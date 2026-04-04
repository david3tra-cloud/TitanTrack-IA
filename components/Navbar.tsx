import React from 'react';
import { View, AuthUser } from '../types';

interface NavbarProps {
  currentView: View;
  onViewChange: (view: View) => void;
  isLoggedIn: boolean;
  authUser: AuthUser | null;
  onLoginClick: () => void;
  onRegisterClick: () => void;
  onLogout: () => void;
}

const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onViewChange,
  isLoggedIn,
  authUser,
  onLoginClick,
  onRegisterClick,
  onLogout
}) => {
  const allItems = [
    { id: View.DASHBOARD, label: 'Resumen' },
    { id: View.LOG, label: 'Entrenos' },
    { id: View.ROUTINES, label: 'Rutinas' },
    { id: View.EXERCISES, label: 'Biblioteca' },
    { id: View.PROGRESS, label: 'Perfil' },
    { id: View.WEIGHT, label: 'Peso' },
    { id: View.RECS, label: 'Coach IA' }
  ];

  const handleNavClick = (view: View) => {
    onViewChange(view);
  };

  return (
    <>
      <nav className="fixed top-0 left-0 w-full z-40 bg-black/60 backdrop-blur-2xl border-b border-white/5">
        {/* MOBILE TOP BAR */}
        <div className="md:hidden px-4 py-3 flex flex-col gap-3">
          <div
            className="flex items-center gap-3 cursor-pointer"
            onClick={() => handleNavClick(View.DASHBOARD)}
          >
            <div className="w-9 h-9 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-lg flex items-center justify-center shadow-[0_0_20px_rgba(0,242,255,0.4)] shrink-0">
              <span className="text-black font-black text-lg italic">T</span>
            </div>

            <div className="min-w-0">
              <div className="flex items-baseline gap-1 flex-wrap">
                <span className="text-lg font-black tracking-tighter text-white uppercase italic leading-none">
                  Titan
                </span>
                <span className="text-lg font-black tracking-tighter text-cyan-400 uppercase italic leading-none">
                  Track
                </span>
                <span className="text-[10px] font-black px-1.5 py-0.5 bg-fuchsia-600 text-white rounded-md shadow-[0_0_10px_#ff00f7] animate-pulse">
                  AI
                </span>
              </div>

              <span className="text-[8px] font-black text-slate-500 uppercase tracking-[0.3em] leading-none mt-1 block">
                Grid v4.0 Professional
              </span>
            </div>
          </div>

          {!isLoggedIn ? (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={onLoginClick}
                className="min-h-[44px] px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:text-white hover:border-cyan-500/30 hover:bg-cyan-500/5 transition-all text-[10px] font-black uppercase tracking-[0.18em]"
              >
                Iniciar sesión
              </button>

              <button
                onClick={onRegisterClick}
                className="min-h-[44px] px-3 py-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-cyan-500 text-white shadow-[0_0_20px_rgba(255,0,247,0.25)] hover:shadow-[0_0_28px_rgba(0,242,255,0.35)] transition-all text-[10px] font-black uppercase tracking-[0.18em]"
              >
                Registrarse
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-cyan-500/20 bg-cyan-500/5 px-3 py-3">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">
                  Sesión activa
                </p>
                <p className="text-sm font-black text-white truncate">
                  {authUser?.displayName || authUser?.email}
                </p>
              </div>

              <button
                onClick={onLogout}
                className="shrink-0 min-h-[44px] px-4 py-2 rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:text-white hover:border-rose-500/30 hover:bg-rose-500/10 transition-all text-[10px] font-black uppercase tracking-[0.18em]"
              >
                Salir
              </button>
            </div>
          )}
        </div>

        {/* DESKTOP NAV */}
        <div className="hidden md:flex max-w-7xl mx-auto px-8 py-4 items-center justify-between gap-6">
          <div
            className="flex items-center gap-4 group cursor-pointer shrink-0"
            onClick={() => handleNavClick(View.DASHBOARD)}
          >
            <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-lg flex items-center justify-center shadow-[0_0_20px_rgba(0,242,255,0.4)] rotate-3 group-hover:rotate-12 transition-transform duration-500">
              <span className="text-black font-black text-xl italic">T</span>
            </div>

            <div className="flex flex-col">
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-black tracking-tighter text-white uppercase italic leading-none">
                  Titan
                </span>
                <span className="text-xl font-black tracking-tighter text-cyan-400 uppercase italic leading-none">
                  Track
                </span>
                <span className="text-xs font-black px-1.5 py-0.5 bg-fuchsia-600 text-white rounded-md shadow-[0_0_10px_#ff00f7] ml-1 animate-pulse">
                  AI
                </span>
              </div>

              <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.4em] leading-none mt-1">
                Grid v4.0 Professional
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-center">
            {allItems.map(item => (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`relative px-4 py-2 rounded-xl transition-all duration-300 group ${
                  currentView === item.id
                    ? 'text-cyan-400'
                    : 'text-slate-500 hover:text-white'
                }`}
              >
                {currentView === item.id && (
                  <div className="absolute inset-0 bg-cyan-500/10 rounded-xl border border-cyan-500/20 shadow-[inset_0_0_10px_rgba(0,242,255,0.1)]"></div>
                )}

                <span className="relative flex items-center gap-2 text-[9px] font-black uppercase tracking-widest">
                  {item.label}
                </span>
              </button>
            ))}
          </div>

          {!isLoggedIn ? (
            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={onLoginClick}
                className="px-4 py-2 rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:text-white hover:border-cyan-500/30 hover:bg-cyan-500/5 transition-all text-[10px] font-black uppercase tracking-[0.25em]"
              >
                Iniciar sesión
              </button>

              <button
                onClick={onRegisterClick}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-fuchsia-600 to-cyan-500 text-white shadow-[0_0_20px_rgba(255,0,247,0.25)] hover:shadow-[0_0_28px_rgba(0,242,255,0.35)] transition-all text-[10px] font-black uppercase tracking-[0.25em]"
              >
                Registrarse
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3 shrink-0">
              <div className="px-4 py-2 rounded-xl border border-cyan-500/20 bg-cyan-500/5 min-w-[180px]">
                <p className="text-[9px] font-black uppercase tracking-[0.25em] text-slate-500">
                  Sesión activa
                </p>
                <p className="text-sm font-black text-white truncate">
                  {authUser?.displayName || authUser?.email}
                </p>
              </div>

              <button
                onClick={onLogout}
                className="px-4 py-2 rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:text-white hover:border-rose-500/30 hover:bg-rose-500/10 transition-all text-[10px] font-black uppercase tracking-[0.25em]"
              >
                Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </nav>
    </>
  );
};

export default Navbar;