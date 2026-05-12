import React, { useState, useEffect } from 'react';
import { Workout, Exercise, Set, Routine } from '../types';
import { EXERCISE_CATEGORIES, INITIAL_EXERCISES } from '../constants';

const STORAGE_KEY = 'titan_active_workout';

interface ActiveWorkoutState {
  name: string;
  exercises: Exercise[];
  totalSeconds: number;
}

interface WorkoutLoggerProps {
  onSave: (workout: Workout) => void;
  onCancel: () => void;
  routines: Routine[];
}

const WorkoutLogger: React.FC<WorkoutLoggerProps> = ({ onSave, onCancel, routines }) => {
  const getSavedState = (): ActiveWorkoutState | null => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  const saved = getSavedState();

  const [name, setName] = useState<string>(saved?.name ?? 'RUTINA_' + Date.now().toString().slice(-4));
  const [exercises, setExercises] = useState<Exercise[]>(saved?.exercises ?? []);
  const [showRoutineSelector, setShowRoutineSelector] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState<number | null>(null);
  const [totalSeconds, setTotalSeconds] = useState<number>(saved?.totalSeconds ?? 0);
  const [showResumeAlert, setShowResumeAlert] = useState<boolean>(!!saved);

  // Persistir estado activo en localStorage en cada cambio
  useEffect(() => {
    const state: ActiveWorkoutState = { name, exercises, totalSeconds };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [name, exercises, totalSeconds]);

  // Cronometro total
  useEffect(() => {
    const interval = setInterval(() => setTotalSeconds(prev => prev + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  // Timer de descanso entre series
  useEffect(() => {
    if (timerSeconds !== null && timerSeconds > 0) {
      const interval = setInterval(() => setTimerSeconds(s => s! - 1), 1000);
      return () => clearInterval(interval);
    } else if (timerSeconds === 0) {
      setTimerSeconds(null);
      if ('vibrate' in navigator) navigator.vibrate([100, 50, 100]);
    }
  }, [timerSeconds]);

  const clearSavedSession = () => {
    localStorage.removeItem(STORAGE_KEY);
  };

  const loadRoutine = (routine: Routine) => {
    const loadedExercises: Exercise[] = routine.exercises.map(re => ({
      id: Math.random().toString(36).substr(2, 9),
      name: re.name,
      category: 'Cargado',
      sets: Array.from({ length: re.sets }).map(() => ({
        id: Math.random().toString(36).substr(2, 9),
        reps: parseInt(re.reps) || 10,
        weight: 0,
        completed: false,
        restTime: re.restTime
      }))
    }));
    setExercises(loadedExercises);
    setName(routine.name + '_ACTIVO');
    setShowRoutineSelector(false);
    setShowResumeAlert(false);
  };

  const addExercise = () => {
    setExercises([...exercises, {
      id: Math.random().toString(36).substr(2, 9),
      name: INITIAL_EXERCISES[0],
      category: EXERCISE_CATEGORIES[0],
      sets: [{
        id: Math.random().toString(36).substr(2, 9),
        reps: 10,
        weight: 20,
        completed: false,
        restTime: '60s'
      }]
    }]);
  };

  const addSet = (exerciseId: string) => {
    setExercises(exercises.map(ex =>
      ex.id === exerciseId
        ? { ...ex, sets: [...ex.sets, { id: Math.random().toString(36).substr(2, 9), reps: 10, weight: 20, completed: false, restTime: '60s' }] }
        : ex
    ));
  };

  const deleteSet = (exerciseId: string, setId: string) => {
    setExercises(exercises.map(ex =>
      ex.id === exerciseId
        ? { ...ex, sets: ex.sets.filter(s => s.id !== setId) }
        : ex
    ));
  };

  const updateSet = (exerciseId: string, setId: string, field: keyof Set, value: any) => {
    setExercises(exercises.map(ex =>
      ex.id === exerciseId
        ? {
          ...ex,
          sets: ex.sets.map(s => {
            if (s.id === setId) {
              if (field === 'completed' && value === true && !s.completed) setTimerSeconds(60);
              return { ...s, [field]: value };
            }
            return s;
          })
        }
        : ex
    ));
  };

  const handleSave = () => {
    if (exercises.length === 0) {
      alert('Añade al menos un ejercicio para guardar la sesión.');
      return;
    }
    const workout: Workout = {
      id: Math.random().toString(36).substr(2, 9),
      date: new Date().toISOString(),
      name: name || 'ENTRENAMIENTO_SIN_NOMBRE',
      exercises: exercises.map(ex => ({
        ...ex,
        sets: ex.sets.filter(s => s.completed || (s.reps > 0 && s.weight >= 0))
      }))
    };
    clearSavedSession();
    onSave(workout);
  };

  const handleCancel = () => {
    clearSavedSession();
    onCancel();
  };

  const handleDiscardAndStart = () => {
    clearSavedSession();
    setName('RUTINA_' + Date.now().toString().slice(-4));
    setExercises([]);
    setTotalSeconds(0);
    setShowResumeAlert(false);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-start justify-center overflow-y-auto py-4 px-4">
      <div className="w-full max-w-4xl bg-gradient-to-br from-slate-900 via-black to-slate-950 border border-white/10 rounded-3xl shadow-2xl p-6 space-y-6">
        {/* Banner de entrenamiento en curso */}
        {showResumeAlert && (
          <div className="bg-cyan-500/10 border-2 border-cyan-500/50 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-2xl">⚡</span>
              <span className="font-black text-cyan-400 uppercase tracking-widest text-sm">
                Entrenamiento en curso recuperado
              </span>
            </div>
            <p className="text-slate-400 text-xs">
              Tienes una sesión activa guardada. ¿Quieres continuar o empezar de nuevo?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowResumeAlert(false)}
                className="flex-1 py-2 bg-cyan-500/20 border border-cyan-500/50 text-cyan-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-cyan-500 hover:text-black transition-all"
              >
                Continuar
              </button>
              <button
                onClick={handleDiscardAndStart}
                className="flex-1 py-2 bg-fuchsia-500/20 border border-fuchsia-500/50 text-fuchsia-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-fuchsia-500 hover:text-black transition-all"
              >
                Empezar de nuevo
              </button>
            </div>
          </div>
        )}

        {/* Timer de descanso */}
        {timerSeconds !== null && (
          <div className="bg-fuchsia-600/20 border-2 border-fuchsia-500 rounded-2xl p-4 text-center">
            <div className="text-4xl font-black text-fuchsia-400 tracking-widest">
              RECARGA: {timerSeconds}s
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-black text-white italic flex items-center gap-2">
              <span className="text-fuchsia-500">⚡</span>
              Bio Registro
            </h2>
            <div className="text-xs text-slate-500 uppercase tracking-widest flex items-center gap-2 mt-1">
              <span className="text-cyan-400 font-black">{Math.floor(totalSeconds / 60)}m {totalSeconds % 60}s</span>
              <span className="text-fuchsia-500">●</span>
              <span className="text-fuchsia-400 font-black">ACTIVE</span>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="text-slate-500 hover:text-white text-2xl font-bold transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Selector de rutina */}
        {exercises.length === 0 && routines.length > 0 && (
          <button
            onClick={() => setShowRoutineSelector(!showRoutineSelector)}
            className="bg-fuchsia-600/20 border border-fuchsia-500/50 text-fuchsia-400 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-fuchsia-500 hover:text-white transition-all"
          >
            {showRoutineSelector ? 'CERRAR' : 'CARGAR RUTINA'}
          </button>
        )}

        {showRoutineSelector && (
          <div className="bg-black/40 border border-white/10 rounded-2xl p-6 space-y-4">
            <h3 className="text-lg font-black text-white uppercase tracking-widest">
              Seleccionar Rutina Guardada
            </h3>
            <div className="space-y-3">
              {routines.map(r => (
                <button
                  key={r.id}
                  onClick={() => loadRoutine(r)}
                  className="w-full text-left p-4 bg-black/40 border border-white/5 rounded-2xl hover:border-cyan-500/50 transition-all group"
                >
                  <div className="font-black text-white group-hover:text-cyan-400 transition-colors">
                    {r.name}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {r.exercises.length} Ejercicios
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Nombre de sesión */}
        <div className="space-y-2">
          <label className="text-xs uppercase tracking-widest text-slate-500 font-black">
            Identificador de Sesión
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white font-black italic focus:ring-2 focus:ring-cyan-500 outline-none transition-all"
          />
        </div>

        {/* Ejercicios */}
        {exercises.map((ex) => {
          const allOptions = INITIAL_EXERCISES.includes(ex.name)
            ? INITIAL_EXERCISES
            : [ex.name, ...INITIAL_EXERCISES];

          return (
            <div key={ex.id} className="bg-black/40 border border-white/10 rounded-2xl p-6 space-y-4">
              <div className="flex gap-2 items-center">
                <select
                  value={ex.name}
                  onChange={(e) =>
                    setExercises(exercises.map(item =>
                      item.id === ex.id ? { ...item, name: e.target.value } : item
                    ))
                  }
                  className="bg-black border border-white/10 rounded-xl p-3 text-white font-black text-sm italic focus:ring-1 focus:ring-cyan-500 outline-none flex-1 min-w-0"
                >
                  {allOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
                <button
                  onClick={() => setExercises(exercises.filter(item => item.id !== ex.id))}
                  className="text-fuchsia-500 text-[10px] font-black uppercase tracking-widest hover:text-white transition-colors shrink-0"
                >
                  Eliminar
                </button>
              </div>

              {/* Cabecera de tabla */}
              <div className="grid grid-cols-[50px_1fr_1fr_60px_40px] gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 px-2">
                <div>Set</div>
                <div>KG</div>
                <div>Reps</div>
                <div>Status</div>
                <div></div>
              </div>

              {/* Filas de series */}
              {ex.sets.map((set, idx) => (
                <div key={set.id} className="grid grid-cols-[50px_1fr_1fr_60px_40px] gap-2 items-center">
                  <div className="text-slate-500 font-bold text-xs text-center">#{idx + 1}</div>
                  <input
                    type="number"
                    value={set.weight}
                    onChange={(e) => updateSet(ex.id, set.id, 'weight', Number(e.target.value))}
                    className="w-full min-w-0 bg-black/60 border border-white/5 rounded-lg py-2 px-1 text-center text-white font-bold text-xs focus:ring-1 focus:ring-cyan-500 outline-none box-border"
                  />
                  <input
                    type="number"
                    value={set.reps}
                    onChange={(e) => updateSet(ex.id, set.id, 'reps', Number(e.target.value))}
                    className="w-full min-w-0 bg-black/60 border border-white/5 rounded-lg py-2 px-1 text-center text-white font-bold text-xs focus:ring-1 focus:ring-cyan-500 outline-none box-border"
                  />
                  <button
                    onClick={() => updateSet(ex.id, set.id, 'completed', !set.completed)}
                    className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all border-2 mx-auto ${
                      set.completed
                        ? 'bg-cyan-500 border-cyan-500 text-black shadow-[0_0_10px_#00f2ff]'
                        : 'border-slate-800 text-transparent'
                    }`}
                  >
                    {set.completed ? '⚡' : ''}
                  </button>
                  <button
                    onClick={() => deleteSet(ex.id, set.id)}
                    className="text-slate-700 hover:text-fuchsia-500 text-lg text-center"
                  >
                    ×
                  </button>
                </div>
              ))}

              <button
                onClick={() => addSet(ex.id)}
                className="w-full py-3 border border-dashed border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white hover:border-cyan-500/30 transition-all"
              >
                + Nueva Serie
              </button>
            </div>
          );
        })}

        {/* Botón añadir ejercicio */}
        <button
          onClick={addExercise}
          className="w-full py-4 border border-dashed border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white hover:border-fuchsia-500/30 transition-all"
        >
          ⚡ Añadir Ejercicio Libre
        </button>

        {/* Botones de acción */}
        <div className="flex gap-3">
          <button
            onClick={handleCancel}
            className="flex-1 py-4 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white hover:border-white/30 transition-all"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-4 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-2xl text-[10px] font-black uppercase tracking-widest text-black hover:text-black transition-all"
          >
            Confirmar Transmisión
          </button>
        </div>
      </div>
    </div>
  );
};

export default WorkoutLogger;
