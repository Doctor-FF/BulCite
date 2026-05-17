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
        background: isDark
          ? "linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%)"
          : "linear-gradient(135deg, rgba(255, 255, 255, 0.85) 0%, rgba(255, 255, 255, 0.65) 100%)",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        border: isDark
          ? "1px solid rgba(255, 255, 255, 0.1)"
          : "1px solid rgba(255, 255, 255, 0.6)",
        boxShadow: shine.active
          ? isDark
            ? "0 8px 40px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.1)"
            : "0 8px 40px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(255, 255, 255, 0.8), inset 0 1px 0 rgba(255, 255, 255, 1)"
          : isDark
            ? "0 4px 24px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.05)"
            : "0 4px 24px rgba(0, 0, 0, 0.04), 0 0 0 1px rgba(255, 255, 255, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.9)",
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        transform: shine.active ? "translateY(-1px)" : "translateY(0)",
      }}
    >
      {/* Glass refraction highlight at top */}
      <div 
        className="pointer-events-none absolute inset-x-0 top-0 h-px z-10"
        style={{
          background: isDark
            ? "linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.15), transparent)"
            : "linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.9), transparent)",
        }}
      />

      {/* Mouse-following shine effect on border */}
      <div
        className="pointer-events-none absolute inset-[-1px] z-0 rounded-2xl transition-opacity duration-500"
        style={{
          opacity: shine.active ? 1 : 0,
          background: `radial-gradient(600px circle at ${shine.x}px ${shine.y}px, ${
            isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(255, 255, 255, 0.5)"
          }, transparent 50%)`,
        }}
      />

      {/* Subtle inner glow */}
      <div
        className="pointer-events-none absolute inset-0 z-0 rounded-2xl transition-opacity duration-500"
        style={{
          opacity: shine.active ? 0.5 : 0,
          background: `radial-gradient(400px circle at ${shine.x}px ${shine.y}px, ${
            isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(255, 255, 255, 0.3)"
          }, transparent 60%)`,
        }}
      />

      {/* Content */}
      <div className="relative z-10 h-full flex flex-col">{children}</div>
    </div>
  );
}
