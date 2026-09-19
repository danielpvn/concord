import React, { useEffect, useRef } from 'react';
import { useVoice } from '../../context/VoiceContext';
import { useSocket } from '../../context/SocketContext';

const RemoteAudioTrack = ({ socketId, stream, userVolumes, isDeafened, onlineUsers }) => {
  const audioRef = useRef(null);

  const remoteUser = onlineUsers?.find(u => u.socketId === socketId);
  const rawVolume = remoteUser ? (userVolumes?.[remoteUser.userId] ?? 100) : 100;
  // Volume normalizado de 0.0 a 1.0 para o elemento HTMLAudioElement
  const normalizedVolume = isDeafened ? 0 : Math.min(1, Math.max(0, rawVolume / 100));

  useEffect(() => {
    const audioEl = audioRef.current;
    if (!audioEl || !stream) return;

    audioEl.srcObject = stream;
    audioEl.volume = normalizedVolume;

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
      if (audioEl && audioEl.paused) {
        audioEl.play().catch(console.warn);
      }
    };

    window.addEventListener('click', handleGesture, { once: true });
    window.addEventListener('keydown', handleGesture, { once: true });
    window.addEventListener('touchstart', handleGesture, { once: true });

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
      audioRef.current.volume = normalizedVolume;
    }
  }, [normalizedVolume]);

  return (
    <audio
      ref={audioRef}
      autoPlay
      playsInline
      className="hidden"
      data-socket-id={socketId}
    />
  );
};

export const RemoteAudioRenderer = () => {
  const { remoteStreams, userVolumes, isDeafened } = useVoice();
  const { onlineUsers } = useSocket();

  const entries = Object.entries(remoteStreams || {});
  if (entries.length === 0) return null;

  return (
    <div className="hidden" aria-hidden="true">
      {entries.map(([socketId, stream]) => (
        <RemoteAudioTrack
          key={socketId}
          socketId={socketId}
          stream={stream}
          userVolumes={userVolumes}
          isDeafened={isDeafened}
          onlineUsers={onlineUsers}
        />
      ))}
    </div>
  );
};
