import React, { useState, useRef, useEffect } from 'react';
import { useSocket } from '../../context/SocketContext';
import { useVoice } from '../../context/VoiceContext';
import { useAuth } from '../../context/AuthContext';
import { Avatar } from '../ui/Avatar';
import {
  MicOff,
  Crown,
  Shield,
  Volume2,
  VolumeX,
  Maximize,
  Radio,
  MoreVertical,
  MoveRight,
  UserX,
  Menu,
  AlertTriangle,
  LayoutGrid
} from 'lucide-react';

const MENU_WIDTH = 220;

const RoleBadge = ({ role }) => {
  if (role === 'OWNER') {
    return (
      <span className="px-1.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-400 text-[9px] md:text-[10px] font-bold inline-flex items-center gap-1">
        <Crown className="w-3 h-3" />
        DONO
      </span>
    );
  }
  if (role === 'ADMIN') {
    return (
      <span className="px-1.5 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 text-[9px] md:text-[10px] font-bold inline-flex items-center gap-1">
        <Shield className="w-3 h-3" />
        ADMIN
      </span>
    );
  }
  return null;
};

const connectionLabel = (state) => {
  if (!state || state === 'connected') return null;
  if (state === 'failed' || state === 'disconnected') {
    return { text: 'Sem conexão de áudio', className: 'text-red-400' };
  }
  return { text: 'Conectando áudio…', className: 'text-amber-400' };
};

const MobileHeader = ({ onOpenMenu, label, count }) => (
  <div className="md:hidden flex items-center justify-between gap-2 pb-2.5 mb-2 border-b border-gaming-800/80">
    <button
      onClick={onOpenMenu}
      className="flex items-center gap-2 min-w-0 h-10 px-3 rounded-xl bg-gaming-900 border border-gaming-700 text-white active:scale-95 transition shadow-sm"
    >
      <Menu className="w-5 h-5 text-indigo-400 flex-shrink-0" />
      <span className="text-sm font-bold truncate">{label}</span>
    </button>

    {count !== undefined && (
      <div className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gaming-900/90 border border-gaming-800 text-[11px] text-slate-400 font-mono">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span>{count} na sala</span>
      </div>
    )}
  </div>
);

