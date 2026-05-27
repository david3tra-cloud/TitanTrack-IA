import React, { useState, useEffect } from 'react';
import {
  View,
  Workout,
  Routine,
  WeightRecord,
  UserProfile,
  AuthUser
} from './types';
import Navbar from './components/Navbar';
import AuthModal from './components/AuthModal';
import Dashboard from './components/Dashboard';
import WorkoutLogger from './components/WorkoutLogger';
import Recommendations from './components/Recommendations';
import RoutinesView from './components/RoutinesView';
import WeightTracker from './components/WeightTracker';
import ExerciseLibrary from './components/ExerciseLibrary';
import UserProfileView from './components/UserProfileView';
import { supabase } from './src/lib/supabaseClient';
import { Analytics } from '@vercel/analytics/react';

const defaultUserProfile: UserProfile = {
  displayName: '',
  plan: 'free',
  sex: '',
  birthYear: undefined,
  heightCm: undefined,
  weightKg: undefined,
  goal: '',
  level: '',
  trainingDaysPerWeek: undefined,
  sessionMinutes: undefined,
  preferredStyle: '',
  equipment: [],
  limitations: '',
  measurements: {}
};

const WorkoutLogEntry: React.FC<{ workout: Workout }> = ({ workout }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div
      className={`rounded-2xl border transition-all duration-500 overflow-hidden ${
        isExpanded
          ? 'bg-slate-900/40 border-cyan-500/50 shadow-[0_0_20px_rgba(0,242,255,0.1)]'
          : 'bg-black/40 border-white/10 hover:border-cyan-500/30'
      }`}
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full text-left p-6 flex justify-between items-center group"
      >
        <div>
          <h3
            className={`text-xl font-black uppercase tracking-tighter transition-colors ${
              isExpanded ? 'text-cyan-400' : 'text-white'
            }`}
          >
            {workout.name}
          </h3>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
            {new Date(workout.date).toLocaleString()}
          </p>
        </div>
        <div
          className={`text-xl transition-all duration-500 ${
            isExpanded ? 'rotate-180 text-cyan-400' : 'text-slate-600'
          }`}
        >
          ▼
        </div>
      </button>

      {isExpanded && (
        <div className="p-6 pt-0 border-t border-white/5 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="space-y-4 mt-6">
            {workout.exercises.map(ex => (
              <div key={ex.id} className="p-4 rounded-xl bg-black/40 border border-white/5">
                <p className="font-black text-cyan-400 mb-3 text-sm uppercase italic tracking-wider">
                  {ex.name}
                </p>
                <div className="flex flex-wrap gap-2">
                  {ex.sets.map((set, i) => (
                    <div
                      key={set.id}
                      className="bg-slate-900/80 px-3 py-2 rounded-lg text-[10px] text-slate-400 border border-white/5 flex items-center gap-2"
                    >
                      <span className="text-magenta-500 font-black">S{i + 1}</span>
                      <span className="text-white font-bold">
                        {set.weight} <span className="text-[8px] opacity-50">KG</span>
                      </span>
                      <span className="opacity-20">|</span>
                      <span className="text-cyan-400 font-bold">
                        {set.reps} <span className="text-[8px] opacity-50">REPS</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>(View.DASHBOARD);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [weightRecords, setWeightRecords] = useState<WeightRecord[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile>(defaultUserProfile);

  const [showLogger, setShowLogger] = useState(false);
  const [isFabMenuOpen, setIsFabMenuOpen] = useState(false);

  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);

  const [pendingProfileLoad, setPendingProfileLoad] = useState<{
    id: string;
    email: string;
    name: string;
    closeModal?: boolean;
  } | null>(null);

  const isPro = userProfile.plan === 'pro' || userProfile.plan === 'infinity';
  const isInfinity = userProfile.plan === 'infinity';
  const isLoggedIn = !!authUser;

  const clearAuthState = () => {
    setAuthUser(null);
    setUserProfile(defaultUserProfile);
    setCurrentView(View.DASHBOARD);
    setShowLogger(false);
    setIsFabMenuOpen(false);
    setWeightRecords([]);
    setWorkouts([]);
    setRoutines([]);
  };

  const loadProfile = async (
    userId: string,
    fallbackEmail?: string,
    fallbackDisplayName?: string
  ): Promise<boolean> => {
    const { data, error } = await supabase
      .from('profiles')
      .select(
        `
          id,
          display_name,
          plan,
          sex,
          birth_year,
          height_cm,
          weight_kg,
          goal,
          level,
          training_days_per_week,
          session_minutes,
          preferred_style,
          equipment,
          limitations,
          measurements
        `
      )
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error cargando profile:', error.message);
      return false;
    }

    if (!data) {
      setUserProfile(defaultUserProfile);
      setAuthUser(prev =>
        prev
          ? {
              ...prev,
              displayName: prev.displayName || fallbackDisplayName || fallbackEmail || '',
              email: prev.email || fallbackEmail || '',
              plan: 'free'
            }
          : prev
      );
      return false;
    }

    const profileFromDb: UserProfile = {
      ...defaultUserProfile,
      displayName: data.display_name || fallbackDisplayName || fallbackEmail || '',
      plan: data.plan || 'free',
      sex: data.sex || '',
      birthYear: data.birth_year ?? undefined,
      heightCm: data.height_cm ?? undefined,
      weightKg: data.weight_kg ?? undefined,
      goal: data.goal || '',
      level: data.level || '',
      trainingDaysPerWeek: data.training_days_per_week ?? undefined,
      sessionMinutes: data.session_minutes ?? undefined,
      preferredStyle: data.preferred_style || '',
      equipment: Array.isArray(data.equipment) ? data.equipment : [],
      limitations: data.limitations || '',
      measurements: data.measurements || {}
    };

    setUserProfile(profileFromDb);

    setAuthUser(prev =>
      prev
        ? {
            ...prev,
            displayName:
              profileFromDb.displayName || prev.displayName || fallbackDisplayName || fallbackEmail || '',
            email: prev.email || fallbackEmail || '',
            plan: profileFromDb.plan || 'free'
          }
        : {
            id: userId,
            displayName: profileFromDb.displayName || fallbackDisplayName || fallbackEmail || '',
            email: fallbackEmail || '',
            plan: profileFromDb.plan || 'free'
          }
    );

    return true;
  };

  useEffect(() => {
    if (!pendingProfileLoad) return;

    const run = async () => {
      const { id, email, name, closeModal } = pendingProfileLoad;

      await loadProfile(id, email, name);

      const { data: weightData, error: weightError } = await supabase
        .from('weight_records')
        .select('id, date, weight')
        .order('date', { ascending: true });

      if (weightError) {
        console.error('Error cargando weight_records (profile load):', weightError.message);
      } else if (weightData) {
        const mapped: WeightRecord[] = weightData.map(row => ({
          id: row.id,
          date: row.date,
          weight: Number(row.weight)
        }));
        setWeightRecords(mapped);
      }

      if (closeModal) {
        setIsAuthModalOpen(false);
      }

      setPendingProfileLoad(null);
    };

    run();
  }, [pendingProfileLoad]);

  useEffect(() => {
    const loadSessionAndData = async () => {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        console.error('Error obteniendo sesión:', error.message);
        clearAuthState();
        return;
      }

      const session = data.session;

      if (session?.user) {
        const user = session.user;
        const fallbackDisplayName =
          (user.user_metadata?.display_name as string) || user.email || '';

        const sessionUser: AuthUser = {
          id: user.id,
          displayName: fallbackDisplayName,
          email: user.email || '',
          plan: 'free'
        };

        setAuthUser(sessionUser);

        setPendingProfileLoad({
          id: user.id,
          email: user.email || '',
          name: fallbackDisplayName
        });

        const { data: workoutsData, error: workoutsError } = await supabase
          .from('workouts')
          .select('id, name, date, data')
          .eq('user_id', user.id)
          .order('date', { ascending: true });

        if (workoutsError) {
          console.error('Error cargando workouts:', workoutsError.message);
        } else if (workoutsData) {
          const mappedWorkouts: Workout[] = workoutsData.map(row => ({
            id: row.id,
            name: row.name,
            date: row.date,
            ...(row.data as any)
          }));
          setWorkouts(mappedWorkouts);
        }

        const { data: routinesData, error: routinesError } = await supabase
          .from('routines')
          .select('id, name, description, data')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true });

        if (routinesError) {
          console.error('Error cargando routines:', routinesError.message);
        } else if (routinesData) {
          const mappedRoutines: Routine[] = routinesData.map(row => ({
            id: row.id,
            name: row.name,
            description: row.description || '',
            ...(row.data as any)
          }));
          setRoutines(mappedRoutines);
        }
      } else {
        clearAuthState();
      }
    };

    loadSessionAndData();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        const user = session.user;
        const fallbackDisplayName =
          (user.user_metadata?.display_name as string) || user.email || '';

        const sessionUser: AuthUser = {
          id: user.id,
          displayName: fallbackDisplayName,
          email: user.email || '',
          plan: 'free'
        };

        setAuthUser(sessionUser);

        setPendingProfileLoad({
          id: user.id,
          email: user.email || '',
          name: fallbackDisplayName,
          closeModal: event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED'
        });
      } else {
        clearAuthState();
        setPendingProfileLoad(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const openLoginModal = () => {
    setAuthMode('login');
    setIsAuthModalOpen(true);
  };

  const openRegisterModal = () => {
    setAuthMode('register');
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
  };

  const handleRegister = async (
    displayName: string,
    email: string,
    password: string
  ): Promise<{ success: boolean; message: string }> => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName
        }
      }
    });

    if (error) {
      return {
        success: false,
        message: error.message
      };
    }

    const sessionUser: AuthUser = {
      id: data.user?.id ?? '',
      displayName,
      email: data.user?.email ?? email,
      plan: 'free'
    };

    setAuthUser(sessionUser);

    if (data.user?.id) {
      await loadProfile(data.user.id, data.user.email ?? email, displayName);
    } else {
      setUserProfile({
        ...defaultUserProfile,
        displayName,
        plan: 'free'
      });
    }

    setTimeout(() => {
      setIsAuthModalOpen(false);
    }, 700);

    return {
      success: true,
      message: 'Cuenta creada correctamente.'
    };
  };

  const handleLogin = async (
    email: string,
    password: string
  ): Promise<{ success: boolean; message: string }> => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      return {
        success: false,
        message: error.message
      };
    }

    const user = data.user;
    const fallbackDisplayName =
      (user?.user_metadata?.display_name as string) ||
      user?.email ||
      '';

    const sessionUser: AuthUser = {
      id: user?.id ?? '',
      displayName: fallbackDisplayName,
      email: user?.email ?? email,
      plan: 'free'
    };

    setAuthUser(sessionUser);

    if (user?.id) {
      await loadProfile(user.id, user.email ?? email, fallbackDisplayName);
    } else {
      setUserProfile(defaultUserProfile);
    }

    setTimeout(() => {
      setIsAuthModalOpen(false);
    }, 500);

    return {
      success: true,
      message: 'Sesión iniciada correctamente.'
    };
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error('Error cerrando sesión:', error.message);
    }

    clearAuthState();
  };

  const saveWorkout = async (workout: Workout) => {
    if (!authUser?.id) {
      console.error('No hay usuario autenticado para guardar workout.');
      return;
    }

    const workoutId = workout.id || Math.random().toString(36).slice(2, 11);

    const workoutToSave: Workout = {
      ...workout,
      id: workoutId
    };

    const { error } = await supabase.from('workouts').insert({
      id: workoutToSave.id,
      user_id: authUser.id,
      name: workoutToSave.name,
      date: workoutToSave.date,
      data: workoutToSave
    });

    if (error) {
      console.error('Error guardando workout:', error.message);
      return;
    }

    setWorkouts(prev => [...prev, workoutToSave]);
    setShowLogger(false);
  };

  const saveRoutine = async (routine: Routine) => {
    if (!authUser?.id) {
      console.error('No hay usuario autenticado para guardar rutina.');
      return;
    }

    const routineId = routine.id || Math.random().toString(36).slice(2, 11);
    const routineToSave: Routine = {
      ...routine,
      id: routineId
    };

    const exists = routines.find(r => r.id === routineId);

    if (exists) {
      const { error } = await supabase
        .from('routines')
        .update({
          name: routineToSave.name,
          description: (routineToSave as any).description || null,
          data: routineToSave
        })
        .eq('id', routineId)
        .eq('user_id', authUser.id);

      if (error) {
        console.error('Error actualizando rutina:', error.message);
        return;
      }

      setRoutines(prev =>
        prev.map(r => (r.id === routineId ? routineToSave : r))
      );
    } else {
      const { error } = await supabase.from('routines').insert({
        id: routineToSave.id,
        user_id: authUser.id,
        name: routineToSave.name,
        description: (routineToSave as any).description || null,
        data: routineToSave
      });

      if (error) {
        console.error('Error creando rutina:', error.message);
        return;
      }

      setRoutines(prev => [...prev, routineToSave]);
    }
  };

  const deleteRoutine = async (id: string) => {
    if (!authUser?.id) {
      console.error('No hay usuario autenticado para borrar rutina.');
      return;
    }

    const { error } = await supabase
      .from('routines')
      .delete()
      .eq('id', id)
      .eq('user_id', authUser.id);

    if (error) {
      console.error('Error eliminando rutina:', error.message);
      return;
    }

    setRoutines(prev => prev.filter(r => r.id !== id));
  };

  const addWeightRecord = async (weight: number) => {
    if (!authUser?.id) {
      console.error('No hay usuario autenticado para guardar peso.');
      return;
    }

    const newRecord: WeightRecord = {
      id: Math.random().toString(36).slice(2, 11),
      date: new Date().toISOString(),
      weight
    };

    const { error } = await supabase
      .from('weight_records')
      .insert({
        id: newRecord.id,
        user_id: authUser.id,
        date: newRecord.date,
        weight: newRecord.weight
      });

    if (error) {
      console.error('Error guardando weight_record:', error);
      return;
    }

    setWeightRecords(prev => [...prev, newRecord]);
  };

  const deleteWeightRecord = async (id: string) => {
    const { error } = await supabase
      .from('weight_records')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error eliminando weight_record:', error.message);
      return;
    }

    setWeightRecords(prev => prev.filter(r => r.id !== id));
  };

  const saveUserProfile = async (profile: UserProfile) => {
    if (!authUser?.id) {
      console.error('No hay usuario autenticado para guardar el perfil.');
      return;
    }

    const cleanedProfile: UserProfile = {
      ...defaultUserProfile,
      ...profile,
      measurements: {
        ...defaultUserProfile.measurements,
        ...(profile.measurements || {})
      }
    };

    const { error } = await supabase.from('profiles').upsert({
      id: authUser.id,
      display_name: cleanedProfile.displayName || '',
      plan: cleanedProfile.plan || 'free',
      sex: cleanedProfile.sex || null,
      birth_year: cleanedProfile.birthYear ?? null,
      height_cm: cleanedProfile.heightCm ?? null,
      weight_kg: cleanedProfile.weightKg ?? null,
      goal: cleanedProfile.goal || null,
      level: cleanedProfile.level || null,
      training_days_per_week: cleanedProfile.trainingDaysPerWeek ?? null,
      session_minutes: cleanedProfile.sessionMinutes ?? null,
      preferred_style: cleanedProfile.preferredStyle || null,
      equipment: cleanedProfile.equipment || [],
      limitations: cleanedProfile.limitations || null,
      measurements: cleanedProfile.measurements || {}
    });

    if (error) {
      console.error('Error guardando profile:', error.message);
      return;
    }

    setUserProfile(cleanedProfile);

    setAuthUser(prev =>
      prev
        ? {
            ...prev,
            displayName: cleanedProfile.displayName || prev.displayName,
            plan: cleanedProfile.plan
          }
        : prev
    );
  };

  const getViewTitle = () => {
    switch (currentView) {
      case View.DASHBOARD:
        return 'Resumen central';
      case View.PROGRESS:
        return 'Perfil usuario';
      case View.RECS:
        return 'Coach IA';
      case View.LOG:
        return 'Entrenos';
      case View.ROUTINES:
        return 'Rutinas';
      case View.WEIGHT:
        return 'Peso';
      case View.EXERCISES:
        return 'Biblioteca';
      default:
        return 'Resumen central';
    }
  };

  const getViewSubtitle = () => {
    switch (currentView) {
      case View.DASHBOARD:
        return '// RESUMEN CENTRAL';
      case View.PROGRESS:
        return '// PERFIL USUARIO';
      case View.RECS:
        return '// COACH IA';
      case View.LOG:
        return '// ENTRENOS';
      case View.ROUTINES:
        return '// RUTINAS';
      case View.WEIGHT:
        return '// PESO';
      case View.EXERCISES:
        return '// BIBLIOTECA';
      default:
        return '// RESUMEN CENTRAL';
    }
  };

  return (
    <div className="min-h-screen pt-32 md:pt-24 pb-32 relative overflow-x-hidden">
      <Analytics />
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-cyan-500/10 blur-[120px] rounded-full -z-10 animate-pulse" />
      <div
        className="fixed bottom-0 right-1/4 w-96 h-96 bg-fuchsia-500/10 blur-[120px] rounded-full -z-10 animate-pulse"
        style={{ animationDelay: '1s' }}
      />

      <Navbar
        currentView={currentView}
        onViewChange={setCurrentView}
        isLoggedIn={isLoggedIn}
        authUser={authUser}
        onLoginClick={openLoginModal}
        onRegisterClick={openRegisterModal}
        onLogout={handleLogout}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        mode={authMode}
        onClose={closeAuthModal}
        onSwitchMode={setAuthMode}
        onLogin={handleLogin}
        onRegister={handleRegister}
      />

      <main className="max-w-5xl mx-auto p-4 md:p-8">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6 pt-6 md:pt-0">
          <div className="animate-in fade-in slide-in-from-left duration-700">
            <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-white italic uppercase">
              {getViewTitle()}
            </h1>

            <h2 className="text-xl md:text-2xl font-black tracking-widest text-slate-500 uppercase italic mt-2">
              {getViewSubtitle()}
            </h2>

            <p className="text-slate-600 text-[10px] font-black uppercase tracking-[0.4em] mt-3 flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_#10b981]" />
              SYSTEM_READY{' '}
              {new Date()
                .toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
                .toUpperCase()}
            </p>
          </div>

          <button
            onClick={() => setShowLogger(true)}
            className="group relative px-8 py-5 bg-transparent text-white font-black text-xs uppercase tracking-[0.3em] transition-all overflow-hidden w-full md:w-auto text-center"
          >
            <div className="absolute inset-0 border border-cyan-500/40 rounded-2xl group-hover:border-cyan-400 group-hover:shadow-[0_0_30px_rgba(0,242,255,0.4)] transition-all" />
            <div className="absolute inset-x-0 bottom-0 h-1.5 bg-gradient-to-r from-cyan-500 via-blue-600 to-fuchsia-500 opacity-60" />
            <span className="relative flex items-center justify-center gap-3">
              INICIAR ENTRENAMIENTO <span className="text-cyan-400 group-hover:animate-bounce">⚡</span>
            </span>
          </button>
        </header>

        {showLogger && (
          <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl flex items-center justify-center p-4 overflow-y-auto">
            <div className="w-full max-w-2xl animate-in zoom-in-95 duration-300">
              <WorkoutLogger
                onSave={saveWorkout}
                onCancel={() => setShowLogger(false)}
                routines={routines}
              />
            </div>
          </div>
        )}

        <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
          {currentView === View.DASHBOARD && <Dashboard workouts={workouts} />}

          {currentView === View.PROGRESS && (
            <UserProfileView profile={userProfile} onSave={saveUserProfile} />
          )}

          {currentView === View.RECS && (
            <Recommendations
              workouts={workouts}
              profile={userProfile}
              isPro={isPro}
              nutritionAppUrl={isInfinity ? 'https://fit-menu-ai.vercel.app/' : undefined}
            />
          )}

          {currentView === View.WEIGHT && (
            <WeightTracker
              records={weightRecords}
              onAddRecord={addWeightRecord}
              onDeleteRecord={deleteWeightRecord}
            />
          )}

          {currentView === View.EXERCISES && <ExerciseLibrary />}

          {currentView === View.ROUTINES && (
            <RoutinesView
              routines={routines}
              onSaveRoutine={saveRoutine}
              onDeleteRoutine={deleteRoutine}
              isLoggedIn={isLoggedIn}
              isPro={isPro}
            />
          )}

          {currentView === View.LOG && (
            <div className="space-y-6">
              {workouts.length === 0 ? (
                <div className="bg-slate-900/40 p-16 rounded-[40px] border border-dashed border-white/10 text-center">
                  <p className="text-slate-500 font-black uppercase tracking-widest">
                    Sin registros en el mainframe.
                  </p>
                </div>
              ) : (
                [...workouts].reverse().map(workout => (
                  <WorkoutLogEntry key={workout.id} workout={workout} />
                ))
              )}
            </div>
          )}
        </div>
      </main>

      <div className="md:hidden fixed bottom-6 right-6 z-40">
        <button
          onClick={() => setIsFabMenuOpen(!isFabMenuOpen)}
          className="w-16 h-16 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full shadow-[0_0_40px_rgba(0,242,255,0.7)] flex items-center justify-center text-black text-3xl font-bold active:scale-90 transition-transform"
        >
          ⚡
        </button>
      </div>

      {isFabMenuOpen && (
        <div
          className="md:hidden fixed inset-0 z-30 bg-black/60 backdrop-blur-sm flex items-end"
          onClick={() => setIsFabMenuOpen(false)}
        >
          <div
            className="w-full bg-slate-900 rounded-t-3xl border-t border-white/10 px-5 pt-6 pb-[max(2.5rem,env(safe-area-inset-bottom))]"
            onClick={e => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="text-xs font-black uppercase tracking-[0.35em] text-slate-500">
                Navegación rápida
              </div>
              <button
                onClick={() => setIsFabMenuOpen(false)}
                className="w-10 h-10 rounded-full border border-white/10 bg-white/5 text-slate-300 flex items-center justify-center"
                aria-label="Cerrar menú rápido"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              <button
                onClick={() => {
                  setCurrentView(View.DASHBOARD);
                  setIsFabMenuOpen(false);
                }}
                className="min-h-[84px] rounded-2xl border border-white/10 bg-black/20 px-2 py-3 flex flex-col items-center justify-center gap-2 text-slate-200 active:scale-95 transition-transform"
              >
                <div className="text-2xl leading-none">🔋</div>
                <div className="text-[10px] font-black uppercase tracking-[0.2em] leading-tight">
                  Resumen
                </div>
              </button>

              <button
                onClick={() => {
                  setCurrentView(View.LOG);
                  setIsFabMenuOpen(false);
                }}
                className="min-h-[84px] rounded-2xl border border-white/10 bg-black/20 px-2 py-3 flex flex-col items-center justify-center gap-2 text-slate-200 active:scale-95 transition-transform"
              >
                <div className="text-2xl leading-none">📁</div>
                <div className="text-[10px] font-black uppercase tracking-[0.2em] leading-tight">
                  Entrenos
                </div>
              </button>

              <button
                onClick={() => {
                  setCurrentView(View.ROUTINES);
                  setIsFabMenuOpen(false);
                }}
                className="min-h-[84px] rounded-2xl border border-white/10 bg-black/20 px-2 py-3 flex flex-col items-center justify-center gap-2 text-slate-200 active:scale-95 transition-transform"
              >
                <div className="text-2xl leading-none">📀</div>
                <div className="text-[10px] font-black uppercase tracking-[0.2em] leading-tight">
                  Rutinas
                </div>
              </button>

              <button
                onClick={() => {
                  setCurrentView(View.EXERCISES);
                  setIsFabMenuOpen(false);
                }}
                className="min-h-[84px] rounded-2xl border border-white/10 bg-black/20 px-2 py-3 flex flex-col items-center justify-center gap-2 text-slate-200 active:scale-95 transition-transform"
              >
                <div className="text-2xl leading-none">📘</div>
                <div className="text-[10px] font-black uppercase tracking-[0.2em] leading-tight">
                  Biblioteca
                </div>
              </button>

              <button
                onClick={() => {
                  setCurrentView(View.PROGRESS);
                  setIsFabMenuOpen(false);
                }}
                className="min-h-[84px] rounded-2xl border border-white/10 bg-black/20 px-2 py-3 flex flex-col items-center justify-center gap-2 text-slate-200 active:scale-95 transition-transform"
              >
                <div className="text-2xl leading-none">📊</div>
                <div className="text-[10px] font-black uppercase tracking-[0.2em] leading-tight">
                  Perfil
                </div>
              </button>

              <button
                onClick={() => {
                  setCurrentView(View.WEIGHT);
                  setIsFabMenuOpen(false);
                }}
                className="min-h-[84px] rounded-2xl border border-white/10 bg-black/20 px-2 py-3 flex flex-col items-center justify-center gap-2 text-slate-200 active:scale-95 transition-transform"
              >
                <div className="text-2xl leading-none">⚖️</div>
                <div className="text-[10px] font-black uppercase tracking-[0.2em] leading-tight">
                  Peso
                </div>
              </button>

              <button
                onClick={() => {
                  setCurrentView(View.RECS);
                  setIsFabMenuOpen(false);
                }}
                className="min-h-[84px] rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-2 py-3 flex flex-col items-center justify-center gap-2 text-cyan-300 active:scale-95 transition-transform"
              >
                <div className="text-2xl leading-none">🧠</div>
                <div className="text-[10px] font-black uppercase tracking-[0.2em] leading-tight">
                  Coach IA
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
