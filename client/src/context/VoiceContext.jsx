import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';
import { apiFetch } from '../services/api';

const VoiceContext = createContext(null);

// STUN padrão. Servidores TURN (necessários para 4G / NAT simétrico) vêm de /api/ice-servers
const DEFAULT_ICE_SERVERS = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  { urls: 'stun:stun.cloudflare.com:3478' }
];

// Tipos de conexão por amigo:
//  - 'audio':       voz bidirecional
//  - 'screen':      EU transmito minha tela para o amigo
//  - 'screen-view': EU assisto a tela do amigo
// O streamType enviado no sinal é o tipo do lado de quem envia; o receptor converte para o seu.
const LOCAL_TYPE_FOR_INCOMING = { audio: 'audio', screen: 'screen-view', 'screen-view': 'screen' };

const peerKey = (type, socketId) => `${type}|${socketId}`;

export const VoiceProvider = ({ children }) => {
  const { user } = useAuth();
  const { socket, activeChannelId, activeChannel, onlineUsers } = useSocket();

  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [micLevel, setMicLevel] = useState(0); // 0 a 100 para barra de teste
  const [micError, setMicError] = useState(null);
  const [sensitivityThreshold, setSensitivityThreshold] = useState(() => {
    return parseInt(localStorage.getItem('concord_voice_sensitivity') || '25', 10);
  });

  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenStream, setScreenStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({}); // socketId -> MediaStream
  const [remoteScreenStreams, setRemoteScreenStreams] = useState({}); // socketId -> MediaStream
  const [peerStates, setPeerStates] = useState({}); // socketId -> connectionState (áudio)

  // Volumes individuais por usuário (0 a 200%)
  const [userVolumes, setUserVolumes] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('concord_user_volumes') || '{}');
    } catch {
      return {};
    }
  });

  const localStreamRef = useRef(null);
  const micPromiseRef = useRef(null);
  const screenStreamRef = useRef(null);
  const audioContextRef = useRef(null);
  const vadIntervalRef = useRef(null);
  const peersRef = useRef(new Map()); // peerKey -> { pc, socketId, type, polite, makingOffer, ignoreOffer, queue, tracks }
  const iceServersRef = useRef(DEFAULT_ICE_SERVERS);

  const socketRef = useRef(socket);
  const isMutedRef = useRef(isMuted);
  const isServerMutedRef = useRef(user?.isServerMuted);
  const sensitivityThresholdRef = useRef(sensitivityThreshold);
  const inVoiceRef = useRef(false);
  const roomPeersRef = useRef([]);

  const inVoice = activeChannel?.type === 'voice';

  useEffect(() => { socketRef.current = socket; }, [socket]);
  useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);
  useEffect(() => { isServerMutedRef.current = user?.isServerMuted; }, [user?.isServerMuted]);
  useEffect(() => { sensitivityThresholdRef.current = sensitivityThreshold; }, [sensitivityThreshold]);
  useEffect(() => { inVoiceRef.current = inVoice; }, [inVoice]);
  useEffect(() => {
    roomPeersRef.current = onlineUsers
      .filter(u => u.channelId === activeChannelId && u.socketId !== socket?.id)
      .map(u => u.socketId);
  }, [onlineUsers, activeChannelId, socket?.id]);

  // Busca servidores ICE (inclui TURN se configurado no servidor)
  useEffect(() => {
    if (!user) return;
    apiFetch('/ice-servers')
      .then(data => {
        if (Array.isArray(data?.iceServers) && data.iceServers.length) {
          iceServersRef.current = data.iceServers;
        }
        if (!data?.hasTurn) {
          console.warn('⚠️ [WebRTC] Nenhum servidor TURN configurado: amigos em redes móveis/NAT restritivo podem não se conectar.');
        }
      })
      .catch(err => console.warn('Não foi possível obter servidores ICE:', err));
  }, [user]);

  // Salva sensibilidade
  const updateSensitivity = (val) => {
    setSensitivityThreshold(val);
    sensitivityThresholdRef.current = val;
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

  // ---------------------------------------------------------------------------
  // Conexões WebRTC (padrão "perfect negotiation")
  // ---------------------------------------------------------------------------

  const sendSignal = (peer, signal) => {
    socketRef.current?.emit('webrtc_signal', {
      toSocketId: peer.socketId,
      signal,
      streamType: peer.type
    });
  };

  const publishRemoteStream = (peer) => {
    const stream = new MediaStream(peer.tracks.filter(t => t.readyState === 'live'));
    const setter = peer.type === 'audio' ? setRemoteStreams : setRemoteScreenStreams;
    setter(prev => ({ ...prev, [peer.socketId]: stream }));
  };

  const removeRemoteStream = (type, socketId) => {
    const setter = type === 'audio' ? setRemoteStreams : type === 'screen-view' ? setRemoteScreenStreams : null;
    if (!setter) return;
    setter(prev => {
      if (!(socketId in prev)) return prev;
      const next = { ...prev };
      delete next[socketId];
      return next;
    });
  };

  const closePeer = useCallback((type, socketId) => {
    const key = peerKey(type, socketId);
    const peer = peersRef.current.get(key);
    if (!peer) return;
    peersRef.current.delete(key);
    try {
      peer.pc.close();
    } catch (e) {}
    removeRemoteStream(type, socketId);
    if (type === 'audio') {
      setPeerStates(prev => {
        const next = { ...prev };
        delete next[socketId];
        return next;
      });
    }
  }, []);

  const closeAllPeers = useCallback(() => {
    Array.from(peersRef.current.values()).forEach(p => closePeer(p.type, p.socketId));
  }, [closePeer]);

  // Coloca (ou troca) a faixa do microfone na conexão de áudio; sem microfone, entra em modo ouvinte
  const attachLocalAudio = async (peer) => {
    const { pc } = peer;
    if (pc.signalingState === 'closed') return;
    const stream = localStreamRef.current;
    const track = stream?.getAudioTracks()[0];
    const transceiver = pc.getTransceivers().find(t => t.receiver.track?.kind === 'audio');

    if (!track) {
      if (!transceiver) pc.addTransceiver('audio', { direction: 'recvonly' });
      return;
    }

    if (transceiver) {
      if (transceiver.sender.track !== track) {
        await transceiver.sender.replaceTrack(track);
      }
      try {
        transceiver.sender.setStreams?.(stream);
      } catch (e) {}
      if (transceiver.direction === 'recvonly' || transceiver.direction === 'inactive') {
        transceiver.direction = 'sendrecv'; // dispara renegociação automaticamente
      }
    } else {
      pc.addTrack(track, stream);
    }
  };

  const createPeer = (socketId, type) => {
    const pc = new RTCPeerConnection({ iceServers: iceServersRef.current, iceCandidatePoolSize: 2 });
    const peer = {
      pc,
      socketId,
      type,
      // Um lado "educado" cede em caso de colisão de ofertas; o critério é determinístico entre os dois lados
      polite: (socketRef.current?.id || '') > socketId,
      makingOffer: false,
      ignoreOffer: false,
      queue: Promise.resolve(),
      tracks: []
    };
    peersRef.current.set(peerKey(type, socketId), peer);

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) sendSignal(peer, { candidate });
    };

    pc.onnegotiationneeded = async () => {
      try {
        peer.makingOffer = true;
        await pc.setLocalDescription();
        sendSignal(peer, { description: pc.localDescription });
      } catch (err) {
        console.warn(`[WebRTC] Falha ao negociar com ${socketId} (${type}):`, err);
      } finally {
        peer.makingOffer = false;
      }
    };

    pc.ontrack = ({ track }) => {
      console.log(`🔊 [WebRTC] Faixa ${track.kind} recebida de ${socketId} (${type})`);
      if (!peer.tracks.includes(track)) peer.tracks.push(track);
      track.addEventListener('ended', () => {
        peer.tracks = peer.tracks.filter(t => t !== track);
        if (peersRef.current.get(peerKey(type, socketId)) === peer) publishRemoteStream(peer);
      });
      publishRemoteStream(peer);
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      console.log(`📡 [WebRTC] ${socketId} (${type}): ${state}`);
      if (type === 'audio') {
        setPeerStates(prev => ({ ...prev, [socketId]: state }));
      }
      if (state === 'failed') {
        // Tenta novamente com novos candidatos ICE (útil ao trocar Wi-Fi/4G)
        try {
          pc.restartIce();
        } catch (e) {}
      }
    };

    return peer;
  };

  const processSignal = async (peer, signal) => {
    const { pc } = peer;
    if (pc.signalingState === 'closed') return;

    if (signal.description) {
      const description = signal.description;
      const offerCollision =
        description.type === 'offer' && (peer.makingOffer || pc.signalingState !== 'stable');
      peer.ignoreOffer = !peer.polite && offerCollision;
      if (peer.ignoreOffer) return;

      await pc.setRemoteDescription(description);

      if (description.type === 'offer') {
        if (peer.type === 'audio') {
          await attachLocalAudio(peer);
        }
        await pc.setLocalDescription();
        sendSignal(peer, { description: pc.localDescription });
      }
    } else if (signal.candidate) {
      try {
        await pc.addIceCandidate(signal.candidate);
      } catch (err) {
        if (!peer.ignoreOffer) console.warn('[WebRTC] Erro ao adicionar ICE candidate:', err);
      }
    }
  };

  const handleWebRTCSignal = useCallback(({ fromSocketId, signal, streamType }) => {
    if (!fromSocketId || !signal) return;
    const type = LOCAL_TYPE_FOR_INCOMING[streamType || 'audio'];
    if (!type) return;

    let peer = peersRef.current.get(peerKey(type, fromSocketId));
    if (!peer) {
      // Só aceitamos novas conexões a partir de uma oferta
      if (signal.description?.type !== 'offer') return;
      if (type === 'screen') return; // não estou mais transmitindo
      if (!inVoiceRef.current) return;
      peer = createPeer(fromSocketId, type);
    }

    // Processa sinais em ordem (evita adicionar ICE antes da descrição remota)
    peer.queue = peer.queue
      .then(() => processSignal(peer, signal))
      .catch(err => console.warn(`[WebRTC] Erro ao processar sinal de ${fromSocketId} (${type}):`, err));
  }, []);

  // Eu inicio a conexão de voz com um amigo que acabou de entrar
  const connectAudioPeer = useCallback(async (socketId) => {
    closePeer('audio', socketId);
    const peer = createPeer(socketId, 'audio');
    // Aguarda o microfone se ainda estiver sendo obtido, para já oferecer a faixa
    if (micPromiseRef.current) {
      await micPromiseRef.current.catch(() => null);
    }
    if (peersRef.current.get(peerKey('audio', socketId)) !== peer) return;
    await attachLocalAudio(peer); // dispara onnegotiationneeded -> oferta
  }, [closePeer]);

  const connectScreenPeer = useCallback((socketId) => {
    const stream = screenStreamRef.current;
    if (!stream) return;
    closePeer('screen', socketId);
    const peer = createPeer(socketId, 'screen');
    stream.getTracks().forEach(track => peer.pc.addTrack(track, stream));
  }, [closePeer]);

  // ---------------------------------------------------------------------------
  // Microfone e detector de voz
  // ---------------------------------------------------------------------------

  const stopVoiceActivity = () => {
    if (vadIntervalRef.current) {
      clearInterval(vadIntervalRef.current);
      vadIntervalRef.current = null;
    }
  };

  const startVoiceActivity = (stream) => {
    stopVoiceActivity();
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
      audioContextRef.current = new AudioContextClass();
    }
    const audioCtx = audioContextRef.current;
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }

    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.2;
    source.connect(analyser);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    let lastLevel = -1;
    let speaking = false;
    let lastLoudAt = 0;

    // Intervalo (em vez de requestAnimationFrame) para não re-renderizar a app 60x por segundo
    vadIntervalRef.current = setInterval(() => {
      analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
      const levelPercent = Math.min(100, Math.round((sum / dataArray.length / 128) * 100));

      if (Math.abs(levelPercent - lastLevel) >= 2) {
        lastLevel = levelPercent;
        setMicLevel(levelPercent);
      }

      const effectivelyMuted = isMutedRef.current || isServerMutedRef.current;
      const now = Date.now();
      if (!effectivelyMuted && levelPercent > sensitivityThresholdRef.current) lastLoudAt = now;
      // Segura o indicador por 300ms para não piscar entre sílabas
      const speakingNow = !effectivelyMuted && now - lastLoudAt < 300;

      if (speakingNow !== speaking) {
        speaking = speakingNow;
        setIsSpeaking(speakingNow);
        socketRef.current?.emit('update_voice_state', { isSpeaking: speakingNow });
      }
    }, 80);
  };

  const initMicrophone = useCallback(async () => {
    if (localStreamRef.current && localStreamRef.current.active) {
      return localStreamRef.current;
    }
    if (micPromiseRef.current) return micPromiseRef.current;

    if (!navigator.mediaDevices?.getUserMedia) {
      setMicError('Seu navegador não permite acesso ao microfone (é necessário HTTPS).');
      return null;
    }

    micPromiseRef.current = (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            googEchoCancellation: true,
            googAutoGainControl: true,
            googNoiseSuppression: true,
            googHighpassFilter: true,
            channelCount: 1
          },
          video: false
        });

        // Saiu da sala enquanto o navegador pedia permissão
        if (!inVoiceRef.current) {
          stream.getTracks().forEach(t => t.stop());
          return null;
        }

        const track = stream.getAudioTracks()[0];
        if (track) track.enabled = !(isMutedRef.current || isServerMutedRef.current);

        localStreamRef.current = stream;
        setMicError(null);
        startVoiceActivity(stream);

        // Conexões criadas antes do microfone ficar pronto passam a enviar a voz (com renegociação)
        peersRef.current.forEach(peer => {
          if (peer.type === 'audio') attachLocalAudio(peer).catch(console.warn);
        });

        return stream;
      } catch (err) {
        console.warn('Não foi possível acessar o microfone (modo ouvinte ativado):', err);
        setMicError(
          err?.name === 'NotAllowedError'
            ? 'Permissão do microfone negada. Libere o microfone nas configurações do navegador.'
            : 'Microfone indisponível. Você está no modo ouvinte.'
        );
        return null;
      } finally {
        micPromiseRef.current = null;
      }
    })();

    return micPromiseRef.current;
  }, []);

  const stopMicrophone = () => {
    stopVoiceActivity();
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    setMicLevel(0);
  };

  // Aplica Mute / Server Mute nas faixas locais de áudio
  useEffect(() => {
    const effectivelyMuted = isMuted || user?.isServerMuted;
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !effectivelyMuted;
      });
    }

    if (effectivelyMuted) setIsSpeaking(false);

    if (socket) {
      socket.emit('update_voice_state', {
        isMuted: effectivelyMuted,
        isDeafened,
        isSpeaking: false
      });
    }
  }, [isMuted, user?.isServerMuted, isDeafened, socket]);

  // ---------------------------------------------------------------------------
  // Compartilhamento de tela
  // ---------------------------------------------------------------------------

  const stopScreenShare = useCallback(() => {
    const hadStream = Boolean(screenStreamRef.current);
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }
    setScreenStream(null);
    setIsScreenSharing(false);

    Array.from(peersRef.current.values())
      .filter(p => p.type === 'screen')
      .forEach(p => closePeer('screen', p.socketId));

    if (hadStream) {
      socketRef.current?.emit('update_screen_state', { isScreenSharing: false });
    }
  }, [closePeer]);

  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      stopScreenShare();
      return;
    }

    if (!inVoiceRef.current) {
      alert('Entre em um canal de voz para compartilhar sua tela.');
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      alert('O compartilhamento de tela está disponível no aplicativo para PC ou em navegadores desktop (Chrome, Edge, Opera, Firefox). No celular, você pode assistir às transmissões dos amigos!');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          frameRate: { ideal: 30, max: 60 },
          width: { ideal: 1920, max: 1920 },
          height: { ideal: 1080, max: 1080 }
        },
        audio: true
      });

      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        try {
          videoTrack.contentHint = 'motion'; // prioriza fluidez (jogos)
        } catch (e) {}
        videoTrack.onended = () => stopScreenShare();
      }

      screenStreamRef.current = stream;
      setScreenStream(stream);
      setIsScreenSharing(true);

      socketRef.current?.emit('update_screen_state', { isScreenSharing: true });

      // Transmite para todos os amigos presentes no canal de voz
      roomPeersRef.current.forEach(socketId => connectScreenPeer(socketId));
    } catch (err) {
      if (err.name !== 'NotAllowedError') {
        console.warn('Compartilhamento de tela cancelado ou indisponível:', err);
      }
    }
  };

  // ---------------------------------------------------------------------------
  // Eventos do servidor
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!socket) return;

    const onUserJoined = ({ socketId }) => {
      if (!inVoiceRef.current || !socketId || socketId === socket.id) return;
      console.log(`👤 Amigo entrou na sala de voz: ${socketId}`);
      connectAudioPeer(socketId);
      if (screenStreamRef.current) connectScreenPeer(socketId);
    };

    const onUserLeft = ({ socketId }) => {
      console.log(`🚪 Amigo saiu da sala de voz: ${socketId}`);
      ['audio', 'screen', 'screen-view'].forEach(type => closePeer(type, socketId));
    };

    const onScreenStateChanged = ({ socketId, isScreenSharing: sharing }) => {
      if (!sharing) closePeer('screen-view', socketId);
    };

    // Ao perder a conexão com o servidor, o socket.id muda: descarta conexões antigas
    const onDisconnect = () => closeAllPeers();

    socket.on('webrtc_signal', handleWebRTCSignal);
    socket.on('user_joined_voice', onUserJoined);
    socket.on('user_left_voice', onUserLeft);
    socket.on('user_screen_state_changed', onScreenStateChanged);
    socket.on('disconnect', onDisconnect);

    return () => {
      socket.off('webrtc_signal', handleWebRTCSignal);
      socket.off('user_joined_voice', onUserJoined);
      socket.off('user_left_voice', onUserLeft);
      socket.off('user_screen_state_changed', onScreenStateChanged);
      socket.off('disconnect', onDisconnect);
    };
  }, [socket, handleWebRTCSignal, connectAudioPeer, connectScreenPeer, closePeer, closeAllPeers]);

  // Ao entrar em um canal de voz: liga o microfone. Ao sair/trocar: encerra tudo.
  useEffect(() => {
    if (inVoice) {
      initMicrophone();
    }
    return () => {
      stopScreenShare();
      closeAllPeers();
      stopMicrophone();
      setIsSpeaking(false);
    };
  }, [inVoice, activeChannelId, initMicrophone, stopScreenShare, closeAllPeers]);

  // Desbloqueio global de política de Autoplay / AudioContext suspenso
  useEffect(() => {
    const resumeAudio = () => {
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume().catch(() => {});
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

  const toggleMute = () => setIsMuted(prev => !prev);
  const toggleDeafen = () => setIsDeafened(prev => !prev);

  const cleanupVoiceConnections = useCallback(() => {
    stopScreenShare();
    closeAllPeers();
  }, [stopScreenShare, closeAllPeers]);

  return (
    <VoiceContext.Provider
      value={{
        isMuted,
        isDeafened,
        isSpeaking,
        micLevel,
        micError,
        sensitivityThreshold,
        updateSensitivity,
        userVolumes,
        setUserVolume,
        isScreenSharing,
        screenStream,
        remoteStreams,
        remoteScreenStreams,
        peerStates,
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
