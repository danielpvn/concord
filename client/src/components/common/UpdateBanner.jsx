import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../services/api';
import { Sparkles, RefreshCw, X } from 'lucide-react';

const BUILD_VERSION = '1.0.1';

export const UpdateBanner = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Sincroniza a versão inicial caso ainda não esteja salva
    if (!localStorage.getItem('concord_client_version')) {
      localStorage.setItem('concord_client_version', BUILD_VERSION);
    }

    const checkVersion = async () => {
      try {
        const data = await apiFetch('/version');
        const currentVersion = localStorage.getItem('concord_client_version') || BUILD_VERSION;

        if (data.version && data.version !== currentVersion) {
          setUpdateInfo(data);
          setUpdateAvailable(true);
        } else {
          setUpdateAvailable(false);
        }
      } catch {
        // Ignora se estiver offline
      }
    };

    checkVersion();
    const interval = setInterval(checkVersion, 30000);
    return () => clearInterval(interval);
  }, []);

  if (!updateAvailable || isDismissed) return null;

  const handleApplyUpdate = () => {
    if (updateInfo?.version) {
      localStorage.setItem('concord_client_version', updateInfo.version);
    }
    // Recarrega a página limpa
    window.location.reload();
  };

  return (
    <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white px-3 sm:px-4 py-2 flex items-center justify-between gap-2 shadow-lg z-50 text-xs font-medium">
      <div className="flex items-center gap-2">
        <span className="p-1 rounded-lg bg-white/20">
          <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-spin" />
        </span>
        <span className="min-w-0 line-clamp-2 sm:line-clamp-none">
          <strong>Nova Versão {updateInfo?.version || 'Disponível'}!</strong> {updateInfo?.releaseNotes || 'Novas melhorias foram lançadas.'}
        </span>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={handleApplyUpdate}
          className="px-3 py-1 bg-white text-indigo-950 hover:bg-slate-100 font-bold rounded-lg transition flex items-center gap-1.5 shadow active:scale-95"
        >
          <RefreshCw className="w-3 h-3" />
          <span className="hidden xs:inline">Atualizar Agora</span>
          <span className="xs:hidden">Atualizar</span>
        </button>
        <button
          onClick={() => setIsDismissed(true)}
          className="p-1 rounded-lg hover:bg-white/20 text-white/80 hover:text-white transition"
          title="Fechar"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
