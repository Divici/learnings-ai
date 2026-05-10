import Link from "next/link";
import type { Route } from "next";
import { Cards, MapTrifold, FolderSimple, Plus } from "@phosphor-icons/react/dist/ssr";

export type FocusItem = {
  id: string;
  name: string;
  parentTopic: string;
  dueCount: number;
};

export type SidebarViewProps = {
  userInitials: string;
  userName: string;
  level: number;
  activePath: "learning" | "planning";
  focus: FocusItem[];
  /** 21-cell heatmap; index 0 = today, 20 = 21 days ago. Each value is the attempt count for that day. */
  heatmap: number[];
};

const TOPIC_TONES: Record<string, { text: string; bg: string }> = {
  retrieval: { text: "text-blue-400", bg: "bg-blue-500/20 text-blue-300" },
  agents: { text: "text-purple-400", bg: "bg-purple-500/20 text-purple-300" },
  evals: { text: "text-teal-400", bg: "bg-teal-500/20 text-teal-300" },
  spec: { text: "text-teal-400", bg: "bg-teal-500/20 text-teal-300" },
  system_design: { text: "text-blue-400", bg: "bg-blue-500/20 text-blue-300" },
};

function heatmapClass(count: number): string {
  if (count === 0) return "bg-white/5";
  if (count <= 5) return "bg-blue-500/20";
  if (count <= 15) return "bg-blue-500/40";
  if (count <= 30) return "bg-blue-500/60";
  return "bg-blue-500/80";
}

export function SidebarView({
  userInitials,
  userName,
  level,
  activePath,
  focus,
  heatmap,
}: SidebarViewProps) {
  return (
    <aside className="w-64 flex-shrink-0 glass-panel rounded-2xl flex flex-col overflow-hidden h-full">
      {/* Profile */}
      <div className="p-6 border-b border-white/5 flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold"
          style={{ background: "linear-gradient(45deg, #3b82f6, #8b5cf6)" }}
        >
          {userInitials}
        </div>
        <div>
          <div className="text-sm font-medium">{userName}</div>
          <div className="text-xs text-white/50">Level {level} Scholar</div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-8">
        {/* Primary nav */}
        <nav className="flex flex-col gap-1" aria-label="Primary">
          <NavLink
            href="/learning"
            active={activePath === "learning"}
            icon={<Cards size={18} weight="regular" aria-hidden />}
            label="Learning"
          />
          <NavLink
            href="/planning"
            active={activePath === "planning"}
            icon={<MapTrifold size={18} weight="regular" aria-hidden />}
            label="Planning"
          />
        </nav>

        {/* Current Focus — real data */}
        <section className="flex flex-col gap-2">
          <h2 className="text-[10px] uppercase tracking-widest text-white/40 font-semibold px-3 mb-1 flex justify-between items-center">
            <span>Current Focus</span>
            <button type="button" aria-label="Add focus area">
              <Plus size={12} className="cursor-pointer hover:text-white transition-colors" />
            </button>
          </h2>
          {focus.length === 0 ? (
            <p className="px-3 text-xs text-white/40 italic">No focus areas yet.</p>
          ) : (
            focus.map((f) => {
              const tone = TOPIC_TONES[f.parentTopic] ?? TOPIC_TONES.retrieval!;
              return (
                <Link
                  key={f.id}
                  href={"/learning/topics" as Route}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-white/80 cursor-pointer hover:bg-white/5 group"
                >
                  <FolderSimple
                    size={16}
                    className={`${tone.text} group-hover:opacity-90`}
                    aria-hidden
                  />
                  <span className="truncate flex-1">{f.name}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                      f.dueCount > 0 ? tone.bg : "bg-white/5 text-white/40"
                    }`}
                  >
                    {f.dueCount}
                  </span>
                </Link>
              );
            })
          )}
        </section>

        {/* Activity Stream — 21-cell heatmap with real data */}
        <section className="mt-auto pt-4 border-t border-white/5">
          <h2 className="text-[10px] uppercase tracking-widest text-white/40 font-semibold px-3 mb-3">
            Activity Stream
          </h2>
          <div className="px-3 flex flex-wrap gap-1">
            {heatmap.map((count, i) => (
              <div
                key={i}
                data-testid="heatmap-cell"
                title={`${count} attempts`}
                className={`w-3 h-3 rounded-[2px] ${heatmapClass(count)}`}
              />
            ))}
          </div>
        </section>
      </div>
    </aside>
  );
}

function NavLink({
  href,
  active,
  icon,
  label,
}: {
  href: Route;
  active: boolean;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
        active
          ? "bg-white/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]"
          : "text-white/60 hover:text-white hover:bg-white/5"
      }`}
    >
      {icon}
      {label}
    </Link>
  );
}
