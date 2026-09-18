import React, { useState, useRef, useEffect } from 'react';
import { useSocket } from '../../context/SocketContext';
import { useVoice } from '../../context/VoiceContext';
import { useAuth } from '../../context/AuthContext';
import { Avatar } from '../ui/Avatar';
import {
  Mic,
  MicOff,
  Headphones,
  Crown,
  Shield,
  Volume2,
  VolumeX,
  Maximize,
  Radio,
  MoreVertical,
  MoveRight,
  UserX
} from 'lucide-react';

export const VoiceGrid = () => {
  const { onlineUsers, activeChannel, activeChannelId, adminServerMute, adminKickVoice, adminMoveUser, channels } = useSocket();
  const { user, isAdmin, isOwner } = useAuth();
  const {
    isSpeaking,
    isMuted,
    isDeafened,
    isScreenSharing,
    screenStream,
    remoteStreams,
    remoteScreenStreams,
    userVolumes,
    setUserVolume
  } = useVoice();

  const [contextMenu, setContextMenu] = useState(null);
  const videoRef = useRef(null);

  // Filtra amigos conectados na mesma sala de voz ativa
  const roomUsers = onlineUsers.filter(u => u.channelId === activeChannelId);

  // Encontra se alguém está compartilhando tela na sala (local ou remoto)
  const remoteScreenUser = roomUsers.find(u => u.isScreenSharing && u.userId !== user?.id);
  const activeScreenStream = isScreenSharing
    ? screenStream
    : remoteScreenUser && remoteScreenStreams[remoteScreenUser.socketId];

  useEffect(() => {
    if (videoRef.current && activeScreenStream) {
      videoRef.current.srcObject = activeScreenStream;
    }
  }, [activeScreenStream]);

  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  const handleContextMenu = (e, targetUser) => {
    e.preventDefault();
    if (!isAdmin) return;
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      targetUser
    });
  };

  const handleDragStart = (e, userId) => {
    if (isAdmin) {
      e.dataTransfer.setData('text/plain', userId);
    }
  };

  const isTextChannel = activeChannel?.type === 'text';

  if (isTextChannel) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-gaming-950">
        <div className="w-16 h-16 rounded-3xl bg-gaming-900 border border-gaming-800 flex items-center justify-center text-3xl mb-4 shadow-xl">
          💬
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Canal de Texto #{activeChannel?.name}</h2>
        <p className="text-sm text-slate-400 max-w-md">
          Abra a gaveta de chat à direita para conversar, enviar prints ou arrastar imagens para seus amigos.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-gaming-950 p-6 overflow-hidden relative">
      {/* Transmissão de Tela Ativa */}
      {activeScreenStream ? (
        <div className="flex-1 flex flex-col h-full gap-4">
          <div className="relative flex-1 bg-black rounded-2xl overflow-hidden border border-gaming-800 flex items-center justify-center group shadow-2xl">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full h-full object-contain"
            />

            {/* Badge de Transmissão */}
            <div className="absolute top-4 left-4 px-3 py-1.5 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs font-semibold text-white tracking-wide flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-red-400" />
                {isScreenSharing ? 'Sua Transmissão' : `Tela de ${remoteScreenUser?.username}`}
              </span>
            </div>

            <button
              onClick={() => videoRef.current?.requestFullscreen()}
              title="Tela Cheia"
              className="absolute bottom-4 right-4 p-2.5 rounded-xl bg-black/60 hover:bg-black/80 backdrop-blur-md text-white border border-white/10 transition transform group-hover:scale-105"
            >
              <Maximize className="w-4 h-4" />
            </button>
          </div>

          {/* Miniatura dos Participantes na parte inferior */}
          <div className="h-24 flex items-center gap-3 overflow-x-auto py-2">
            {roomUsers.map(u => {
              const isCurrentUser = u.userId === user?.id;
              const isUserSpeaking = isCurrentUser ? isSpeaking : u.isSpeaking;
              const isUserMuted = isCurrentUser ? isMuted || user?.isServerMuted : u.isMuted || u.isServerMuted;

              return (
                <div
                  key={u.socketId || u.userId}
                  className={`flex-shrink-0 flex items-center gap-2.5 px-3 py-2 rounded-xl bg-gaming-900 border transition ${
                    isUserSpeaking ? 'border-emerald-400 ring-2 ring-emerald-500/40' : 'border-gaming-800'
                  }`}
                >
                  <Avatar
                    username={u.username}
                    avatarColor={u.avatarColor}
                    avatarUrl={u.avatarUrl}
                    size="sm"
                    isSpeaking={isUserSpeaking}
                  />
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-slate-200 truncate max-w-[80px]">{u.username}</span>
                    <span className="text-[10px] text-slate-500">
                      {isUserMuted ? 'Mutado' : isUserSpeaking ? 'Falando' : 'Ouvindo'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Grade Dinâmica de Avatares */
        <div className="flex-1 flex flex-col justify-center">
          {roomUsers.length === 0 ? (
            <div className="text-center text-slate-500">
              <p className="text-base font-medium">Nenhum amigo neste canal de voz no momento.</p>
              <p className="text-xs mt-1 text-slate-600">Seus amigos podem entrar clicando no canal na barra lateral.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-h-full overflow-y-auto p-2">
              {roomUsers.map(u => {
                const isCurrentUser = u.userId === user?.id;
                const isUserSpeaking = isCurrentUser ? isSpeaking : u.isSpeaking;
                const isUserMuted = isCurrentUser ? isMuted || user?.isServerMuted : u.isMuted || u.isServerMuted;
                const currentVolume = userVolumes[u.userId] ?? 100;

                return (
                  <div
                    key={u.socketId || u.userId}
                    draggable={isAdmin}
                    onDragStart={(e) => handleDragStart(e, u.userId)}
                    onContextMenu={(e) => handleContextMenu(e, u)}
                    className={`relative flex flex-col items-center justify-center p-6 rounded-2xl bg-gaming-900/90 border transition-all duration-200 group shadow-lg ${
                      isUserSpeaking
                        ? 'border-emerald-400 ring-4 ring-emerald-500/30 scale-[1.02]'
                        : 'border-gaming-800 hover:border-gaming-700'
                    } ${isAdmin ? 'cursor-grab active:cursor-grabbing' : ''}`}
                  >
                    {/* Badge de Cargo */}
                    <div className="absolute top-3 left-3 flex items-center gap-1.5">
                      {u.role === 'OWNER' && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-400 text-[10px] font-bold flex items-center gap-1">
                          <Crown className="w-3 h-3 text-amber-400" />
                          DONO
                        </span>
                      )}
                      {u.role === 'ADMIN' && (
                        <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 text-[10px] font-bold flex items-center gap-1">
                          <Shield className="w-3 h-3 text-indigo-400" />
                          ADMIN
                        </span>
                      )}
                    </div>

                    {/* Indicadores de Mudo / Som */}
                    <div className="absolute top-3 right-3 flex items-center gap-1">
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

                    {/* Avatar do Jogador com Imagem ou Letra */}
                    <div className="relative mb-3 mt-2">
                      <Avatar
                        username={u.username}
                        avatarColor={u.avatarColor}
                        avatarUrl={u.avatarUrl}
                        size="xl"
                        isSpeaking={isUserSpeaking}
                      />

                      {isUserSpeaking && (
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center ring-2 ring-gaming-900 shadow-md">
                          <Volume2 className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </div>

                    {/* Nome do Jogador */}
                    <h3 className="text-sm font-bold text-white tracking-wide truncate max-w-[150px]">
                      {u.username} {isCurrentUser && <span className="text-[10px] text-slate-400 font-normal">(Você)</span>}
                    </h3>

                    {/* Controle de Volume Individual por Amigo */}
                    {!isCurrentUser && (
                      <div className="w-full mt-3 pt-3 border-t border-gaming-800/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2">
                        <Volume2 className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <input
                          type="range"
                          min="0"
                          max="200"
                          value={currentVolume}
                          onChange={(e) => setUserVolume(u.userId, parseInt(e.target.value, 10))}
                          className="w-full h-1 bg-gaming-700 rounded-lg appearance-none cursor-pointer accent-gaming-accent"
                        />
                        <span className="text-[10px] font-mono text-slate-400 w-7 text-right">{currentVolume}%</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Menu de Contexto de Moderação */}
      {contextMenu && (
        <div
          className="fixed z-50 w-52 bg-gaming-900 border border-gaming-700 rounded-xl shadow-2xl py-1.5 overflow-hidden text-xs"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-1.5 border-b border-gaming-800 text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
            Moderar: {contextMenu.targetUser.username}
          </div>

          <button
            onClick={() => {
              adminServerMute(contextMenu.targetUser.userId, !contextMenu.targetUser.isServerMuted);
              setContextMenu(null);
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-slate-300 hover:text-white hover:bg-gaming-800 transition text-left"
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
              className="w-full flex items-center gap-2 px-3 py-2 text-slate-300 hover:text-white hover:bg-gaming-800 transition text-left"
            >
              <MoveRight className="w-3.5 h-3.5 text-indigo-400" />
              <span>Mover para {c.name}</span>
            </button>
          ))}

          <button
            onClick={() => {
              adminKickVoice(contextMenu.targetUser.userId);
              setContextMenu(null);
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 transition text-left border-t border-gaming-800"
          >
            <UserX className="w-3.5 h-3.5" />
            <span>Desconectar da Voz</span>
          </button>
        </div>
      )}
    </div>
  );
};
