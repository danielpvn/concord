// Sons de notificação sintetizados com Web Audio (sem arquivos para baixar)

const STORAGE_KEY = 'concord_sounds_enabled';
const VOLUME_KEY = 'concord_sounds_volume';
const MESSAGE_KEY = 'concord_message_sounds_enabled';

let ctx = null;
let outputDeviceId = '';

const getContext = () => {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!ctx || ctx.state === 'closed') {
    ctx = new AudioContextClass();
    applyOutputDevice();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
};

const applyOutputDevice = () => {
  if (ctx && typeof ctx.setSinkId === 'function') {
    ctx.setSinkId(outputDeviceId || '').catch(() => {});
  }
};

export const setSoundsOutputDevice = (deviceId) => {
  outputDeviceId = deviceId || '';
  applyOutputDevice();
};

export const areSoundsEnabled = () => localStorage.getItem(STORAGE_KEY) !== '0';
export const setSoundsEnabled = (enabled) => localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
// Som de mensagens pode ser silenciado separadamente dos sons de entrar/sair/tela
export const areMessageSoundsEnabled = () => localStorage.getItem(MESSAGE_KEY) !== '0';
export const setMessageSoundsEnabled = (enabled) => {
  localStorage.setItem(MESSAGE_KEY, enabled ? '1' : '0');
  window.dispatchEvent(new Event('concord-sound-settings'));
};

export const getSoundsVolume = () => {
  const value = parseInt(localStorage.getItem(VOLUME_KEY) || '60', 10);
  return Number.isFinite(value) ? value : 60;
};
export const setSoundsVolume = (value) => localStorage.setItem(VOLUME_KEY, String(value));

// Cada nota: [frequência em Hz, início em s, duração em s]
const SOUNDS = {
  join: { type: 'sine', notes: [[523.25, 0, 0.12], [783.99, 0.09, 0.18]] },
  leave: { type: 'sine', notes: [[783.99, 0, 0.12], [523.25, 0.09, 0.2]] },
  screenStart: { type: 'triangle', notes: [[659.25, 0, 0.09], [880, 0.07, 0.09], [1174.66, 0.14, 0.16]] },
  screenStop: { type: 'triangle', notes: [[1174.66, 0, 0.09], [880, 0.07, 0.09], [659.25, 0.14, 0.16]] },
  message: { type: 'sine', notes: [[987.77, 0, 0.07], [1318.51, 0.06, 0.14]] },
  mute: { type: 'sine', notes: [[440, 0, 0.08]] },
  unmute: { type: 'sine', notes: [[660, 0, 0.08]] }
};

let lastPlayed = {};

export const playSound = (name) => {
  if (!areSoundsEnabled()) return;
  if (name === 'message' && !areMessageSoundsEnabled()) return;
  const sound = SOUNDS[name];
  if (!sound) return;

  // Evita empilhar o mesmo som várias vezes (ex.: várias mensagens de uma vez)
  const now = Date.now();
  if (lastPlayed[name] && now - lastPlayed[name] < 150) return;
  lastPlayed[name] = now;

  const audio = getContext();
  if (!audio) return;

  const master = audio.createGain();
  master.gain.value = (getSoundsVolume() / 100) * 0.25;
  master.connect(audio.destination);

  const start = audio.currentTime + 0.01;
  sound.notes.forEach(([freq, offset, duration]) => {
    const osc = audio.createOscillator();
    const env = audio.createGain();
    osc.type = sound.type;
    osc.frequency.value = freq;
    env.gain.setValueAtTime(0, start + offset);
    env.gain.linearRampToValueAtTime(1, start + offset + 0.01);
    env.gain.exponentialRampToValueAtTime(0.001, start + offset + duration);
    osc.connect(env);
    env.connect(master);
    osc.start(start + offset);
    osc.stop(start + offset + duration + 0.02);
  });
};
