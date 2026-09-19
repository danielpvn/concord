import { RnnoiseWorkletNode, loadRnnoise } from '@sapphi-red/web-noise-suppressor';
import rnnoiseWorkletPath from '@sapphi-red/web-noise-suppressor/rnnoiseWorklet.js?url';
import rnnoiseWasmPath from '@sapphi-red/web-noise-suppressor/rnnoise.wasm?url';
import rnnoiseSimdWasmPath from '@sapphi-red/web-noise-suppressor/rnnoise_simd.wasm?url';

// Binário WASM do RNNoise é baixado uma única vez por sessão
let rnnoiseWasmPromise = null;

/**
 * Cria a cadeia de processamento do microfone:
 *   microfone -> [RNNoise (IA)] -> analisador (detector de voz)
 *                               -> gate (ganho) -> faixa enviada no WebRTC
 *
 * Retorna null se o navegador não suportar Web Audio.
 */
export const createMicProcessor = async (rawStream, { aiNoiseSuppression }) => {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;

  let ctx;
  try {
    // RNNoise só funciona a 48 kHz
    ctx = new AudioContextClass({ sampleRate: 48000, latencyHint: 'interactive' });
  } catch (e) {
    ctx = new AudioContextClass();
  }

  const source = ctx.createMediaStreamSource(rawStream);
  let head = source;
  let rnnoise = null;

  if (aiNoiseSuppression && ctx.audioWorklet && ctx.sampleRate === 48000) {
    try {
      rnnoiseWasmPromise = rnnoiseWasmPromise || loadRnnoise({ url: rnnoiseWasmPath, simdUrl: rnnoiseSimdWasmPath });
      const [wasmBinary] = await Promise.all([
        rnnoiseWasmPromise,
        ctx.audioWorklet.addModule(rnnoiseWorkletPath)
      ]);
      rnnoise = new RnnoiseWorkletNode(ctx, { wasmBinary, maxChannels: 1 });
      source.connect(rnnoise);
      head = rnnoise;
    } catch (err) {
      rnnoiseWasmPromise = null;
      console.warn('[Áudio] Supressão de ruído por IA indisponível, usando apenas filtros do navegador:', err);
    }
  }

  const analyser = ctx.createAnalyser();
  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = 0.2;
  head.connect(analyser);

  const gate = ctx.createGain();
  gate.gain.value = 1;
  head.connect(gate);

  const destination = ctx.createMediaStreamDestination();
  gate.connect(destination);

  let gateOpen = true;

  return {
    ctx,
    analyser,
    aiActive: Boolean(rnnoise),
    stream: destination.stream,
    setGateOpen(open) {
      if (open === gateOpen) return;
      gateOpen = open;
      // Abre rápido (não corta o início da fala) e fecha suave
      gate.gain.setTargetAtTime(open ? 1 : 0, ctx.currentTime, open ? 0.005 : 0.06);
    },
    destroy() {
      try {
        rnnoise?.destroy();
      } catch (e) {}
      try {
        source.disconnect();
      } catch (e) {}
      destination.stream.getTracks().forEach(t => t.stop());
      ctx.close().catch(() => {});
    }
  };
};
