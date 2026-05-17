"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Info, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import type { LogEntry } from "../types";

interface ProcessingTerminalProps {
  logs: LogEntry[];
  progress?: { current: number; total: number };
}

export function ProcessingTerminal({ logs, progress }: ProcessingTerminalProps) {
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
      className="relative rounded-2xl overflow-hidden h-full flex flex-col"
      style={{
        background: "linear-gradient(180deg, rgba(15, 15, 18, 0.98) 0%, rgba(10, 10, 12, 0.95) 100%)",
        backdropFilter: "blur(20px) saturate(150%)",
        WebkitBackdropFilter: "blur(20px) saturate(150%)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        boxShadow: shine.active
          ? "0 8px 40px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.05)"
          : "0 4px 24px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.03)",
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        transform: shine.active ? "translateY(-1px)" : "translateY(0)",
      }}
    >
      {/* Glass refraction highlight at top */}
      <div 
        className="pointer-events-none absolute inset-x-0 top-0 h-px z-10"
        style={{
          background: "linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent)",
        }}
      />

      {/* Mouse-following shine effect */}
      <div
        className="pointer-events-none absolute inset-[-1px] z-0 rounded-2xl transition-opacity duration-500"
        style={{
          opacity: shine.active ? 1 : 0,
          background: `radial-gradient(500px circle at ${shine.x}px ${shine.y}px, rgba(255, 255, 255, 0.06), transparent 50%)`,
        }}
      />

      {/* Header - removed circles */}
      <div className="relative z-10 flex items-center px-4 py-3 border-b border-neutral-800/50">
        <span className="text-xs font-mono text-neutral-400">
          Processing Terminal
        </span>
      </div>

      {/* Logs */}
      <div
        ref={scrollRef}
        className="relative z-10 flex-1 overflow-y-auto p-4 font-mono text-xs"
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

      {/* Progress bar at bottom */}
      {progress && progress.total > 0 && (
        <div className="relative z-10 px-4 py-2 border-t border-neutral-800/50">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-mono text-neutral-400">
              Progress: {progress.current}/{progress.total}
            </span>
            <span className="text-xs font-mono text-neutral-400">
              {Math.round((progress.current / progress.total) * 100)}%
            </span>
          </div>
          <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-300"
              style={{ width: `${(progress.current / progress.total) * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
