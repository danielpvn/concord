import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useVoice } from '../../context/VoiceContext';
import { useSocket } from '../../context/SocketContext';
import { Avatar } from '../ui/Avatar';
import { ImageCropperModal } from '../ui/ImageCropperModal';
import { getAuthToken, apiFetch, API_BASE, getFullMediaUrl } from '../../services/api';
import {
  X,
  Mic,
  Sliders,
  Palette,
  Check,
  Upload,
  Image as ImageIcon,
  Trash2,
  Link2,
  Globe,
  Crop,
  Lock,
  KeyRound,
  AlertCircle,
  User
} from 'lucide-react';

const AVATAR_COLORS = [
  '#6366f1',
  '#8b5cf6',
  '#ec4899',
  '#ef4444',
  '#f97316',
  '#10b981',
  '#06b6d4',
  '#3b82f6',
];

export const SettingsModal = ({ isOpen, onClose }) => {
  const { user, updateProfile } = useAuth();
  const { micLevel, sensitivityThreshold, updateSensitivity, isSpeaking } = useVoice();
  const { broadcastProfileUpdate } = useSocket();

  const [selectedColor, setSelectedColor] = useState(user?.avatarColor || AVATAR_COLORS[0]);
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || null);
  const [webLinkInput, setWebLinkInput] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [avatarSourceTab, setAvatarSourceTab] = useState('upload'); // 'upload' | 'link'

  // Troca de Apelido / Nome de Jogador
  const [usernameInput, setUsernameInput] = useState(user?.username || '');
  const [usernameFeedback, setUsernameFeedback] = useState(null);
  const [isSavingUsername, setIsSavingUsername] = useState(false);

  // Troca de Senha Própria
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordFeedback, setPasswordFeedback] = useState(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Estado do Cropper de Imagem
  const [cropperOpen, setCropperOpen] = useState(false);
  const [tempImageToCrop, setTempImageToCrop] = useState(null);

  const fileInputRef = useRef(null);

  useEffect(() => {
    if (user) {
      setSelectedColor(user.avatarColor || AVATAR_COLORS[0]);
      setAvatarUrl(user.avatarUrl || null);
      setUsernameInput(user.username || '');
    }
  }, [user, isOpen]);

  if (!isOpen) return null;

  const handleSaveUsername = async (e) => {
    e.preventDefault();
    setUsernameFeedback(null);

    const clean = usernameInput.trim();
    if (!clean) {
      setUsernameFeedback({ type: 'error', text: 'O apelido não pode estar vazio.' });
      return;
    }

    if (clean.length < 2 || clean.length > 20) {
      setUsernameFeedback({ type: 'error', text: 'O apelido deve ter entre 2 e 20 caracteres.' });
      return;
    }

    if (clean === user?.username) {
      setUsernameFeedback({ type: 'info', text: 'Esse já é o seu apelido atual.' });
      return;
    }

    setIsSavingUsername(true);
    try {
      const updatedUser = await updateProfile({ username: clean });
      broadcastProfileUpdate({
        username: updatedUser.username,
        avatarColor: updatedUser.avatarColor,
        avatarUrl: updatedUser.avatarUrl
      });
      setUsernameFeedback({ type: 'success', text: `Apelido alterado para "${updatedUser.username}" com sucesso!` });
      setTimeout(() => setUsernameFeedback(null), 3000);
    } catch (err) {
      setUsernameFeedback({ type: 'error', text: err.message || 'Erro ao alterar apelido.' });
    } finally {
      setIsSavingUsername(false);
    }
  };

  const handleAvatarFileSelected = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setTempImageToCrop(reader.result);
      setCropperOpen(true);
    };
    reader.readAsDataURL(file);

    e.target.value = '';
  };

  const handleWebLinkSubmit = (e) => {
    e.preventDefault();
    if (!webLinkInput.trim()) return;

    setTempImageToCrop(webLinkInput.trim());
    setCropperOpen(true);
  };

  const handleCropComplete = async (croppedBlob, croppedDataUrl) => {
    setCropperOpen(false);
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('avatar', croppedBlob, 'avatar.webp');

      const token = getAuthToken();
      const res = await fetch(`${API_BASE}/auth/avatar`, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: formData
      });

      const data = await res.json();
      if (res.ok && data.avatarUrl) {
        setAvatarUrl(data.avatarUrl);
        const updated = await updateProfile({ avatarUrl: data.avatarUrl, avatarColor: selectedColor });
        broadcastProfileUpdate({ username: updated.username, avatarColor: selectedColor, avatarUrl: data.avatarUrl });
        setSaveSuccess(true);
        setWebLinkInput('');
        setTimeout(() => setSaveSuccess(false), 2000);
      } else {
        setAvatarUrl(croppedDataUrl);
        const updated = await updateProfile({ avatarUrl: croppedDataUrl, avatarColor: selectedColor });
        broadcastProfileUpdate({ username: updated.username, avatarColor: selectedColor, avatarUrl: croppedDataUrl });
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
      }
    } catch (err) {
      console.error('Erro ao salvar avatar cortado:', err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemovePhoto = async () => {
    setAvatarUrl(null);
    setWebLinkInput('');
    const updated = await updateProfile({ avatarUrl: null, avatarColor: selectedColor });
    broadcastProfileUpdate({ username: updated.username, avatarColor: selectedColor, avatarUrl: null });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const handleColorChange = async (color) => {
    setSelectedColor(color);
    const updated = await updateProfile({ avatarColor: color, avatarUrl });
    broadcastProfileUpdate({ username: updated.username, avatarColor: color, avatarUrl });
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordFeedback(null);

    if (newPassword !== confirmNewPassword) {
      setPasswordFeedback({ type: 'error', text: 'A nova senha e a confirmação não coincidem.' });
      return;
    }

    if (newPassword.length < 3) {
      setPasswordFeedback({ type: 'error', text: 'A nova senha deve ter no mínimo 3 caracteres.' });
      return;
    }

    setIsChangingPassword(true);
    try {
      const data = await apiFetch('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword })
      });
      setPasswordFeedback({ type: 'success', text: data.message });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (err) {
      setPasswordFeedback({ type: 'error', text: err.message });
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
        <div className="w-full max-w-lg bg-gaming-900 border border-gaming-700/80 rounded-2xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between pb-4 border-b border-gaming-800">
            <div className="flex items-center gap-2">
              <Sliders className="w-5 h-5 text-indigo-400" />
              <h2 className="text-base font-bold text-white">Configurações de Áudio & Perfil</h2>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-gaming-800 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-6 space-y-6">
            {/* Seção 1: Apelido / Nome de Jogador */}
            <div>
              <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <User className="w-4 h-4 text-indigo-400" />
                Seu Apelido (Nome no Concord)
              </h3>
              <form onSubmit={handleSaveUsername} className="p-3.5 bg-gaming-950 border border-gaming-800 rounded-2xl space-y-2">
                {usernameFeedback && (
                  <div
                    className={`p-2.5 rounded-xl text-xs flex items-center gap-2 ${
                      usernameFeedback.type === 'success'
                        ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                        : usernameFeedback.type === 'info'
                        ? 'bg-blue-500/10 border border-blue-500/30 text-blue-400'
                        : 'bg-red-500/10 border border-red-500/30 text-red-400'
                    }`}
                  >
                    {usernameFeedback.type === 'success' ? <Check className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
                    <span>{usernameFeedback.text}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    required
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    placeholder="Seu novo apelido"
                    maxLength={20}
                    className="flex-1 px-3 py-2 bg-gaming-900 border border-gaming-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-gaming-accent font-medium"
                  />
                  <button
                    type="submit"
                    disabled={isSavingUsername || !usernameInput.trim() || usernameInput.trim() === user?.username}
                    className="px-4 py-2 bg-gaming-accent hover:bg-indigo-600 text-white rounded-xl text-xs font-medium transition flex items-center gap-1.5 disabled:opacity-40 shadow-sm"
                  >
                    {isSavingUsername ? 'Salvando...' : 'Salvar Apelido'}
                  </button>
                </div>
                <p className="text-[10px] text-slate-500">
                  De 2 a 20 caracteres. O novo nome atualizará imediatamente em todos os canais de voz e no chat!
                </p>
              </form>
            </div>

            {/* Seção 2: Avatar e Foto Personalizada */}
            <div>
              <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-indigo-400" />
                Sua Foto de Perfil / Avatar
              </h3>

              <div className="p-4 bg-gaming-950 border border-gaming-800 rounded-2xl space-y-4">
                <div className="flex items-center gap-4">
                  <Avatar
                    username={user?.username}
                    avatarColor={selectedColor}
                    avatarUrl={avatarUrl}
                    size="lg"
                    className="ring-2 ring-gaming-700 shadow-xl"
                  />

                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-bold text-white block truncate">{user?.username}</span>
                    <span className="text-[11px] text-slate-400 block mt-0.5">
                      {avatarUrl ? 'Foto personalizada ativa' : 'Usando cor padrão'}
                    </span>
                    <div className="flex items-center gap-3 mt-2">
                      {avatarUrl && (
                        <button
                          type="button"
                          onClick={() => {
                            setTempImageToCrop(getFullMediaUrl(avatarUrl));
                            setCropperOpen(true);
                          }}
                          className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 hover:underline font-medium"
                        >
                          <Crop className="w-3.5 h-3.5" />
                          <span>Redimensionar</span>
                        </button>
                      )}

                      {avatarUrl && (
                        <button
                          type="button"
                          onClick={handleRemovePhoto}
                          className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 hover:underline"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Remover</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 border-b border-gaming-800 pb-2">
                  <button
                    type="button"
                    onClick={() => setAvatarSourceTab('upload')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
                      avatarSourceTab === 'upload'
                        ? 'bg-gaming-800 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Do Computador</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAvatarSourceTab('link')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
                      avatarSourceTab === 'link'
                        ? 'bg-gaming-800 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>Link da Web (Google / URL)</span>
                  </button>
                </div>

                {avatarSourceTab === 'upload' && (
                  <div>
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/*"
                      className="hidden"
                      onChange={handleAvatarFileSelected}
                    />

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="w-full py-2.5 px-4 bg-gaming-accent hover:bg-indigo-600 text-white rounded-xl text-xs font-medium transition flex items-center justify-center gap-2 shadow-md disabled:opacity-50"
                    >
                      <Upload className="w-4 h-4" />
                      <span>{isUploading ? 'Processando...' : 'Escolher Imagem no PC'}</span>
                    </button>
                    <p className="text-[10px] text-slate-500 mt-1.5 text-center">PNG, JPG, WEBP ou GIF (com ajuste de zoom e corte)</p>
                  </div>
                )}

                {avatarSourceTab === 'link' && (
                  <form onSubmit={handleWebLinkSubmit} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="url"
                        value={webLinkInput}
                        onChange={(e) => setWebLinkInput(e.target.value)}
                        placeholder="Cole o link da imagem (ex: https://site.com/foto.png)"
                        className="flex-1 px-3 py-2 bg-gaming-900 border border-gaming-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-gaming-accent"
                      />
                      <button
                        type="submit"
                        disabled={!webLinkInput.trim() || isUploading}
                        className="px-3.5 py-2 bg-gaming-accent hover:bg-indigo-600 text-white rounded-xl text-xs font-medium transition flex items-center gap-1.5 disabled:opacity-40"
                      >
                        <Link2 className="w-3.5 h-3.5" />
                        <span>Ajustar</span>
                      </button>
                    </div>
                  </form>
                )}
              </div>

              <div className="mt-3">
                <label className="block text-[11px] text-slate-400 mb-1.5">Cor de destaque do perfil:</label>
                <div className="flex items-center justify-between gap-2 p-2 bg-gaming-950 border border-gaming-800 rounded-xl">
                  {AVATAR_COLORS.map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => handleColorChange(color)}
                      style={{ backgroundColor: color }}
                      className={`w-7 h-7 rounded-full transition transform ${
                        selectedColor === color ? 'scale-125 ring-2 ring-white shadow-lg' : 'hover:scale-110 opacity-70 hover:opacity-100'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Seção 2: Microfone e Sensibilidade de Voz */}
            <div>
              <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Mic className="w-4 h-4 text-emerald-400" />
                Sensibilidade de Ativação por Voz (Noise Gate)
              </h3>
              <p className="text-[11px] text-slate-400 mb-3">
                Fale no microfone para calibrar. Quando a barra verde ultrapassar a linha branca, seu áudio será transmitido.
              </p>

              <div className="space-y-1.5 bg-gaming-950 p-3.5 rounded-xl border border-gaming-800">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Volume Captado:</span>
                  <span className={`font-mono font-bold ${isSpeaking ? 'text-emerald-400' : 'text-slate-500'}`}>
                    {isSpeaking ? '🟢 Falando' : '⚪ Silêncio'}
                  </span>
                </div>

                <div className="relative w-full h-3 bg-gaming-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-75 rounded-full"
                    style={{ width: `${micLevel}%` }}
                  />
                  <div
                    className="absolute top-0 bottom-0 w-1 bg-white shadow-lg"
                    style={{ left: `${sensitivityThreshold}%` }}
                  />
                </div>

                <div className="pt-3">
                  <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                    <span>Mais Sensível (Capta sussurros)</span>
                    <span>Menos Sensível (Corta ruídos)</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="80"
                    value={sensitivityThreshold}
                    onChange={(e) => updateSensitivity(parseInt(e.target.value, 10))}
                    className="w-full h-1.5 bg-gaming-700 rounded-lg appearance-none cursor-pointer accent-gaming-accent"
                  />
                </div>
              </div>
            </div>

            {/* Seção 3: Alterar Própria Senha */}
            <div>
              <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-amber-400" />
                Segurança da Conta (Alterar Minha Senha)
              </h3>

              <form onSubmit={handleChangePassword} className="p-4 bg-gaming-950 border border-gaming-800 rounded-2xl space-y-3">
                {passwordFeedback && (
                  <div
                    className={`p-2.5 rounded-xl text-xs flex items-center gap-2 ${
                      passwordFeedback.type === 'success'
                        ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                        : 'bg-red-500/10 border border-red-500/30 text-red-400'
                    }`}
                  >
                    {passwordFeedback.type === 'success' ? <Check className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
                    <span>{passwordFeedback.text}</span>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Senha Atual:</label>
                  <input
                    type="password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-1.5 bg-gaming-900 border border-gaming-700 rounded-xl text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Nova Senha:</label>
                    <input
                      type="password"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Nova senha"
                      className="w-full px-3 py-1.5 bg-gaming-900 border border-gaming-700 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Confirmar Nova Senha:</label>
                    <input
                      type="password"
                      required
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      placeholder="Repita a nova senha"
                      className="w-full px-3 py-1.5 bg-gaming-900 border border-gaming-700 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={isChangingPassword || !currentPassword || !newPassword}
                    className="px-4 py-1.5 bg-gaming-800 hover:bg-gaming-700 text-slate-200 text-xs font-medium rounded-xl border border-gaming-700 transition disabled:opacity-40"
                  >
                    {isChangingPassword ? 'Alterando...' : 'Salvar Nova Senha'}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Rodapé com feedback */}
          <div className="mt-6 pt-4 border-t border-gaming-800 flex items-center justify-between">
            {saveSuccess ? (
              <span className="text-xs text-emerald-400 flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Avatar atualizado com sucesso!
              </span>
            ) : <div />}

            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-gaming-accent hover:bg-indigo-600 text-white text-xs font-medium transition shadow-md"
            >
              Concluído
            </button>
          </div>
        </div>
      </div>

      {/* Modal de Redimensionamento e Ajuste de Imagem */}
      <ImageCropperModal
        isOpen={cropperOpen}
        imageSrc={tempImageToCrop}
        onCropComplete={handleCropComplete}
        onCancel={() => setCropperOpen(false)}
      />
    </>
  );
};
