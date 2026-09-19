import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';

const VoiceContext = createContext(null);

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:stun.services.mozilla.com' },
    { urls: 'stun:stun.cloudflare.com:3478' }
  ],
  iceCandidatePoolSize: 10
};

export const VoiceProvider = ({ children }) => {
  const { user } = useAuth();
  const { socket, activeChannelId, activeChannel } = useSocket();

  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [micLevel, setMicLevel] = useState(0); // 0 a 100 para barra de teste
  const [sensitivityThreshold, setSensitivityThreshold] = useState(() => {
    return parseInt(localStorage.getItem('concord_voice_sensitivity') || '25', 10);
  });

  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenStream, setScreenStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({}); // socketId -> MediaStream
  const [remoteScreenStreams, setRemoteScreenStreams] = useState({}); // socketId -> MediaStream

  // Volumes individuais por usuário (0 a 200%)
  const [userVolumes, setUserVolumes] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('concord_user_volumes') || '{}');
    } catch {
      return {};
    }
  });

  const localStreamRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);
  const peerConnectionsRef = useRef({}); // socketId_streamType -> RTCPeerConnection
  const pendingIceCandidatesRef = useRef({}); // socketId_streamType -> [candidate, ...]

  // Salva sensibilidade
  const updateSensitivity = (val) => {
    setSensitivityThreshold(val);
    localStorage.setItem('concord_voice_sensitivity', val.toString());
  };

  // Salva volume de um usuário individual
  const setUserVolume = (userId, volume) => {
    setUserVolumes(prev => {
      const updated = { ...prev, [userId]: volume };
      localStorage.setItem('concord_user_volumes', JSON.stringify(updated));
      return updated;
    });
  };

  // Inicializa captura de microfone local e analisador de voz (VAD)
  const initMicrophone = useCallback(async () => {
    try {
      if (localStreamRef.current && localStreamRef.current.active) {
        return localStreamRef.current;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: false
      });

      localStreamRef.current = stream;

      // Se houver conexões WebRTC ativas aguardando microfone, atualiza os senders
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        Object.entries(peerConnectionsRef.current).forEach(([key, pc]) => {
          if (key.endsWith('_audio')) {
            const senders = pc.getSenders();
            const sender = senders.find(s => s.track && s.track.kind === 'audio');
            if (sender) {
              sender.replaceTrack(audioTrack).catch(console.warn);
            } else {
              try {
                pc.addTrack(audioTrack, stream);
              } catch (e) {
                console.warn('Aviso ao anexar faixa em conexão existente:', e);
              }
            }
          }
        });
      }

      // Configura AudioContext para medidor de voz e detecção automática de fala
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
          audioContextRef.current = new AudioContextClass();
        }
        const audioCtx = audioContextRef.current;

        if (audioCtx.state === 'suspended') {
          audioCtx.resume().catch(console.warn);
        }

        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        analyserRef.current = analyser;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const checkAudioLevel = () => {
          if (!analyserRef.current) return;
          analyserRef.current.getByteFrequencyData(dataArray);

          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const average = sum / dataArray.length;
          const levelPercent = Math.min(100, Math.round((average / 128) * 100));
          setMicLevel(levelPercent);

          const effectivelyMuted = isMuted || user?.isServerMuted;
          const speakingNow = !effectivelyMuted && levelPercent > sensitivityThreshold;

          setIsSpeaking(prev => {
            if (prev !== speakingNow && socket) {
              socket.emit('update_voice_state', { isSpeaking: speakingNow });
            }
            return speakingNow;
          });

          animationFrameRef.current = requestAnimationFrame(checkAudioLevel);
        };

        checkAudioLevel();
      }

      return stream;
    } catch (err) {
      console.warn('Não foi possível acessar o microfone (modo ouvinte ativado):', err);
      return null;
    }
  }, [isMuted, user?.isServerMuted, sensitivityThreshold, socket]);

  // Aplica Mute / Server Mute nas faixas locais de áudio
  useEffect(() => {
    const effectivelyMuted = isMuted || user?.isServerMuted;
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !effectivelyMuted;
      });
    }

    if (socket) {
      socket.emit('update_voice_state', {
        isMuted: effectivelyMuted,
        isDeafened,
        isSpeaking: false
      });
    }
  }, [isMuted, user?.isServerMuted, isDeafened, socket]);

  // Cria ou recupera PeerConnection WebRTC com um usuário
  const getOrCreatePeerConnection = useCallback((targetSocketId, streamType = 'audio') => {
    const key = `${targetSocketId}_${streamType}`;
    if (peerConnectionsRef.current[key]) {
      return peerConnectionsRef.current[key];
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('webrtc_signal', {
          toSocketId: targetSocketId,
          signal: { candidate: event.candidate },
          streamType
        });
      }
    };

    pc.ontrack = (event) => {
      console.log(`🔊 [WebRTC] Fluxo de áudio recebido de ${targetSocketId} (${streamType})`);
      const [remoteStream] = event.streams;
      const streamToUse = remoteStream || new MediaStream([event.track]);
      if (streamType === 'screen') {
        setRemoteScreenStreams(prev => ({ ...prev, [targetSocketId]: streamToUse }));
      } else {
        setRemoteStreams(prev => ({ ...prev, [targetSocketId]: streamToUse }));
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`📡 [WebRTC] Conexão com ${targetSocketId} (${streamType}): ${pc.connectionState}`);
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`🧊 [WebRTC] ICE com ${targetSocketId} (${streamType}): ${pc.iceConnectionState}`);
    };

    peerConnectionsRef.current[key] = pc;
    return pc;
  }, [socket]);

  // Inicia chamada WebRTC com usuário recém conectado na sala
  const initiatePeerCall = useCallback(async (targetSocketId, stream, streamType = 'audio') => {
    let activeStream = stream;
    if (!activeStream && streamType === 'audio') {
      try {
        activeStream = await initMicrophone();
      } catch (e) {
        console.warn('Microfone não disponível de imediato:', e);
      }
    }

    const pc = getOrCreatePeerConnection(targetSocketId, streamType);

    if (activeStream) {
      const senders = pc.getSenders();
      activeStream.getTracks().forEach(track => {
        const alreadyAdded = senders.some(s => s.track && s.track.id === track.id);
        if (!alreadyAdded) {
          pc.addTrack(track, activeStream);
        }
      });
    } else if (streamType === 'audio') {
      // Modo ouvinte (recvonly): permite escutar os amigos mesmo sem microfone local
      const transceivers = pc.getTransceivers();
      if (!transceivers.some(t => t.receiver && t.receiver.track && t.receiver.track.kind === 'audio')) {
        pc.addTransceiver('audio', { direction: 'recvonly' });
      }
    }

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      if (socket) {
        socket.emit('webrtc_signal', {
          toSocketId: targetSocketId,
          signal: { sdp: pc.localDescription },
          streamType
        });
      }
    } catch (err) {
      console.error(`Erro ao criar oferta WebRTC para ${targetSocketId}:`, err);
    }
  }, [getOrCreatePeerConnection, socket, initMicrophone]);

  // Processa sinal WebRTC recebido (Offer, Answer ou ICE Candidate)
  const handleWebRTCSignal = useCallback(async ({ fromSocketId, signal, streamType }) => {
    const key = `${fromSocketId}_${streamType || 'audio'}`;
    const pc = getOrCreatePeerConnection(fromSocketId, streamType || 'audio');

    try {
      if (signal.sdp) {
        await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));

        // Processa candidatos ICE pendentes que chegaram antes do setRemoteDescription
        if (pendingIceCandidatesRef.current[key] && pendingIceCandidatesRef.current[key].length > 0) {
          const queued = pendingIceCandidatesRef.current[key];
          pendingIceCandidatesRef.current[key] = [];
          for (const cand of queued) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(cand));
            } catch (err) {
              console.warn('Erro ao processar ICE candidate enfileirado:', err);
            }
          }
        }

        if (signal.sdp.type === 'offer') {
          let stream = streamType === 'screen' ? screenStream : localStreamRef.current;
          if (!stream && streamType !== 'screen') {
            try {
              stream = await initMicrophone();
            } catch (e) {
              console.warn('Não foi possível obter microfone ao responder oferta:', e);
            }
          }

          if (stream) {
            const senders = pc.getSenders();
            stream.getTracks().forEach(track => {
              const alreadyAdded = senders.some(s => s.track && s.track.id === track.id);
              if (!alreadyAdded) {
                pc.addTrack(track, stream);
              }
            });
          }

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          if (socket) {
            socket.emit('webrtc_signal', {
              toSocketId: fromSocketId,
              signal: { sdp: pc.localDescription },
              streamType: streamType || 'audio'
            });
          }
        }
      } else if (signal.candidate) {
        if (pc.remoteDescription && pc.remoteDescription.type) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
          } catch (err) {
            console.warn('Erro ao adicionar ICE candidate recebido:', err);
          }
        } else {
          if (!pendingIceCandidatesRef.current[key]) {
            pendingIceCandidatesRef.current[key] = [];
          }
          pendingIceCandidatesRef.current[key].push(signal.candidate);
        }
      }
    } catch (err) {
      console.error(`Erro ao processar sinal WebRTC de ${fromSocketId}:`, err);
    }
  }, [getOrCreatePeerConnection, screenStream, socket, initMicrophone]);

  // Limpeza de conexões e recursos de voz
  const cleanupVoiceConnections = useCallback(() => {
    Object.values(peerConnectionsRef.current).forEach(pc => {
      try {
        pc.close();
      } catch (e) {}
    });
    peerConnectionsRef.current = {};
    pendingIceCandidatesRef.current = {};
    setRemoteStreams({});
    setRemoteScreenStreams({});
    setIsSpeaking(false);
  }, []);

  // Escuta WebRTC sockets
  useEffect(() => {
    if (!socket) return;

    socket.on('webrtc_signal', handleWebRTCSignal);

    socket.on('user_joined_voice', async ({ socketId }) => {
      console.log(`👤 Amigo entrou na sala de voz: ${socketId}`);
      if (localStreamRef.current) {
        initiatePeerCall(socketId, localStreamRef.current, 'audio');
      } else {
        initiatePeerCall(socketId, null, 'audio');
      }

      if (screenStream) {
        initiatePeerCall(socketId, screenStream, 'screen');
      }
    });

    socket.on('user_left_voice', ({ socketId }) => {
      console.log(`🚪 Amigo saiu da sala de voz: ${socketId}`);
      ['audio', 'screen'].forEach(type => {
        const key = `${socketId}_${type}`;
        if (peerConnectionsRef.current[key]) {
          try {
            peerConnectionsRef.current[key].close();
          } catch (e) {}
          delete peerConnectionsRef.current[key];
        }
        delete pendingIceCandidatesRef.current[key];
      });

      setRemoteStreams(prev => {
        const next = { ...prev };
        delete next[socketId];
        return next;
      });

      setRemoteScreenStreams(prev => {
        const next = { ...prev };
        delete next[socketId];
        return next;
      });
    });

    return () => {
      socket.off('webrtc_signal', handleWebRTCSignal);
      socket.off('user_joined_voice');
      socket.off('user_left_voice');
    };
  }, [socket, handleWebRTCSignal, initiatePeerCall, screenStream]);

  // Ativa áudio se estiver em canal de voz, ou limpa se sair
  useEffect(() => {
    if (activeChannel?.type === 'voice') {
      initMicrophone();
    } else {
      cleanupVoiceConnections();
    }
  }, [activeChannel, initMicrophone, cleanupVoiceConnections]);

  // Desbloqueio global de política de Autoplay / AudioContext suspenso
  useEffect(() => {
    const resumeAudio = () => {
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume().catch(console.warn);
      }
    };
    window.addEventListener('click', resumeAudio);
    window.addEventListener('keydown', resumeAudio);
    window.addEventListener('touchstart', resumeAudio);
    return () => {
      window.removeEventListener('click', resumeAudio);
      window.removeEventListener('keydown', resumeAudio);
      window.removeEventListener('touchstart', resumeAudio);
    };
  }, []);

  // Iniciar / Parar Compartilhamento de Tela (com áudio do sistema)
  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      if (screenStream) {
        screenStream.getTracks().forEach(track => track.stop());
      }
      setScreenStream(null);
      setIsScreenSharing(false);
      if (socket) socket.emit('update_screen_state', { isScreenSharing: false });
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            cursor: 'always',
            frameRate: { ideal: 60, max: 60 },
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          },
          audio: true // Captura o som do jogo/sistema
        });

        stream.getVideoTracks()[0].onended = () => {
          setScreenStream(null);
          setIsScreenSharing(false);
          if (socket) socket.emit('update_screen_state', { isScreenSharing: false });
        };

        setScreenStream(stream);
        setIsScreenSharing(true);
        if (socket) socket.emit('update_screen_state', { isScreenSharing: true });
      } catch (err) {
        console.warn('Compartilhamento de tela cancelado:', err);
      }
    }
  };

  const toggleMute = () => setIsMuted(prev => !prev);
  const toggleDeafen = () => setIsDeafened(prev => !prev);

  return (
    <VoiceContext.Provider
      value={{
        isMuted,
        isDeafened,
        isSpeaking,
        micLevel,
        sensitivityThreshold,
        updateSensitivity,
        userVolumes,
        setUserVolume,
        isScreenSharing,
        screenStream,
        remoteStreams,
        remoteScreenStreams,
        toggleMute,
        toggleDeafen,
        toggleScreenShare,
        initMicrophone,
        cleanupVoiceConnections
      }}
    >
      {children}
    </VoiceContext.Provider>
  );
};

export const useVoice = () => {
  const context = useContext(VoiceContext);
  if (!context) {
    throw new Error('useVoice deve ser usado dentro de um VoiceProvider');
  }
  return context;
};
