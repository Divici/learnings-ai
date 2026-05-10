"use client";

import { useState, useEffect, useCallback } from "react";

type CardRow = {
  id: string;
  prompt: string;
  cardType: "mc" | "cloze" | "freeform";
  difficulty: number;
  isDisabled: boolean;
  conceptName: string;
  ease: number | null;
  lastReviewedAt: string | null;
};

export function CardEditorTable() {
  const [cards, setCards] = useState<CardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [search, setSearch] = useState("");
  const [showDisabled, setShowDisabled] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (type) params.set("type", type);
    if (difficulty) params.set("difficulty", difficulty);
    if (search) params.set("search", search);
    if (showDisabled) params.set("showDisabled", "true");
    fetch(`/api/cards?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => setCards(d.cards ?? []))
      .finally(() => setLoading(false));
  }, [type, difficulty, search, showDisabled]);

  useEffect(() => {
    const id = setTimeout(load, 200);
    return () => clearTimeout(id);
  }, [load]);

  const toggleDisable = async (id: string, current: boolean) => {
    await fetch(`/api/cards/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDisabled: !current }),
    });
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, isDisabled: !current } : c)));
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="search"
          placeholder="Search prompt…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white/90 text-sm flex-1 min-w-[200px]"
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white/90 text-sm"
        >
          <option value="">All types</option>
          <option value="mc">MC</option>
          <option value="cloze">Cloze</option>
          <option value="freeform">Freeform</option>
        </select>
        <select
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value)}
          className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white/90 text-sm"
        >
          <option value="">All difficulties</option>
          <option value="1">1 (recall)</option>
          <option value="2">2 (apply)</option>
          <option value="3">3 (synthesize)</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-white/70">
          <input
            type="checkbox"
            checked={showDisabled}
            onChange={(e) => setShowDisabled(e.target.checked)}
          />
          Show disabled
        </label>
      </div>
      {loading ? (
        <p className="text-white/50 text-sm">Loading…</p>
      ) : cards.length === 0 ? (
        <p className="text-white/50 text-sm italic">No cards match.</p>
      ) : (
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-[10px] uppercase tracking-widest text-white/40 font-mono border-b border-white/10">
              <th className="text-left py-2 pr-4">Prompt</th>
              <th className="text-left py-2 pr-4">Type</th>
              <th className="text-left py-2 pr-4">Concept</th>
              <th className="text-left py-2 pr-4">Diff</th>
              <th className="text-left py-2 pr-4">Ease</th>
              <th className="text-left py-2 pr-4">Last reviewed</th>
              <th className="text-left py-2 pr-4">Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {cards.map((c) => (
              <tr key={c.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                <td className="py-2 pr-4 max-w-md truncate text-white/90">{c.prompt}</td>
                <td className="py-2 pr-4 text-white/60 font-mono uppercase text-xs">{c.cardType}</td>
                <td className="py-2 pr-4 text-white/70 text-xs">{c.conceptName}</td>
                <td className="py-2 pr-4 text-white/60 font-mono">{c.difficulty}</td>
                <td className="py-2 pr-4 text-white/60 font-mono">
                  {c.ease !== null ? c.ease.toFixed(2) : "—"}
                </td>
                <td className="py-2 pr-4 text-white/40 text-xs">
                  {c.lastReviewedAt ? new Date(c.lastReviewedAt).toLocaleDateString() : "never"}
                </td>
                <td className="py-2 pr-4">
                  {c.isDisabled ? (
                    <span className="text-xs px-2 py-0.5 rounded bg-red-500/10 text-red-300 border border-red-500/20">
                      disabled
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded bg-green-500/10 text-green-300 border border-green-500/20">
                      active
                    </span>
                  )}
                </td>
                <td className="py-2 pr-4">
                  <button
                    type="button"
                    onClick={() => toggleDisable(c.id, c.isDisabled)}
                    className="text-xs text-blue-400 hover:underline"
                  >
                    {c.isDisabled ? "Enable" : "Disable"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
