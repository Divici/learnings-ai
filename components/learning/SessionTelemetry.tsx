import { ChartLineUp } from "@phosphor-icons/react/dist/ssr";

export type SessionTelemetryProps = {
  retentionPct: number;
  timePerCardSec: number;
  memoryStrengthPct: number; // 0..100
};

export function SessionTelemetry({ retentionPct, timePerCardSec, memoryStrengthPct }: SessionTelemetryProps) {
  return (
    <div className="glass-panel rounded-2xl p-5">
      <div className="text-[10px] uppercase tracking-widest text-white/40 font-semibold mb-4 flex items-center gap-2">
        <ChartLineUp size={14} /> Session Telemetry
      </div>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-black/20 border border-white/5 rounded-xl p-3">
          <div className="text-[10px] text-white/40 uppercase font-mono mb-1">Retention</div>
          <div className="flex items-end gap-1">
            <span className="text-xl font-medium text-green-400">{Math.round(retentionPct)}</span>
            <span className="text-xs text-white/30 mb-0.5">%</span>
          </div>
        </div>
        <div className="bg-black/20 border border-white/5 rounded-xl p-3">
          <div className="text-[10px] text-white/40 uppercase font-mono mb-1">Time/Card</div>
          <div className="flex items-end gap-1">
            <span className="text-xl font-medium text-white/90">{timePerCardSec.toFixed(1)}</span>
            <span className="text-xs text-white/30 mb-0.5">sec</span>
          </div>
        </div>
      </div>
      <div className="pt-4 border-t border-white/5">
        <div className="flex justify-between items-center text-xs mb-2">
          <span className="text-white/60">Memory Strength</span>
          <span className="font-mono text-purple-400">
            {memoryStrengthPct >= 70 ? "High" : memoryStrengthPct >= 40 ? "Med" : "Low"}
          </span>
        </div>
        <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
          <div className="h-full bg-purple-500 rounded-full" style={{ width: `${Math.min(100, Math.max(0, memoryStrengthPct))}%` }} />
        </div>
      </div>
    </div>
  );
}
