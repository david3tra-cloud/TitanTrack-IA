import React, { useEffect, useState } from 'react';

type AuthMode = 'login' | 'register';

interface AuthModalProps {
  isOpen: boolean;
  mode: AuthMode;
  onClose: () => void;
  onSwitchMode: (mode: AuthMode) => void;
  onLogin: (
    email: string,
    password: string
  ) => Promise<{ success: boolean; message: string }>;
  onRegister: (
    displayName: string,
    email: string,
    password: string
  ) => Promise<{ success: boolean; message: string }>;
}

const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  mode,
  onClose,
  onSwitchMode,
  onLogin,
  onRegister
}) => {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setError('');
      setSuccessMessage('');
      setPassword('');
      setConfirmPassword('');
    }
  }, [isOpen, mode]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) onClose();
    };

    if (isOpen) {
      window.addEventListener('keydown', onKeyDown);
    }

    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose, isSubmitting]);

  if (!isOpen) return null;

  const resetMessages = () => {
    setError('');
    setSuccessMessage('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();

    if (!email.trim() || !password.trim()) {
      setError('Completa email y contraseña.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (mode === 'register') {
        if (!displayName.trim()) {
          setError('Introduce tu nombre visible.');
          setIsSubmitting(false);
          return;
        }

        if (password.length < 6) {
          setError('La contraseña debe tener al menos 6 caracteres.');
          setIsSubmitting(false);
          return;
        }

        if (password !== confirmPassword) {
          setError('Las contraseñas no coinciden.');
          setIsSubmitting(false);
          return;
        }

        const result = await onRegister(
          displayName.trim(),
          email.trim().toLowerCase(),
          password
        );

        if (!result.success) {
          setError(result.message);
          setIsSubmitting(false);
          return;
        }

        setSuccessMessage(result.message);
        setDisplayName('');
        setEmail('');
        setPassword('');
        setConfirmPassword('');
        setIsSubmitting(false);
        return;
      }

      const result = await onLogin(email.trim().toLowerCase(), password);

      if (!result.success) {
        setError(result.message);
        setIsSubmitting(false);
        return;
      }

      setSuccessMessage(result.message);
      setEmail('');
      setPassword('');
      setIsSubmitting(false);
    } catch (err) {
      setError('Ha ocurrido un error inesperado.');
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
      onClick={() => {
        if (!isSubmitting) onClose();
      }}
    >
      <div
        className="relative w-full max-w-md rounded-[32px] border border-cyan-500/20 bg-slate-950/95 shadow-[0_0_60px_rgba(0,242,255,0.12)] overflow-hidden animate-in fade-in zoom-in-95 duration-300"
        onClick={e => e.stopPropagation()}
      >
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/70 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-cyan-500 via-blue-600 to-fuchsia-500 opacity-70" />

        <button
          onClick={onClose}
          disabled={isSubmitting}
          className="absolute top-4 right-4 w-10 h-10 rounded-full border border-white/10 text-slate-400 hover:text-white hover:border-cyan-400/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Cerrar modal"
        >
          ✕
        </button>

        <div className="p-6 md:p-8">
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl font-black tracking-tighter text-white italic uppercase">
                Titan
              </span>
              <span className="text-2xl font-black tracking-tighter text-cyan-400 italic uppercase">
                Track
              </span>
              <span className="text-sm font-black px-2 py-0.5 bg-fuchsia-600 text-white rounded-lg shadow-[0_0_16px_#ff00f7]">
                AI
              </span>
            </div>

            <h2 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tight">
              {mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
            </h2>

            <p className="text-slate-400 text-sm mt-2">
              {mode === 'login'
                ? 'Accede a tu panel y continúa tus registros.'
                : 'Regístrate para guardar tu progreso y personalizar la app.'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-6 rounded-2xl bg-black/40 border border-white/10 p-1">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => {
                onSwitchMode('login');
                resetMessages();
              }}
              className={`py-3 rounded-xl text-xs font-black uppercase tracking-[0.25em] transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                mode === 'login'
                  ? 'bg-cyan-500 text-black shadow-[0_0_20px_rgba(0,242,255,0.4)]'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Iniciar sesión
            </button>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => {
                onSwitchMode('register');
                resetMessages();
              }}
              className={`py-3 rounded-xl text-xs font-black uppercase tracking-[0.25em] transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                mode === 'register'
                  ? 'bg-fuchsia-500 text-white shadow-[0_0_20px_rgba(255,0,247,0.35)]'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Registrarse
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block text-[11px] font-black uppercase tracking-[0.25em] text-slate-400 mb-2">
                  Nombre visible
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder="Ej: David"
                  disabled={isSubmitting}
                  className="w-full rounded-2xl bg-slate-900/80 border border-white/10 px-4 py-4 text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 focus:shadow-[0_0_0_3px_rgba(0,242,255,0.12)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
            )}

            <div>
              <label className="block text-[11px] font-black uppercase tracking-[0.25em] text-slate-400 mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="tuemail@correo.com"
                disabled={isSubmitting}
                className="w-full rounded-2xl bg-slate-900/80 border border-white/10 px-4 py-4 text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 focus:shadow-[0_0_0_3px_rgba(0,242,255,0.12)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-[11px] font-black uppercase tracking-[0.25em] text-slate-400 mb-2">
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={isSubmitting}
                className="w-full rounded-2xl bg-slate-900/80 border border-white/10 px-4 py-4 text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 focus:shadow-[0_0_0_3px_rgba(0,242,255,0.12)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            {mode === 'register' && (
              <div>
                <label className="block text-[11px] font-black uppercase tracking-[0.25em] text-slate-400 mb-2">
                  Confirmar contraseña
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={isSubmitting}
                  className="w-full rounded-2xl bg-slate-900/80 border border-white/10 px-4 py-4 text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 focus:shadow-[0_0_0_3px_rgba(0,242,255,0.12)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
            )}

            {error && (
              <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
                {error}
              </div>
            )}

            {successMessage && (
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
                {successMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-[0.3em] transition-all disabled:opacity-60 disabled:cursor-not-allowed ${
                mode === 'login'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-black shadow-[0_0_30px_rgba(0,242,255,0.25)] hover:scale-[1.01]'
                  : 'bg-gradient-to-r from-fuchsia-500 to-cyan-400 text-white shadow-[0_0_30px_rgba(255,0,247,0.2)] hover:scale-[1.01]'
              }`}
            >
              {isSubmitting
                ? mode === 'login'
                  ? 'Entrando...'
                  : 'Creando...'
                : mode === 'login'
                ? 'Entrar'
                : 'Crear cuenta'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-slate-400">
              {mode === 'login' ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'}{' '}
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => {
                  onSwitchMode(mode === 'login' ? 'register' : 'login');
                  resetMessages();
                }}
                className="text-cyan-400 font-bold hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {mode === 'login' ? 'Regístrate' : 'Inicia sesión'}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;