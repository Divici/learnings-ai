"use client";

import { useState } from "react";
import { BookOpen, FilePdf, Plus } from "@phosphor-icons/react/dist/ssr";

export type SourceChunk = {
  id: string;
  title: string;
  headingPath: string[];
  content: string;
};

export type SourceMaterialListProps = {
  chunks: SourceChunk[];
  onAddNote?: () => void;
};

export function SourceMaterialList({ chunks, onAddNote }: SourceMaterialListProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = chunks.find((c) => c.id === openId);
  return (
    <div className="glass-panel rounded-2xl p-5 flex-1 flex flex-col overflow-hidden relative">
      <div className="text-[10px] uppercase tracking-widest text-white/40 font-semibold mb-4 flex items-center gap-2">
        <BookOpen size={14} /> Source Material
      </div>
      <div className="flex-1 overflow-y-auto pr-2 flex flex-col gap-3">
        {chunks.length === 0 && (
          <p className="text-xs text-white/40 italic">No source chunks linked.</p>
        )}
        {chunks.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setOpenId(c.id)}
            className="glass-card rounded-xl p-3 text-left"
          >
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded bg-blue-500/20 text-blue-400 flex items-center justify-center flex-shrink-0">
                <FilePdf size={16} />
              </div>
              <div>
                <h4 className="text-xs font-medium text-white/90 mb-1 leading-tight">{c.title}</h4>
                <div className="text-[10px] text-white/40 font-mono">{c.headingPath.join(" / ")}</div>
              </div>
            </div>
          </button>
        ))}
        {onAddNote && (
          <button
            type="button"
            onClick={onAddNote}
            className="p-3 mt-2 border border-dashed border-white/10 rounded-xl flex items-center justify-center text-xs text-white/40 hover:text-white/80 hover:bg-white/5 transition-all gap-2"
          >
            <Plus size={14} /> Add Context Note
          </button>
        )}
      </div>
      {open && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-end" onClick={() => setOpenId(null)}>
          <div
            className="w-full max-h-[80%] bg-[#0a0a10] border-t border-white/10 rounded-t-2xl p-6 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-medium text-white/90 mb-2">{open.title}</h3>
            <div className="text-[10px] text-white/40 font-mono mb-4">{open.headingPath.join(" / ")}</div>
            <pre className="text-xs text-white/80 whitespace-pre-wrap font-sans leading-relaxed">{open.content}</pre>
          </div>
        </div>
      )}
    </div>
  );
}
