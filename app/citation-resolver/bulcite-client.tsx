"use client";

import { useState } from "react";
import { useTheme } from "next-themes";
import { Beaker, Users, FileText } from "lucide-react";
import { ThemeToggle } from "./components/theme-toggle";
import CitationResolverContent from "./citation-resolver-content";
import CitationConverterClient from "./citation-converter-client";

type TabType = "resolver" | "converter";

export default function BulCiteClient() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [activeTab, setActiveTab] = useState<TabType>("resolver");
  const [activeUsers, setActiveUsers] = useState(0);
  const [orbColors, setOrbColors] = useState<{ light: string; dark: string }[]>([]);

  // Generate random gradient colors on mount
  useState(() => {
    const colorOptions = [
      { light: "rgba(147, 197, 253, 0.4)", dark: "rgba(30, 58, 138, 0.3)" },
      { light: "rgba(253, 164, 175, 0.4)", dark: "rgba(136, 19, 55, 0.3)" },
      { light: "rgba(110, 231, 183, 0.4)", dark: "rgba(6, 78, 59, 0.3)" },
      { light: "rgba(196, 181, 253, 0.4)", dark: "rgba(76, 29, 149, 0.3)" },
      { light: "rgba(252, 211, 77, 0.4)", dark: "rgba(146, 64, 14, 0.3)" },
      { light: "rgba(125, 211, 252, 0.4)", dark: "rgba(12, 74, 110, 0.3)" },
      { light: "rgba(190, 242, 100, 0.4)", dark: "rgba(63, 98, 18, 0.3)" },
      { light: "rgba(240, 171, 252, 0.4)", dark: "rgba(112, 26, 117, 0.3)" },
      { light: "rgba(253, 186, 116, 0.4)", dark: "rgba(124, 45, 18, 0.3)" },
      { light: "rgba(94, 234, 212, 0.4)", dark: "rgba(19, 78, 74, 0.3)" },
    ];
    const shuffled = [...colorOptions].sort(() => Math.random() - 0.5);
    setOrbColors(shuffled.slice(0, 4));

    // Simulate active users
    setActiveUsers(Math.floor(Math.random() * 37) + 12);
    const interval = setInterval(() => {
      setActiveUsers((prev) => {
        const change = Math.floor(Math.random() * 7) - 3;
        return Math.max(5, Math.min(99, prev + change));
      });
    }, Math.random() * 10000 + 5000);

    return () => clearInterval(interval);
  });

  return (
    <div className="min-h-screen relative overflow-hidden transition-colors duration-500">
      {/* Gradient background */}
      <div className="fixed inset-0 bg-gradient-to-br from-slate-100 via-neutral-50 to-stone-100 dark:from-slate-950 dark:via-neutral-950 dark:to-zinc-900" />

      {/* Animated blurred gradient orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {orbColors.length >= 4 && (
          <>
            <div
              className="absolute w-[700px] h-[700px] rounded-full blur-[120px] -top-48 -left-48 animate-float1"
              style={{
                background: `radial-gradient(circle, ${isDark ? orbColors[0].dark : orbColors[0].light}, transparent 70%)`,
              }}
            />
            <div
              className="absolute w-[600px] h-[600px] rounded-full blur-[120px] top-1/2 -right-32 animate-float2"
              style={{
                background: `radial-gradient(circle, ${isDark ? orbColors[1].dark : orbColors[1].light}, transparent 70%)`,
              }}
            />
            <div
              className="absolute w-[500px] h-[500px] rounded-full blur-[120px] -bottom-32 left-1/3 animate-float3"
              style={{
                background: `radial-gradient(circle, ${isDark ? orbColors[2].dark : orbColors[2].light}, transparent 70%)`,
              }}
            />
            <div
              className="absolute w-[550px] h-[550px] rounded-full blur-[120px] top-1/4 left-1/4 animate-float2"
              style={{
                background: `radial-gradient(circle, ${isDark ? orbColors[3].dark : orbColors[3].light}, transparent 70%)`,
              }}
            />
          </>
        )}
      </div>

      {/* Noise texture */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.015] dark:opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Content */}
      <div className="relative z-10 min-h-screen p-4 md:p-8">
        {/* Header */}
        <div className="max-w-7xl mx-auto mb-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-neutral-900 dark:bg-white/10 flex items-center justify-center">
                <Beaker className="h-5 w-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-semibold text-neutral-900 dark:text-white">
                    BulCite
                  </h1>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400">
                    <Users className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium">{activeUsers} online</span>
                  </div>
                </div>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  Citation Tools Suite
                </p>
              </div>
            </div>
            <ThemeToggle />
          </div>

          {/* Tab Navigation */}
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => setActiveTab("resolver")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                activeTab === "resolver"
                  ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900"
                  : "bg-neutral-200/50 dark:bg-white/[0.05] text-neutral-600 dark:text-neutral-400 hover:bg-neutral-300/50 dark:hover:bg-white/[0.08]"
              }`}
            >
              <Beaker className="h-4 w-4" />
              Citation Resolver
            </button>
            <button
              onClick={() => setActiveTab("converter")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                activeTab === "converter"
                  ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900"
                  : "bg-neutral-200/50 dark:bg-white/[0.05] text-neutral-600 dark:text-neutral-400 hover:bg-neutral-300/50 dark:hover:bg-white/[0.08]"
              }`}
            >
              <FileText className="h-4 w-4" />
              IEEE → EndNote
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="max-w-7xl mx-auto">
          {activeTab === "resolver" ? (
            <CitationResolverContent />
          ) : (
            <CitationConverterClient />
          )}
        </div>
      </div>
    </div>
  );
}
