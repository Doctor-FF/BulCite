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
      className={`relative rounded-2xl overflow-hidden transition-all duration-300 ${
        noPadding ? "" : "p-5"
      } ${className}`}
      style={{
        // Light: black tint, Dark: white tint
        background: isDark
          ? "rgba(255, 255, 255, 0.05)"
          : "rgba(0, 0, 0, 0.03)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        border: isDark
          ? "1px solid rgba(255, 255, 255, 0.1)"
          : "1px solid rgba(0, 0, 0, 0.08)",
        // Removed heavy drop shadows
        boxShadow: "none",
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        transform: shine.active ? "translateY(-1px)" : "translateY(0)",
      }}
    >
      {/* Glass refraction highlight at top */}
      <div 
        className="pointer-events-none absolute inset-x-0 top-0 h-px z-10"
        style={{
          background: isDark
            ? "linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent)"
            : "linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.5), transparent)",
        }}
      />

      {/* Mouse-following shine effect - much more subtle in dark mode */}
      <div
        className="pointer-events-none absolute inset-[-1px] z-0 rounded-2xl transition-opacity duration-500"
        style={{
          opacity: shine.active ? 1 : 0,
          background: `radial-gradient(600px circle at ${shine.x}px ${shine.y}px, ${
            isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(255, 255, 255, 0.3)"
          }, transparent 50%)`,
        }}
      />

      {/* Content */}
      <div className="relative z-10 h-full flex flex-col">{children}</div>
    </div>
  );
}
