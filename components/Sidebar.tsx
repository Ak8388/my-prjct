
import React, { useState } from 'react';
import { UserProfile } from '../types';

interface SidebarProps {
  members: UserProfile[];
  activeMemberId: string | null;
  onSelectMember: (id: string) => void;
  isUnlocked: boolean;
  onUnlock: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ members, activeMemberId, onSelectMember, isUnlocked, onUnlock }) => {
  const [clickCount, setClickCount] = useState(0);

  const handleVersionClick = () => {
    const newCount = clickCount + 1;
    setClickCount(newCount);
    if (newCount >= 5) {
      onUnlock();
      setClickCount(0);
    }
  };

  return (
    <div className="w-72 bg-slate-900 border-r border-slate-800 h-screen flex flex-col hidden md:flex shrink-0">
      <div className="p-6 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-slate-700 rounded flex items-center justify-center text-slate-300">
            <i className="fas fa-microchip"></i>
          </div>
          <h1 className="text-sm font-bold tracking-tighter text-slate-200 uppercase">SysUtility <span className="text-slate-500 font-normal">v1.0.4</span></h1>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4">
        {isUnlocked ? (
          <>
            <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-4 px-2">Data Nodes</h2>
            <div className="space-y-1">
              {members.map((member) => (
                <button
                  key={member.id}
                  onClick={() => onSelectMember(member.id)}
                  className={`w-full flex items-center gap-3 p-2 rounded-lg transition-all ${
                    activeMemberId === member.id 
                    ? 'bg-slate-800 text-blue-400 border border-slate-700' 
                    : 'hover:bg-slate-800/50 text-slate-400'
                  }`}
                >
                  <div className="w-8 h-8 rounded bg-slate-700 flex items-center justify-center overflow-hidden">
                    <img src={member.avatar} alt="" className="w-full h-full object-cover grayscale opacity-50" />
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-semibold leading-tight">{member.name === 'Istri Tersayang' ? 'Node-Alpha' : 'Node-Self'}</p>
                    <p className="text-[10px] opacity-50 uppercase">{member.status}</p>
                  </div>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="space-y-4">
             <div className="p-3 bg-slate-800/30 rounded-lg border border-slate-800">
                <p className="text-[10px] text-slate-500 mb-2 uppercase">Core Processes</p>
                <div className="space-y-2">
                   <div className="flex justify-between text-[10px]"><span className="text-slate-400">Network Stack</span><span className="text-emerald-500">OK</span></div>
                   <div className="flex justify-between text-[10px]"><span className="text-slate-400">Disk I/O</span><span className="text-emerald-500">OK</span></div>
                   <div className="flex justify-between text-[10px]"><span className="text-slate-400">Memory</span><span className="text-emerald-500">Optimized</span></div>
                </div>
             </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-slate-800">
        <button 
          onClick={handleVersionClick}
          className="text-[10px] text-slate-600 hover:text-slate-500 w-full text-center py-2 mono transition-colors"
        >
          Build: 1.0.4-stable-x64
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