// Uma transmissão de tela (minha ou de um amigo)
const ScreenTile = ({ screen, muted, compact = false, onSelect, onShowAll, className = '' }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.srcObject !== screen.stream) video.srcObject = screen.stream;
    video.play().catch(() => {});
  }, [screen.stream]);

  // O atributo `muted` do React não é atualizado de forma confiável; aplica direto no elemento
  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted;
  }, [muted]);

  const enterFullscreen = (e) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    if (video.requestFullscreen) {
      video.requestFullscreen().catch(() => {});
    } else if (video.webkitEnterFullscreen) {
      video.webkitEnterFullscreen(); // iPhone
    }
  };

  const label = screen.isLocal ? 'Sua Transmissão' : `Tela de ${screen.username}`;

  return (
    <div
      onClick={onSelect}
      title={onSelect ? `Destacar ${label}` : undefined}
      className={`relative bg-black rounded-xl sm:rounded-2xl overflow-hidden border border-gaming-800 flex items-center justify-center shadow-2xl min-w-0 ${
        onSelect ? 'cursor-pointer hover:border-indigo-500/60 transition' : ''
      } ${className}`}
    >
      <video ref={videoRef} autoPlay playsInline muted={muted} className="w-full h-full object-contain" />

      <div
        className={`absolute max-w-[75%] rounded-lg bg-black/60 backdrop-blur-md border border-white/10 flex items-center gap-1.5 ${
          compact ? 'top-1 left-1 px-1.5 py-0.5' : 'top-2 left-2 sm:top-3 sm:left-3 px-2.5 py-1'
        }`}
      >
        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
        <span className={`font-semibold text-white truncate ${compact ? 'text-[10px]' : 'text-xs'}`}>{label}</span>
      </div>

      {!compact && (
        <div className="absolute bottom-2 right-2 sm:bottom-3 sm:right-3 flex items-center gap-1.5">
          {onShowAll && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onShowAll();
              }}
              title="Ver todas as telas"
              aria-label="Ver todas as telas"
              className="p-2.5 rounded-xl bg-black/60 hover:bg-black/80 backdrop-blur-md text-white border border-white/10 transition"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={enterFullscreen}
            title="Tela Cheia"
            aria-label="Tela Cheia"
            className="p-2.5 rounded-xl bg-black/60 hover:bg-black/80 backdrop-blur-md text-white border border-white/10 transition"
          >
            <Maximize className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};

export const VoiceGrid = () => {
  const { socket, onlineUsers, activeChannel, activeChannelId, adminServerMute, adminKickVoice, adminMoveUser, channels, setIsMobileMenuOpen } = useSocket();
  const { user, isAdmin } = useAuth();
  const {
    isSpeaking,
    isMuted,
    isDeafened,
    isScreenSharing,
    screenStream,
    remoteScreenStreams,
    peerStates,
    micError,
    userVolumes,
    setUserVolume
  } = useVoice();

  const [contextMenu, setContextMenu] = useState(null);
  const [focusedScreenId, setFocusedScreenId] = useState(null);

  // Filtra amigos conectados na mesma sala de voz ativa (e garante presença do usuário local)
  const roomUsers = React.useMemo(() => {
    if (!activeChannelId) return [];
    const inRoom = onlineUsers.filter(u => u.channelId === activeChannelId);
    if (user && !inRoom.some(u => u.userId === user.id) && activeChannel?.type === 'voice') {
      return [
        {
          socketId: socket?.id || 'me',
          userId: user.id,
          username: user.username,
          avatarColor: user.avatarColor,
          avatarUrl: user.avatarUrl,
          role: user.role,
          isServerMuted: user.isServerMuted,
          channelId: activeChannelId,
          isMuted,
          isDeafened,
          isSpeaking,
          isScreenSharing
        },
        ...inRoom
      ];
    }
    return inRoom;
  }, [onlineUsers, activeChannelId, user, activeChannel, socket?.id, isMuted, isDeafened, isSpeaking, isScreenSharing]);

  // Todas as transmissões de tela da sala: a minha primeiro, depois as dos amigos
  const screens = React.useMemo(() => {
    const list = [];
    if (isScreenSharing && screenStream) {
      list.push({ id: 'local', username: user?.username, stream: screenStream, isLocal: true });
    }
    Object.entries(remoteScreenStreams).forEach(([socketId, stream]) => {
      const owner = roomUsers.find(u => u.socketId === socketId);
      if (owner && stream.getVideoTracks().length > 0) {
        list.push({ id: socketId, username: owner.username, stream, isLocal: false });
      }
    });
    return list;
  }, [isScreenSharing, screenStream, remoteScreenStreams, roomUsers, user?.username]);

  const pendingScreenUsers = roomUsers.filter(
    u => u.userId !== user?.id && u.isScreenSharing && !screens.some(s => s.id === u.socketId)
  );

  // Se a tela em destaque parar, volta para a grade
  const focusedScreen = screens.find(s => s.id === focusedScreenId) || null;
  useEffect(() => {
    if (focusedScreenId && !focusedScreen) setFocusedScreenId(null);
  }, [focusedScreenId, focusedScreen]);

  useEffect(() => {
    const close = () => setContextMenu(null);
    window.addEventListener('click', close);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('resize', close);
    };
  }, []);

  const openModerationMenu = (x, y, targetUser) => {
    if (!isAdmin || targetUser.userId === user?.id) return;
    const optionCount = 2 + channels.filter(c => c.type === 'voice' && c.id !== activeChannelId).length;
    const estimatedHeight = 40 + optionCount * 36;
    setContextMenu({
      x: Math.max(8, Math.min(x, window.innerWidth - MENU_WIDTH - 8)),
      y: Math.max(8, Math.min(y, window.innerHeight - estimatedHeight - 8)),
      targetUser
    });
  };

  const handleContextMenu = (e, targetUser) => {
    if (!isAdmin) return;
    e.preventDefault();
    openModerationMenu(e.clientX, e.clientY, targetUser);
  };

  const handleMenuButton = (e, targetUser) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    openModerationMenu(rect.right - MENU_WIDTH, rect.bottom + 4, targetUser);
  };

  const handleDragStart = (e, userId) => {
    if (isAdmin) {
      e.dataTransfer.setData('text/plain', userId);
    }
  };

  const openMobileMenu = () => setIsMobileMenuOpen(true);

  if (!activeChannel) {
    return (
      <div className="flex-1 min-w-0 flex flex-col h-full bg-gaming-950 p-3 sm:p-6 overflow-hidden">
        <MobileHeader onOpenMenu={openMobileMenu} label="Escolher canal" />
        <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-500 px-4">
          <p className="text-base font-medium">Você não está em nenhum canal.</p>
          <p className="text-xs mt-1 text-slate-600">Escolha um canal de voz para conversar com seus amigos.</p>
        </div>
      </div>
    );
  }

  if (activeChannel.type === 'text') {
    return (
      <div className="flex-1 min-w-0 flex flex-col h-full bg-gaming-950 p-3 sm:p-8 overflow-hidden relative">
        <MobileHeader onOpenMenu={openMobileMenu} label={`# ${activeChannel.name}`} />

        <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
          <div className="w-16 h-16 rounded-3xl bg-gaming-900 border border-gaming-800 flex items-center justify-center text-3xl mb-4 shadow-xl">
            💬
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-white mb-2">Canal de Texto #{activeChannel.name}</h2>
          <p className="text-sm text-slate-400 max-w-md">
            Abra o chat para conversar, enviar prints ou arrastar imagens para seus amigos.
          </p>
        </div>
      </div>
    );
  }

  const renderParticipantChip = (u) => {
    const isCurrentUser = u.userId === user?.id;
    const isUserSpeaking = isCurrentUser ? isSpeaking : u.isSpeaking;
    const isUserMuted = isCurrentUser ? isMuted || user?.isServerMuted : u.isMuted || u.isServerMuted;

    return (
      <div
        key={u.socketId || u.userId}
        className={`flex-shrink-0 flex items-center gap-2 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl bg-gaming-900 border transition ${
          isUserSpeaking ? 'border-emerald-400 ring-2 ring-emerald-500/40' : 'border-gaming-800'
        }`}
      >
        <Avatar username={u.username} avatarColor={u.avatarColor} avatarUrl={u.avatarUrl} size="sm" isSpeaking={isUserSpeaking} />
        <div className="flex flex-col min-w-0">
          <span className="text-xs font-medium text-slate-200 truncate max-w-[80px]">{u.username}</span>
          <span className="text-[10px] text-slate-500">
            {isUserMuted ? 'Mutado' : isUserSpeaking ? 'Falando' : 'Ouvindo'}
          </span>
        </div>
      </div>
    );
  };

  const renderTile = (u) => {
    const isCurrentUser = u.userId === user?.id;
    const isUserSpeaking = isCurrentUser ? isSpeaking : u.isSpeaking;
    const isUserMuted = isCurrentUser ? isMuted || user?.isServerMuted : u.isMuted || u.isServerMuted;
    const currentVolume = userVolumes[u.userId] ?? 100;
    const connection = isCurrentUser ? null : connectionLabel(peerStates[u.socketId]);
    const canModerate = isAdmin && !isCurrentUser;

    return (
      <div
        key={u.socketId || u.userId}
        draggable={isAdmin}
        onDragStart={(e) => handleDragStart(e, u.userId)}
        onContextMenu={(e) => handleContextMenu(e, u)}
        className={`relative flex flex-col items-center p-3 pt-4 sm:p-5 rounded-2xl bg-gaming-900/90 border transition-all duration-200 group shadow-lg min-w-0 ${
          isUserSpeaking
            ? 'border-emerald-400 ring-2 sm:ring-4 ring-emerald-500/30'
            : 'border-gaming-800 hover:border-gaming-700'
        } ${isAdmin ? 'md:cursor-grab md:active:cursor-grabbing' : ''}`}
      >
        {/* Indicadores de Mudo / Som */}
        <div className="absolute top-2 left-2 flex items-center gap-1">
          {isUserMuted && (
            <div className="p-1 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30" title="Microfone Mutado">
              <MicOff className="w-3.5 h-3.5" />
            </div>
          )}
          {u.isDeafened && (
            <div className="p-1 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30" title="Fone Desativado">
              <VolumeX className="w-3.5 h-3.5" />
            </div>
          )}
        </div>

        {/* Menu de moderação (funciona no toque, sem clique direito) */}
        {canModerate && (
          <button
            onClick={(e) => handleMenuButton(e, u)}
            title="Moderar"
            aria-label={`Moderar ${u.username}`}
            className="absolute top-1.5 right-1.5 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-gaming-800 transition"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        )}

        {/* Avatar */}
        <div className="relative mb-2 sm:mb-3">
          <Avatar
            username={u.username}
            avatarColor={u.avatarColor}
            avatarUrl={u.avatarUrl}
            size="lg"
            className="sm:w-20 sm:h-20 sm:text-2xl"
            isSpeaking={isUserSpeaking}
          />
          {isUserSpeaking && (
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center ring-2 ring-gaming-900 shadow-md">
              <Volume2 className="w-3 h-3 text-white" />
            </div>
          )}
        </div>

        {/* Nome e cargo */}
        <h3 className="text-sm font-bold text-white truncate max-w-full text-center">
          {u.username}
          {isCurrentUser && <span className="text-[10px] text-slate-400 font-normal"> (Você)</span>}
        </h3>
        {(u.role === 'OWNER' || u.role === 'ADMIN') && (
          <div className="mt-1">
            <RoleBadge role={u.role} />
          </div>
        )}

        {connection && (
          <span className={`mt-1 text-[10px] font-medium ${connection.className}`}>{connection.text}</span>
        )}

        {/* Volume individual: sempre visível no toque, aparece no hover no desktop */}
        {!isCurrentUser && (
          <div className="w-full mt-2.5 pt-2.5 border-t border-gaming-800/80 flex items-center gap-2 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 transition-opacity">
            <Volume2 className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={Math.min(100, currentVolume)}
              onChange={(e) => setUserVolume(u.userId, parseInt(e.target.value, 10))}
              aria-label={`Volume de ${u.username}`}
              className="w-full min-w-0 h-1.5 bg-gaming-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
            <span className="text-[10px] font-mono text-slate-400 w-8 text-right flex-shrink-0">{Math.min(100, currentVolume)}%</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex-1 min-w-0 flex flex-col h-full bg-gaming-950 p-3 sm:p-6 overflow-hidden relative">
      <MobileHeader onOpenMenu={openMobileMenu} label={`🔊 ${activeChannel.name}`} count={roomUsers.length} />

      {micError && (
        <div className="mb-2 sm:mb-4 flex items-start gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{micError}</span>
        </div>
      )}

      {screens.length > 0 ? (
        <div className="flex-1 flex flex-col gap-2 sm:gap-3 min-h-0">
          {focusedScreen || screens.length === 1 ? (
            <>
              <ScreenTile
                screen={focusedScreen || screens[0]}
                muted={(focusedScreen || screens[0]).isLocal || isDeafened}
                onShowAll={screens.length > 1 ? () => setFocusedScreenId(null) : null}
                className="flex-1 min-h-0"
              />
              {screens.length > 1 && (
                <div className="flex-shrink-0 flex gap-2 overflow-x-auto no-scrollbar">
                  {screens
                    .filter(s => s.id !== (focusedScreen || screens[0]).id)
                    .map(s => (
                      <ScreenTile
                        key={s.id}
                        screen={s}
                        muted
                        compact
                        onSelect={() => setFocusedScreenId(s.id)}
                        className="w-40 sm:w-56 aspect-video flex-shrink-0"
                      />
                    ))}
                </div>
              )}
            </>
          ) : (
            // Várias telas ao mesmo tempo: grade (toque em uma para destacar)
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain grid grid-cols-1 md:grid-cols-2 auto-rows-[minmax(180px,1fr)] gap-2 sm:gap-3">
              {screens.map(s => (
                <ScreenTile
                  key={s.id}
                  screen={s}
                  muted={s.isLocal || isDeafened}
                  onSelect={() => setFocusedScreenId(s.id)}
                />
              ))}
            </div>
          )}

          {pendingScreenUsers.map(u => (
            <div key={u.socketId} className="flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gaming-900 border border-gaming-800 text-xs text-slate-300">
              <Radio className="w-4 h-4 text-red-400 animate-pulse flex-shrink-0" />
              <span className="truncate">Carregando a tela de {u.username}…</span>
            </div>
          ))}

          <div className="flex-shrink-0 flex items-center gap-2 sm:gap-3 overflow-x-auto no-scrollbar py-1">
            {roomUsers.map(renderParticipantChip)}
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          {pendingScreenUsers.map(u => (
            <div key={u.socketId} className="mb-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-gaming-900 border border-gaming-800 text-xs text-slate-300">
              <Radio className="w-4 h-4 text-red-400 animate-pulse flex-shrink-0" />
              <span className="truncate">Carregando a tela de {u.username}…</span>
            </div>
          ))}

          {roomUsers.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 p-4">
              <p className="text-base font-medium">Nenhum amigo neste canal de voz no momento.</p>
              <p className="text-xs mt-1 text-slate-600">Seus amigos podem entrar tocando no canal de voz.</p>
            </div>
          ) : (
            <div className="min-h-full flex flex-col justify-start md:justify-center">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4 p-0.5 sm:p-2">
                {roomUsers.map(renderTile)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Menu de Moderação */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-gaming-900 border border-gaming-700 rounded-xl shadow-2xl py-1.5 overflow-hidden text-sm md:text-xs animate-fade-in"
          style={{ top: contextMenu.y, left: contextMenu.x, width: MENU_WIDTH }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-1.5 border-b border-gaming-800 text-[10px] text-slate-400 font-semibold uppercase tracking-wider truncate">
            Moderar: {contextMenu.targetUser.username}
          </div>

          <button
            onClick={() => {
              adminServerMute(contextMenu.targetUser.userId, !contextMenu.targetUser.isServerMuted);
              setContextMenu(null);
            }}
            className="w-full flex items-center gap-2 px-3 py-2.5 md:py-2 text-slate-300 hover:text-white hover:bg-gaming-800 transition text-left"
          >
            <MicOff className="w-3.5 h-3.5 text-red-400" />
            <span>{contextMenu.targetUser.isServerMuted ? 'Desmutar no Servidor' : 'Mutar no Servidor'}</span>
          </button>

          {channels.filter(c => c.type === 'voice' && c.id !== activeChannelId).map(c => (
            <button
              key={c.id}
              onClick={() => {
                adminMoveUser(contextMenu.targetUser.userId, c.id);
                setContextMenu(null);
              }}
              className="w-full flex items-center gap-2 px-3 py-2.5 md:py-2 text-slate-300 hover:text-white hover:bg-gaming-800 transition text-left"
            >
              <MoveRight className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
              <span className="truncate">Mover para {c.name}</span>
            </button>
          ))}

          <button
            onClick={() => {
              adminKickVoice(contextMenu.targetUser.userId);
              setContextMenu(null);
            }}
            className="w-full flex items-center gap-2 px-3 py-2.5 md:py-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 transition text-left border-t border-gaming-800"
          >
            <UserX className="w-3.5 h-3.5" />
            <span>Desconectar da Voz</span>
          </button>
        </div>
      )}
    </div>
  );
};
