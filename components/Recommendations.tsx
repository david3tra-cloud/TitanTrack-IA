import React, { useState, useEffect } from 'react';
import { Workout, Recommendation } from '../types';
import { getPersonalizedRecommendationsGroq } from '../services/aiService';

interface RecommendationsProps {
  workouts: Workout[];
  isPro?: boolean;
  nutritionAppUrl?: string;
}

const Recommendations: React.FC<RecommendationsProps> = ({
  workouts,
  isPro = false,
  nutritionAppUrl
}) => {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRecommendations = async () => {
    if (workouts.length === 0) return;
    setLoading(true);
    setError(null);

    try {
      const recs = await getPersonalizedRecommendationsGroq(workouts);
      setRecommendations(recs);
    } catch (err) {
      setError('No se pudieron cargar las recomendaciones en este momento.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (workouts.length > 0 && recommendations.length === 0) {
      fetchRecommendations();
    }
  }, [workouts]);

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case 'strength':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/50';
      case 'recovery':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50';
      case 'nutrition':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/50';
      case 'technique':
        return 'bg-purple-500/20 text-purple-400 border-purple-500/50';
      default:
        return 'bg-slate-500/20 text-slate-400 border-slate-500/50';
    }
  };

  return (
    <div className="space-y-6">
      {/* HERO COACH */}
      <div
        className={`relative overflow-hidden rounded-[32px] border p-6 md:p-8 ${
          isPro
            ? 'bg-gradient-to-br from-fuchsia-600/15 via-slate-950 to-cyan-500/10 border-fuchsia-500/40 shadow-[0_0_30px_rgba(255,0,247,0.18)]'
            : 'bg-gradient-to-r from-blue-900/40 to-slate-900 border-blue-500/30'
        }`}
      >
        <div className="absolute inset-0 pointer-events-none opacity-30">
          <div className="absolute -top-16 -right-12 w-56 h-56 bg-cyan-500/20 blur-3xl rounded-full" />
          <div className="absolute -bottom-20 -left-10 w-56 h-56 bg-fuchsia-500/20 blur-3xl rounded-full" />
        </div>

        <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <span className={`text-xl ${isPro ? 'text-fuchsia-400' : 'text-blue-400'}`}>✧</span>
              <span
                className={`text-[10px] font-black uppercase tracking-[0.35em] ${
                  isPro ? 'text-fuchsia-300' : 'text-blue-300'
                }`}
              >
                {isPro ? 'Titan Coach PRO' : 'Titan Coach FREE'}
              </span>
              {isPro && (
                <span className="px-2 py-0.5 rounded-full bg-fuchsia-600 text-white text-[9px] font-black uppercase tracking-[0.25em] shadow-[0_0_14px_#ff00f7]">
                  PRO
                </span>
              )}
            </div>

            <h2 className="text-2xl md:text-3xl font-black text-white italic uppercase tracking-tighter">
              {isPro ? 'Coach IA avanzado' : 'Coach IA personal'}
            </h2>

            <p className="text-slate-300 mt-3 max-w-2xl text-sm md:text-base">
              {isPro
                ? 'Analiza tus entrenos y te orienta con un enfoque más premium, alineado con tu progresión, recuperación y estrategia semanal.'
                : 'Análisis rápido basado en tus últimos entrenamientos para darte consejos útiles y accionables.'}
            </p>
          </div>

          <button
            onClick={fetchRecommendations}
            disabled={loading || workouts.length === 0}
            className={`px-6 py-4 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] transition-all shadow-lg ${
              isPro
                ? 'bg-gradient-to-r from-fuchsia-600 to-cyan-500 hover:from-fuchsia-500 hover:to-cyan-400 disabled:bg-slate-700 text-white shadow-[0_0_30px_rgba(255,0,247,0.25)]'
                : 'bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white'
            }`}
          >
            {loading ? 'ANALIZANDO...' : isPro ? 'ACTUALIZAR COACH PRO' : 'ACTUALIZAR TIPS'}
          </button>
        </div>
      </div>

      {/* EMPTY */}
      {workouts.length === 0 && (
        <div className="bg-black/40 p-12 rounded-[32px] border border-white/10 text-center">
          <p className="text-slate-400 text-lg">
            Registra algunos entrenamientos para que la IA pueda darte consejos personalizados.
          </p>
        </div>
      )}

      {/* SKELETON */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-40 bg-slate-800 rounded-2xl animate-pulse border border-slate-700"
            ></div>
          ))}
        </div>
      )}

      {/* ERROR */}
      {error && <p className="text-red-400 text-center">{error}</p>}

      {/* PRO COACH BLOCK */}
      {isPro && workouts.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 rounded-[28px] border border-fuchsia-500/30 bg-gradient-to-br from-fuchsia-600/10 via-black/50 to-cyan-500/10 p-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-fuchsia-400 text-lg">🧠</span>
              <h3 className="text-white text-xl font-black uppercase tracking-tight italic">
                Modo Coach PRO
              </h3>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div className="bg-black/40 border border-white/10 rounded-2xl p-4">
                <p className="text-[10px] uppercase tracking-[0.3em] font-black text-fuchsia-300 mb-2">
                  Plan
                </p>
                <p className="text-sm text-slate-200">
                  Ajusta el enfoque de cada semana según tu objetivo principal y tu estructura de entrenamiento.
                </p>
              </div>

              <div className="bg-black/40 border border-white/10 rounded-2xl p-4">
                <p className="text-[10px] uppercase tracking-[0.3em] font-black text-cyan-300 mb-2">
                  Recuperación
                </p>
                <p className="text-sm text-slate-200">
                  Detecta cuándo conviene bajar carga, descansar más o reorganizar sesiones.
                </p>
              </div>

              <div className="bg-black/40 border border-white/10 rounded-2xl p-4">
                <p className="text-[10px] uppercase tracking-[0.3em] font-black text-emerald-300 mb-2">
                  Progresión
                </p>
                <p className="text-sm text-slate-200">
                  Ayuda a mantener continuidad con decisiones más inteligentes, no solo tips sueltos.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-cyan-500/20 bg-black/40 p-6">
            <p className="text-[10px] uppercase tracking-[0.35em] font-black text-cyan-300 mb-3">
              Estado IA
            </p>
            <div className="space-y-3">
              <div className="rounded-2xl bg-slate-900/70 border border-white/10 p-4">
                <p className="text-slate-500 text-[10px] uppercase font-black tracking-[0.25em]">
                  Entrenos analizados
                </p>
                <p className="text-white text-2xl font-black mt-1">{workouts.length}</p>
              </div>
              <div className="rounded-2xl bg-slate-900/70 border border-white/10 p-4">
                <p className="text-slate-500 text-[10px] uppercase font-black tracking-[0.25em]">
                  Nivel coach
                </p>
                <p className="text-fuchsia-400 text-lg font-black mt-1">PRO ACTIVE</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FREE UPSELL */}
      {!isPro && workouts.length > 0 && (
        <div className="rounded-[28px] border border-fuchsia-500/20 bg-gradient-to-r from-fuchsia-600/10 via-black/50 to-cyan-500/10 p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.35em] font-black text-fuchsia-300 mb-2">
                Titan Coach PRO
              </p>
              <h3 className="text-white text-xl font-black uppercase italic tracking-tight">
                Sube de nivel tu coach
              </h3>
              <p className="text-slate-300 text-sm mt-2 max-w-2xl">
                Desbloquea un coach más avanzado, con enfoque en progresión, recuperación, estrategia semanal y acceso premium a nutrición IA.
              </p>
            </div>

            <button className="px-6 py-4 rounded-2xl bg-gradient-to-r from-fuchsia-600 to-cyan-500 text-white text-[10px] font-black uppercase tracking-[0.25em] shadow-[0_0_24px_rgba(255,0,247,0.25)]">
              DESBLOQUEAR PRO
            </button>
          </div>
        </div>
      )}

      {/* RECOMMENDATIONS GRID */}
      {!loading && recommendations.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {recommendations.map((rec, idx) => (
            <div
              key={idx}
              className={`p-6 rounded-[24px] border transition-all flex flex-col justify-between ${
                isPro
                  ? 'bg-slate-900/70 border-slate-700 hover:border-fuchsia-500/40'
                  : 'bg-slate-800 border-slate-700 hover:border-slate-500'
              }`}
            >
              <div>
                <span
                  className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase border mb-3 ${getCategoryColor(
                    rec.category
                  )}`}
                >
                  {rec.category}
                </span>
                <h3 className="text-lg font-bold text-white mb-2">{rec.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{rec.description}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* NUTRITION APP BLOCK */}
      <div
        className={`rounded-[32px] border p-6 md:p-8 ${
          isPro
            ? 'border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-black/50 to-emerald-500/10'
            : 'border-amber-500/20 bg-black/40'
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <span className="text-amber-400 text-xl">🥗</span>
              <span className="text-[10px] font-black uppercase tracking-[0.35em] text-amber-300">
                Nutrición IA
              </span>
              {isPro && (
                <span className="px-2 py-0.5 rounded-full bg-amber-500 text-black text-[9px] font-black uppercase tracking-[0.25em]">
                  PRO
                </span>
              )}
            </div>

            <h3 className="text-white text-2xl font-black uppercase italic tracking-tight">
              Menú del día y plan semanal con IA
            </h3>

            <p className="text-slate-300 mt-3 max-w-2xl text-sm md:text-base">
              {isPro
                ? 'Accede a tu experiencia de nutrición inteligente para generar menús diarios o semanales alineados con tu objetivo.'
                : 'Disponible como experiencia premium: genera menús IA del día o semanales para reforzar tu progreso.'}
            </p>
          </div>

          {nutritionAppUrl ? (
            <a
              href={nutritionAppUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center justify-center px-6 py-4 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] transition-all ${
                isPro
                  ? 'bg-gradient-to-r from-amber-500 to-emerald-500 text-black shadow-[0_0_24px_rgba(245,158,11,0.25)]'
                  : 'bg-slate-900 border border-amber-500/30 text-amber-300'
              }`}
            >
              {isPro ? 'ABRIR NUTRICIÓN IA' : 'DESCUBRIR VERSIÓN PRO'}
            </a>
          ) : (
            <button
              className={`inline-flex items-center justify-center px-6 py-4 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] transition-all ${
                isPro
                  ? 'bg-gradient-to-r from-amber-500 to-emerald-500 text-black shadow-[0_0_24px_rgba(245,158,11,0.25)]'
                  : 'bg-slate-900 border border-amber-500/30 text-amber-300'
              }`}
            >
              {isPro ? 'NUTRICIÓN IA DISPONIBLE' : 'PRÓXIMAMENTE EN PRO'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Recommendations;