import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Sparkles, User, Lock, ArrowRight, Eye, EyeOff, HelpCircle } from 'lucide-react';
import concordLogo from '../../assets/concord-logo-transparent.png';
import concordWordmark from '../../assets/concord-wordmark.webp';

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

export const AuthModal = () => {
  const { login, register } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPasswordTip, setShowForgotPasswordTip] = useState(false);
  const [selectedColor, setSelectedColor] = useState(AVATAR_COLORS[0]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validação de confirmação de senha no cadastro
    if (!isLogin && password !== confirmPassword) {
      setError('As senhas digitadas não coincidem! Por favor, digite a mesma senha nos dois campos.');
      return;
    }

    if (!isLogin && password.length < 3) {
      setError('A senha deve ter no mínimo 3 caracteres.');
      return;
    }

    setLoading(true);

    try {
      if (isLogin) {
        await login(username, password);
      } else {
        await register(username, password, selectedColor);
      }
    } catch (err) {
      setError(err.message || 'Erro ao processar autenticação');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="w-full max-w-md bg-gaming-900 border border-gaming-700/60 rounded-2xl p-5 sm:p-8 shadow-2xl relative overflow-y-auto max-h-[calc(100dvh-2rem)]">
        {/* Glow de fundo */}
        <div className="absolute -top-20 -right-20 w-48 h-48 bg-gaming-accent/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-gaming-success/15 rounded-full blur-3xl pointer-events-none" />

        {/* Cabeçalho */}
        <div className="text-center mb-6 relative">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-500/15 to-purple-600/15 border border-indigo-500/30 shadow-2xl mb-3 overflow-hidden p-1.5">
            <img src={concordLogo} alt="Concord Logo" className="w-full h-full object-contain filter drop-shadow-md" />
          </div>
          <div className="flex justify-center mb-2">
            <img src={concordWordmark} alt="Concord" className="h-9 w-auto object-contain filter drop-shadow" />
          </div>
          <p className="text-xs text-slate-400">
            {isLogin ? 'Bem-vindo de volta! Entre para jogar com seus amigos' : 'Crie seu perfil e entre na sala em segundos'}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2 animate-shake">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Campo de Apelido */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-400" />
              Apelido (Nome de Jogador)
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Ex: PedroGamer"
              className="w-full px-4 py-2.5 bg-gaming-950 border border-gaming-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-gaming-accent focus:ring-1 focus:ring-gaming-accent transition text-sm"
            />
          </div>

          {/* Campo de Senha */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                Sua Senha
              </label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1"
              >
                {showPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                <span>{showPassword ? 'Ocultar' : 'Mostrar'}</span>
              </button>
            </div>
            <input
              type={showPassword ? 'text' : 'password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-2.5 bg-gaming-950 border border-gaming-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-gaming-accent focus:ring-1 focus:ring-gaming-accent transition text-sm font-mono"
            />
          </div>

          {/* Campo de Confirmação de Senha (Apenas no Cadastro) */}
          {!isLogin && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-emerald-400" />
                Confirmar Senha
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita sua senha exatamente"
                className={`w-full px-4 py-2.5 bg-gaming-950 border rounded-xl text-white placeholder-slate-500 focus:outline-none transition text-sm font-mono ${
                  confirmPassword && password !== confirmPassword
                    ? 'border-red-500/70 focus:border-red-500'
                    : confirmPassword && password === confirmPassword
                    ? 'border-emerald-500/70 focus:border-emerald-500'
                    : 'border-gaming-700 focus:border-gaming-accent'
                }`}
              />
              {confirmPassword && password !== confirmPassword && (
                <p className="text-[10px] text-red-400 mt-1">As senhas não coincidem ainda</p>
              )}
              {confirmPassword && password === confirmPassword && (
                <p className="text-[10px] text-emerald-400 mt-1">✓ Senhas conferem perfeitamente</p>
              )}
            </div>
          )}

          {/* Seletor de Cor no Cadastro */}
          {!isLogin && (
            <div className="pt-1">
              <label className="block text-xs font-medium text-slate-300 mb-2 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-slate-400" />
                Cor de Destaque Inicial
              </label>
              <div className="flex items-center justify-between gap-2 p-2 bg-gaming-950 border border-gaming-700 rounded-xl">
                {AVATAR_COLORS.map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setSelectedColor(color)}
                    style={{ backgroundColor: color }}
                    className={`w-7 h-7 rounded-full transition transform ${
                      selectedColor === color ? 'scale-125 ring-2 ring-white shadow-lg' : 'hover:scale-110 opacity-70 hover:opacity-100'
                    }`}
                  />
                ))}
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-gaming-accent hover:bg-indigo-600 text-white font-medium rounded-xl shadow-lg shadow-indigo-500/20 transition flex items-center justify-center gap-2 text-sm disabled:opacity-50 mt-5"
          >
            {loading ? (
              <span>Processando...</span>
            ) : (
              <>
                <span>{isLogin ? 'Entrar no Hub' : 'Criar Perfil e Entrar'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-5 text-center flex flex-col gap-2">
          <button
            type="button"
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
              setPassword('');
              setConfirmPassword('');
            }}
            className="text-xs text-indigo-400 hover:text-indigo-300 hover:underline transition"
          >
            {isLogin ? 'Primeira vez aqui? Crie sua conta' : 'Já tem uma conta? Fazer Login'}
          </button>

          {isLogin && (
            <div>
              <button
                type="button"
                onClick={() => setShowForgotPasswordTip(!showForgotPasswordTip)}
                className="text-[11px] text-slate-500 hover:text-slate-400 flex items-center justify-center gap-1 mx-auto hover:underline"
              >
                <HelpCircle className="w-3 h-3" />
                <span>Esqueceu sua senha?</span>
              </button>

              {showForgotPasswordTip && (
                <div className="mt-2 p-2.5 bg-gaming-950 border border-gaming-800 rounded-xl text-[11px] text-slate-300 text-left animate-fade-in leading-relaxed">
                  💡 <strong>Como recuperar:</strong> Para sua comodidade e privacidade (sem precisar cadastrar e-mails), o <strong>Dono da sala</strong> ou qualquer <strong>Administrador</strong> pode redefinir sua senha na hora pelo painel de gerenciamento. Basta pedir para ele gerar uma nova senha para você!
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
