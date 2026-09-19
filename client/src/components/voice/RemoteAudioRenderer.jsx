import React, { useEffect, useRef } from 'react';
import { useVoice } from '../../context/VoiceContext';
import { useSocket } from '../../context/SocketContext';

const RemoteAudioTrack = ({ socketId, stream, userVolumes, isDeafened, onlineUsers, outputDeviceId }) => {
  const audioRef = useRef(null);

  const remoteUser = onlineUsers?.find(u => u.socketId === socketId);
  const rawVolume = remoteUser ? (userVolumes?.[remoteUser.userId] ?? 100) : 100;
  // Volume normalizado de 0.0 a 1.0 para o elemento HTMLAudioElement
  const normalizedVolume = isDeafened ? 0 : Math.min(1, Math.max(0, rawVolume / 100));
  // No iOS, `volume` é somente leitura: usamos `muted` para ensurdecer / volume zero
  const shouldMute = isDeafened || rawVolume <= 0;

  useEffect(() => {
    const audioEl = audioRef.current;
    if (!audioEl || !stream) return;

    audioEl.srcObject = stream;
    audioEl.muted = shouldMute;
    try {
      audioEl.volume = normalizedVolume;
    } catch (e) {}

    const playAudio = () => {
      const promise = audioEl.play();
      if (promise !== undefined) {
        promise.catch(err => {
          console.warn(`[Áudio] Autoplay pausado para ${remoteUser?.username || socketId}. Aguardando interação.`);
        });
      }
    };

    playAudio();

    // Desbloqueia reprodução caso a política de autoplay do navegador pause inicialmente
    const handleGesture = () => {
      if (audioEl) {
        audioEl.play().catch(console.warn);
      }
    };

    window.addEventListener('click', handleGesture);
    window.addEventListener('keydown', handleGesture);
    window.addEventListener('touchstart', handleGesture);

    return () => {
      window.removeEventListener('click', handleGesture);
      window.removeEventListener('keydown', handleGesture);
      window.removeEventListener('touchstart', handleGesture);
      if (audioEl) {
        audioEl.srcObject = null;
      }
    };
  }, [stream]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = shouldMute;
      try {
        audioRef.current.volume = normalizedVolume;
      } catch (e) {}
    }
  }, [normalizedVolume, shouldMute]);

  // Dispositivo de saída escolhido nas configurações (Chrome/Edge/Electron)
  useEffect(() => {
    const audioEl = audioRef.current;
    if (audioEl && typeof audioEl.setSinkId === 'function') {
      audioEl.setSinkId(outputDeviceId || '').catch(err => console.warn('[Áudio] Falha ao trocar saída:', err));
    }
  }, [outputDeviceId]);

  return (
    <audio
      ref={audioRef}
      autoPlay
      playsInline
      data-socket-id={socketId}
      style={{ position: 'fixed', top: -9999, left: -9999, width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
    />
  );
};

export const RemoteAudioRenderer = () => {
  const { remoteStreams, userVolumes, isDeafened, outputDeviceId } = useVoice();
  const { onlineUsers } = useSocket();

  const entries = Object.entries(remoteStreams || {});
  if (entries.length === 0) return null;

  return (
    <div style={{ position: 'fixed', top: -9999, left: -9999, width: 1, height: 1, opacity: 0, pointerEvents: 'none' }} aria-hidden="true">
      {entries.map(([socketId, stream]) => (
        <RemoteAudioTrack
          key={socketId}
          socketId={socketId}
          stream={stream}
          userVolumes={userVolumes}
          isDeafened={isDeafened}
          onlineUsers={onlineUsers}
          outputDeviceId={outputDeviceId}
        />
      ))}
    </div>
  );
};
