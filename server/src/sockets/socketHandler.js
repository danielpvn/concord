import prisma from '../prisma.js';

// Mapa de usuários conectados: socketId -> Dados do usuário
const connectedUsers = new Map();

const voiceJoinPayload = (socketId, user) => ({
  socketId,
  userId: user.userId,
  username: user.username,
  avatarColor: user.avatarColor,
  role: user.role,
  isMuted: user.isMuted,
  isDeafened: user.isDeafened,
  isServerMuted: user.isServerMuted,
  isScreenSharing: user.isScreenSharing
});

export const setupSocketHandlers = (io) => {
  io.on('connection', (socket) => {
    console.log(`🔌 Novo cliente conectado: ${socket.id}`);

    // --- Usuário entra no servidor e sincroniza estado ---
    socket.on('join_server', async (userData) => {
      if (!userData || !userData.userId) return;

      const userFromDb = await prisma.user.findUnique({
        where: { id: userData.userId },
        select: {
          id: true,
          username: true,
          avatarColor: true,
          avatarUrl: true,
          role: true,
          isServerMuted: true
        }
      });

      if (!userFromDb) return;

      const existing = connectedUsers.get(socket.id);
      // join_channel pode chegar antes do join_server terminar (consulta assíncrona ao banco)
      const initialChannel = socket.data.pendingChannelId || userData.channelId || existing?.channelId || null;
      delete socket.data.pendingChannelId;

      connectedUsers.set(socket.id, {
        socketId: socket.id,
        userId: userFromDb.id,
        username: userFromDb.username,
        avatarColor: userFromDb.avatarColor,
        avatarUrl: userFromDb.avatarUrl,
        role: userFromDb.role,
        isServerMuted: userFromDb.isServerMuted,
        channelId: initialChannel,
        isMuted: false,
        isDeafened: false,
        isSpeaking: false,
        isScreenSharing: false
      });

      if (initialChannel) {
        socket.join(`channel_${initialChannel}`);
        // Os demais membros da sala iniciam a conexão WebRTC com este socket
        socket.to(`channel_${initialChannel}`).emit('user_joined_voice', voiceJoinPayload(socket.id, connectedUsers.get(socket.id)));
      }

      // Transmite a lista de todos os usuários online atualizada
      io.emit('online_users_updated', Array.from(connectedUsers.values()));
    });

    // --- Atualização de Perfil em Tempo Real (Apelido, Cor, Avatar) ---
    socket.on('update_profile_broadcast', ({ username, avatarColor, avatarUrl }) => {
      const user = connectedUsers.get(socket.id);
      if (!user) return;

      if (username) user.username = username;
      if (avatarColor) user.avatarColor = avatarColor;
      if (avatarUrl !== undefined) user.avatarUrl = avatarUrl;

      io.emit('online_users_updated', Array.from(connectedUsers.values()));
    });

    // --- Entrar em um canal (Voz ou Texto) ---
    socket.on('join_channel', ({ channelId } = {}) => {
      const user = connectedUsers.get(socket.id);
      if (!user) {
        socket.data.pendingChannelId = channelId;
        return;
      }

      const previousChannel = user.channelId;

      // Já está neste canal: apenas garante a sala do socket, sem renegociar WebRTC
      if (previousChannel === channelId) {
        socket.join(`channel_${channelId}`);
        return;
      }

      user.channelId = channelId;
      user.isScreenSharing = false;
      user.isSpeaking = false;

      if (previousChannel && previousChannel !== channelId) {
        socket.leave(`channel_${previousChannel}`);
        // Notifica o canal anterior que o usuário saiu
        socket.to(`channel_${previousChannel}`).emit('user_left_voice', {
          socketId: socket.id,
          userId: user.userId
        });
      }

      socket.join(`channel_${channelId}`);

      // Notifica todos os usuários da atualização
      io.emit('online_users_updated', Array.from(connectedUsers.values()));
      socket.to(`channel_${channelId}`).emit('user_joined_voice', voiceJoinPayload(socket.id, user));
    });

    // --- Sair do canal de voz ---
    socket.on('leave_channel', () => {
      delete socket.data.pendingChannelId;
      const user = connectedUsers.get(socket.id);
      if (!user || !user.channelId) return;

      const channelId = user.channelId;
      user.channelId = null;
      user.isScreenSharing = false;
      user.isSpeaking = false;

      socket.leave(`channel_${channelId}`);
      socket.to(`channel_${channelId}`).emit('user_left_voice', {
        socketId: socket.id,
        userId: user.userId
      });

      io.emit('online_users_updated', Array.from(connectedUsers.values()));
    });

    // --- Atualização de Estado de Voz (Mudo, Ensurdecer, Falando) ---
    socket.on('update_voice_state', ({ isMuted, isDeafened, isSpeaking }) => {
      const user = connectedUsers.get(socket.id);
      if (!user) return;

      if (isMuted !== undefined) user.isMuted = isMuted;
      if (isDeafened !== undefined) user.isDeafened = isDeafened;
      if (isSpeaking !== undefined) user.isSpeaking = isSpeaking;

      if (user.channelId) {
        io.to(`channel_${user.channelId}`).emit('user_voice_state_changed', {
          socketId: socket.id,
          userId: user.userId,
          isMuted: user.isMuted,
          isDeafened: user.isDeafened,
          isSpeaking: user.isSpeaking,
          isServerMuted: user.isServerMuted
        });
      }
      io.emit('online_users_updated', Array.from(connectedUsers.values()));
    });

    // --- Atualização de Compartilhamento de Tela ---
    socket.on('update_screen_state', ({ isScreenSharing }) => {
      const user = connectedUsers.get(socket.id);
      if (!user) return;

      user.isScreenSharing = Boolean(isScreenSharing);

      if (user.channelId) {
        io.to(`channel_${user.channelId}`).emit('user_screen_state_changed', {
          socketId: socket.id,
          userId: user.userId,
          username: user.username,
          isScreenSharing: user.isScreenSharing
        });
      }
      io.emit('online_users_updated', Array.from(connectedUsers.values()));
    });

    // --- Envio de Mensagem de Texto no Chat ---
    socket.on('send_message', async ({ channelId, content, attachmentUrl, attachmentType }) => {
      const user = connectedUsers.get(socket.id);
      if (!user || (!content && !attachmentUrl)) return;

      try {
        const message = await prisma.message.create({
          data: {
            channelId,
            userId: user.userId,
            content: content || '',
            attachmentUrl: attachmentUrl || null,
            attachmentType: attachmentType || null
          },
          include: {
            user: {
              select: {
                id: true,
                username: true,
                avatarColor: true,
                avatarUrl: true,
                role: true
              }
            }
          }
        });

        io.emit('new_message', { message });
      } catch (err) {
        console.error('Erro ao salvar mensagem:', err);
      }
    });

    // --- Moderação: Arrastar e Soltar Usuário para outro Canal (Drag & Drop) ---
    socket.on('admin_drag_move_user', ({ targetUserId, targetChannelId }) => {
      const actor = connectedUsers.get(socket.id);
      if (!actor || (actor.role !== 'OWNER' && actor.role !== 'ADMIN')) {
        return socket.emit('error_message', 'Você não tem permissão para mover usuários.');
      }

      // Procura o socket do usuário alvo
      for (const [targetSocketId, targetUser] of connectedUsers.entries()) {
        if (targetUser.userId === targetUserId) {
          io.to(targetSocketId).emit('force_change_channel', { targetChannelId });
          break;
        }
      }
    });

    // --- Moderação: Mute de Servidor (Server Mute) ---
    socket.on('admin_server_mute', async ({ targetUserId, mute }) => {
      const actor = connectedUsers.get(socket.id);
      if (!actor || (actor.role !== 'OWNER' && actor.role !== 'ADMIN')) {
        return socket.emit('error_message', 'Você não tem permissão para mutar usuários.');
      }

      try {
        await prisma.user.update({
          where: { id: targetUserId },
          data: { isServerMuted: mute }
        });

        for (const [targetSocketId, targetUser] of connectedUsers.entries()) {
          if (targetUser.userId === targetUserId) {
            targetUser.isServerMuted = mute;
            io.to(targetSocketId).emit('you_were_server_muted', { isServerMuted: mute });
            break;
          }
        }

        io.emit('online_users_updated', Array.from(connectedUsers.values()));
      } catch (err) {
        console.error('Erro ao processar server mute:', err);
      }
    });

    // --- Moderação: Desconectar da Voz (Kick from voice) ---
    socket.on('admin_kick_voice', ({ targetUserId }) => {
      const actor = connectedUsers.get(socket.id);
      if (!actor || (actor.role !== 'OWNER' && actor.role !== 'ADMIN')) {
        return socket.emit('error_message', 'Você não tem permissão para desconectar usuários.');
      }

      for (const [targetSocketId, targetUser] of connectedUsers.entries()) {
        if (targetUser.userId === targetUserId) {
          io.to(targetSocketId).emit('force_leave_voice');
          break;
        }
      }
    });

    // --- Sinalização WebRTC Nativa (Mesh P2P Audio/Screen) ---
    socket.on('webrtc_signal', ({ toSocketId, signal, streamType } = {}) => {
      if (!toSocketId || !signal || !connectedUsers.has(toSocketId)) return;
      io.to(toSocketId).emit('webrtc_signal', {
        fromSocketId: socket.id,
        signal,
        streamType // 'audio' | 'screen' (sharer -> viewer) | 'screen-view' (viewer -> sharer)
      });
    });

    // --- Desconexão de Cliente ---
    socket.on('disconnect', () => {
      const user = connectedUsers.get(socket.id);
      if (user) {
        if (user.channelId) {
          socket.to(`channel_${user.channelId}`).emit('user_left_voice', {
            socketId: socket.id,
            userId: user.userId
          });
        }
        connectedUsers.delete(socket.id);
        io.emit('online_users_updated', Array.from(connectedUsers.values()));
        console.log(`❌ Usuário desconectado: ${user.username} (${socket.id})`);
      }
    });
  });
};
