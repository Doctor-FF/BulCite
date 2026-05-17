"use client";

import { useRef, useState, useCallback, type ReactNode } from "react";
import { useTheme } from "next-themes";

interface GlassPanelProps {
  children: ReactNode;
  className?: string;
  noPadding?: boolean;
}

export function GlassPanel({
  children,
  className = "",
  noPadding = false,
}: GlassPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [shine, setShine] = useState({ x: 0, y: 0, active: false });
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      setShine({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        active: true,
      });
    },
    []
  );

  const handleMouseLeave = useCallback(() => {
    setShine((prev) => ({ ...prev, active: false }));
  }, []);

  return (
    <div
      ref={panelRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`relative rounded-2xl overflow-hidden transition-all duration-500 ${
        noPadding ? "" : "p-5"
      } ${className}`}
      style={{
        background: isDark
          ? "rgba(255, 255, 255, 0.04)"
          : "rgba(255, 255, 255, 0.70)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        border: isDark
          ? "1px solid rgba(255, 255, 255, 0.08)"
          : "1px solid rgba(0, 0, 0, 0.08)",
        boxShadow: shine.active
          ? isDark
            ? "0 4px 32px rgba(255, 255, 255, 0.04), inset 0 0 0 1px rgba(255, 255, 255, 0.08)"
            : "0 2px 24px rgba(0, 0, 0, 0.06), inset 0 0 0 1px rgba(255, 255, 255, 0.9)"
          : isDark
            ? "0 4px 24px rgba(0, 0, 0, 0.2), inset 0 0 0 1px rgba(255, 255, 255, 0.04)"
            : "0 2px 16px rgba(0, 0, 0, 0.04), inset 0 0 0 1px rgba(255, 255, 255, 0.8)",
        transition: "box-shadow 0.5s ease, border-color 0.5s ease",
        borderColor: shine.active
          ? isDark
            ? "rgba(255, 255, 255, 0.15)"
            : "rgba(0, 0, 0, 0.14)"
          : isDark
            ? "rgba(255, 255, 255, 0.08)"
            : "rgba(0, 0, 0, 0.08)",
      }}
    >
      {/* Border-only shine */}
      <div
        className="pointer-events-none absolute inset-[-1px] z-0 rounded-2xl transition-opacity duration-700"
        style={{
          opacity: shine.active ? 1 : 0,
          background: `radial-gradient(500px circle at ${shine.x}px ${shine.y}px, ${
            isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.08)"
          }, transparent 65%)`,
          mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          maskComposite: "exclude",
          WebkitMaskComposite: "xor",
          padding: "1.5px",
          borderRadius: "1rem",
        }}
      />

      {/* Content */}
      <div className="relative z-10 h-full flex flex-col">{children}</div>
    </div>
  );
}
