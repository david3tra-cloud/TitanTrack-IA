
import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Workout } from '../types';

interface ProgressChartsProps {
  workouts: Workout[];
}

const ProgressCharts: React.FC<ProgressChartsProps> = ({ workouts }) => {
  const chartData = useMemo(() => {
    return workouts.map(w => ({
      date: new Date(w.date).toLocaleDateString('es-ES', { month: 'short', day: 'numeric' }),
      volume: w.exercises.reduce((exAcc, ex) => {
        return exAcc + ex.sets.reduce((setAcc, set) => setAcc + (set.weight * set.reps), 0);
      }, 0),
      exercises: w.exercises.length
    }));
  }, [workouts]);

  if (workouts.length < 2) {
    return (
      <div className="bg-slate-800 p-12 rounded-2xl border border-slate-700 text-center">
        <p className="text-slate-400 text-lg">Se necesitan al menos 2 entrenamientos para mostrar el progreso visualmente.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700">
        <h3 className="text-xl font-bold mb-6 text-white">Progresión de Volumen (kg)</h3>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#f8fafc' }}
                itemStyle={{ color: '#60a5fa' }}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="volume" 
                name="Volumen Total" 
                stroke="#3b82f6" 
                strokeWidth={3} 
                dot={{ r: 6, fill: '#3b82f6' }} 
                activeDot={{ r: 8 }} 
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default ProgressCharts;
