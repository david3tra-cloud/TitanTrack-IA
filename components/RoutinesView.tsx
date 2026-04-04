import React, { useState } from 'react';
import { Routine, RoutineExercise } from '../types';
import { INITIAL_EXERCISES } from '../constants';
import { generateRoutineGroq } from '../services/aiService';

interface RoutinesViewProps {
  routines: Routine[];
  onSaveRoutine: (routine: Routine) => void;
  onDeleteRoutine: (id: string) => void;
  isLoggedIn: boolean;
  isPro: boolean;
}

const RoutinesView: React.FC<RoutinesViewProps> = ({
  routines,
  onSaveRoutine,
  onDeleteRoutine,
  isLoggedIn,
  isPro
}) => {
  const [activeTab, setActiveTab] = useState<'list' | 'ai' | 'manual'>('list');
  const [isGeneratingBasic, setIsGeneratingBasic] = useState(false);
  const [isGeneratingPro, setIsGeneratingPro] = useState(false);
  const [expandedRoutines, setExpandedRoutines] = useState<Record<string, boolean>>({});
  const [expandedPlanDays, setExpandedPlanDays] = useState<Record<string, string | null>>({});

  const [aiDays, setAiDays] = useState('3 días');
  const [aiObjective, setAiObjective] = useState('Crecimiento muscular');
  const [aiLevel, setAiLevel] = useState('Intermedio');
  const [aiEquipment, setAiEquipment] = useState('');

  const [manualName, setManualName] = useState('');
  const [manualDesc, setManualDesc] = useState('');
  const [manualExercises, setManualExercises] = useState<RoutineExercise[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  const toggleRoutine = (id: string) => {
    setExpandedRoutines(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const togglePlanDay = (routineId: string, dayKey: string) => {
    setExpandedPlanDays(prev => ({
      ...prev,
      [routineId]: prev[routineId] === dayKey ? null : dayKey
    }));
  };

  const startManual = (existingRoutine?: Routine) => {
    if (existingRoutine) {
      setManualName(existingRoutine.name);
      setManualDesc(existingRoutine.description || '');
      setManualExercises(existingRoutine.exercises);
      setEditingId(existingRoutine.id);
    } else {
      setManualName('');
      setManualDesc('');
      setManualExercises([]);
      setEditingId(null);
    }
    setActiveTab('manual');
  };

  const addManualExercise = () => {
    setManualExercises(prev => [
      ...prev,
      {
        id: Math.random().toString(36).slice(2, 11),
        name: INITIAL_EXERCISES[0],
        sets: 3,
        reps: '10-12',
        restTime: '60s'
      }
    ]);
  };

  const updateManualExercise = (id: string, field: keyof RoutineExercise, value: any) => {
    setManualExercises(prev => prev.map(ex => (ex.id === id ? { ...ex, [field]: value } : ex)));
  };

  const handleSaveManual = () => {
    if (!manualName || manualExercises.length === 0) {
      alert('Nombre y al menos un ejercicio requerido');
      return;
    }

    onSaveRoutine({
      id: editingId || Math.random().toString(36).slice(2, 11),
      name: manualName,
      description: manualDesc,
      exercises: manualExercises
    });

    setActiveTab('list');
    setManualName('');
    setManualDesc('');
    setManualExercises([]);
    setEditingId(null);
  };

  const getDayCountFromText = (value?: string) => {
    const parsed = parseInt(value || '', 10);
    if (Number.isNaN(parsed) || parsed <= 0) return 3;
    return Math.min(parsed, 7);
  };

  const getPlanDayCount = (routine: Routine) => {
    const desc = routine.description || '';
    const match = desc.match(/\[PLAN_DAYS:(\d+)\]/i);
    if (match?.[1]) {
      const parsed = parseInt(match[1], 10);
      if (!Number.isNaN(parsed) && parsed > 0) return Math.min(parsed, 7);
    }
    return 3;
  };

  const buildPlanDescription = (baseDescription?: string, dayCount?: number) => {
    const cleanBase = (baseDescription || '').replace(/\[PLAN_DAYS:\d+\]/gi, '').trim();
    return `${cleanBase ? `${cleanBase} ` : ''}[PLAN_DAYS:${dayCount}]`.trim();
  };

  const handleAiGenerateBasic = async () => {
    if (!isLoggedIn) return;

    setIsGeneratingBasic(true);
    try {
      const newRoutine = await generateRoutineGroq({
        daysPerWeek: aiDays,
        objective: aiObjective,
        level: aiLevel,
        equipment: aiEquipment
      });

      onSaveRoutine(newRoutine);
      setActiveTab('list');
    } catch (err) {
      alert('Error generando rutina. Revisa tu conexión.');
    } finally {
      setIsGeneratingBasic(false);
    }
  };

  const handleAiGeneratePro = async () => {
    if (!isLoggedIn) return;
    if (!isPro) {
      alert('Esta función está disponible solo para Titan PRO.');
      return;
    }

    setIsGeneratingPro(true);
    try {
      const requestedDayCount = getDayCountFromText(aiDays);

      const generatedRoutine = await generateRoutineGroq({
        daysPerWeek: aiDays,
        objective: aiObjective,
        level: aiLevel,
        equipment: aiEquipment,
        mode: 'pro_plan'
      } as any);

      const weeklyPlanRoutine: Routine = {
        ...generatedRoutine,
        name: generatedRoutine.name.toUpperCase().startsWith('PLAN SEMANAL')
          ? generatedRoutine.name
          : `PLAN SEMANAL ${generatedRoutine.name}`,
        description: buildPlanDescription(
          generatedRoutine.description || `Plan semanal de ${requestedDayCount} días`,
          requestedDayCount
        )
      };

      onSaveRoutine(weeklyPlanRoutine);
      setActiveTab('list');
    } catch (err) {
      alert('Error generando plan PRO. Revisa tu conexión.');
    } finally {
      setIsGeneratingPro(false);
    }
  };

  const isWeeklyPlan = (routine: Routine) =>
    routine.name.trim().toUpperCase().startsWith('PLAN SEMANAL');

  const getPlanDayLabels = (count: number) => {
    const labels = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    return labels.slice(0, count);
  };

  const splitExercisesByConfiguredDays = (exercises: RoutineExercise[], dayCount: number) => {
    const labels = getPlanDayLabels(dayCount);
    const result: Record<string, RoutineExercise[]> = {};

    labels.forEach(label => {
      result[label] = [];
    });

    if (exercises.length === 0) return result;

    exercises.forEach((exercise, index) => {
      const dayLabel = labels[index % labels.length];
      result[dayLabel].push(exercise);
    });

    return result;
  };

  const getVisibleDescription = (description?: string) => {
    return (description || '').replace(/\[PLAN_DAYS:\d+\]/gi, '').trim();
  };

  const renderRoutineCard = (r: Routine) => {
    const isExpanded = expandedRoutines[r.id];

    if (!isWeeklyPlan(r)) {
      return (
        <div
          key={r.id}
          className={`rounded-[32px] border transition-all duration-500 overflow-hidden ${
            isExpanded ? 'bg-slate-900/40 border-cyan-500/50 shadow-2xl' : 'bg-black/40 border-white/5'
          }`}
        >
          <div className="p-6">
            <div className="flex justify-between items-start">
              <div className="flex-1 cursor-pointer" onClick={() => toggleRoutine(r.id)}>
                <h3
                  className={`text-xl font-black italic uppercase tracking-tighter transition-colors ${
                    isExpanded ? 'text-cyan-400' : 'text-white'
                  }`}
                >
                  {r.name}
                </h3>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">
                  {getVisibleDescription(r.description) || 'Sin datos de descripción'}
                </p>
              </div>

              <div className="flex gap-2 ml-4">
                <button
                  onClick={e => {
                    e.stopPropagation();
                    startManual(r);
                  }}
                  className="p-3 bg-white/5 text-slate-400 hover:text-cyan-400 hover:bg-white/10 rounded-2xl transition-all border border-transparent hover:border-cyan-500/30"
                >
                  ✏️
                </button>
                <button
                  onClick={e => {
                    e.stopPropagation();
                    onDeleteRoutine(r.id);
                  }}
                  className="p-3 bg-white/5 text-slate-400 hover:text-fuchsia-400 hover:bg-white/10 rounded-2xl transition-all border border-transparent hover:border-fuchsia-500/30"
                >
                  🗑️
                </button>
              </div>
            </div>

            {isExpanded && (
              <div className="mt-8 pt-8 border-t border-white/5 animate-in fade-in slide-in-from-top-4 duration-500">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {r.exercises.map(ex => (
                    <div
                      key={ex.id}
                      className="bg-black/40 p-5 rounded-3xl border border-white/5 flex justify-between items-center group"
                    >
                      <div className="flex-1">
                        <p className="text-sm font-black text-white italic uppercase group-hover:text-cyan-400 transition-colors">
                          {ex.name}
                        </p>
                        <p className="text-[10px] text-cyan-400/70 font-black uppercase tracking-widest mt-1">
                          {ex.sets} series x {ex.reps} reps
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="bg-cyan-500/10 px-3 py-1 rounded-lg text-[10px] text-cyan-400 font-mono border border-cyan-500/20">
                          {ex.restTime || '60s'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-8 flex gap-4">
                  <button
                    onClick={() => toggleRoutine(r.id)}
                    className="flex-1 py-4 text-[10px] font-black text-slate-600 uppercase tracking-widest hover:text-slate-400 transition-colors"
                  >
                    Cerrar Archivo
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

    const configuredDayCount = getPlanDayCount(r);
    const splitByDay = splitExercisesByConfiguredDays(r.exercises, configuredDayCount);
    const planExpandedDay = expandedPlanDays[r.id] ?? null;

    return (
      <div
        key={r.id}
        className={`rounded-[32px] border transition-all duration-500 overflow-hidden ${
          isExpanded
            ? 'bg-gradient-to-br from-fuchsia-600/15 via-black/70 to-cyan-500/15 border-fuchsia-500/50 shadow-[0_0_40px_rgba(255,0,247,0.3)]'
            : 'bg-black/40 border-fuchsia-500/30'
        }`}
      >
        <div className="p-6">
          <div className="flex justify-between items-start">
            <div className="flex-1 cursor-pointer" onClick={() => toggleRoutine(r.id)}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-black uppercase tracking-[0.35em] text-fuchsia-300">
                  Plan semanal
                </span>
                <span className="px-2 py-0.5 rounded-full bg-fuchsia-600 text-[9px] font-black uppercase tracking-[0.25em] text-white shadow-[0_0_12px_#ff00f7]">
                  Infinity
                </span>
              </div>

              <h3
                className={`text-xl font-black italic uppercase tracking-tighter transition-colors ${
                  isExpanded ? 'text-cyan-300' : 'text-white'
                }`}
              >
                {r.name}
              </h3>

              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                {getVisibleDescription(r.description) || `Plan dividido en ${configuredDayCount} días`}
              </p>
            </div>

            <div className="flex gap-2 ml-4">
              <button
                onClick={e => {
                  e.stopPropagation();
                  startManual(r);
                }}
                className="p-3 bg-white/5 text-slate-400 hover:text-cyan-400 hover:bg-white/10 rounded-2xl transition-all border border-transparent hover:border-cyan-500/30"
              >
                ✏️
              </button>
              <button
                onClick={e => {
                  e.stopPropagation();
                  onDeleteRoutine(r.id);
                }}
                className="p-3 bg-white/5 text-slate-400 hover:text-fuchsia-400 hover:bg-white/10 rounded-2xl transition-all border border-transparent hover:border-fuchsia-500/30"
              >
                🗑️
              </button>
            </div>
          </div>

          {isExpanded && (
            <div className="mt-6 pt-6 border-t border-white/10 animate-in fade-in slide-in-from-top-4 duration-500">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] text-slate-300 uppercase tracking-[0.3em]">
                  Días del plan
                </p>
                <span className="text-[10px] text-cyan-300 uppercase tracking-[0.2em] font-black">
                  {configuredDayCount} días
                </span>
              </div>

              <div className="space-y-3">
                {Object.entries(splitByDay).map(([day, dayExercises]) => {
                  const open = planExpandedDay === day;

                  return (
                    <div
                      key={day}
                      className={`rounded-2xl border ${
                        open ? 'border-cyan-500/60 bg-black/70' : 'border-white/10 bg-black/40'
                      } transition-all`}
                    >
                      <button
                        className="w-full px-4 py-3 flex items-center justify-between"
                        onClick={() => togglePlanDay(r.id, day)}
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-7 h-7 rounded-full bg-cyan-500/15 border border-cyan-500/40 flex items-center justify-center text-[11px] font-black text-cyan-300">
                            {day[0]}
                          </span>
                          <div className="flex flex-col text-left">
                            <span className="text-xs font-black uppercase tracking-[0.2em] text-slate-100">
                              {day}
                            </span>
                            <span className="text-[10px] text-slate-500 uppercase tracking-[0.2em]">
                              {dayExercises.length} ejercicios
                            </span>
                          </div>
                        </div>

                        <span
                          className={`text-xs text-cyan-300 transition-transform ${
                            open ? 'rotate-180' : ''
                          }`}
                        >
                          ▼
                        </span>
                      </button>

                      {open && (
                        <div className="px-4 pb-4 space-y-2">
                          {dayExercises.length === 0 ? (
                            <div className="bg-black/60 border border-white/10 rounded-xl px-3 py-3">
                              <p className="text-[10px] text-slate-500 uppercase tracking-[0.2em]">
                                Día sin ejercicios asignados
                              </p>
                            </div>
                          ) : (
                            dayExercises.map(ex => (
                              <div
                                key={ex.id}
                                className="flex items-center justify-between bg-black/60 border border-white/10 rounded-xl px-3 py-2"
                              >
                                <div className="flex-1">
                                  <p className="text-[11px] font-black text-white uppercase tracking-[0.15em]">
                                    {ex.name}
                                  </p>
                                  <p className="text-[9px] text-cyan-400/80 uppercase tracking-[0.2em]">
                                    {ex.sets} x {ex.reps}
                                  </p>
                                </div>
                                <span className="text-[9px] text-slate-400 font-mono">
                                  {ex.restTime || '60s'}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <button
                onClick={() => toggleRoutine(r.id)}
                className="mt-6 w-full py-3 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] hover:text-slate-200 transition-colors"
              >
                Cerrar plan
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex bg-black/40 p-1.5 rounded-2xl border border-white/10">
        {(['list', 'ai', 'manual'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${
              activeTab === tab
                ? 'bg-cyan-500 text-black shadow-[0_0_15px_rgba(0,242,255,0.4)]'
                : 'text-slate-500 hover:text-white'
            }`}
          >
            {tab === 'list'
              ? 'MIS RUTINAS'
              : tab === 'ai'
              ? '⚡ GENERADOR AI'
              : '✍️ MANUAL'}
          </button>
        ))}
      </div>

      {activeTab === 'list' && (
        <div className="grid grid-cols-1 gap-6">
          {routines.length === 0 ? (
            <div className="bg-black/40 p-16 rounded-[40px] text-center border border-dashed border-white/10">
              <p className="text-slate-500 font-black uppercase tracking-widest">
                Memoria vacía. Crea una rutina.
              </p>
            </div>
          ) : (
            routines.map(r => renderRoutineCard(r))
          )}
        </div>
      )}

      {activeTab === 'ai' && (
        <div className="bg-black/40 p-8 rounded-[48px] border border-white/10 space-y-8">
          <div className="space-y-2">
            <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter">
              ✨ Bio-Inferencia IA
            </h3>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
              Algoritmo de optimización de rutinas
            </p>
          </div>

          {!isLoggedIn && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] px-2">
                    Frecuencia
                  </label>
                  <select
                    value={aiDays}
                    onChange={e => setAiDays(e.target.value)}
                    className="w-full bg-black border border-white/10 rounded-2xl p-4 text-white font-bold italic focus:ring-2 focus:ring-cyan-500 outline-none appearance-none"
                  >
                    {['2 días', '3 días', '4 días', '5 días', '6 días'].map(opt => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] px-2">
                    Vector de Objetivo
                  </label>
                  <select
                    value={aiObjective}
                    onChange={e => setAiObjective(e.target.value)}
                    className="w-full bg-black border border-white/10 rounded-2xl p-4 text-white font-bold italic focus:ring-2 focus:ring-cyan-500 outline-none appearance-none"
                  >
                    {['Adelgazar', 'Tonificar', 'Crecimiento muscular', 'Fuerza', 'Resistencia'].map(opt => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] px-2">
                    Nivel de Usuario
                  </label>
                  <select
                    value={aiLevel}
                    onChange={e => setAiLevel(e.target.value)}
                    className="w-full bg-black border border-white/10 rounded-2xl p-4 text-white font-bold italic focus:ring-2 focus:ring-cyan-500 outline-none appearance-none"
                  >
                    {['Principiante', 'Intermedio', 'Avanzado'].map(opt => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] px-2">
                    Hardware / Equipo
                  </label>
                  <input
                    type="text"
                    value={aiEquipment}
                    onChange={e => setAiEquipment(e.target.value)}
                    placeholder="Gimnasio completo, etc..."
                    className="w-full bg-black border border-white/10 rounded-2xl p-4 text-white font-bold italic focus:ring-2 focus:ring-cyan-500 outline-none"
                  />
                </div>
              </div>

              <button
                onClick={handleAiGenerateBasic}
                disabled={isGeneratingBasic}
                className="w-full py-5 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 disabled:opacity-20 text-white rounded-[24px] font-black italic uppercase tracking-[0.2em] shadow-[0_10px_30px_rgba(0,242,255,0.3)] transition-all flex items-center justify-center gap-4"
              >
                {isGeneratingBasic ? (
                  <span className="animate-pulse text-xs tracking-widest">SINCRO_IA...</span>
                ) : (
                  <>
                    SINTETIZAR RUTINA <span className="text-xl">⚡</span>
                  </>
                )}
              </button>

              <p className="text-[10px] text-slate-500 text-center mt-4 uppercase tracking-[0.3em]">
                Regístrate para desbloquear rutinas personalizadas y el plan PRO por días.
              </p>
            </>
          )}

          {isLoggedIn && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] px-2">
                    Frecuencia
                  </label>
                  <select
                    value={aiDays}
                    onChange={e => setAiDays(e.target.value)}
                    className="w-full bg-black border border-white/10 rounded-2xl p-4 text-white font-bold italic focus:ring-2 focus:ring-cyan-500 outline-none appearance-none"
                  >
                    {['2 días', '3 días', '4 días', '5 días', '6 días'].map(opt => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] px-2">
                    Vector de Objetivo
                  </label>
                  <select
                    value={aiObjective}
                    onChange={e => setAiObjective(e.target.value)}
                    className="w-full bg-black border border-white/10 rounded-2xl p-4 text-white font-bold italic focus:ring-2 focus:ring-cyan-500 outline-none appearance-none"
                  >
                    {['Adelgazar', 'Tonificar', 'Crecimiento muscular', 'Fuerza', 'Resistencia'].map(opt => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] px-2">
                    Nivel de Usuario
                  </label>
                  <select
                    value={aiLevel}
                    onChange={e => setAiLevel(e.target.value)}
                    className="w-full bg-black border border-white/10 rounded-2xl p-4 text-white font-bold italic focus:ring-2 focus:ring-cyan-500 outline-none appearance-none"
                  >
                    {['Principiante', 'Intermedio', 'Avanzado'].map(opt => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] px-2">
                    Hardware / Equipo
                  </label>
                  <input
                    type="text"
                    value={aiEquipment}
                    onChange={e => setAiEquipment(e.target.value)}
                    placeholder="Mancuernas, barra, poleas..."
                    className="w-full bg-black border border-white/10 rounded-2xl p-4 text-white font-bold italic focus:ring-2 focus:ring-cyan-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                <div className="rounded-[32px] border border-emerald-500/30 bg-emerald-500/5 p-6 space-y-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.35em] text-emerald-300">
                    Registrado
                  </p>
                  <h4 className="text-lg font-black text-white uppercase italic tracking-tight">
                    Rutina personalizada básica
                  </h4>
                  <p className="text-[11px] text-slate-300">
                    Genera una rutina única ajustada a tu objetivo, nivel, frecuencia y material, perfecta para
                    empezar a entrenar ya.
                  </p>
                  <button
                    onClick={handleAiGenerateBasic}
                    disabled={isGeneratingBasic}
                    className="w-full mt-2 py-4 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 disabled:opacity-30 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.25em] shadow-[0_10px_30px_rgba(16,185,129,0.3)] transition-all flex items-center justify-center gap-3"
                  >
                    {isGeneratingBasic ? (
                      <span className="animate-pulse">Generando...</span>
                    ) : (
                      <>
                        Crear rutina básica <span>⚡</span>
                      </>
                    )}
                  </button>
                </div>

                <div
                  className={`rounded-[32px] border p-6 space-y-4 relative overflow-hidden ${
                    isPro
                      ? 'border-fuchsia-500/60 bg-gradient-to-br from-fuchsia-600/15 via-black/60 to-cyan-500/15 shadow-[0_0_30px_rgba(255,0,247,0.4)]'
                      : 'border-fuchsia-500/30 bg-gradient-to-br from-fuchsia-600/10 via-black/80 to-slate-800'
                  }`}
                >
                  <div className="absolute inset-0 pointer-events-none opacity-40 mix-blend-screen">
                    <div className="w-40 h-40 bg-fuchsia-500/40 blur-3xl rounded-full absolute -top-10 -right-8" />
                    <div className="w-40 h-40 bg-cyan-500/40 blur-3xl rounded-full absolute -bottom-12 -left-6" />
                  </div>

                  <div className="relative space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-[0.35em] text-fuchsia-300 flex items-center gap-2">
                      Titan PRO
                      <span className="px-2 py-0.5 rounded-full bg-fuchsia-600 text-[9px] uppercase tracking-[0.25em] text-white shadow-[0_0_12px_#ff00f7]">
                        PRO
                      </span>
                    </p>
                    <h4 className="text-lg font-black text-white uppercase italic tracking-tight">
                      Plan de entrenamiento por días
                    </h4>
                    <p className="text-[11px] text-slate-100">
                      La IA construye un sistema completo de entrenamiento repartido por días, ajustado a tu perfil,
                      objetivo y contexto real.
                    </p>
                  </div>

                  <button
                    onClick={handleAiGeneratePro}
                    disabled={isGeneratingPro || !isPro}
                    className={`relative w-full mt-4 py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.25em] flex items-center justify-center gap-3 transition-all ${
                      isPro
                        ? 'bg-gradient-to-r from-fuchsia-600 to-cyan-500 text-white shadow-[0_0_30px_rgba(255,0,247,0.6)] hover:shadow-[0_0_40px_rgba(255,0,247,0.8)]'
                        : 'bg-slate-900/80 text-slate-500 border border-fuchsia-500/40'
                    }`}
                  >
                    {isPro ? (
                      isGeneratingPro ? (
                        <span className="animate-pulse">Sintetizando plan PRO...</span>
                      ) : (
                        <>
                          Crear plan semanal PRO <span>🚀</span>
                        </>
                      )
                    ) : (
                      <>
                        Desbloquear con Titan PRO <span>🔓</span>
                      </>
                    )}
                  </button>

                  {!isPro && (
                    <p className="relative mt-2 text-[10px] text-slate-300">
                      Actualiza a Titan PRO para desbloquear planes por días, progresiones y personalización avanzada.
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'manual' && (
        <div className="bg-black/40 p-8 rounded-[48px] border border-white/10 space-y-8">
          <div className="space-y-4">
            <input
              type="text"
              placeholder="Nombre de la Rutina"
              value={manualName}
              onChange={e => setManualName(e.target.value)}
              className="w-full bg-black border border-white/10 rounded-[24px] p-5 text-white text-2xl font-black italic uppercase tracking-tighter outline-none focus:ring-2 focus:ring-cyan-500 transition-all"
            />
            <input
              type="text"
              placeholder="Descripción del sistema (opcional)"
              value={manualDesc}
              onChange={e => setManualDesc(e.target.value)}
              className="w-full bg-white/5 border border-white/5 rounded-2xl p-4 text-slate-300 outline-none italic"
            />
          </div>

          <div className="space-y-4">
            <h4 className="text-[9px] font-black text-slate-600 uppercase tracking-[0.5em] px-4">
              Configuración de Ejercicios
            </h4>
            {manualExercises.map(ex => (
              <div
                key={ex.id}
                className="bg-black/60 p-6 rounded-[32px] border border-white/5 space-y-6"
              >
                <div className="flex gap-4 items-center">
                  <select
                    value={ex.name}
                    onChange={e => updateManualExercise(ex.id, 'name', e.target.value)}
                    className="flex-1 bg-black border border-white/10 rounded-xl p-3 text-white text-xs font-black italic uppercase outline-none"
                  >
                    {INITIAL_EXERCISES.map(name => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() =>
                      setManualExercises(prev => prev.filter(item => item.id !== ex.id))
                    }
                    className="text-fuchsia-500 hover:text-white transition-colors p-2 text-xl"
                  >
                    ×
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block text-center">
                      Series
                    </span>
                    <input
                      type="number"
                      value={ex.sets}
                      onChange={e => updateManualExercise(ex.id, 'sets', Number(e.target.value))}
                      className="w-full bg-black border border-white/5 rounded-xl p-3 text-center text-white text-sm font-black italic outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block text-center">
                      Reps
                    </span>
                    <input
                      type="text"
                      value={ex.reps}
                      placeholder="8-12"
                      onChange={e => updateManualExercise(ex.id, 'reps', e.target.value)}
                      className="w-full bg-black border border-white/5 rounded-xl p-3 text-center text-white text-sm font-black italic outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block text-center">
                      Break
                    </span>
                    <input
                      type="text"
                      value={ex.restTime}
                      placeholder="60s"
                      onChange={e => updateManualExercise(ex.id, 'restTime', e.target.value)}
                      className="w-full bg-black border border-white/5 rounded-xl p-3 text-center text-cyan-400 text-sm font-mono font-black italic outline-none"
                    />
                  </div>
                </div>
              </div>
            ))}

            <button
              onClick={addManualExercise}
              className="w-full py-6 border-2 border-dashed border-white/5 rounded-[32px] text-slate-500 hover:text-cyan-400 hover:border-cyan-500/30 transition-all font-black uppercase text-[10px] tracking-[0.2em]"
            >
              + AÑADIR NÚCLEO
            </button>
          </div>

          <button
            onClick={handleSaveManual}
            className="w-full py-5 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white rounded-[24px] font-black italic uppercase tracking-[0.2em] shadow-[0_10px_30px_rgba(16,185,129,0.3)] transition-all"
          >
            {editingId ? 'ACTUALIZAR RUTINA' : 'GRABAR EN MEMORIA'}
          </button>
        </div>
      )}
    </div>
  );
};

export default RoutinesView;