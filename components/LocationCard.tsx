
import React from 'react';
import { UserProfile, AIInsight } from '../types';

interface LocationCardProps {
  member: UserProfile;
  insight: AIInsight | null;
  loadingInsight: boolean;
}

const LocationCard: React.FC<LocationCardProps> = ({ member, insight, loadingInsight }) => {
  if (!member.currentLocation) return (
    <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 text-center text-slate-600 text-xs italic">
      NO_SENSOR_DATA_FOUND
    </div>
  );

  return (
    <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
      <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Telemetri Unit</h3>
            <p className="text-[10px] text-slate-600">SYNCCLASS: STABLE</p>
          </div>
          <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
        </div>

        <div className="space-y-4 mb-6">
          <div className="flex justify-between border-b border-slate-800 pb-2">
            <span className="text-[10px] text-slate-500">TIMESTAMP</span>
            <span className="text-[10px] text-slate-300 mono">{new Date(member.currentLocation.timestamp).toLocaleTimeString()}</span>
          </div>
          <div className="flex justify-between border-b border-slate-800 pb-2">
            <span className="text-[10px] text-slate-500">ACCURACY</span>
            <span className="text-[10px] text-slate-300 mono">{member.currentLocation.accuracy.toFixed(1)}m</span>
          </div>
          <div className="flex justify-between border-b border-slate-800 pb-2">
            <span className="text-[10px] text-slate-500">LATENCY</span>
            <span className="text-[10px] text-emerald-500 mono">12ms</span>
          </div>
        </div>

        <div className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg">
           <p className="text-[10px] font-bold text-blue-400 mb-2 uppercase italic">AI Analysis Output</p>
           {loadingInsight ? (
              <div className="flex gap-1">
                 <div className="w-1 h-1 bg-blue-500 animate-bounce"></div>
                 <div className="w-1 h-1 bg-blue-500 animate-bounce delay-100"></div>
                 <div className="w-1 h-1 bg-blue-500 animate-bounce delay-200"></div>
              </div>
           ) : insight ? (
              <div className="space-y-3">
                 <p className="text-xs text-slate-300 leading-relaxed italic">
                   "{insight.summary}"
                 </p>
                 <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-500 uppercase">RISK_LEVEL:</span>
                    <span className={`text-[10px] font-bold ${
                       insight.safetyRating === 'Aman' ? 'text-emerald-500' : 'text-amber-500'
                    }`}>{insight.safetyRating.toUpperCase()}</span>
                 </div>
              </div>
           ) : (
              <p className="text-[10px] text-slate-600">Waiting for next data packet...</p>
           )}
        </div>
      </div>

      <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 border-l-4 border-l-blue-500">
         <h4 className="text-[10px] font-bold text-slate-500 uppercase mb-2">Protocol Suggestion</h4>
         <p className="text-[10px] text-slate-400 leading-relaxed">
            {insight?.recommendation || "Maintain current observation parameters."}
         </p>
      </div>
    </div>
  );
};

export default LocationCard;
