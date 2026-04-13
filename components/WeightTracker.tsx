
import React, { useState, useMemo } from 'react';
import { WeightRecord } from '../types';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

interface WeightTrackerProps {
  records: WeightRecord[];
  onAddRecord: (weight: number) => void | Promise<void>;
  onDeleteRecord: (id: string) => void | Promise<void>;
}

const WeightTracker: React.FC<WeightTrackerProps> = ({
  records,
  onAddRecord,
  onDeleteRecord
}) => {
  const [newWeight, setNewWeight] = useState('');

  const sortedRecords = useMemo(() => {
    return [...records].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }, [records]);

  const chartData = useMemo(() => {
    return sortedRecords.map(r => ({
      date: new Date(r.date).toLocaleDateString('es-ES', {
        month: 'short',
        day: 'numeric'
      }),
      weight: r.weight,
      fullDate: new Date(r.date).toLocaleDateString('es-ES')
    }));
  }, [sortedRecords]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const weightVal = parseFloat(newWeight);

    if (!isNaN(weightVal) && weightVal > 0) {
      onAddRecord(weightVal);
      setNewWeight('');
    }
  };

  const latestRecord =
    sortedRecords.length > 0 ? sortedRecords[sortedRecords.length - 1] : null;

  const latestWeight = latestRecord ? latestRecord.weight : null;

  return (
    <div className="space-y-6">
      <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl">
        <h3 className="text-xl font-bold text-white mb-4">Registrar Peso Corporal</h3>

        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative min-w-0">
            <input
              type="number"
              step="0.1"
              value={newWeight}
              onChange={(e) => setNewWeight(e.target.value)}
              placeholder="Ej: 75.5"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-4 text-white text-lg font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all pr-12"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">
              kg
            </span>
          </div>

          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-xl font-bold transition-all shadow-lg"
          >
            Añadir
          </button>
        </form>
      </div>

      {latestWeight !== null && latestRecord && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700">
            <p className="text-slate-400 text-sm font-medium uppercase">Peso Actual</p>
            <h3 className="text-4xl font-bold text-blue-400 mt-1">
              {latestWeight} <span className="text-lg text-slate-500">kg</span>
            </h3>
          </div>

          <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700">
            <p className="text-slate-400 text-sm font-medium uppercase">Último Registro</p>
            <h3 className="text-2xl font-bold text-emerald-400 mt-1">
              {new Date(latestRecord.date).toLocaleDateString('es-ES')}
            </h3>
          </div>
        </div>
      )}

      <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl">
        <h3 className="text-xl font-bold text-white mb-6">Evolución de Peso</h3>

        {records.length < 2 ? (
          <div className="h-60 flex items-center justify-center text-slate-500 italic">
            Registra al menos 2 días para ver la gráfica de progreso.
          </div>
        ) : (
          <div className="w-full min-w-0 h-[300px]">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <LineChart
                data={chartData}
                margin={{ top: 10, right: 12, left: 0, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />

                <XAxis
                  dataKey="date"
                  stroke="#94a3b8"
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={{ stroke: '#475569' }}
                />

                <YAxis
                  stroke="#94a3b8"
                  domain={['auto', 'auto']}
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={{ stroke: '#475569' }}
                  width={42}
                />

                <Tooltip
                  labelFormatter={(label, payload) => {
                    if (payload && payload.length > 0) {
                      return payload[0].payload.fullDate;
                    }
                    return label;
                  }}
                  formatter={(value: number | string) => [`${value} kg`, 'Peso']}
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    color: '#f8fafc'
                  }}
                  itemStyle={{ color: '#60a5fa' }}
                  labelStyle={{ color: '#cbd5e1' }}
                />

                <Line
                  type="monotone"
                  dataKey="weight"
                  name="Peso (kg)"
                  stroke="#3b82f6"
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#3b82f6' }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl">
        <h3 className="text-xl font-bold text-white mb-4">Historial de Registros</h3>

        {records.length === 0 ? (
          <p className="text-slate-500 italic text-center py-8">
            No hay registros de peso aún.
          </p>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar">
            {[...sortedRecords].reverse().map(record => (
              <div
                key={record.id}
                className="flex justify-between items-center p-4 bg-slate-900 rounded-xl hover:bg-slate-700/50 transition-all border border-slate-800 gap-4"
              >
                <div className="min-w-0">
                  <p className="text-sm text-slate-400 capitalize">
                    {new Date(record.date).toLocaleString('es-ES', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long'
                    })}
                  </p>
                  <p className="font-mono text-xs text-slate-500">
                    {new Date(record.date).toLocaleTimeString('es-ES', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>

                <div className="flex items-center gap-6 shrink-0">
                  <p className="text-xl font-bold text-blue-400">
                    {record.weight}{' '}
                    <span className="text-xs text-slate-500 uppercase">kg</span>
                  </p>

                  <button
                    onClick={() => onDeleteRecord(record.id)}
                    className="p-2 text-slate-500 hover:text-red-400 transition-colors"
                    title="Eliminar"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #334155;
          border-radius: 10px;
        }
      `}</style>
    </div>
  );
};

export default WeightTracker;