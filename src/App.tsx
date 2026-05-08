/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sun, 
  Moon, 
  Heart, 
  Leaf, 
  Coffee, 
  Sparkles, 
  CheckCircle2, 
  Plus, 
  History, 
  User, 
  Quote as QuoteIcon,
  ChevronRight,
  TrendingUp,
  Smile,
  Zap,
  Wind,
  Droplets,
  CloudMoon,
  ChevronLeft,
  Volume2,
  VolumeX,
  Music,
  Waves,
  Trees,
  CloudLightning,
  Brain
} from 'lucide-react';

const AMBIENT_SOUNDS = [
  { id: 'rain', name: 'Gentle Rain', icon: CloudLightning, url: 'https://cdn.pixabay.com/download/audio/2022/03/10/audio_51cb05370a.mp3?filename=soft-rain-ambient-111154.mp3' },
  { id: 'waves', name: 'Ocean Waves', icon: Waves, url: 'https://cdn.pixabay.com/download/audio/2022/03/09/audio_b287959082.mp3?filename=ocean-waves-ambient-110055.mp3' },
  { id: 'forest', name: 'Deep Forest', icon: Trees, url: 'https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0a13f69d2.mp3?filename=forest-ambient-sounds-morning-birds-111153.mp3' },
  { id: 'zen', name: 'Zen Garden', icon: Music, url: 'https://cdn.pixabay.com/download/audio/2021/11/25/audio_91b32e02f9.mp3?filename=meditation-zen-ambient-111155.mp3' },
];
import { onAuthStateChanged, signOut, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, onSnapshot, limit, orderBy, getDocFromServer } from 'firebase/firestore';
import { auth, signInWithGoogle, db } from './lib/firebase';
import { generateDailySeed, getMotivationalQuote, getStressReliefAdvice, generateAffirmation } from './services/geminiService';
import { WellnessSeed, UserState, DailyLog } from './types';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const STORAGE_KEY = 'aura_user_state';

const MOOD_DESCRIPTIONS = [
  "Gentle", "Flowing", "Centered", "Radiant", "Luminous"
];

const STRESS_TRIGGERS = [
  "Work Pressure", "Racing Thoughts", "Physical Tension", "Loneliness", "General Anxiety"
];

const ICON_OPTIONS: Record<string, any> = { Sun, Moon, Heart, Leaf, Zap, Wind, Coffee, Sparkles };

const STORAGE_UTILS = {
  get: (): UserState => {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : { name: 'Soul', logs: [], selectedIcon: 'Heart' };
  },
  set: (state: UserState) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
};

