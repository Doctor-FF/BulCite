"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Info, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import type { LogEntry } from "../types";

interface ProcessingTerminalProps {
  logs: LogEntry[];
}

export function ProcessingTerminal({ logs }: ProcessingTerminalProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [shine, setShine] = useState({ x: 0, y: 0, active: false });

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
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

  const getIcon = (type: LogEntry["type"]) => {
    switch (type) {
      case "success":
        return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />;
      case "warning":
        return <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />;
      case "error":
        return <XCircle className="h-3.5 w-3.5 text-red-400" />;
      default:
        return <Info className="h-3.5 w-3.5 text-neutral-400" />;
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative rounded-2xl overflow-hidden min-h-[200px] h-full"
      style={{
        background: "rgba(10, 10, 12, 0.95)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        border: "1px solid rgba(255, 255, 255, 0.06)",
        boxShadow: shine.active
          ? "0 4px 32px rgba(0, 0, 0, 0.3), inset 0 0 0 1px rgba(255, 255, 255, 0.06)"
          : "0 4px 24px rgba(0, 0, 0, 0.2), inset 0 0 0 1px rgba(255, 255, 255, 0.03)",
        transition: "box-shadow 0.5s ease, border-color 0.5s ease",
        borderColor: shine.active
          ? "rgba(255, 255, 255, 0.12)"
          : "rgba(255, 255, 255, 0.06)",
      }}
    >
      {/* Border-only shine */}
      <div
        className="pointer-events-none absolute inset-[-1px] z-0 rounded-2xl transition-opacity duration-700"
        style={{
          opacity: shine.active ? 1 : 0,
          background: `radial-gradient(500px circle at ${shine.x}px ${shine.y}px, rgba(255, 255, 255, 0.10), transparent 65%)`,
          mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          maskComposite: "exclude",
          WebkitMaskComposite: "xor",
          padding: "1.5px",
          borderRadius: "1rem",
        }}
      />

      {/* Header */}
      <div className="relative z-10 flex items-center gap-2 px-4 py-3 border-b border-neutral-800/50">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-neutral-700" />
          <div className="w-3 h-3 rounded-full bg-neutral-700" />
          <div className="w-3 h-3 rounded-full bg-neutral-700" />
        </div>
        <span className="ml-2 text-xs font-mono text-neutral-400">
          Processing Terminal
        </span>
      </div>

      {/* Logs */}
      <div
        ref={scrollRef}
        className="relative z-10 h-[calc(100%-44px)] overflow-y-auto p-4 font-mono text-xs"
      >
        {logs.length === 0 ? (
          <div className="text-neutral-500 italic">
            Waiting for citations to process...
          </div>
        ) : (
          <div className="space-y-1.5">
            {logs.map((log) => (
              <div key={log.id} className="flex items-start gap-2">
                <span className="text-neutral-500 shrink-0">
                  [{formatTime(log.timestamp)}]
                </span>
                <span className="shrink-0">{getIcon(log.type)}</span>
                <span
                  className={
                    log.type === "success"
                      ? "text-emerald-400"
                      : log.type === "warning"
                        ? "text-amber-400"
                        : log.type === "error"
                          ? "text-red-400"
                          : "text-neutral-300"
                  }
                >
                  {log.message}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
