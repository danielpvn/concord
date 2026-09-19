import React, { useEffect, useRef } from 'react';
import { useVoice } from '../../context/VoiceContext';
import { useSocket } from '../../context/SocketContext';

const isIOS = typeof navigator !== 'undefined' &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

// Contexto de áudio compartilhado, usado só para volume acima de 100% (reforço)
let playbackContext = null;
let playbackSinkId = '';
const getPlaybackContext = (outputDeviceId) => {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!playbackContext || playbackContext.state === 'closed') {
    playbackContext = new AudioContextClass();
    playbackSinkId = '';
  }
  if (playbackContext.state === 'suspended') playbackContext.resume().catch(() => {});
  if ((outputDeviceId || '') !== playbackSinkId && typeof playbackContext.setSinkId === 'function') {
    playbackSinkId = outputDeviceId || '';
    playbackContext.setSinkId(playbackSinkId).catch(() => {});
  }
  return playbackContext;
};

// Reforço (>100%) usa Web Audio. Até 100% fica no <audio> normal, que mantém o cancelamento
// de eco do navegador funcionando para quem usa caixa de som.
const canBoost = (outputDeviceId) => {
  if (isIOS || !(window.AudioContext || window.webkitAudioContext)) return false;
  if (outputDeviceId && !('setSinkId' in (window.AudioContext?.prototype || {}))) return false;
  return true;
};

const RemoteStreamPlayer = ({ stream, volume, muted, outputDeviceId, label }) => {
  const audioRef = useRef(null);
  const gainRef = useRef(null);
  const hasAudio = stream?.getAudioTracks().length > 0;
  const boosted = !muted && volume > 100 && hasAudio && canBoost(outputDeviceId);

  useEffect(() => {
    const audioEl = audioRef.current;
    if (!audioEl || !stream) return;
    audioEl.srcObject = stream;

    const play = () => audioEl.play().catch(() => {
      console.warn(`[Áudio] Autoplay pausado para ${label}. Aguardando interação.`);
    });
    play();

    // Desbloqueia a reprodução caso a política de autoplay do navegador pause no início
    const handleGesture = () => audioEl.play().catch(() => {});
    window.addEventListener('click', handleGesture);
    window.addEventListener('keydown', handleGesture);
    window.addEventListener('touchstart', handleGesture);

    return () => {
      window.removeEventListener('click', handleGesture);
      window.removeEventListener('keydown', handleGesture);
      window.removeEventListener('touchstart', handleGesture);
      audioEl.srcObject = null;
    };
  }, [stream]);

  // Elemento <audio>: toca direto até 100%; no reforço fica mudo (mas tocando, o Chrome
  // precisa disso para entregar o áudio ao Web Audio)
  useEffect(() => {
    const audioEl = audioRef.current;
    if (!audioEl) return;
    audioEl.muted = muted || volume <= 0 || boosted; // no iOS `volume` é somente leitura
    try {
      audioEl.volume = boosted ? 1 : Math.min(1, Math.max(0, volume / 100));
    } catch (e) {}
  }, [muted, volume, boosted]);

  useEffect(() => {
    const audioEl = audioRef.current;
    if (audioEl && typeof audioEl.setSinkId === 'function') {
      audioEl.setSinkId(outputDeviceId || '').catch(err => console.warn('[Áudio] Falha ao trocar saída:', err));
    }
  }, [outputDeviceId]);

  // Reforço de volume (100% a 200%)
  useEffect(() => {
    if (!boosted || !stream) return;
    const ctx = getPlaybackContext(outputDeviceId);
    if (!ctx) return;
    let source;
    let gain;
    try {
      source = ctx.createMediaStreamSource(stream);
      gain = ctx.createGain();
      gain.gain.value = volume / 100;
      source.connect(gain);
      gain.connect(ctx.destination);
      gainRef.current = gain;
    } catch (err) {
      console.warn('[Áudio] Reforço de volume indisponível:', err);
    }
    return () => {
      try { source?.disconnect(); } catch (e) {}
      try { gain?.disconnect(); } catch (e) {}
      gainRef.current = null;
    };
  }, [boosted, stream, outputDeviceId]);

  useEffect(() => {
    if (gainRef.current) gainRef.current.gain.value = volume / 100;
  }, [volume]);

  return <audio ref={audioRef} autoPlay playsInline data-label={label} />;
};

export const RemoteAudioRenderer = () => {
  const {
    remoteStreams,
    remoteScreenStreams,
    userVolumes,
    mutedUsers,
    screenVolumes,
    mutedScreens,
    isDeafened,
    outputDeviceId
  } = useVoice();
  const { onlineUsers } = useSocket();

  const userOf = (socketId) => onlineUsers?.find(u => u.socketId === socketId);

  const voices = Object.entries(remoteStreams || {});
  const screens = Object.entries(remoteScreenStreams || {}).filter(([, stream]) => stream.getAudioTracks().length > 0);
  if (voices.length === 0 && screens.length === 0) return null;

  return (
    <div style={{ position: 'fixed', top: -9999, left: -9999, width: 1, height: 1, opacity: 0, pointerEvents: 'none' }} aria-hidden="true">
      {voices.map(([socketId, stream]) => {
        const remoteUser = userOf(socketId);
        const userId = remoteUser?.userId;
        return (
          <RemoteStreamPlayer
            key={`voice-${socketId}`}
            label={remoteUser?.username || socketId}
            stream={stream}
            volume={userVolumes?.[userId] ?? 100}
            muted={isDeafened || Boolean(userId && mutedUsers?.[userId])}
            outputDeviceId={outputDeviceId}
          />
        );
      })}
      {screens.map(([socketId, stream]) => {
        const remoteUser = userOf(socketId);
        const userId = remoteUser?.userId;
        return (
          <RemoteStreamPlayer
            key={`screen-${socketId}`}
            label={`tela de ${remoteUser?.username || socketId}`}
            stream={stream}
            volume={screenVolumes?.[userId] ?? 100}
            muted={isDeafened || Boolean(userId && mutedScreens?.[userId])}
            outputDeviceId={outputDeviceId}
          />
        );
      })}
    </div>
  );
};
