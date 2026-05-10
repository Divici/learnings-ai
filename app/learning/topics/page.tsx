"use client";

import { useState, useEffect } from "react";
import { GlassCard } from "@/components/glass/GlassCard";
import { SessionConfigModal } from "@/components/learning/SessionConfigModal";

type Concept = {
  id: string;
  name: string;
  parentTopic: string;
  cardCount: number;
  mastery: number;
};

const TOPIC_TONES: Record<string, string> = {
  retrieval: "blue",
  agents: "purple",
  evals: "teal",
  spec: "teal",
  system_design: "blue",
};

function masteryClass(tone: string): string {
  if (tone === "purple") return "bg-purple-500/10 text-purple-300";
  if (tone === "teal") return "bg-teal-500/10 text-teal-300";
  return "bg-blue-500/10 text-blue-300";
}

export default function TopicsPage() {
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [loading, setLoading] = useState(true);
  const [openConcept, setOpenConcept] = useState<Concept | null>(null);

  useEffect(() => {
    fetch("/api/concepts")
      .then((r) => r.json())
      .then((d) => setConcepts(d.concepts ?? []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-white/50 p-8">Loading…</div>;

  const grouped = concepts.reduce<Record<string, Concept[]>>((acc, c) => {
    (acc[c.parentTopic] ??= []).push(c);
    return acc;
  }, {});

  return (
    <div className="h-full overflow-y-auto p-6 space-y-8">
      <h1 className="text-xl font-medium text-white/90">Pick a focus</h1>
      {Object.entries(grouped).map(([topic, items]) => (
        <section key={topic}>
          <h2 className="text-[10px] uppercase tracking-widest text-white/40 font-semibold mb-3">{topic}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {items.map((c) => {
              const tone = TOPIC_TONES[c.parentTopic] ?? "blue";
              return (
                <GlassCard key={c.id} className="rounded-xl p-4">
                  <h3 className="text-sm font-medium text-white/90 mb-2">{c.name}</h3>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-mono text-white/40">{c.cardCount} cards</span>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${masteryClass(tone)}`}>
                      {Math.round(c.mastery * 100)}% mastery
                    </span>
                  </div>
                  <button type="button" onClick={() => setOpenConcept(c)} className="w-full text-xs text-blue-400 hover:underline">
                    Start →
                  </button>
                </GlassCard>
              );
            })}
          </div>
        </section>
      ))}
      {openConcept && (
        <SessionConfigModal
          conceptId={openConcept.id}
          conceptName={openConcept.name}
          open={true}
          onClose={() => setOpenConcept(null)}
        />
      )}
    </div>
  );
}
