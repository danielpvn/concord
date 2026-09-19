import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useVoice } from '../../context/VoiceContext';
import { useSocket } from '../../context/SocketContext';
import { Avatar } from '../ui/Avatar';
import { SettingsModal } from '../settings/SettingsModal';
import { AdminManagementModal } from '../admin/AdminManagementModal';
import {
  Mic,
  MicOff,
  Headphones,
  VolumeX,
  Tv,
  Settings,
  Crown,
  MessageSquare,
  PhoneOff,
  LogOut,
  Shield
} from 'lucide-react';

export const ControlBar = () => {
  const { user, isOwner, isAdmin, logout } = useAuth();
  const { isMuted, isDeafened, isSpeaking, isScreenSharing, toggleMute, toggleDeafen, toggleScreenShare } = useVoice();
  const { isChatOpen, setIsChatOpen, unreadChatCount, leaveChannel, activeChannelId } = useSocket();

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);

  const effectivelyMuted = isMuted || user?.isServerMuted;

  return (
    <>
      <footer className="h-16 bg-gaming-900 border-t border-gaming-800 px-2 sm:px-4 flex items-center justify-between z-30 select-none gap-1 sm:gap-3">
        {/* Lado Esquerdo: Perfil do Jogador Conectado */}
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink min-w-0 max-w-[120px] xs:max-w-[150px] sm:max-w-none sm:min-w-[150px]">
          <div className="relative flex-shrink-0">
            <Avatar
              username={user?.username}
              avatarColor={user?.avatarColor}
              avatarUrl={user?.avatarUrl}
              size="sm"
              isSpeaking={isSpeaking}
            />
            {isSpeaking && (
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-emerald-400 ring-2 ring-gaming-900 animate-pulse" />
            )}
          </div>

          <div className="flex flex-col min-w-0 truncate">
            <div className="flex items-center gap-1 truncate">
              <span className="text-xs font-bold text-white leading-tight truncate">
                {user?.username}
              </span>
              {isOwner && <Crown className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-400 flex-shrink-0" title="Dono Supremo" />}
              {!isOwner && isAdmin && <Shield className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-indigo-400 flex-shrink-0" title="Administrador" />}
            </div>

            <span className="text-[10px] text-slate-400 hidden sm:inline truncate">
              {user?.isServerMuted ? (
                <span className="text-red-400 font-semibold">Mutado pelo Servidor</span>
              ) : effectivelyMuted ? (
                'Microfone Mudo'
              ) : isSpeaking ? (
                <span className="text-emerald-400 font-semibold">Falando</span>
              ) : (
                'Conectado'
              )}
            </span>
          </div>
        </div>

        {/* Centro: Controles de Áudio, Vídeo e Ações Gamers */}
        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          {/* Botão de Microfone */}
          <button
            onClick={toggleMute}
            disabled={user?.isServerMuted}
            title={user?.isServerMuted ? 'Você foi mutado por um administrador' : effectivelyMuted ? 'Desmutar Microfone' : 'Mutar Microfone'}
            className={`p-2 sm:p-3 rounded-xl sm:rounded-2xl transition flex items-center justify-center shadow-md ${
              effectivelyMuted
                ? 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'
                : 'bg-gaming-800 text-slate-200 hover:bg-gaming-700 hover:text-white border border-gaming-700'
            } disabled:opacity-50`}
          >
            {effectivelyMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          {/* Botão de Ensurdecer */}
          <button
            onClick={toggleDeafen}
            title={isDeafened ? 'Ativar Fone de Ouvido' : 'Ensurdecer (Mutar todo o Som)'}
            className={`p-2 sm:p-3 rounded-xl sm:rounded-2xl transition flex items-center justify-center shadow-md ${
              isDeafened
                ? 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'
                : 'bg-gaming-800 text-slate-200 hover:bg-gaming-700 hover:text-white border border-gaming-700'
            }`}
          >
            {isDeafened ? <VolumeX className="w-4 h-4" /> : <Headphones className="w-4 h-4" />}
          </button>

          {/* Botão de Compartilhar Tela */}
          <button
            onClick={toggleScreenShare}
            title={isScreenSharing ? 'Parar Compartilhamento de Tela' : 'Compartilhar Tela do Jogo'}
            className={`p-2 sm:p-3 rounded-xl sm:rounded-2xl transition flex items-center justify-center shadow-md ${
              isScreenSharing
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 animate-pulse'
                : 'bg-gaming-800 text-slate-200 hover:bg-gaming-700 hover:text-white border border-gaming-700'
            }`}
          >
            <Tv className="w-4 h-4" />
          </button>

          {/* Botão de Configurações de Áudio & Perfil */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            title="Configurações de Áudio, Foto e Perfil"
            className="p-2 sm:p-3 rounded-xl sm:rounded-2xl bg-gaming-800 text-slate-200 hover:bg-gaming-700 hover:text-white border border-gaming-700 transition shadow-md"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* Botão Exclusivo do Dono */}
          {isOwner && (
            <button
              onClick={() => setIsAdminModalOpen(true)}
              title="Gerenciar Administradores & Resetar Logins (Exclusivo do Dono)"
              className="p-2 sm:p-3 rounded-xl sm:rounded-2xl bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/30 transition shadow-md flex items-center justify-center"
            >
              <Crown className="w-4 h-4" />
            </button>
          )}

          {/* Desconectar da Voz */}
          {activeChannelId && (
            <button
              onClick={leaveChannel}
              title="Desconectar do Canal de Voz"
              className="p-2 sm:p-3 rounded-xl sm:rounded-2xl bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 transition shadow-md flex items-center justify-center"
            >
              <PhoneOff className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Lado Direito: Chat e Logout */}
        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0 justify-end">
          <button
            onClick={() => setIsChatOpen(!isChatOpen)}
            title="Abrir / Fechar Chat"
            className={`relative p-2 sm:p-2.5 px-2.5 sm:px-3.5 rounded-xl transition flex items-center gap-1.5 text-xs font-semibold ${
              isChatOpen
                ? 'bg-gaming-accent text-white shadow-md shadow-indigo-500/20'
                : 'bg-gaming-800 text-slate-300 hover:bg-gaming-700 hover:text-white border border-gaming-700'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span className="hidden md:inline">Chat</span>
            {unreadChatCount > 0 && !isChatOpen && (
              <span className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-red-500 text-white text-[9px] sm:text-[10px] flex items-center justify-center font-bold animate-bounce">
                {unreadChatCount}
              </span>
            )}
          </button>

          <button
            onClick={logout}
            title="Sair da Conta"
            className="p-2 sm:p-2.5 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </footer>

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      {isOwner && <AdminManagementModal isOpen={isAdminModalOpen} onClose={() => setIsAdminModalOpen(false)} />}
    </>
  );
};
