import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { apiFetch, SERVER_BASE_URL, getAuthToken } from '../services/api';
import { playSound } from '../services/sounds';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { user, setUser } = useAuth();
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [channels, setChannels] = useState([]);
  const [activeChannelId, setActiveChannelId] = useState(null);
  const [messages, setMessages] = useState({});
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Carrega canais do servidor
  const loadChannels = useCallback(async () => {
    try {
      const data = await apiFetch('/channels');
      setChannels(data.channels);
      // Se não houver canal ativo selecionado, seleciona o primeiro por padrão
      if (data.channels.length > 0 && !activeChannelId) {
        // Volta para o último canal usado (ex.: depois de recarregar para atualizar)
        const lastChannelId = localStorage.getItem('concord_last_channel');
        const lastChannel = data.channels.find(c => c.id === lastChannelId);
        const defaultVoice = lastChannel || data.channels.find(c => c.type === 'voice') || data.channels[0];
        setActiveChannelId(defaultVoice.id);
      }
    } catch (err) {
      console.error('Erro ao carregar canais:', err);
    }
  }, [activeChannelId]);

  // Carrega mensagens do canal ativo
  const loadMessages = useCallback(async (channelId) => {
    if (!channelId) return;
    try {
      const data = await apiFetch(`/channels/${channelId}/messages`);
      setMessages(prev => ({
        ...prev,
        [channelId]: data.messages
      }));
    } catch (err) {
      console.error('Erro ao carregar mensagens:', err);
    }
  }, []);

  const activeChannelIdRef = useRef(activeChannelId);
  const isChatOpenRef = useRef(isChatOpen);
  const userIdRef = useRef(user?.id);

  useEffect(() => {
    activeChannelIdRef.current = activeChannelId;
    if (activeChannelId) {
      localStorage.setItem('concord_last_channel', activeChannelId);
    }
  }, [activeChannelId]);

  useEffect(() => {
    isChatOpenRef.current = isChatOpen;
  }, [isChatOpen]);

  useEffect(() => {
    userIdRef.current = user?.id;
  }, [user?.id]);

  // Conexão com Socket.io (só reconecta ao trocar de conta, não ao editar o perfil)
  useEffect(() => {
    if (!user?.id) {
      setSocket(null);
      return;
    }

    loadChannels();

    const newSocket = io(SERVER_BASE_URL, {
      transports: ['websocket', 'polling']
    });

    newSocket.on('connect', () => {
      console.log('⚡ Conectado ao servidor Concord WebSocket');
      newSocket.emit('join_server', {
        token: getAuthToken(),
        channelId: activeChannelIdRef.current
      });
      if (activeChannelIdRef.current) {
        newSocket.emit('join_channel', { channelId: activeChannelIdRef.current });
      }
    });

    newSocket.on('online_users_updated', (users) => {
      setOnlineUsers(users);
    });

    newSocket.on('user_voice_state_changed', ({ socketId, isMuted, isDeafened, isSpeaking, isServerMuted }) => {
      setOnlineUsers(prev => prev.map(u => u.socketId === socketId ? {
        ...u,
        ...(isMuted !== undefined && { isMuted }),
        ...(isDeafened !== undefined && { isDeafened }),
        ...(isSpeaking !== undefined && { isSpeaking }),
        ...(isServerMuted !== undefined && { isServerMuted })
      } : u));
    });

    newSocket.on('user_screen_state_changed', ({ socketId, isScreenSharing }) => {
      setOnlineUsers(prev => prev.map(u => u.socketId === socketId ? { ...u, isScreenSharing: Boolean(isScreenSharing) } : u));
    });

    newSocket.on('new_message', ({ message }) => {
      setMessages(prev => {
        const channelMsgs = prev[message.channelId] || [];
        return {
          ...prev,
          [message.channelId]: [...channelMsgs, message]
        };
      });

      const fromSomeoneElse = message.userId !== userIdRef.current;
      if (fromSomeoneElse) {
        playSound('message');
        if (!isChatOpenRef.current) {
          setUnreadChatCount(prev => prev + 1);
        }
      }
    });

    newSocket.on('message_deleted', ({ messageId, channelId }) => {
      setMessages(prev => {
        const channelMsgs = prev[channelId];
        if (!channelMsgs) return prev;
        return { ...prev, [channelId]: channelMsgs.filter(m => m.id !== messageId) };
      });
    });

    newSocket.on('error_message', (text) => {
      if (typeof text === 'string') alert(text);
    });

    // Moderação recebida: você foi mutado pelo servidor
    newSocket.on('you_were_server_muted', ({ isServerMuted }) => {
      setUser(prev => prev ? { ...prev, isServerMuted } : null);
    });

    // Moderação recebida: você foi movido para outro canal
    newSocket.on('force_change_channel', ({ targetChannelId }) => {
      setActiveChannelId(targetChannelId);
      newSocket.emit('join_channel', { channelId: targetChannelId });
    });

    // Moderação recebida: você foi desconectado da voz
    newSocket.on('force_leave_voice', () => {
      setActiveChannelId(null);
      newSocket.emit('leave_channel');
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [user?.id]);

  // Sincroniza mensagens ao trocar de canal
  useEffect(() => {
    if (activeChannelId) {
      loadMessages(activeChannelId);
      if (socket && socket.connected) {
        socket.emit('join_channel', { channelId: activeChannelId });
      }
    }
  }, [activeChannelId, socket]);

  const joinChannel = (channelId) => {
    setActiveChannelId(channelId);
    if (socket) {
      socket.emit('join_channel', { channelId });
    }
  };

  const leaveChannel = () => {
    setActiveChannelId(null);
    if (socket) {
      socket.emit('leave_channel');
    }
  };

  const sendMessage = (channelId, content, attachmentUrl = null, attachmentType = null) => {
    if (socket) {
      socket.emit('send_message', {
        channelId,
        content,
        attachmentUrl,
        attachmentType
      });
    }
  };

  // Moderação via Drag & Drop ou Context Menu
  const adminMoveUser = (targetUserId, targetChannelId) => {
    if (socket) {
      socket.emit('admin_drag_move_user', { targetUserId, targetChannelId });
    }
  };

  const adminServerMute = (targetUserId, mute) => {
    if (socket) {
      socket.emit('admin_server_mute', { targetUserId, mute });
    }
  };

  const adminKickVoice = (targetUserId) => {
    if (socket) {
      socket.emit('admin_kick_voice', { targetUserId });
    }
  };

  const deleteMessage = (messageId) => {
    if (socket) {
      socket.emit('delete_message', { messageId });
    }
  };

  const broadcastProfileUpdate = (profileData) => {
    if (socket) {
      socket.emit('update_profile_broadcast', profileData);
    }
  };

  const activeChannel = channels.find(c => c.id === activeChannelId);

  return (
    <SocketContext.Provider
      value={{
        socket,
        onlineUsers,
        channels,
        activeChannelId,
        activeChannel,
        messages: messages[activeChannelId] || [],
        unreadChatCount,
        setUnreadChatCount,
        isChatOpen,
        setIsChatOpen,
        isMobileMenuOpen,
        setIsMobileMenuOpen,
        joinChannel,
        leaveChannel,
        sendMessage,
        deleteMessage,
        adminMoveUser,
        adminServerMute,
        adminKickVoice,
        broadcastProfileUpdate,
        refreshChannels: loadChannels
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket deve ser usado dentro de um SocketProvider');
  }
  return context;
};
