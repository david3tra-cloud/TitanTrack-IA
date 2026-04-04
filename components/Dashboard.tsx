
import React from 'react';
import { Workout } from '../types';

interface DashboardProps {
  workouts: Workout[];
}

const Dashboard: React.FC<DashboardProps> = ({ workouts }) => {
  const totalVolume = workouts.reduce((acc, workout) => {
    return acc + workout.exercises.reduce((exAcc, ex) => {
      return exAcc + ex.sets.reduce((setAcc, set) => setAcc + (set.weight * set.reps), 0);
    }, 0);
  }, 0);

  const lastWorkout = workouts[workouts.length - 1];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="relative group overflow-hidden bg-black/40 p-8 rounded-[32px] border border-white/10 transition-all hover:border-cyan-500/50">
          <div className="absolute top-0 right-0 p-4 opacity-10 text-6xl font-black italic">DATA</div>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">Sesiones Totales</p>
          <h3 className="text-6xl font-black text-white mt-4 italic tracking-tighter">{workouts.length}</h3>
          <div className="w-12 h-1 bg-cyan-500 mt-4 shadow-[0_0_10px_#00f2ff]"></div>
        </div>

        <div className="relative group overflow-hidden bg-black/40 p-8 rounded-[32px] border border-white/10 transition-all hover:border-fuchsia-500/50">
          <div className="absolute top-0 right-0 p-4 opacity-10 text-6xl font-black italic">VOL</div>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">Carga Acumulada</p>
          <div className="flex items-baseline gap-2 mt-4">
             <h3 className="text-5xl font-black text-fuchsia-500 italic tracking-tighter">{(totalVolume/1000).toFixed(1)}</h3>
             <span className="text-xl font-black text-slate-700 italic">TONS</span>
          </div>
          <div className="w-12 h-1 bg-fuchsia-500 mt-4 shadow-[0_0_10px_#ff00f7]"></div>
        </div>

        <div className="relative group overflow-hidden bg-black/40 p-8 rounded-[32px] border border-white/10 transition-all hover:border-cyan-500/50">
          <div className="absolute top-0 right-0 p-4 opacity-10 text-6xl font-black italic">LAST</div>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">Última Transmisión</p>
          <h3 className="text-3xl font-black text-white mt-4 uppercase italic leading-tight">
            {lastWorkout ? lastWorkout.name : 'Vacio'}
          </h3>
          <p className="text-cyan-400 text-xs font-bold mt-2 font-mono">
            {lastWorkout ? new Date(lastWorkout.date).toLocaleDateString() : '--/--/--'}
          </p>
        </div>
      </div>

      <div className="bg-black/40 rounded-[40px] border border-white/10 p-8">
        <div className="flex justify-between items-center mb-8">
           <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter">Eventos Recientes</h3>
           <span className="bg-white/5 px-3 py-1 rounded-full text-[10px] text-slate-500 font-black uppercase tracking-widest">Mainframe Link</span>
        </div>
        {workouts.length === 0 ? (
          <div className="py-20 text-center border-2 border-dashed border-white/5 rounded-[32px]">
            <p className="text-slate-600 font-black uppercase tracking-[0.5em]">Esperando Datos...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {[...workouts].reverse().slice(0, 5).map(workout => (
              <div key={workout.id} className="group flex justify-between items-center p-6 bg-white/5 rounded-3xl border border-transparent hover:border-cyan-500/30 transition-all cursor-pointer">
                <div className="flex items-center gap-6">
                  <div className="w-12 h-12 rounded-2xl bg-black flex items-center justify-center border border-white/10 group-hover:border-cyan-400 group-hover:shadow-[0_0_10px_rgba(0,242,255,0.4)] transition-all">
                     <span className="text-xl">🦾</span>
                  </div>
                  <div>
                    <h4 className="font-black text-white uppercase italic tracking-tight group-hover:text-cyan-400 transition-colors">{workout.name}</h4>
                    <p className="text-[10px] text-slate-500 font-mono mt-1 uppercase tracking-widest">{new Date(workout.date).toLocaleTimeString()}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-black text-white italic tracking-tighter">{workout.exercises.length}</p>
                  <p className="text-[8px] text-slate-600 font-black uppercase tracking-[0.2em]">Protocolos</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
