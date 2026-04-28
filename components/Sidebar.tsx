import Link from "next/link";
import { Cards, MapTrifold, Plus } from "@phosphor-icons/react/dist/ssr";

export type SidebarProps = {
  userInitials: string;
  userName: string;
  level: number;
  activePath: "learning" | "planning";
};

export function Sidebar({ userInitials, userName, level, activePath }: SidebarProps) {
  return (
    <aside className="w-64 flex-shrink-0 glass-panel rounded-2xl flex flex-col overflow-hidden h-full">
      {/* Profile */}
      <div className="p-6 border-b border-white/5 flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold"
          style={{
            background: "linear-gradient(45deg, #3b82f6, #8b5cf6)",
          }}
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

        {/* Current Focus (stub — populated in Plan 3) */}
        <section className="flex flex-col gap-2">
          <h2 className="text-[10px] uppercase tracking-widest text-white/40 font-semibold px-3 mb-1 flex justify-between items-center">
            <span>Current Focus</span>
            <button type="button" aria-label="Add focus area">
              <Plus size={12} className="cursor-pointer hover:text-white transition-colors" />
            </button>
          </h2>
          <p className="px-3 text-xs text-white/40 italic">No focus areas yet.</p>
        </section>

        {/* Activity Stream (stub — populated in Plan 3) */}
        <section className="mt-auto pt-4 border-t border-white/5">
          <h2 className="text-[10px] uppercase tracking-widest text-white/40 font-semibold px-3 mb-3">
            Activity Stream
          </h2>
          <div className="px-3 flex flex-wrap gap-1">
            {Array.from({ length: 21 }).map((_, i) => (
              <div
                key={i}
                data-testid="heatmap-cell"
                className="w-3 h-3 rounded-[2px] bg-white/5"
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
  href: string;
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
