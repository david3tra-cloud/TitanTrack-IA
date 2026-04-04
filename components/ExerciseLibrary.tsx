
import React, { useState } from 'react';
import { EXERCISE_DATABASE, EXERCISE_CATEGORIES } from '../constants';

const ExerciseLibrary: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todos');

  const filteredExercises = EXERCISE_DATABASE.filter(ex => {
    const matchesSearch = ex.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'Todos' || ex.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-8">
      <div className="bg-black/40 p-8 rounded-[40px] border border-white/10 space-y-6">
        <div className="relative">
          <input
            type="text"
            placeholder="Analizar base de datos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-black border border-white/10 rounded-3xl p-5 pl-14 text-white font-bold outline-none focus:ring-2 focus:ring-cyan-500 transition-all italic"
          />
          <span className="absolute left-6 top-1/2 -translate-y-1/2 text-2xl">📡</span>
        </div>
        
        <div className="flex gap-3 overflow-x-auto pb-4 custom-scrollbar">
          <button
            onClick={() => setSelectedCategory('Todos')}
            className={`px-6 py-3 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all border ${
              selectedCategory === 'Todos' ? 'bg-cyan-500 border-cyan-400 text-black shadow-[0_0_15px_rgba(0,242,255,0.4)]' : 'bg-black border-white/10 text-slate-500'
            }`}
          >
            Todos los Sectores
          </button>
          {EXERCISE_CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-6 py-3 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all border ${
                selectedCategory === cat ? 'bg-fuchsia-600 border-fuchsia-500 text-white shadow-[0_0_15px_rgba(255,0,247,0.4)]' : 'bg-black border-white/10 text-slate-500'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {filteredExercises.map((ex, idx) => (
          <div key={idx} className="group relative bg-black/40 rounded-[48px] border border-white/5 overflow-hidden flex flex-col hover:border-cyan-500/50 transition-all duration-500">
            <div className="h-64 bg-slate-900/40 flex items-center justify-center p-8 relative">
              <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent opacity-60"></div>
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-fuchsia-500/5 blur-[60px] rounded-full"></div>
              
              <svg viewBox="0 0 100 100" className="w-40 h-40 drop-shadow-[0_0_15px_rgba(0,242,255,0.4)] transition-transform duration-700 group-hover:scale-110">
                {ex.drawing}
              </svg>
              
              <div className="absolute top-6 left-8 flex flex-col gap-1">
                 <span className="text-[8px] font-black text-cyan-400 uppercase tracking-[0.3em]">Sector: {ex.category}</span>
                 <div className="w-12 h-0.5 bg-cyan-500"></div>
              </div>
              <span className="absolute bottom-6 right-8 text-[8px] font-black uppercase tracking-[0.5em] text-slate-700">BioMechanic Core v2.0</span>
            </div>
            
            <div className="p-8 space-y-4 flex-1 flex flex-col relative bg-black/40">
              <h3 className="text-3xl font-black text-white italic uppercase tracking-tighter group-hover:text-cyan-400 transition-colors">{ex.name}</h3>
              <p className="text-slate-400 text-sm leading-relaxed flex-1 font-medium">
                {ex.description}
              </p>
              <div className="pt-6 flex items-center justify-between border-t border-white/5">
                 <div className="flex gap-2">
                    <div className="px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-400 text-[8px] font-black uppercase tracking-widest border border-cyan-500/20">Fuerza</div>
                    <div className="px-3 py-1 rounded-full bg-fuchsia-500/10 text-fuchsia-400 text-[8px] font-black uppercase tracking-widest border border-fuchsia-500/20">Hipertrofia</div>
                 </div>
                 <span className="text-[10px] font-black text-slate-600">ID: EX_{idx.toString().padStart(3, '0')}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ExerciseLibrary;
