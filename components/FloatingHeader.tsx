import { Brain, CaretDown } from "@phosphor-icons/react/dist/ssr";

export type FloatingHeaderProps = {
  workspace: string;
  version: string;
};

export function FloatingHeader({ workspace, version }: FloatingHeaderProps) {
  return (
    <header className="glass-panel fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-6 px-6 py-2.5 rounded-full text-xs font-medium tracking-wide">
      <div className="flex items-center gap-2 text-white">
        <Brain size={18} weight="regular" aria-hidden />
        <span>Learnings AI</span>
      </div>
      <div className="h-4 w-px bg-white/10" aria-hidden />
      <button
        type="button"
        className="text-white/60 flex items-center gap-2 cursor-pointer hover:text-white transition-colors"
        aria-label="Switch workspace"
      >
        <span>{workspace}</span>
        <CaretDown size={10} weight="regular" aria-hidden />
      </button>
      <div className="h-4 w-px bg-white/10" aria-hidden />
      <div className="font-mono text-white/40">v{version}</div>
    </header>
  );
}
