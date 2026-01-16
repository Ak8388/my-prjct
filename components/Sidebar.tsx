
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
          <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-emerald-600/20">
            <i className="fas fa-radar"></i>
          </div>
          <h1 className="text-sm font-bold tracking-tighter text-slate-200 uppercase">SysUtility <span className="text-slate-500 font-normal">v1.0.4</span></h1>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4">
        {isUnlocked ? (
          <>
            <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-4 px-2">Active Targets</h2>
            <div className="space-y-1">
              {members.map((member) => (
                <button
                  key={member.id}
                  onClick={() => onSelectMember(member.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
                    activeMemberId === member.id 
                    ? 'bg-slate-800 text-emerald-400 border border-slate-700 shadow-xl' 
                    : 'hover:bg-slate-800/50 text-slate-400 border border-transparent'
                  }`}
                >
                  <div className="relative">
                    <div className="w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center overflow-hidden border border-slate-600">
                      <img src={member.avatar} alt="" className="w-full h-full object-cover grayscale opacity-50" />
                    </div>
                    {member.status === 'online' && (
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 border-2 border-slate-900 rounded-full"></div>
                    )}
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-bold leading-tight">{member.id === '1' ? 'Alpha_Target' : 'Self_Node'}</p>
                    <p className={`text-[9px] uppercase font-black ${member.status === 'online' ? 'text-emerald-500' : 'text-slate-600'}`}>
                      {member.status}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="space-y-4">
             <div className="p-4 bg-slate-800/30 rounded-xl border border-slate-800">
                <p className="text-[10px] font-bold text-slate-500 mb-3 uppercase tracking-widest">System Engine</p>
                <div className="space-y-2">
                   <div className="flex justify-between text-[10px]"><span className="text-slate-400">Kernel Status</span><span className="text-emerald-500 font-bold">ACTIVE</span></div>
                   <div className="flex justify-between text-[10px]"><span className="text-slate-400">Data Pipeline</span><span className="text-emerald-500 font-bold">READY</span></div>
                   <div className="flex justify-between text-[10px]"><span className="text-slate-400">Security Layer</span><span className="text-emerald-500 font-bold">ENABLED</span></div>
                </div>
             </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-slate-800">
        <button 
          onClick={handleVersionClick}
          className="text-[10px] text-slate-600 hover:text-slate-400 w-full text-center py-2 mono transition-colors uppercase tracking-[0.2em]"
        >
          Build: 1.0.4-LOCKED
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
