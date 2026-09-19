import React, { useState } from 'react';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import { Avatar } from '../ui/Avatar';
import concordLogo from '../../assets/concord-logo-transparent.png';
import concordWordmark from '../../assets/concord-wordmark.webp';
import {
  Volume2,
  Hash,
  ChevronLeft,
  ChevronRight,
  Gamepad2,
  Moon,
  Shield,
  Crown,
  X
} from 'lucide-react';

export const SidebarChannels = () => {
  const { channels, activeChannelId, joinChannel, onlineUsers, adminMoveUser, isMobileMenuOpen, setIsMobileMenuOpen } = useSocket();
  const { isAdmin } = useAuth();
  // Barra de canais aberta por padrão (lembra se a pessoa recolher)
  const [isExpanded, setIsExpandedState] = useState(() => localStorage.getItem('concord_sidebar_expanded') !== '0');
  const setIsExpanded = (expanded) => {
    setIsExpandedState(expanded);
    localStorage.setItem('concord_sidebar_expanded', expanded ? '1' : '0');
  };
  const [dragOverChannelId, setDragOverChannelId] = useState(null);

  const voiceChannels = channels.filter(c => c.type === 'voice');
  const textChannels = channels.filter(c => c.type === 'text');

  const handleDragOver = (e, channelId) => {
    e.preventDefault();
    if (isAdmin) {
      setDragOverChannelId(channelId);
    }
  };

  const handleDragLeave = () => {
    setDragOverChannelId(null);
  };

  const handleDrop = (e, targetChannelId) => {
    e.preventDefault();
    setDragOverChannelId(null);
    if (!isAdmin) return;

    const targetUserId = e.dataTransfer.getData('text/plain');
    if (targetUserId) {
      adminMoveUser(targetUserId, targetChannelId);
    }
  };

  const handleSelectChannel = (channelId) => {
    joinChannel(channelId);
    if (setIsMobileMenuOpen) {
      setIsMobileMenuOpen(false);
    }
  };

  const getChannelIcon = (name) => {
    if (name.includes('Jogatina') || name.includes('🎮')) return <Gamepad2 className="w-4 h-4 text-emerald-400" />;
    if (name.includes('AFK') || name.includes('Ausente') || name.includes('💤')) return <Moon className="w-4 h-4 text-amber-400" />;
    return <Volume2 className="w-4 h-4 text-indigo-400" />;
  };

  // Conteúdo comum da lista de canais (reutilizado entre Desktop e Mobile Drawer)
  const renderChannelList = (showFullNames = true) => (
    <div className="flex-1 overflow-y-auto px-2 py-4 space-y-4">
      <div>
        {showFullNames ? (
          <div className="px-2 mb-2 flex items-center justify-between text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            <span>Canais de Voz</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gaming-800 text-slate-400">{voiceChannels.length}</span>
          </div>
        ) : (
          <div className="text-center mb-2">
            <Volume2 className="w-4 h-4 mx-auto text-slate-500" />
          </div>
        )}

        <div className="space-y-1">
          {voiceChannels.map(channel => {
            const isActive = activeChannelId === channel.id;
            const isDragTarget = dragOverChannelId === channel.id;
            const usersInRoom = onlineUsers.filter(u => u.channelId === channel.id);

            return (
              <div
                key={channel.id}
                onDragOver={(e) => handleDragOver(e, channel.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, channel.id)}
                className={`rounded-xl transition group ${
                  isDragTarget ? 'ring-2 ring-emerald-400 bg-emerald-500/10' : ''
                }`}
              >
                <button
                  onClick={() => handleSelectChannel(channel.id)}
                  className={`w-full flex items-center gap-3 p-2.5 md:p-2 rounded-xl transition ${
                    isActive
                      ? 'bg-gaming-800 text-white font-medium border border-gaming-700/80 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-gaming-850'
                  }`}
                >
                  <div className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-lg bg-gaming-950/60">
                    {getChannelIcon(channel.name)}
                  </div>

                  {showFullNames && (
                    <div className="flex-1 flex items-center justify-between min-w-0">
                      <span className="text-sm md:text-xs truncate">{channel.name}</span>
                      {usersInRoom.length > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          {usersInRoom.length}
                        </span>
                      )}
                    </div>
                  )}
                </button>

                {showFullNames && usersInRoom.length > 0 && (
                  <div className="pl-9 pr-2 py-1 space-y-1">
                    {usersInRoom.map(u => (
                      <div
                        key={u.socketId}
                        // Dono/Admin arrastam a pessoa para outro canal de voz direto pela barra
                        draggable={isAdmin}
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', u.userId);
                          e.dataTransfer.effectAllowed = 'move';
                        }}
                        onDragEnd={handleDragLeave}
                        title={isAdmin ? `Arraste para mover ${u.username} de canal` : undefined}
                        className={`flex items-center justify-between text-[11px] text-slate-300 py-0.5 px-1.5 rounded hover:bg-gaming-800/50 ${isAdmin ? 'cursor-grab active:cursor-grabbing' : ''}`}
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          <Avatar
                            username={u.username}
                            avatarColor={u.avatarColor}
                            avatarUrl={u.avatarUrl}
                            size="xs"
                            isSpeaking={u.isSpeaking}
                          />
                          <span className="truncate">{u.username}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          {u.role === 'OWNER' && <Crown className="w-3 h-3 text-amber-400" />}
                          {u.role === 'ADMIN' && <Shield className="w-3 h-3 text-indigo-400" />}
                          {u.isMuted && <span className="text-[10px]">🔇</span>}
                          {u.isDeafened && <span className="text-[10px]">🎧</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div>
        {showFullNames ? (
          <div className="px-2 mb-2 flex items-center justify-between text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            <span>Canais de Texto</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gaming-800 text-slate-400">{textChannels.length}</span>
          </div>
        ) : (
          <div className="text-center mb-2">
            <Hash className="w-4 h-4 mx-auto text-slate-500" />
          </div>
        )}

        <div className="space-y-1">
          {textChannels.map(channel => {
            const isActive = activeChannelId === channel.id;
            return (
              <button
                key={channel.id}
                onClick={() => handleSelectChannel(channel.id)}
                className={`w-full flex items-center gap-3 p-2.5 md:p-2 rounded-xl transition ${
                  isActive
                    ? 'bg-gaming-800 text-white font-medium border border-gaming-700/80 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-gaming-850'
                }`}
              >
                <div className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-lg bg-gaming-950/60">
                  <Hash className="w-4 h-4 text-slate-400" />
                </div>
                {showFullNames && <span className="text-sm md:text-xs truncate">{channel.name}</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* 📱 MOBILE: Backdrop escuro quando o menu de canais estiver aberto */}
      {isMobileMenuOpen && (
        <div
          onClick={() => setIsMobileMenuOpen(false)}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 md:hidden animate-fade-in"
        />
      )}

      {/* 📱 MOBILE: Menu deslizante (Drawer) off-canvas */}
      {isMobileMenuOpen && (
        <aside className="fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-gaming-900 border-r border-gaming-800 flex flex-col shadow-2xl md:hidden animate-slide-in pt-safe pb-safe">
          <div className="flex items-center justify-between p-3 border-b border-gaming-800/80">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-indigo-500/15 to-purple-600/15 border border-indigo-500/30 flex items-center justify-center p-1">
                <img src={concordLogo} alt="Concord" className="w-full h-full object-contain" />
              </div>
              <img src={concordWordmark} alt="Concord" className="h-7 w-auto object-contain" />
            </div>
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              aria-label="Fechar menu"
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-gaming-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {renderChannelList(true)}

          <div className="p-3 border-t border-gaming-800 bg-gaming-950/40 flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-slate-400">
              <strong className="text-white font-mono">{onlineUsers.length}</strong> amigos online
            </span>
          </div>
        </aside>
      )}

      {/* 💻 DESKTOP: Barra lateral fixa com recolhimento */}
      <aside
        className={`hidden md:flex relative flex-col h-full bg-gaming-900 border-r border-gaming-800 transition-all duration-300 z-30 ${
          isExpanded ? 'w-64' : 'w-16'
        }`}
      >
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          title={isExpanded ? 'Recolher Canais' : 'Expandir Canais'}
          className="absolute -right-3 top-6 z-40 w-6 h-6 rounded-full bg-gaming-800 border border-gaming-700 flex items-center justify-center text-slate-300 hover:text-white hover:bg-gaming-700 shadow-md transition"
        >
          {isExpanded ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>

        <div className="flex items-center justify-between p-3 border-b border-gaming-800/80">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500/15 to-purple-600/15 border border-indigo-500/30 flex items-center justify-center flex-shrink-0 overflow-hidden shadow-lg p-1 hover:scale-105 transition">
              <img src={concordLogo} alt="Concord" className="w-full h-full object-contain filter drop-shadow-md" />
            </div>
            {isExpanded && (
              <div className="overflow-hidden flex items-center">
                <img src={concordWordmark} alt="Concord" className="h-8 w-auto object-contain filter drop-shadow" />
              </div>
            )}
          </div>
        </div>

        {renderChannelList(isExpanded)}

        <div className="p-3 border-t border-gaming-800 bg-gaming-950/40">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            {isExpanded && (
              <span className="text-xs text-slate-400">
                <strong className="text-white font-mono">{onlineUsers.length}</strong> amigos online
              </span>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};
