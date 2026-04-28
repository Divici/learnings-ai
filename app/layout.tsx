import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { headers } from "next/headers";
import packageJson from "@/package.json";
import { GlobalBackground } from "@/components/GlobalBackground";
import { FloatingHeader } from "@/components/FloatingHeader";
import { Sidebar } from "@/components/Sidebar";
import "@/app/globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["300", "400"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Learnings AI",
  description: "Personal AI engineering tool — review and plan.",
};

function deriveActivePath(pathname: string): "learning" | "planning" {
  if (pathname.startsWith("/planning")) return "planning";
  return "learning";
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") ?? "/learning";
  const isAuth = pathname === "/auth";

  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body>
        <GlobalBackground />
        <div className="relative z-10 w-full h-full flex flex-col p-4 sm:p-6 lg:p-8">
          {isAuth ? (
            <main className="flex-1 flex w-full max-w-[1600px] mx-auto h-[calc(100vh-80px)]">
              {children}
            </main>
          ) : (
            <>
              <FloatingHeader workspace="Gauntlet AI" version={packageJson.version} />
              <main className="flex-1 flex gap-6 w-full max-w-[1600px] mx-auto mt-16 h-[calc(100vh-140px)]">
                <Sidebar
                  userInitials="DA"
                  userName="Learner"
                  level={1}
                  activePath={deriveActivePath(pathname)}
                />
                <div className="flex-1 relative h-full">{children}</div>
              </main>
            </>
          )}
        </div>
      </body>
    </html>
  );
}
