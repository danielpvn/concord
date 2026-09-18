import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';

const VoiceContext = createContext(null);

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
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
  const peerConnectionsRef = useRef({}); // socketId -> RTCPeerConnection

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
      if (localStreamRef.current) return localStreamRef.current;

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: false
      });

      localStreamRef.current = stream;

      // Configura AudioContext para medidor de voz e detecção automática de fala
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        const audioCtx = new AudioContext();
        audioContextRef.current = audioCtx;
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
      console.warn('Não foi possível acessar o microfone:', err);
      return null;
    }
  }, [isMuted, user?.isServerMuted, sensitivityThreshold, socket]);

  // Aplica Mute / Server Mute nos tracks de áudio
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
      const [remoteStream] = event.streams;
      if (streamType === 'screen') {
        setRemoteScreenStreams(prev => ({ ...prev, [targetSocketId]: remoteStream }));
      } else {
        setRemoteStreams(prev => ({ ...prev, [targetSocketId]: remoteStream }));
      }
    };

    peerConnectionsRef.current[key] = pc;
    return pc;
  }, [socket]);

  // Inicia chamada WebRTC com usuário recém conectado na sala
  const initiatePeerCall = useCallback(async (targetSocketId, stream, streamType = 'audio') => {
    if (!stream) return;
    const pc = getOrCreatePeerConnection(targetSocketId, streamType);

    stream.getTracks().forEach(track => {
      pc.addTrack(track, stream);
    });

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    if (socket) {
      socket.emit('webrtc_signal', {
        toSocketId: targetSocketId,
        signal: { sdp: pc.localDescription },
        streamType
      });
    }
  }, [getOrCreatePeerConnection, socket]);

  // Processa sinal WebRTC recebido
  const handleWebRTCSignal = useCallback(async ({ fromSocketId, signal, streamType }) => {
    const pc = getOrCreatePeerConnection(fromSocketId, streamType || 'audio');

    if (signal.sdp) {
      await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));

      if (signal.sdp.type === 'offer') {
        const stream = streamType === 'screen' ? screenStream : localStreamRef.current;
        if (stream) {
          stream.getTracks().forEach(track => {
            pc.addTrack(track, stream);
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
      await pc.addIceCandidate(new RTCIceCandidate(signal.candidate)).catch(console.warn);
    }
  }, [getOrCreatePeerConnection, screenStream, socket]);

  // Escuta WebRTC sockets
  useEffect(() => {
    if (!socket) return;

    socket.on('webrtc_signal', handleWebRTCSignal);

    socket.on('user_joined_voice', async ({ socketId }) => {
      if (localStreamRef.current) {
        initiatePeerCall(socketId, localStreamRef.current, 'audio');
      }
      if (screenStream) {
        initiatePeerCall(socketId, screenStream, 'screen');
      }
    });

    socket.on('user_left_voice', ({ socketId }) => {
      ['audio', 'screen'].forEach(type => {
        const key = `${socketId}_${type}`;
        if (peerConnectionsRef.current[key]) {
          peerConnectionsRef.current[key].close();
          delete peerConnectionsRef.current[key];
        }
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

  // Ativa áudio se estiver em canal de voz
  useEffect(() => {
    if (activeChannel?.type === 'voice') {
      initMicrophone();
    }
  }, [activeChannel, initMicrophone]);

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

        // Quando o usuário para o compartilhamento pela barra do navegador
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
        initMicrophone
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
