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

// Botão padrão da barra: alvo de toque de 44px no celular, compacto no desktop
const BarButton = ({ onClick, title, variant = 'default', disabled, children, className = '' }) => {
  const variants = {
    default: 'bg-gaming-800 text-slate-200 hover:bg-gaming-700 hover:text-white border-gaming-700',
    danger: 'bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30',
    success: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30',
    owner: 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border-amber-500/30',
    accent: 'bg-gaming-accent text-white border-indigo-400/40',
    ghost: 'bg-transparent text-slate-400 hover:text-red-400 hover:bg-red-500/10 border-transparent'
  };

  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      disabled={disabled}
      className={`relative flex-1 md:flex-none min-w-0 max-w-[56px] md:max-w-none h-11 md:h-auto md:p-3 rounded-xl md:rounded-2xl border transition flex items-center justify-center active:scale-95 disabled:opacity-50 ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
};

const iconClass = 'w-5 h-5 md:w-4 md:h-4';

export const ControlBar = () => {
  const { user, isOwner, isAdmin, logout } = useAuth();
  const { isMuted, isDeafened, isSpeaking, isScreenSharing, micError, toggleMute, toggleDeafen, toggleScreenShare } = useVoice();
  const { isChatOpen, setIsChatOpen, unreadChatCount, leaveChannel, activeChannel } = useSocket();

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);

  const effectivelyMuted = isMuted || user?.isServerMuted;
  const inVoice = activeChannel?.type === 'voice';
  // Celulares (Android/iOS) não suportam captura de tela pelo navegador
  const canScreenShare = typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getDisplayMedia);

  const handleLogout = () => {
    if (window.confirm('Deseja sair da sua conta?')) logout();
  };

  let statusText = inVoice ? 'Conectado à voz' : 'Online';
  if (user?.isServerMuted) {
    statusText = <span className="text-red-400 font-semibold">Mutado pelo Servidor</span>;
  } else if (micError && inVoice) {
    statusText = <span className="text-amber-400 font-semibold">Sem microfone</span>;
  } else if (effectivelyMuted) {
    statusText = 'Microfone Mudo';
  } else if (isSpeaking) {
    statusText = <span className="text-emerald-400 font-semibold">Falando</span>;
  }

  const unreadBadge = unreadChatCount > 99 ? '99+' : unreadChatCount;

  return (
    <>
      <footer className="bg-gaming-900 border-t border-gaming-800 z-30 select-none w-full pb-safe">
        <div className="h-16 px-2 md:px-4 flex items-center justify-between gap-2 md:gap-3">
          {/* Perfil do Jogador (tablet / desktop) */}
          <div className="hidden sm:flex items-center gap-3 min-w-0 flex-shrink sm:min-w-[140px]">
            <div className="relative flex-shrink-0">
              <Avatar
                username={user?.username}
                avatarColor={user?.avatarColor}
                avatarUrl={user?.avatarUrl}
                size="sm"
                isSpeaking={isSpeaking}
              />
              {isSpeaking && (
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 ring-2 ring-gaming-900 animate-pulse" />
              )}
            </div>

            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1 min-w-0">
                <span className="text-xs font-bold text-white leading-tight truncate">{user?.username}</span>
                {isOwner && <Crown className="w-3 h-3 text-amber-400 flex-shrink-0" title="Dono Supremo" />}
                {!isOwner && isAdmin && <Shield className="w-3 h-3 text-indigo-400 flex-shrink-0" title="Administrador" />}
              </div>
              <span className="text-[10px] text-slate-400 truncate">{statusText}</span>
            </div>
          </div>

          {/* Controles: no celular ocupam a largura toda, distribuídos por igual */}
          <div className="flex flex-1 sm:flex-none items-center justify-between sm:justify-center gap-1.5 md:gap-2 min-w-0">
            <BarButton
              onClick={toggleMute}
              disabled={user?.isServerMuted}
              variant={effectivelyMuted ? 'danger' : 'default'}
              title={user?.isServerMuted ? 'Você foi mutado por um administrador' : effectivelyMuted ? 'Desmutar Microfone' : 'Mutar Microfone'}
            >
              {effectivelyMuted ? <MicOff className={iconClass} /> : <Mic className={iconClass} />}
            </BarButton>

            <BarButton
              onClick={toggleDeafen}
              variant={isDeafened ? 'danger' : 'default'}
              title={isDeafened ? 'Ativar Fone de Ouvido' : 'Ensurdecer (Mutar todo o Som)'}
            >
              {isDeafened ? <VolumeX className={iconClass} /> : <Headphones className={iconClass} />}
            </BarButton>

            {canScreenShare && inVoice && (
              <BarButton
                onClick={toggleScreenShare}
                variant={isScreenSharing ? 'success' : 'default'}
                title={isScreenSharing ? 'Parar Compartilhamento de Tela' : 'Compartilhar Tela do Jogo'}
                className={isScreenSharing ? 'animate-pulse' : ''}
              >
                <Tv className={iconClass} />
              </BarButton>
            )}

            {/* Chat (no celular fica junto dos controles) */}
            <BarButton
              onClick={() => setIsChatOpen(!isChatOpen)}
              variant={isChatOpen ? 'accent' : 'default'}
              title="Abrir / Fechar Chat"
              className="md:hidden"
            >
              <MessageSquare className={iconClass} />
              {unreadChatCount > 0 && !isChatOpen && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-bold">
                  {unreadBadge}
                </span>
              )}
            </BarButton>

            <BarButton onClick={() => setIsSettingsOpen(true)} title="Configurações de Áudio, Foto e Perfil">
              <Settings className={iconClass} />
            </BarButton>

            {isOwner && (
              <BarButton
                onClick={() => setIsAdminModalOpen(true)}
                variant="owner"
                title="Gerenciar Administradores & Resetar Logins (Exclusivo do Dono)"
              >
                <Crown className={iconClass} />
              </BarButton>
            )}

            {inVoice && (
              <BarButton onClick={leaveChannel} variant="danger" title="Desconectar do Canal de Voz">
                <PhoneOff className={iconClass} />
              </BarButton>
            )}

            <BarButton onClick={handleLogout} variant="ghost" title="Sair da Conta" className="md:hidden">
              <LogOut className={iconClass} />
            </BarButton>
          </div>

          {/* Lado Direito (desktop): Chat e Logout */}
          <div className="hidden md:flex items-center gap-2 flex-shrink-0 justify-end">
            <button
              onClick={() => setIsChatOpen(!isChatOpen)}
              title="Abrir / Fechar Chat"
              className={`relative p-2.5 px-3.5 rounded-xl transition flex items-center gap-1.5 text-xs font-semibold ${
                isChatOpen
                  ? 'bg-gaming-accent text-white shadow-md shadow-indigo-500/20'
                  : 'bg-gaming-800 text-slate-300 hover:bg-gaming-700 hover:text-white border border-gaming-700'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span>Chat</span>
              {unreadChatCount > 0 && !isChatOpen && (
                <span className="min-w-[20px] h-5 px-1 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-bold">
                  {unreadBadge}
                </span>
              )}
            </button>

            <button
              onClick={handleLogout}
              title="Sair da Conta"
              className="p-2.5 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </footer>

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      {isOwner && <AdminManagementModal isOpen={isAdminModalOpen} onClose={() => setIsAdminModalOpen(false)} />}
    </>
  );
};