const AuraBackground = ({ mood }: { mood: number }) => {
  const colors = [
    'rgba(74, 85, 104, 0.12)', // 1
    'rgba(113, 128, 150, 0.15)', // 2
    'rgba(197, 160, 89, 0.18)', // 3
    'rgba(217, 140, 95, 0.2)', // 4
    'rgba(246, 173, 85, 0.22)'  // 5
  ];

  return (
    <div className="fixed inset-0 -z-50 bg-[#FCFBF7] overflow-hidden pointer-events-none">
      <motion.div 
        animate={{ 
          backgroundColor: colors[mood - 1] || colors[2],
        }}
        transition={{ duration: 4, ease: "easeInOut" }}
        className="absolute top-[-20%] right-[-10%] w-[100%] h-[100%] rounded-full blur-[120px] animate-pulse-soft"
      />
      <motion.div 
        animate={{ 
          backgroundColor: colors[mood - 1] || colors[2],
        }}
        transition={{ duration: 5, ease: "easeInOut", delay: 1 }}
        className="absolute bottom-[-10%] left-[-10%] w-[80%] h-[80%] rounded-full blur-[100px] animate-pulse-soft"
      />
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [state, setState] = useState<UserState>({ name: 'Soul', logs: [], selectedIcon: 'Heart' });
  const [loading, setLoading] = useState(false);
  const [quote, setQuote] = useState<string>('');
  const [gratitudeInput, setGratitudeInput] = useState('');
  const [stressAdvice, setStressAdvice] = useState<string>('');
  const [reliefLoading, setReliefLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'today' | 'relief' | 'game' | 'history' | 'profile'>('today');
  const [activeSound, setActiveSound] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showSoundPicker, setShowSoundPicker] = useState(false);
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMsg, setNotificationMsg] = useState('');

  // Daily Motivation Logic
  useEffect(() => {
    if (user && state.notificationEnabled && !loading) {
      const lastCheck = localStorage.getItem(`aura_last_notify_${user.uid}`);
      if (lastCheck !== todayStr) {
        setNotificationMsg(`Welcome back, ${state.name}. May your day be as radiant as your heart.`);
        setShowNotification(true);
        localStorage.setItem(`aura_last_notify_${user.uid}`, todayStr);
        setTimeout(() => setShowNotification(false), 8000);
      }
    }
  }, [user, state.notificationEnabled, loading, state.name]);
  const [volume, setVolume] = useState(0.5);
  const [timerMinutes, setTimerMinutes] = useState<number | null>(null);
  const [timerRemaining, setTimerRemaining] = useState<number>(0);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const timerIntervalRef = React.useRef<NodeJS.Timeout | null>(null);
  const fadeIntervalRef = React.useRef<NodeJS.Timeout | null>(null);

  // Game State
  const [gameStep, setGameStep] = useState(0);
  const [gameResults, setGameResults] = useState<number[]>([]);
  const [showGameResult, setShowGameResult] = useState(false);

  const QUIZ_QUESTIONS = [
    {
      q: "Imagine a vast, silent forest. What color is the light filtering through the leaves?",
      options: ["Deep Emerald", "Golden Honey", "Mist Silver", "Cerulean Blue"],
      weights: [5, 4, 3, 2]
    },
    {
      q: "A single drop falls into a still lake. How does the ripple make you feel?",
      options: ["Expansive", "Centered", "Hypnotized", "Quiet"],
      weights: [4, 5, 3, 2]
    },
    {
      q: "Choose a texture for your thoughts right now.",
      options: ["Silk", "Cool Marble", "Warm Sand", "Morning Mist"],
      weights: [3, 2, 5, 4]
    }
  ];

  const todayStr = new Date().toLocaleDateString();
  const currentLog = state.logs.find(l => l.date === todayStr);
  const mood = currentLog?.mood || 3;
  const energy = currentLog?.energy || 3;

  // Firebase Auth sync
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setAuthLoading(true);
      if (firebaseUser) {
        setUser(firebaseUser);
        // Test connection
        try {
          await getDocFromServer(doc(db, 'test', 'connection'));
        } catch (e) {}

        // Fetch user profile
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        try {
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            const userData = userDoc.data() as UserState;
            // Fetch logs subcollection
            const logsRef = collection(db, 'users', firebaseUser.uid, 'logs');
            const q = query(logsRef, orderBy('date', 'desc'), limit(30));
            const logsSnap = await getDocs(q);
            const loadedLogs = logsSnap.docs.map(d => d.data() as DailyLog);
            
            setState({
              ...userData,
              name: userData.name || firebaseUser.displayName || 'Soul',
              logs: loadedLogs
            });
          } else {
            // Create initial profile
            const initialState: UserState = {
              name: firebaseUser.displayName || 'Soul',
              logs: [],
              selectedIcon: 'Heart'
            };
            await setDoc(userDocRef, initialState);
            setState(initialState);
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`);
        }
      } else {
        setUser(null);
        setState({ name: 'Soul', logs: [], selectedIcon: 'Heart' });
      }
      setAuthLoading(false);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    const init = async () => {
      if (!user) return;
      if (state.lastSeedDate !== todayStr || !state.currentSeed) {
        setLoading(true);
        const seed = await generateDailySeed();
        handleUpdateProfile({ currentSeed: seed, lastSeedDate: todayStr });
        setLoading(false);
      }
      
      if (currentLog) {
        if (!currentLog.affirmation) {
          const aff = await generateAffirmation(MOOD_DESCRIPTIONS[currentLog.mood - 1] || 'Centered');
          handleUpdateLog({ affirmation: aff });
        }
        getMotivationalQuote(currentLog.mood).then(setQuote);
      } else {
        setQuote("Pause. Breathe. Your journey is uniquely yours, and you are doing enough.");
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (audioRef.current && !fadeIntervalRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  // Sleep Timer logic
  useEffect(() => {
    if (timerMinutes !== null && isPlaying) {
      setTimerRemaining(timerMinutes * 60);
      
      timerIntervalRef.current = setInterval(() => {
        setTimerRemaining((prev) => {
          if (prev <= 0) {
            clearInterval(timerIntervalRef.current!);
            startFadeOut();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [timerMinutes, isPlaying]);

  const startFadeOut = () => {
    if (!audioRef.current) return;
    
    const startVolume = audioRef.current.volume;
    let currentFadeVol = startVolume;
    
    fadeIntervalRef.current = setInterval(() => {
      currentFadeVol -= 0.05;
      if (currentFadeVol <= 0) {
        if (audioRef.current) {
          audioRef.current.volume = 0;
          audioRef.current.pause();
          setIsPlaying(false);
          // Restore original volume for next play
          audioRef.current.volume = volume;
        }
        setTimerMinutes(null);
        if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
        fadeIntervalRef.current = null;
      } else if (audioRef.current) {
        audioRef.current.volume = currentFadeVol;
      }
    }, 200);
  };

  const toggleSound = (soundId: string) => {
    if (activeSound === soundId) {
      if (isPlaying) {
        audioRef.current?.pause();
        setIsPlaying(false);
      } else {
        audioRef.current?.play();
        setIsPlaying(true);
      }
    } else {
      const sound = AMBIENT_SOUNDS.find(s => s.id === soundId);
      if (sound) {
        if (audioRef.current) {
          audioRef.current.src = sound.url;
          audioRef.current.play();
          setActiveSound(soundId);
          setIsPlaying(true);
        }
      }
    }
  };

  const handleUpdateLog = async (updates: Partial<DailyLog>) => {
    if (!user) return;
    const today = new Date().toLocaleDateString();
    const existingLogIdx = state.logs.findIndex(l => l.date === today);
    let newLogs = [...state.logs];
    let targetLog: DailyLog;

    if (existingLogIdx > -1) {
      targetLog = { ...newLogs[existingLogIdx], ...updates };
      newLogs[existingLogIdx] = targetLog;
    } else {
      targetLog = {
        date: today,
        mood: 3, energy: 3, gratitude: [], seedCompleted: false, ...updates
      };
      newLogs.push(targetLog);
    }

    const newState = { ...state, logs: newLogs };
    setState(newState);

    // Save to Firestore
    try {
      const logDocRef = doc(db, 'users', user.uid, 'logs', today.replace(/\//g, '-'));
      await setDoc(logDocRef, targetLog, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/logs/${today}`);
    }

    if (updates.mood) getMotivationalQuote(updates.mood).then(setQuote);
  };

  const handleSleepChange = (delta: number) => {
    const currentSleep = currentLog?.sleepHours || 7;
    const newSleep = Math.min(12, Math.max(0, currentSleep + delta));
    handleUpdateLog({ sleepHours: newSleep });
  };

  const getRelief = async (trigger: string) => {
    setReliefLoading(true);
    const advice = await getStressReliefAdvice(trigger);
    setStressAdvice(advice);
    setReliefLoading(false);
  };

  const handleGameChoice = (weight: number) => {
    const newResults = [...gameResults, weight];
    if (gameStep < QUIZ_QUESTIONS.length - 1) {
      setGameStep(gameStep + 1);
      setGameResults(newResults);
    } else {
      setGameResults(newResults);
      setShowGameResult(true);
    }
  };

  const resetGame = () => {
    setGameStep(0);
    setGameResults([]);
    setShowGameResult(false);
  };

  const getResonanceTitle = (score: number) => {
    if (score > 12) return "Radiant Equilibrium";
    if (score > 9) return "Quiet Stillness";
    return "Gentle Flow";
  };

  const currentIcon = useMemo(() => {
    const Icon = ICON_OPTIONS[state.selectedIcon || 'Heart'] || Heart;
    return <Icon size={20} />;
  }, [state.selectedIcon]);

  const handleLogout = () => {
    signOut(auth);
  };

  const handleUpdateProfile = async (updates: Partial<UserState>) => {
    if (!user) return;
    const newState = { ...state, ...updates };
    setState(newState);
    try {
      const userDocRef = doc(db, 'users', user.uid);
      const { logs, ...cleanUpdates } = updates as any;
      if (Object.keys(cleanUpdates).length > 0) {
        await updateDoc(userDocRef, cleanUpdates);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#FCFBF7] flex items-center justify-center">
        <motion.div 
          animate={{ scale: [1, 1.1, 1], rotate: [0, 180, 360] }}
          transition={{ repeat: Infinity, duration: 4 }}
          className="w-12 h-12 border-2 border-aura-gold border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#FCFBF7] flex items-center justify-center p-8 overflow-hidden relative">
        <AuraBackground mood={3} />
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-12 md:p-20 rounded-[60px] max-w-xl w-full text-center space-y-12 shadow-2xl relative z-10 border-white/60"
        >
          <div className="space-y-6">
            <div className="p-5 bg-aura-ink text-aura-beige w-fit mx-auto rounded-3xl shadow-xl">
               <Heart size={32} />
            </div>
            <div className="space-y-2">
               <h1 className="serif text-5xl md:text-6xl font-light italic text-aura-ink">Soulful Entry.</h1>
               <p className="serif text-xl text-aura-clay font-light italic">Your signature resonance awaits.</p>
            </div>
          </div>

          <p className="text-sm font-normal text-aura-ink/60 leading-relaxed max-w-sm mx-auto">
             Enter your sanctuary to persist your rituals, track your emotional arc, and receive daily divine reflections.
          </p>

          <button 
            onClick={signInWithGoogle}
            className="w-full bg-aura-ink text-aura-beige py-6 rounded-full font-bold text-xs tracking-[0.3em] uppercase flex items-center justify-center gap-4 shadow-2xl hover:bg-aura-gold transition-all duration-500"
          >
             Continue with Google
          </button>
          
          <div className="pt-4 flex items-center justify-center gap-4 text-aura-gold opacity-50">
             <div className="h-[1px] w-8 bg-current" />
             <Sparkles size={16} />
             <div className="h-[1px] w-8 bg-current" />
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-32 font-sans selection:bg-aura-gold/20">
      <AuraBackground mood={mood} />
      
      <audio ref={audioRef} loop onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} />

      {/* Notification Toast */}
      <AnimatePresence>
        {showNotification && (
          <motion.div
            initial={{ opacity: 0, y: -50, x: '-50%' }}
            animate={{ opacity: 1, y: 50, x: '-50%' }}
            exit={{ opacity: 0, y: -50, x: '-50%' }}
            className="fixed top-0 left-1/2 z-[200] glass-card px-8 py-4 rounded-full flex items-center gap-4 border-aura-gold/20 shadow-2xl"
          >
            <div className="p-2 bg-aura-gold/10 text-aura-gold rounded-full">
               <Sparkles size={16} />
            </div>
            <p className="text-sm serif italic font-light text-aura-ink">{notificationMsg}</p>
            <button onClick={() => setShowNotification(false)} className="text-aura-ink/20 hover:text-aura-ink">
               <ChevronLeft size={16} className="rotate-90" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick Access Sound Button */}
      <div className="fixed top-8 right-8 z-[110]">
        <div className="flex flex-col items-end gap-3">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowSoundPicker(!showSoundPicker)}
            className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500 shadow-2xl relative ${
              isPlaying ? 'bg-aura-ink text-aura-beige' : 'bg-white/60 backdrop-blur-xl text-aura-ink border border-white/40'
            }`}
          >
            {isPlaying ? (
              <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 2 }}>
                <Volume2 size={24} />
              </motion.div>
            ) : (
              <VolumeX size={24} className="opacity-40" />
            )}
            
            {isPlaying && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-aura-gold rounded-full border-2 border-[#FCFBF7]" />
            )}
          </motion.button>

          <AnimatePresence>
            {showSoundPicker && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: -20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: -20 }}
                className="glass-card p-6 rounded-[35px] w-64 shadow-2xl space-y-6 border-white/60"
              >
                <div className="flex justify-between items-center px-1">
                   <h5 className="text-[10px] font-black uppercase tracking-widest text-aura-gold">Ambient Sanctum</h5>
                   <button onClick={() => setShowSoundPicker(false)} className="text-aura-ink/20 hover:text-aura-ink">
                      <ChevronLeft size={16} className="rotate-90" />
                   </button>
                </div>

                <div className="space-y-2">
                   {AMBIENT_SOUNDS.map((sound) => (
                      <button
                        key={sound.id}
                        onClick={() => toggleSound(sound.id)}
                        className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all duration-300 ${
                          activeSound === sound.id 
                          ? 'bg-aura-ink text-aura-beige shadow-lg' 
                          : 'hover:bg-aura-sand/50 text-aura-ink/60'
                        }`}
                      >
                         <div className="flex items-center gap-3">
                            <sound.icon size={18} className={activeSound === sound.id ? "text-aura-gold" : ""} />
                            <span className="text-xs font-semibold">{sound.name}</span>
                         </div>
                         {activeSound === sound.id && isPlaying && (
                            <motion.div animate={{ height: [4, 12, 6, 14, 4] }} transition={{ repeat: Infinity, duration: 0.8 }} className="flex items-center gap-0.5">
                               {[1, 2, 3].map(i => <div key={i} className="w-0.5 bg-aura-gold rounded-full h-full" />)}
                            </motion.div>
                         )}
                      </button>
                   ))}
                </div>

                <div className="pt-2 flex items-center gap-4">
                   <VolumeX size={14} className="text-aura-ink/20" />
                   <input 
                      type="range" 
                      min="0" 
                      max="1" 
                      step="0.01" 
                      value={volume} 
                      onChange={(e) => setVolume(parseFloat(e.target.value))}
                      className="flex-1 h-1 bg-aura-sand rounded-full appearance-none cursor-pointer accent-aura-gold"
                   />
                   <Volume2 size={14} className="text-aura-ink/20" />
                </div>

                <div className="space-y-3 pt-2">
                   <div className="flex justify-between items-center px-1">
                      <span className="text-[9px] font-bold uppercase tracking-widest text-aura-ink/30">Sleep Timer</span>
                      {timerMinutes && (
                         <span className="text-[10px] font-serif italic text-aura-gold">
                            {Math.floor(timerRemaining / 60)}:{(timerRemaining % 60).toString().padStart(2, '0')}
                         </span>
                      )}
                   </div>
                   <div className="flex gap-2">
                      {[15, 30, 60].map((mins) => (
                         <button
                           key={mins}
                           onClick={() => setTimerMinutes(timerMinutes === mins ? null : mins)}
                           className={`flex-1 py-2 rounded-xl text-[10px] font-bold transition-all duration-300 ${
                             timerMinutes === mins 
                             ? 'bg-aura-gold text-white shadow-md' 
                             : 'bg-aura-sand/40 text-aura-ink/40 hover:bg-aura-sand/60 hover:text-aura-ink'
                           }`}
                         >
                            {mins}m
                         </button>
                      ))}
                   </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Cinematic Hero */}
      <div className="absolute top-0 right-0 w-full md:w-3/5 h-[60vh] pointer-events-none -z-10 overflow-hidden">
        <motion.div 
           initial={{ opacity: 0, scale: 1.1 }}
           animate={{ opacity: 0.35, scale: 1 }}
           transition={{ duration: 3, ease: [0.22, 1, 0.36, 1] }}
           className="relative h-full"
        >
          <img 
            src="https://images.unsplash.com/photo-1518314916301-7696ca02f91b?auto=format&fit=crop&q=80&w=2000" 
            alt="Wellness Muse" 
            className="w-full h-full object-cover grayscale-[20%]"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 hero-gradient" />
          <div className="absolute inset-0 bg-gradient-to-l from-transparent via-[#FCFBF7]/10 to-[#FCFBF7]" />
        </motion.div>
      </div>

      {/* Editorial Header */}
      <header className="px-8 pt-20 md:pt-32 max-w-7xl mx-auto">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <div className="flex items-center gap-3">
             <div className="p-2.5 bg-aura-ink text-aura-beige rounded-xl shadow-lg ring-4 ring-aura-gold/5">
                {currentIcon}
             </div>
             <span className="text-[10px] font-black uppercase tracking-[0.4em] text-aura-gold">Aura Premium</span>
          </div>
          
          <div className="space-y-0.5">
            <h1 className="serif text-5xl md:text-7xl tracking-tighter text-aura-ink font-light italic">
              Experience {state.name}.
            </h1>
            <p className="serif text-xl md:text-2xl text-aura-clay font-light">
              Your signature resonance, elevated.
            </p>
          </div>

          <div className="flex items-center gap-6 pt-4">
             <div className="h-[1px] w-12 bg-aura-gold/30" />
             <p className="text-[10px] uppercase font-bold tracking-[0.3em] text-aura-ink/40">
                {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
             </p>
          </div>
        </motion.div>
      </header>

      <main className="px-6 mt-12 space-y-12 max-w-7xl mx-auto w-full">
        <AnimatePresence mode="wait">
          {activeTab === 'today' && (
            <motion.div
              key="today"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-8"
            >
              {/* Left Column: Core Focus */}
              <div className="lg:col-span-7 space-y-8">
                
                {/* AI Reflection Card */}
                <section className="glass-card p-8 rounded-[40px] relative overflow-hidden group shadow-2xl shadow-aura-gold/5">
                  <div className="absolute top-0 right-0 p-8 text-aura-gold/10 group-hover:scale-110 transition-transform duration-700">
                    <QuoteIcon size={80} />
                  </div>
                  <div className="relative z-10 space-y-6">
                    <div className="flex items-center gap-2">
                       <Sparkles size={14} className="text-aura-gold" />
                       <span className="text-[10px] font-black uppercase tracking-widest text-aura-ink/40">Daily Reflection</span>
                    </div>
                    <AnimatePresence mode="wait">
                      <motion.p 
                        key={quote}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="serif text-3xl md:text-4xl font-light leading-[1.25] text-aura-ink italic"
                      >
                        "{quote}"
                      </motion.p>
                    </AnimatePresence>
                    <div className="flex items-center gap-4 text-aura-clay">
                       <span className="text-xs font-serif italic">You’re doing enough today.</span>
                    </div>
                  </div>
                </section>

                {/* Daily Seed Ritual */}
                <section className="glass-card p-1 pb-1 rounded-[45px] overflow-hidden group border-aura-gold/10 shadow-2xl">
                   <div className="relative h-56 overflow-hidden rounded-t-[44px]">
                      <img 
                        src="https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&q=80&w=1200" 
                        className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
                        alt="Ritual Visual"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-aura-ink/60 via-transparent to-transparent" />
                      <div className="absolute bottom-6 left-8 flex items-center gap-3">
                         <div className="px-4 py-1.5 bg-white/20 backdrop-blur-xl rounded-full border border-white/20 text-white text-[9px] font-bold tracking-widest uppercase">
                            {state.currentSeed?.estimatedTime} practice
                         </div>
                      </div>
                   </div>
                   <div className="p-10 space-y-6">
                      <div className="space-y-2">
                         <h3 className="serif text-4xl tracking-tight text-aura-ink font-light">
                            {state.currentSeed?.title}
                         </h3>
                         <p className="text-base text-aura-clay font-normal leading-relaxed">
                            {state.currentSeed?.description}
                         </p>
                      </div>
                      
                      <button 
                         onClick={() => handleUpdateLog({ seedCompleted: !currentLog?.seedCompleted })}
                         className={`w-full py-5 rounded-[28px] font-bold text-[11px] tracking-widest uppercase transition-all duration-500 flex items-center justify-center gap-4 ${
                            currentLog?.seedCompleted 
                            ? 'bg-aura-gold/10 text-aura-gold ring-1 ring-aura-gold/20' 
                            : 'bg-aura-ink text-aura-beige shadow-xl hover:bg-aura-gold'
                         }`}
                      >
                         {currentLog?.seedCompleted ? (
                            <>Cultivated <CheckCircle2 size={16} /></>
                         ) : (
                            <>Begin Practice <Leaf size={16} /></>
                         )}
                      </button>
                   </div>
                </section>
              </div>

              {/* Right Column: Tracking & Micro-Metrics */}
              <div className="lg:col-span-5 space-y-8">
                
                {/* Mood & Energy Check-in */}
                <section className="glass-card p-10 rounded-[40px] space-y-10 shadow-xl border-white/40">
                   <div className="space-y-6">
                      <div className="flex justify-between items-center">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-aura-gold">Emotional Resonance</h4>
                        <span className="text-xs font-serif italic text-aura-clay">{MOOD_DESCRIPTIONS[mood - 1]}</span>
                      </div>
                      <div className="flex justify-between items-center gap-2">
                        {[1, 2, 3, 4, 5].map((m) => (
                           <button
                             key={m}
                             onClick={() => handleUpdateLog({ mood: m })}
                             className={`relative h-1.5 w-full rounded-full transition-all duration-700 overflow-hidden ${mood >= m ? 'bg-aura-gold' : 'bg-aura-ink/10'}`}
                           >
                             {mood === m && (
                               <motion.div 
                                 layoutId="curr-mood" 
                                 className="absolute inset-0 bg-white/40 animate-pulse" 
                               />
                             )}
                           </button>
                        ))}
                      </div>
                   </div>

                   <div className="space-y-6">
                      <div className="flex justify-between items-center">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-aura-gold">Life Force</h4>
                        <span className="text-xs font-serif italic text-aura-clay">{energy * 20}% Resonance</span>
                      </div>
                      <div className="flex items-center gap-4">
                         {[1, 2, 3, 4, 5].map((e) => (
                            <button
                              key={e}
                              onClick={() => handleUpdateLog({ energy: e })}
                              className={`flex-1 h-12 rounded-2xl transition-all duration-500 border flex items-center justify-center ${energy === e ? 'bg-aura-ink text-aura-beige border-aura-ink scale-105 shadow-lg' : 'bg-white/40 text-aura-ink/40 border-aura-ink/5 hover:border-aura-gold/20'}`}
                            >
                               <span className="text-xs font-bold">{e}</span>
                            </button>
                         ))}
                      </div>
                   </div>
                </section>

                {/* Sleep Tracker */}
                <section className="glass-card p-10 rounded-[40px] space-y-8 shadow-xl">
                   <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-aura-gold">Rest Cycle</h4>
                        <p className="serif text-3xl font-light italic">Sleep Resonance</p>
                      </div>
                      <div className="p-3 bg-aura-gold/10 rounded-2xl text-aura-gold">
                         <CloudMoon size={24} />
                      </div>
                   </div>
                   <div className="flex items-center justify-between gap-6 py-4">
                      <button 
                        onClick={() => handleSleepChange(-0.5)}
                        className="w-12 h-12 border border-aura-ink/5 rounded-full flex items-center justify-center hover:bg-aura-gold/5 transition-colors"
                      >
                         <MinusIcon size={16} />
                      </button>
                      <div className="text-center">
                         <span className="text-6xl serif italic font-light">{currentLog?.sleepHours || 7}</span>
                         <span className="text-[10px] block mt-1 uppercase tracking-widest font-black text-aura-ink/30">Hours Rested</span>
                      </div>
                      <button 
                        onClick={() => handleSleepChange(0.5)}
                        className="w-12 h-12 border border-aura-ink/5 rounded-full flex items-center justify-center hover:bg-aura-gold/5 transition-colors"
                      >
                         <Plus size={16} />
                      </button>
                   </div>
                </section>

                {/* Affirmation Carousel */}
                <section className="bg-aura-ink p-12 rounded-[50px] shadow-2xl relative overflow-hidden text-center group">
                   <div className="absolute top-0 left-0 w-full h-full opacity-[0.03] pointer-events-none">
                      <div className="bg-[url('https://www.transparenttextures.com/patterns/natural-paper.png')] w-full h-full" />
                   </div>
                   <Sparkles className="mx-auto mb-6 text-aura-gold/50 animate-breathe" size={24} />
                   <div className="space-y-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.4em] text-aura-gold/80">Affirmation</p>
                      <AnimatePresence mode="wait">
                         <motion.h4 
                           key={currentLog?.affirmation}
                           initial={{ opacity: 0, scale: 0.9 }}
                           animate={{ opacity: 1, scale: 1 }}
                           className="serif text-3xl md:text-4xl text-aura-beige font-light leading-relaxed italic"
                         >
                            "{currentLog?.affirmation || 'I embrace the stillness as a form of sacred restoration.'}"
                         </motion.h4>
                      </AnimatePresence>
                   </div>
                </section>

                {/* Daily Anchors (Gratitude) */}
                <section className="glass-card p-10 rounded-[40px] space-y-8 shadow-xl">
                   <h4 className="text-[10px] font-black uppercase tracking-widest text-aura-gold">Daily Anchors</h4>
                   <div className="space-y-4">
                      <div className="relative">
                        <input 
                          type="text"
                          value={gratitudeInput}
                          onChange={(e) => setGratitudeInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && gratitudeInput.trim()) {
                              const currentGratitude = currentLog?.gratitude || [];
                              handleUpdateLog({ gratitude: [...currentGratitude, gratitudeInput.trim()] });
                              setGratitudeInput('');
                            }
                          }}
                          placeholder="What was beautiful today?"
                          className="w-full bg-transparent border-b border-aura-ink/10 py-3 text-xl serif italic focus:outline-none focus:border-aura-gold transition-colors placeholder:text-aura-ink/20"
                        />
                        <button 
                          onClick={() => {
                            if (gratitudeInput.trim()) {
                              const currentGratitude = currentLog?.gratitude || [];
                              handleUpdateLog({ gratitude: [...currentGratitude, gratitudeInput.trim()] });
                              setGratitudeInput('');
                            }
                          }}
                          className="absolute right-0 top-1/2 -translate-y-1/2 text-aura-gold"
                        >
                          <Plus size={20} />
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2 pt-2">
                        {currentLog?.gratitude.map((g, i) => (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="px-5 py-2.5 bg-aura-sand/40 border border-aura-gold/5 rounded-full text-[11px] font-medium text-aura-ink/70 flex items-center gap-2 group"
                          >
                             <div className="w-1.5 h-1.5 rounded-full bg-aura-gold/30 group-hover:bg-aura-gold transition-colors" /> {g}
                          </motion.div>
                        ))}
                      </div>
                   </div>
                </section>
              </div>
            </motion.div>
          )}

          {activeTab === 'relief' && (
            <motion.div
              key="relief"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-4xl mx-auto space-y-12"
            >
              <div className="text-center space-y-4">
                 <h2 className="serif text-5xl md:text-7xl font-light italic">Sanctuary</h2>
                 <p className="text-aura-gold font-bold text-[10px] uppercase tracking-[0.4em]">Instant support for your nervous system</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 {STRESS_TRIGGERS.map((trigger) => (
                   <button
                     key={trigger}
                     onClick={() => getRelief(trigger)}
                     className="glass-card p-10 rounded-[35px] text-left hover:scale-[1.02] transition-all group flex flex-col gap-8 items-start relative overflow-hidden"
                   >
                      <div className="p-3 bg-aura-gold/10 text-aura-gold rounded-full">
                         <Wind size={24} />
                      </div>
                      <div className="space-y-1">
                        <span className="text-xl serif italic font-light">{trigger}</span>
                        <div className="h-[1px] w-8 bg-aura-gold/30 group-hover:w-full transition-all" />
                      </div>
                      <ChevronRight size={24} className="absolute bottom-10 right-10 opacity-10 group-hover:opacity-100 group-hover:translate-x-2 transition-all" />
                   </button>
                 ))}
              </div>

              <AnimatePresence mode="wait">
                {reliefLoading ? (
                   <motion.div 
                     initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                     className="py-12 flex justify-center"
                   >
                      <div className="w-12 h-12 border-2 border-aura-gold border-t-transparent animate-spin rounded-full shadow-lg" />
                   </motion.div>
                ) : (
                  stressAdvice && (
                    <motion.section 
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-aura-ink p-16 rounded-[60px] text-aura-beige shadow-2xl relative overflow-hidden"
                    >
                      <Droplets size={200} className="absolute -bottom-20 -right-20 opacity-[0.03] rotate-12" />
                      <div className="relative z-10 space-y-10 text-center">
                         <div className="flex justify-center items-center gap-4 text-aura-gold">
                            <div className="h-[1px] w-8 bg-current" />
                            <Sparkles size={20} />
                            <span className="text-xs font-black uppercase tracking-[0.4em]">Divine Perspective</span>
                            <div className="h-[1px] w-8 bg-current" />
                         </div>
                         <p className="serif text-4xl md:text-5xl font-light leading-relaxed italic max-w-2xl mx-auto">
                           "{stressAdvice}"
                         </p>
                         <button 
                          onClick={() => setStressAdvice('')}
                          className="premium-btn text-xs tracking-widest uppercase hover:scale-105"
                         >
                            Restored.
                         </button>
                      </div>
                    </motion.section>
                  )
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {activeTab === 'game' && (
            <motion.div
              key="game"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-2xl mx-auto"
            >
              <div className="text-center space-y-4 mb-12">
                 <h2 className="serif text-5xl md:text-6xl font-light italic">Reflect</h2>
                 <p className="text-aura-gold font-bold text-[10px] uppercase tracking-[0.4em]">Interactive Resonance Session</p>
              </div>

              {!showGameResult ? (
                <div className="glass-card p-12 rounded-[50px] space-y-10 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-aura-sand">
                    <motion.div 
                      className="h-full bg-aura-gold"
                      initial={{ width: 0 }}
                      animate={{ width: `${((gameStep + 1) / QUIZ_QUESTIONS.length) * 100}%` }}
                    />
                  </div>
                  
                  <div className="space-y-6">
                    <span className="text-[10px] font-black text-aura-gold uppercase tracking-widest">Inquiry {gameStep + 1} of {QUIZ_QUESTIONS.length}</span>
                    <h3 className="serif text-3xl md:text-4xl font-light leading-snug italic text-aura-ink">
                      {QUIZ_QUESTIONS[gameStep].q}
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    {QUIZ_QUESTIONS[gameStep].options.map((option, i) => (
                      <button
                        key={i}
                        onClick={() => handleGameChoice(QUIZ_QUESTIONS[gameStep].weights[i])}
                        className="w-full p-6 rounded-3xl border border-aura-ink/5 bg-white/40 hover:bg-aura-ink hover:text-aura-beige transition-all text-left serif italic text-xl group flex justify-between items-center"
                      >
                        {option}
                        <ChevronRight size={20} className="opacity-0 group-hover:opacity-100 -translate-x-4 group-hover:translate-x-0 transition-all" />
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-aura-ink p-16 rounded-[60px] text-center text-aura-beige space-y-12 shadow-2xl"
                >
                  <div className="space-y-4">
                    <Sparkles size={40} className="mx-auto text-aura-gold animate-breathe" />
                    <p className="text-[10px] font-black uppercase tracking-[0.5em] text-aura-gold/60">Session Complete</p>
                    <h3 className="serif text-5xl md:text-6xl font-light italic">
                      {getResonanceTitle(gameResults.reduce((a, b) => a + b, 0))}
                    </h3>
                    <p className="text-aura-clay max-w-sm mx-auto serif italic text-lg opacity-80">
                      Your choices indicate a deep alignment with restorative energy today.
                    </p>
                  </div>
                  
                  <button onClick={resetGame} className="premium-btn">
                    Recenter Session
                  </button>
                </motion.div>
              )}
            </motion.div>
          )}

          {activeTab === 'history' && (
            <motion.div
              key="history"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-4xl mx-auto space-y-12 pb-12"
            >
              <div className="text-center space-y-4">
                 <h2 className="serif text-5xl md:text-7xl font-light italic">The Arc</h2>
                 <p className="text-aura-clay font-bold text-[10px] uppercase tracking-[0.4em]">Your cultivated journey through time</p>
              </div>

              <div className="space-y-6">
                {state.logs.slice().reverse().map((log, i) => (
                  <div key={i} className="glass-card p-10 rounded-[45px] flex flex-col md:flex-row items-center justify-between group hover:shadow-2xl transition-all gap-8">
                    <div className="space-y-2 text-center md:text-left">
                      <p className="text-[10px] font-black text-aura-gold uppercase tracking-[0.3em]">{log.date}</p>
                      <h3 className="serif text-3xl font-light italic">{MOOD_DESCRIPTIONS[log.mood - 1]} Presence</h3>
                    </div>
                    <div className="flex items-center gap-12">
                       <div className="flex -space-x-3">
                          {[...Array(log.mood)].map((_, idx) => (
                             <div 
                               key={idx} 
                               className="w-10 h-10 rounded-full border-2 border-[#FCFBF7] bg-aura-gold shadow-lg shadow-aura-gold/20" 
                               style={{ opacity: 1 - (idx * 0.15) }}
                             />
                          ))}
                       </div>
                       <div className="h-12 w-[1px] bg-aura-ink/5 hidden md:block" />
                       <div className="text-center">
                          <p className="text-[8px] font-black uppercase text-aura-ink/40 tracking-widest mb-1">Ritual</p>
                          <CheckCircle2 size={24} className={log.seedCompleted ? "text-aura-gold" : "text-aura-ink/10"} />
                       </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'profile' && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-4xl mx-auto space-y-12"
            >
              <div className="text-center py-20 relative">
                 <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-aura-gold/10 blur-[100px] rounded-full animate-pulse-soft" />
                 <div className="w-56 h-56 rounded-[80px] bg-aura-ink text-aura-beige mx-auto flex items-center justify-center mb-12 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.4)] relative z-10 -rotate-3 hover:translate-y-[-10px] transition-transform duration-700">
                    <div className="p-12 border border-aura-gold/20 rounded-full animate-breathe">
                       {React.createElement(ICON_OPTIONS[state.selectedIcon || 'Heart'] || Heart, { size: 90 })}
                    </div>
                 </div>
                 <h2 className="serif text-8xl font-light tracking-tighter text-aura-ink italic">{state.name}</h2>
                 <p className="text-[10px] font-bold uppercase tracking-[0.5em] text-aura-gold mt-6">Radiant Soul Frequency</p>
              </div>

              {/* Signature Resonance */}
              <section className="glass-card p-12 rounded-[50px] space-y-8 shadow-xl">
                 <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-aura-gold text-center">Selected Resonance</h4>
                 <div className="flex justify-center flex-wrap gap-6">
                    {Object.keys(ICON_OPTIONS).map((iconName) => {
                       const IconComp = ICON_OPTIONS[iconName];
                       return (
                          <button
                             key={iconName}
                             onClick={() => {
                                handleUpdateProfile({ selectedIcon: iconName });
                             }}
                             className={`w-20 h-20 rounded-3xl transition-all duration-500 flex items-center justify-center ${
                                (state.selectedIcon || 'Heart') === iconName 
                                ? 'bg-aura-ink text-aura-beige shadow-2xl scale-110' 
                                : 'bg-white/50 text-aura-ink/20 hover:text-aura-ink hover:scale-105'
                             }`}
                          >
                             <IconComp size={28} />
                          </button>
                       );
                    })}
                 </div>
              </section>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <div className="glass-card p-12 rounded-[55px] space-y-3 text-center">
                    <History size={16} className="mx-auto text-aura-gold/40" />
                    <p className="text-6xl serif italic tracking-tighter font-light">{state.logs.length}</p>
                    <p className="text-[10px] uppercase tracking-widest font-black text-aura-gold/60">Days Cultivated</p>
                 </div>
                 <div className="glass-card p-10 rounded-[55px] space-y-6 flex flex-col items-center justify-center text-center">
                    <p className="text-[10px] uppercase tracking-widest font-black text-aura-gold/60">Divine Notifications</p>
                    <div className="flex items-center gap-4">
                       <span className="text-xs serif italic text-aura-clay">{state.notificationEnabled ? 'Attuned' : 'Silent'}</span>
                       <button 
                         onClick={() => handleUpdateProfile({ notificationEnabled: !state.notificationEnabled })}
                         className={`w-14 h-8 rounded-full transition-all duration-500 relative flex items-center px-1 ${state.notificationEnabled ? 'bg-aura-gold' : 'bg-aura-ink/10'}`}
                       >
                          <motion.div 
                            animate={{ x: state.notificationEnabled ? 24 : 0 }}
                            className="w-6 h-6 bg-white rounded-full shadow-sm" 
                          />
                       </button>
                    </div>
                 </div>
              </div>

              <div className="space-y-4">
                 <button 
                    onClick={() => {
                       const name = prompt('How should we address your health journey?', state.name);
                       if (name) {
                          handleUpdateProfile({ name });
                       }
                    }}
                    className="w-full h-24 glass-card rounded-[40px] flex items-center justify-between px-10 group hover:bg-white transition-all shadow-lg"
                 >
                    <span className="serif text-2xl italic font-light">Refine Identity</span>
                    <div className="w-10 h-10 bg-aura-ink text-white rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                       <Plus size={20} />
                    </div>
                 </button>

                 <button 
                    onClick={handleLogout}
                    className="w-full h-24 bg-red-500/5 hover:bg-red-500/10 border border-red-500/10 rounded-[40px] flex items-center justify-between px-10 group transition-all"
                  >
                    <span className="serif text-2xl italic font-light text-red-500/60">Release Presence</span>
                    <div className="w-10 h-10 bg-red-500 text-white rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                       <History size={18} className="rotate-180" />
                    </div>
                 </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Modern Compact Navigation */}
      <footer className="fixed bottom-0 left-0 right-0 z-[100] px-6 pb-10 pointer-events-none">
         <div className="max-w-md mx-auto pointer-events-auto">
            <div className="backdrop-blur-3xl bg-white/80 p-2 rounded-[35px] flex items-center justify-between border border-aura-ink/5 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.15)] ring-1 ring-white/50">
               {[
                  { id: 'today', icon: Sun, label: 'Today' },
                  { id: 'relief', icon: Wind, label: 'Relief' },
                  { id: 'game', icon: Brain, label: 'Mind' },
                  { id: 'history', icon: History, label: 'The Arc' },
                  { id: 'profile', icon: User, label: 'Soul' }
               ].map((item) => (
                  <button
                     key={item.id}
                     onClick={() => setActiveTab(item.id as any)}
                     className={`flex-1 flex items-center justify-center gap-2.5 py-4 rounded-[28px] transition-all duration-500 relative overflow-hidden ${
                        activeTab === item.id ? 'bg-aura-ink text-aura-beige shadow-lg' : 'text-aura-ink/40 hover:text-aura-ink hover:bg-aura-sand/50'
                     }`}
                  >
                     <item.icon size={20} className="relative z-10" />
                     {activeTab === item.id && (
                        <motion.span 
                           initial={{ opacity: 0, x: -5 }}
                           animate={{ opacity: 1, x: 0 }}
                           className="text-[9px] font-black uppercase tracking-widest relative z-10 hidden sm:block"
                        >
                           {item.label}
                        </motion.span>
                     )}
                  </button>
               ))}
            </div>
         </div>
      </footer>
    </div>
  );
}

function MinusIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
