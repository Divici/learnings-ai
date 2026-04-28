import { GlassPanel } from "@/components/glass/GlassPanel";
import { loginAction } from "./actions";

type Props = {
  searchParams: Promise<{ from?: string; error?: string }>;
};

export default async function AuthPage({ searchParams }: Props) {
  const { from = "/learning", error } = await searchParams;

  return (
    <div className="h-full flex items-center justify-center">
      <GlassPanel className="rounded-2xl p-10 max-w-md w-full">
        <h1 className="text-2xl font-medium mb-2">Welcome back</h1>
        <p className="text-sm text-white/60 mb-6">
          Paste your access token to continue.
        </p>
        <form action={loginAction} className="flex flex-col gap-4">
          <input type="hidden" name="from" value={from} />
          <input
            type="password"
            name="token"
            required
            autoComplete="off"
            placeholder="LEARNINGS_AI_TOKEN"
            className="w-full px-4 py-3 rounded-lg bg-black/30 border border-white/10 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {error ? (
            <p className="text-red-400 text-sm" role="alert">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            className="w-full py-3 rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 text-white font-medium hover:opacity-90 transition-opacity"
          >
            Unlock
          </button>
        </form>
      </GlassPanel>
    </div>
  );
}
