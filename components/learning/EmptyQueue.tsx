import Link from "next/link";

export type EmptyQueueProps = {
  tomorrowCount: number;
  streak?: number;
};

export function EmptyQueue({ tomorrowCount, streak }: EmptyQueueProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center max-w-md mx-auto">
      <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-6">
        <span className="text-2xl">✓</span>
      </div>
      <h2 className="text-xl font-medium text-white/95 mb-2">Nothing due today.</h2>
      <p className="text-sm text-white/50 mb-1">Tomorrow: {tomorrowCount} cards.</p>
      {streak !== undefined && streak > 0 && (
        <div className="text-[10px] uppercase tracking-widest text-orange-400 font-mono mb-2">
          🔥 {streak}-day streak
        </div>
      )}
      {/* /learning/topics ships in a later task — use UrlObject to satisfy typed routes */}
      <Link href={{ pathname: "/learning/topics" }} className="text-sm text-blue-400 hover:underline mt-4">
        Pick a focus area to keep learning →
      </Link>
    </div>
  );
}
