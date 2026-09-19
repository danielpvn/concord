import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../services/api';
import { Crown, Shield, UserX, X, Check, AlertCircle, KeyRound, Copy, Trash2 } from 'lucide-react';

export const AdminManagementModal = ({ isOpen, onClose }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState(null);

  // Estado para o modal de reset de senha
  const [resetModalUser, setResetModalUser] = useState(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [copiedNotification, setCopiedNotification] = useState(false);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/admin/users');
      setUsers(data.users);
    } catch (err) {
      console.error('Erro ao carregar usuários:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadUsers();
    }
  }, [isOpen]);

  const handlePromote = async (userId) => {
    try {
      const data = await apiFetch(`/admin/users/${userId}/promote`, { method: 'POST' });
      setFeedback({ type: 'success', text: data.message });
      loadUsers();
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    }
  };

  const handleDemote = async (userId) => {
    try {
      const data = await apiFetch(`/admin/users/${userId}/demote`, { method: 'POST' });
      setFeedback({ type: 'success', text: data.message });
      loadUsers();
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    }
  };

  const handleDeleteUser = async (targetUser) => {
    if (!window.confirm(`Deseja realmente excluir a conta de "${targetUser.username}"?`)) return;
    try {
      const data = await apiFetch(`/admin/users/${targetUser.id}`, { method: 'DELETE' });
      setFeedback({ type: 'success', text: data.message });
      loadUsers();
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    }
  };

  const handleResetAllMembers = async () => {
    if (!window.confirm('⚠️ ATENÇÃO: Deseja realmente zerar todas as contas e mensagens de amigos no servidor? A sua conta de Dono permanecerá salva e intacta.')) return;
    try {
      const data = await apiFetch('/admin/reset-all-members', { method: 'POST' });
      setFeedback({ type: 'success', text: data.message });
      loadUsers();
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    }
  };

  const handleOpenResetModal = (targetUser) => {
    setResetModalUser(targetUser);
    // Gera uma senha temporária sugerida aleatória de 6 dígitos
    const randomPass = Math.floor(100000 + Math.random() * 900000).toString();
    setNewPasswordInput(randomPass);
  };

  const handleConfirmResetPassword = async (e) => {
    e.preventDefault();
    if (!resetModalUser || !newPasswordInput.trim()) return;

    setIsResetting(true);
    try {
      const data = await apiFetch(`/admin/users/${resetModalUser.id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ newPassword: newPasswordInput.trim() })
      });
      setFeedback({ type: 'success', text: data.message });
      setResetModalUser(null);
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setIsResetting(false);
    }
  };

  const handleCopyPassword = () => {
    navigator.clipboard.writeText(newPasswordInput);
    setCopiedNotification(true);
    setTimeout(() => setCopiedNotification(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
        <div className="w-full max-w-xl bg-gaming-900 border border-gaming-700/80 rounded-2xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
          {/* Topo do modal */}
          <div className="flex items-center justify-between pb-4 border-b border-gaming-800">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <Crown className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Gerenciamento de Membros & Administradores</h2>
                <p className="text-xs text-slate-400">Controle de permissões e recuperação de senhas</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-gaming-800 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Feedback visual */}
          {feedback && (
            <div
              className={`mt-4 p-3 rounded-xl text-xs flex items-center gap-2 ${
                feedback.type === 'success'
                  ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                  : 'bg-red-500/10 border border-red-500/30 text-red-400'
              }`}
            >
              {feedback.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              <span>{feedback.text}</span>
            </div>
          )}

          {/* Informação sobre a regra de negócio */}
          <div className="mt-4 p-3 bg-gaming-950 rounded-xl border border-gaming-800 text-[11px] text-slate-400 leading-relaxed space-y-1">
            <p>
              👑 <strong>Cargos:</strong> Somente você (Dono) pode nomear ou revogar outros administradores.
            </p>
            <p>
              🔑 <strong>Esqueceu a senha?</strong> Você pode redefinir a senha de qualquer amigo com 1 clique no botão de chave ao lado do nome dele.
            </p>
          </div>

          {/* Lista de Usuários */}
          <div className="mt-4 max-h-80 overflow-y-auto space-y-2 pr-1">
            {loading ? (
              <div className="text-center py-8 text-xs text-slate-500">Carregando usuários...</div>
            ) : (
              users.map(u => (
                <div
                  key={u.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-gaming-950/70 border border-gaming-800 gap-2"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs text-white flex-shrink-0"
                      style={{ backgroundColor: u.avatarColor || '#6366f1' }}
                    >
                      {u.username.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="text-xs font-bold text-slate-200 truncate">{u.username}</span>
                        {u.role === 'OWNER' && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 font-bold">
                            DONO 👑
                          </span>
                        )}
                        {u.role === 'ADMIN' && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-400 font-bold">
                            ADMIN 🛡️
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-500 block">Cadastrado em {new Date(u.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {/* Ações de Dono & Reset de Senha */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {/* Botão de Reset de Senha */}
                    <button
                      onClick={() => handleOpenResetModal(u)}
                      title={`Redefinir senha de ${u.username}`}
                      className="p-1.5 rounded-lg bg-gaming-800 hover:bg-gaming-700 text-slate-300 hover:text-white border border-gaming-700 text-xs transition flex items-center gap-1"
                    >
                      <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                      <span className="hidden sm:inline">Reset Senha</span>
                    </button>

                    {/* Botões de Cargo & Exclusão */}
                    {u.role === 'OWNER' ? (
                      <span className="text-xs text-slate-500 italic px-2">Dono</span>
                    ) : (
                      <>
                        {u.role === 'ADMIN' ? (
                          <button
                            onClick={() => handleDemote(u.id)}
                            className="px-2.5 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-medium transition"
                          >
                            Remover Admin
                          </button>
                        ) : (
                          <button
                            onClick={() => handlePromote(u.id)}
                            className="px-2.5 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 text-xs font-medium transition flex items-center gap-1"
                          >
                            <Shield className="w-3.5 h-3.5" />
                            <span>Tornar Admin</span>
                          </button>
                        )}

                        {/* Botão de Excluir Usuário */}
                        <button
                          onClick={() => handleDeleteUser(u)}
                          title={`Excluir conta de ${u.username}`}
                          className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs transition"
                        >
                          <UserX className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Rodapé */}
          <div className="mt-6 pt-4 border-t border-gaming-800 flex items-center justify-between">
            <button
              onClick={handleResetAllMembers}
              title="Apagar todas as contas de membros e mensagens do servidor"
              className="px-3 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-medium transition flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Zerar Contas de Amigos</span>
            </button>

            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-gaming-800 hover:bg-gaming-700 text-slate-200 text-xs font-medium transition"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>

      {/* Modal Popup para Inserir a Nova Senha do Usuário */}
      {resetModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fade-in">
          <div className="w-full max-w-sm bg-gaming-900 border border-gaming-700 rounded-2xl p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-gaming-800">
              <div className="flex items-center gap-2 text-amber-400">
                <KeyRound className="w-4 h-4" />
                <h3 className="text-sm font-bold text-white">Resetar Senha de {resetModalUser.username}</h3>
              </div>
              <button
                onClick={() => setResetModalUser(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmResetPassword} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs text-slate-300 mb-1.5">
                  Nova senha para <strong>{resetModalUser.username}</strong>:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    required
                    value={newPasswordInput}
                    onChange={(e) => setNewPasswordInput(e.target.value)}
                    placeholder="Digite a nova senha"
                    className="flex-1 px-3 py-2 bg-gaming-950 border border-gaming-700 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-amber-400"
                  />
                  <button
                    type="button"
                    onClick={handleCopyPassword}
                    title="Copiar senha para a área de transferência"
                    className="p-2 rounded-xl bg-gaming-800 hover:bg-gaming-700 text-slate-300 border border-gaming-700 transition"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
                {copiedNotification && (
                  <p className="text-[10px] text-emerald-400 mt-1">✓ Senha copiada! Envie para seu amigo no WhatsApp/chat.</p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gaming-800">
                <button
                  type="button"
                  onClick={() => setResetModalUser(null)}
                  className="px-3 py-1.5 rounded-lg bg-gaming-800 text-slate-300 text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isResetting || !newPasswordInput.trim()}
                  className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs transition shadow disabled:opacity-50"
                >
                  {isResetting ? 'Salvando...' : 'Salvar Nova Senha'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
