import React from 'react';
import { useAuth } from './context/AuthContext';
import { AuthModal } from './components/auth/AuthModal';
import { SidebarChannels } from './components/channels/SidebarChannels';
import { VoiceGrid } from './components/voice/VoiceGrid';
import { ControlBar } from './components/controls/ControlBar';
import { ChatDrawer } from './components/chat/ChatDrawer';
import { RemoteAudioRenderer } from './components/voice/RemoteAudioRenderer';
import { UpdateBanner } from './components/common/UpdateBanner';
import concordLogo from './assets/concord-logo-transparent.png';
import concordWordmark from './assets/concord-wordmark.webp';

export const App = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-screen bg-gaming-950 text-white">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-500/15 to-purple-600/15 border border-indigo-500/30 flex items-center justify-center mb-4 p-2 shadow-2xl animate-pulse">
          <img src={concordLogo} alt="Concord" className="w-full h-full object-contain filter drop-shadow-md" />
        </div>
        <img src={concordWordmark} alt="Concord" className="h-7 w-auto object-contain mx-auto mb-2 animate-pulse filter drop-shadow" />
        <p className="text-xs font-semibold tracking-wider uppercase text-slate-400 font-mono">
          Carregando Hub Gamer...
        </p>
      </div>
    );
  }

  if (!user) {
    return <AuthModal />;
  }

  return (
    <div className="flex flex-col h-[100dvh] w-full bg-gaming-950 text-slate-100 overflow-hidden font-sans pt-safe">
      {/* Banner de Atualização Automática de Novas Versões */}
      <UpdateBanner />

      {/* Área Principal: Sidebar de Canais + Grid Central de Voz/Tela + Gaveta de Chat */}
      <div className="flex flex-1 min-h-0 overflow-hidden relative">
        <SidebarChannels />
        <VoiceGrid />
        <ChatDrawer />
      </div>

      {/* Renderizador de Áudio P2P Contínuo para Amigos Conectados */}
      <RemoteAudioRenderer />

      {/* Barra de Controles Inferior */}
      <ControlBar />
    </div>
  );
};

export default App;
