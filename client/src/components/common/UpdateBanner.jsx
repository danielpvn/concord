import React, { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../../services/api';
import { Sparkles, RefreshCw, X } from 'lucide-react';

const CHECK_INTERVAL_MS = 60 * 1000;

// Mostra um aviso quando uma nova versão do Concord é publicada enquanto a página está aberta
export const UpdateBanner = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const loadedVersionRef = useRef(null);

  useEffect(() => {
    const checkVersion = async () => {
      try {
        const data = await apiFetch('/version');
        if (!data?.version || data.version === 'dev') return;

        // A primeira resposta é a versão que esta página carregou
        if (!loadedVersionRef.current) {
          loadedVersionRef.current = data.version;
          return;
        }
        if (data.version !== loadedVersionRef.current) {
          setUpdateAvailable(true);
        }
      } catch {
        // Ignora se estiver offline ou o servidor estiver reiniciando
      }
    };

    checkVersion();
    const interval = setInterval(checkVersion, CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  if (!updateAvailable || isDismissed) return null;

  return (
    <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white px-3 sm:px-4 py-2 flex items-center justify-between gap-2 shadow-lg z-50 text-xs font-medium">
      <div className="flex items-center gap-2 min-w-0">
        <span className="p-1 rounded-lg bg-white/20 flex-shrink-0">
          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
        </span>
        <span className="min-w-0 line-clamp-2 sm:line-clamp-none">
          <strong>Nova versão do Concord disponível!</strong>{' '}
          <span className="hidden sm:inline">Atualize para receber as melhorias (você volta para a mesma sala).</span>
        </span>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={() => window.location.reload()}
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
          aria-label="Fechar aviso"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
