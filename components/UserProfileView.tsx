import React from 'react';
import {
  UserProfile,
  UserGoal,
  UserLevel,
  UserSex,
  TrainingStyle
} from '../types';

interface UserProfileViewProps {
  profile: UserProfile;
  onSave: (profile: UserProfile) => void;
}

const UserProfileView: React.FC<UserProfileViewProps> = ({ profile, onSave }) => {
  const handleChange =
    <K extends keyof UserProfile>(key: K) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const value = e.target.value;
      onSave({
        ...profile,
        [key]: value
      });
    };

  const handleNumberChange =
    <K extends keyof UserProfile>(key: K) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      onSave({
        ...profile,
        [key]: raw === '' ? undefined : Number(raw)
      });
    };

  const handleMeasurementChange =
    (key: keyof UserProfile['measurements']) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      onSave({
        ...profile,
        measurements: {
          ...profile.measurements,
          [key]: raw === '' ? undefined : Number(raw)
        }
      });
    };

  const handleEquipmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const items = raw
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);

    onSave({
      ...profile,
      equipment: items
    });
  };

  const equipmentString = profile.equipment.join(', ');

  const isPro = profile.plan === 'pro' || profile.plan === 'infinity';
  const isInfinity = profile.plan === 'infinity';

  return (
    <div className="space-y-8">
      {/* Cabecera perfil */}
      <section className="rounded-[32px] border border-white/10 bg-black/40 p-6 md:p-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
              Perfil del usuario
            </p>
            <h3 className="text-2xl font-black uppercase tracking-tight text-white">
              {profile.displayName || 'Sin nombre asignado'}
            </h3>
          </div>

          <div className="flex flex-col items-end gap-2">
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
              Plan actual
            </span>
            <span
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.3em] ${
                isInfinity
                  ? 'bg-gradient-to-r from-amber-400 via-fuchsia-500 to-cyan-400 text-black shadow-[0_0_22px_rgba(251,191,36,0.8)]'
                  : isPro
                  ? 'bg-gradient-to-r from-fuchsia-600 to-cyan-500 text-white shadow-[0_0_18px_rgba(255,0,247,0.5)]'
                  : 'border border-white/10 bg-slate-900 text-slate-300'
              }`}
            >
              {isInfinity ? 'Titan Infinity' : isPro ? 'Titan PRO' : 'Free'}
            </span>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <label className="block text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">
              Nombre de perfil
              <input
                type="text"
                value={profile.displayName}
                onChange={handleChange('displayName')}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-sm text-white outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                placeholder="Ej. David, Titan_01..."
              />
            </label>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <label className="block text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">
              Sexo
              <select
                value={profile.sex}
                onChange={handleChange('sex')}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900/60 px-3 py-3 text-xs text-white outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
              >
                <option value="">Seleccionar</option>
                <option value="male">Hombre</option>
                <option value="female">Mujer</option>
                <option value="other">Otro</option>
              </select>
            </label>

            <label className="block text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">
              Año nac.
              <input
                type="number"
                inputMode="numeric"
                value={profile.birthYear ?? ''}
                onChange={handleNumberChange('birthYear')}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900/60 px-3 py-3 text-xs text-white outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                placeholder="1976"
              />
            </label>

            <label className="block text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">
              Objetivo
              <select
                value={profile.goal}
                onChange={handleChange('goal')}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900/60 px-3 py-3 text-xs text-white outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
              >
                <option value="">Seleccionar</option>
                <option value="muscle_gain">Músculo</option>
                <option value="fat_loss">Definición</option>
                <option value="strength">Fuerza</option>
                <option value="recomposition">Recomposición</option>
                <option value="health">Salud</option>
              </select>
            </label>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-4">
          <label className="block text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">
            Peso
            <div className="mt-2 flex items-center gap-2">
              <input
                type="number"
                inputMode="decimal"
                value={profile.weightKg ?? ''}
                onChange={handleNumberChange('weightKg')}
                className="w-full rounded-2xl border border-white/10 bg-slate-900/60 px-3 py-3 text-xs text-white outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                placeholder="85"
              />
              <span className="text-[10px] text-slate-500">kg</span>
            </div>
          </label>

          <label className="block text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">
            Altura
            <div className="mt-2 flex items-center gap-2">
              <input
                type="number"
                inputMode="decimal"
                value={profile.heightCm ?? ''}
                onChange={handleNumberChange('heightCm')}
                className="w-full rounded-2xl border border-white/10 bg-slate-900/60 px-3 py-3 text-xs text-white outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                placeholder="178"
              />
              <span className="text-[10px] text-slate-500">cm</span>
            </div>
          </label>
        </div>
      </section>

      {/* Bloque avanzado PRO / INFINITY */}
      <section className="relative overflow-hidden rounded-[32px] border border-fuchsia-500/30 bg-gradient-to-br from-fuchsia-500/10 via-black/40 to-cyan-500/10 p-6 shadow-[0_0_40px_rgba(0,0,0,0.6)] md:p-8">
        <div className="pointer-events-none absolute inset-0 opacity-40 mix-blend-screen">
          <div className="absolute -bottom-24 -right-10 h-72 w-72 rounded-full bg-cyan-500/40 blur-3xl" />
          <div className="absolute -left-10 -top-24 h-72 w-72 rounded-full bg-fuchsia-500/40 blur-3xl" />
        </div>

        <div className="relative mb-6 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-3">
              <span className="text-[10px] font-black uppercase tracking-[0.35em] text-fuchsia-300">
                Perfil avanzado
              </span>
              <span className="rounded-full bg-fuchsia-600 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.25em] text-white shadow-[0_0_12px_#ff00f7]">
                {isInfinity ? 'Infinity' : 'PRO'}
              </span>
            </div>

            <h3 className="mb-2 text-xl font-black uppercase tracking-tight text-white md:text-2xl">
              {isPro ? 'Perfil avanzado activo' : 'Desbloquea Titan Track PRO'}
            </h3>

            <p className="max-w-md text-xs text-slate-200 md:text-sm">
              Añade medidas, material disponible, estilo de entrenamiento y limitaciones para que Titan Track AI
              genere rutinas mucho más precisas y adaptadas a tu realidad.
            </p>
          </div>

          {!isPro && (
            <button
              type="button"
              className="relative inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-fuchsia-600 to-cyan-500 px-6 py-3 text-[10px] font-black uppercase tracking-[0.35em] text-white shadow-[0_0_30px_rgba(0,242,255,0.6)] transition-transform active:scale-[0.97]"
            >
              Hazte PRO ⚡
            </button>
          )}

          {isPro && !isInfinity && (
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-fuchsia-200">
              Titan PRO activo
            </span>
          )}

          {isInfinity && (
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-200">
              Titan Infinity: perfil completo
            </span>
          )}
        </div>

        <div
          className={`relative mt-4 grid gap-6 text-xs text-slate-100 md:grid-cols-3 ${
            isPro ? '' : 'pointer-events-none opacity-70'
          }`}
        >
          {/* Columna 1 */}
          <div className="space-y-4">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-300">
              Nivel y frecuencia
            </p>

            <label className="block text-[10px] font-black uppercase tracking-[0.25em] text-slate-300">
              Nivel
              <select
                value={profile.level}
                onChange={handleChange('level')}
                disabled={!isPro}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900/60 px-3 py-3 text-xs text-slate-100 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
              >
                <option value="">Seleccionar</option>
                <option value="beginner">Principiante</option>
                <option value="intermediate">Intermedio</option>
                <option value="advanced">Avanzado</option>
              </select>
            </label>

            <label className="block text-[10px] font-black uppercase tracking-[0.25em] text-slate-300">
              Minutos / sesión
              <input
                type="number"
                inputMode="numeric"
                disabled={!isPro}
                value={profile.sessionMinutes ?? ''}
                onChange={handleNumberChange('sessionMinutes')}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900/60 px-3 py-3 text-xs text-slate-100 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                placeholder="45 - 75"
              />
            </label>
          </div>

          {/* Columna 2 */}
          <div className="space-y-4">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-300">
              Estilo y material
            </p>

            <label className="block text-[10px] font-black uppercase tracking-[0.25em] text-slate-300">
              Estilo
              <select
                value={profile.preferredStyle}
                onChange={handleChange('preferredStyle')}
                disabled={!isPro}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900/60 px-3 py-3 text-xs text-slate-100 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
              >
                <option value="">Seleccionar</option>
                <option value="full_body">Full body</option>
                <option value="upper_lower">Torso / pierna</option>
                <option value="push_pull_legs">Push / Pull / Legs</option>
                <option value="body_part_split">Weider</option>
                <option value="functional">Funcional</option>
              </select>
            </label>

            <label className="block text-[10px] font-black uppercase tracking-[0.25em] text-slate-300">
              Material disponible
              <input
                type="text"
                disabled={!isPro}
                value={equipmentString}
                onChange={handleEquipmentChange}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900/60 px-3 py-3 text-xs text-slate-100 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                placeholder="Mancuernas, barra, poleas, bandas..."
              />
            </label>
          </div>

          {/* Columna 3 */}
          <div className="space-y-4">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-300">
              Limitaciones y medidas
            </p>

            <label className="block text-[10px] font-black uppercase tracking-[0.25em] text-slate-300">
              Limitaciones / molestias
              <textarea
                rows={3}
                disabled={!isPro}
                value={profile.limitations}
                onChange={handleChange('limitations')}
                className="mt-2 w-full resize-none rounded-2xl border border-white/10 bg-slate-900/60 px-3 py-3 text-xs text-slate-100 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                placeholder="Hombro, rodilla, espalda..."
              />
            </label>

            <div className="grid grid-cols-3 gap-3">
              <label className="block text-[9px] font-black uppercase tracking-[0.2em] text-slate-300">
                Pecho
                <input
                  type="number"
                  inputMode="decimal"
                  disabled={!isPro}
                  value={profile.measurements.chestCm ?? ''}
                  onChange={handleMeasurementChange('chestCm')}
                  className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-900/60 px-2 py-2 text-[10px] text-slate-100 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                  placeholder="cm"
                />
              </label>

              <label className="block text-[9px] font-black uppercase tracking-[0.2em] text-slate-300">
                Cintura
                <input
                  type="number"
                  inputMode="decimal"
                  disabled={!isPro}
                  value={profile.measurements.waistCm ?? ''}
                  onChange={handleMeasurementChange('waistCm')}
                  className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-900/60 px-2 py-2 text-[10px] text-slate-100 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                  placeholder="cm"
                />
              </label>

              <label className="block text-[9px] font-black uppercase tracking-[0.2em] text-slate-300">
                Cadera
                <input
                  type="number"
                  inputMode="decimal"
                  disabled={!isPro}
                  value={profile.measurements.hipsCm ?? ''}
                  onChange={handleMeasurementChange('hipsCm')}
                  className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-900/60 px-2 py-2 text-[10px] text-slate-100 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                  placeholder="cm"
                />
              </label>
            </div>
          </div>
        </div>

        {!isPro && (
          <p className="relative mt-6 max-w-xl text-[10px] text-slate-300">
            Las áreas sombreadas estarán disponibles al activar Titan Track PRO. La IA usará estos datos para ajustar
            volumen, frecuencia, selección de ejercicios y progresión.
          </p>
        )}

        {isPro && !isInfinity && (
          <p className="relative mt-6 max-w-xl text-[10px] text-slate-300">
            Titan PRO activado. Completa estos datos para que la IA afine tus rutinas.
          </p>
        )}

        {isInfinity && (
          <p className="relative mt-6 max-w-xl text-[10px] text-amber-200">
            Titan Infinity desbloqueado: la IA utilizará tu perfil completo, incluyendo medidas, para ajustar volumen,
            selección de ejercicios y progresión de forma más precisa.
          </p>
        )}
      </section>
    </div>
  );
};

export default UserProfileView;