import { GlassPanel } from "@/components/glass/GlassPanel";
import Link from "next/link";

export type QueueHeroProps = {
  dueCount: number;
  topicBreakdown: Array<{ name: string; count: number; tone: "blue" | "purple" | "teal" }>;
};

export function QueueHero({ dueCount, topicBreakdown }: QueueHeroProps) {
  return (
    <GlassPanel className="rounded-2xl p-12 max-w-2xl mx-auto flex flex-col items-center text-center">
      <div className="text-[10px] uppercase tracking-widest text-blue-400 font-semibold mb-2">Today's Queue</div>
      <h1 className="text-4xl font-medium tracking-tight text-white/95 mb-2">{dueCount}</h1>
      <p className="text-sm text-white/50 mb-6">cards due</p>
      <div className="flex gap-2 mb-8 flex-wrap justify-center">
        {topicBreakdown.map((t) => {
          const cls =
            t.tone === "purple"
              ? "bg-purple-500/10 text-purple-300 border-purple-500/20"
              : t.tone === "teal"
                ? "bg-teal-500/10 text-teal-300 border-teal-500/20"
                : "bg-blue-500/10 text-blue-300 border-blue-500/20";
          return (
            <span key={t.name} className={`text-[10px] px-2 py-1 rounded font-mono border ${cls}`}>
              {t.count} {t.name}
            </span>
          );
        })}
      </div>
      <Link
        href={{ pathname: "/learning", query: { session: "new" } }}
        className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 text-white text-sm font-medium hover:shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-shadow"
      >
        Begin Session
      </Link>
      <span className="text-[10px] text-white/40 mt-3 font-mono">Press Enter</span>
    </GlassPanel>
  );
}
