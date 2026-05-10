"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type SessionConfigModalProps = {
  conceptId: string;
  conceptName: string;
  open: boolean;
  onClose: () => void;
};

export function SessionConfigModal({ conceptId, conceptName, open, onClose }: SessionConfigModalProps) {
  const router = useRouter();
  const [count, setCount] = useState(10);
  const [variants, setVariants] = useState(false);
  const [countTowardSrs, setCountTowardSrs] = useState(false);

  if (!open) return null;
  const start = () => {
    const params = new URLSearchParams({
      session: "topic",
      conceptId,
      count: String(count),
      variants: variants ? "on" : "off",
      srs: countTowardSrs ? "on" : "off",
    });
    router.push(`/learning?${params.toString()}`);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="glass-panel rounded-2xl p-6 max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-medium text-white/90 mb-4">Start: {conceptName}</h2>
        <label className="block mb-4">
          <span className="text-xs text-white/60 uppercase font-mono">Cards: {count}</span>
          <input type="range" min={5} max={50} step={5} value={count} onChange={(e) => setCount(Number(e.target.value))} className="w-full mt-2" />
        </label>
        <label className="flex items-center gap-2 mb-3 text-sm text-white/80">
          <input type="checkbox" checked={variants} onChange={(e) => setVariants(e.target.checked)} />
          Generate variants
        </label>
        <label className="flex items-center gap-2 mb-6 text-sm text-white/80">
          <input type="checkbox" checked={countTowardSrs} onChange={(e) => setCountTowardSrs(e.target.checked)} />
          Count toward SRS
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-3 py-2 text-sm text-white/60 hover:text-white">
            Cancel
          </button>
          <button type="button" onClick={start} className="px-4 py-2 rounded-lg bg-blue-500/20 border border-blue-500/40 text-blue-300 text-sm hover:bg-blue-500/30">
            Start
          </button>
        </div>
      </div>
    </div>
  );
}
