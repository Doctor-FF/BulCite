"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import { Play, Download, Beaker, Users, ChevronUp, ChevronDown } from "lucide-react";
import type { ProcessedCitation, LogEntry, ProcessingStats } from "./types";
import { sanitizeCitation, extractDOI } from "./utils/sanitize";
import { fetchCrossRef, fetchSemanticScholar, fetchRIS, generateUnresolvedRIS } from "./utils/api";
import { GlassPanel } from "./components/glass-panel";
import { ProcessingTerminal } from "./components/processing-terminal";
import { ResultsList } from "./components/results-list";
import { ThemeToggle } from "./components/theme-toggle";

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

export default function CitationResolverClient() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [rawInput, setRawInput] = useState("");
  const [citations, setCitations] = useState<ProcessedCitation[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [activeUsers, setActiveUsers] = useState(0);
  const [threshold, setThreshold] = useState(40); // Default 40%
  const [orbColors, setOrbColors] = useState<{ light: string; dark: string }[]>([]);
  const [highlightedCitationId, setHighlightedCitationId] = useState<string | null>(null);
  const resultsContainerRef = useRef<HTMLDivElement>(null);

  // Generate random gradient colors on mount
  useEffect(() => {
    const colorOptions = [
      { light: "rgba(147, 197, 253, 0.4)", dark: "rgba(30, 58, 138, 0.3)" }, // blue
      { light: "rgba(253, 164, 175, 0.4)", dark: "rgba(136, 19, 55, 0.3)" }, // rose
      { light: "rgba(110, 231, 183, 0.4)", dark: "rgba(6, 78, 59, 0.3)" }, // emerald
      { light: "rgba(196, 181, 253, 0.4)", dark: "rgba(76, 29, 149, 0.3)" }, // violet
      { light: "rgba(252, 211, 77, 0.4)", dark: "rgba(146, 64, 14, 0.3)" }, // amber
      { light: "rgba(125, 211, 252, 0.4)", dark: "rgba(12, 74, 110, 0.3)" }, // sky
      { light: "rgba(190, 242, 100, 0.4)", dark: "rgba(63, 98, 18, 0.3)" }, // lime
      { light: "rgba(240, 171, 252, 0.4)", dark: "rgba(112, 26, 117, 0.3)" }, // fuchsia
      { light: "rgba(253, 186, 116, 0.4)", dark: "rgba(124, 45, 18, 0.3)" }, // orange
      { light: "rgba(94, 234, 212, 0.4)", dark: "rgba(19, 78, 74, 0.3)" }, // teal
    ];
    
    // Shuffle and pick 4 random colors
    const shuffled = [...colorOptions].sort(() => Math.random() - 0.5);
    setOrbColors(shuffled.slice(0, 4));
  }, []);

  // Simulate active users counter (in production, this would connect to a real-time service)
  useEffect(() => {
    // Initial random count between 12-48
    setActiveUsers(Math.floor(Math.random() * 37) + 12);
    
    // Fluctuate every 5-15 seconds
    const interval = setInterval(() => {
      setActiveUsers((prev) => {
        const change = Math.floor(Math.random() * 7) - 3; // -3 to +3
        return Math.max(5, Math.min(99, prev + change));
      });
    }, Math.random() * 10000 + 5000);

    return () => clearInterval(interval);
  }, []);

  // Re-evaluate default selections when threshold changes (only for non-user-resolved items)
  useEffect(() => {
    if (citations.length === 0) return;
    
    const thresholdDecimal = threshold / 100;
    setCitations((prev) =>
      prev.map((c) => {
        // Skip if user has manually resolved or if still processing
        if (c.resolvedByUser || c.status === "processing" || c.status === "pending") {
          return c;
        }
        
        // Re-evaluate based on threshold
        if (c.candidates.length > 0) {
          const bestScore = c.candidates[0].score;
          const shouldAutoSelect = bestScore >= thresholdDecimal;
          return {
            ...c,
            selectedCandidateIndex: shouldAutoSelect ? 0 : null,
            status: shouldAutoSelect ? "resolved" : "unresolved",
          };
        }
        return c;
      })
    );
  }, [threshold]);

  const addLog = useCallback(
    (message: string, type: LogEntry["type"] = "info") => {
      setLogs((prev) => [
        ...prev,
        { id: generateId(), timestamp: new Date(), message, type },
      ]);
    },
    []
  );

  const calculateStats = useCallback((): ProcessingStats => {
    const resolved = citations.filter((c) => {
      // Resolved if user selected a candidate (not null/unresolved)
      return c.selectedCandidateIndex !== null && c.candidates[c.selectedCandidateIndex];
    }).length;

    const processing = citations.filter((c) => c.status === "processing").length;

    return {
      total: citations.length,
      resolved,
      unresolved: citations.length - resolved - processing,
      processing,
    };
  }, [citations]);

  const processCitation = async (
    citation: ProcessedCitation
  ): Promise<ProcessedCitation> => {
    const { rawText, cleanQuery } = citation;

    // Tier 1: Regex DOI extraction
    addLog(`Processing: "${rawText.substring(0, 50)}..."`, "info");
    const directDOI = extractDOI(rawText);

    if (directDOI) {
      addLog(`Found embedded DOI: ${directDOI}`, "success");
      // Auto-select if score >= 40% (1.0 = 100% for direct DOI)
      return {
        ...citation,
        status: "resolved",
        candidates: [
          {
            title: rawText,
            doi: directDOI,
            year: null,
            authors: [],
            score: 1.0,
            source: "regex",
          },
        ],
        selectedCandidateIndex: 0,
      };
    }

    // Tier 2: CrossRef API
    try {
      addLog("Querying CrossRef API...", "info");
      const crossRefCandidates = await fetchCrossRef(cleanQuery, rawText);

      if (crossRefCandidates.length > 0) {
        const bestScore = crossRefCandidates[0].score;
        const thresholdDecimal = threshold / 100;
        addLog(
          `CrossRef found ${crossRefCandidates.length} candidate(s), best: ${crossRefCandidates[0].title.substring(0, 40)}... (${(bestScore * 100).toFixed(0)}%)`,
          bestScore >= thresholdDecimal ? "success" : "warning"
        );

        // Auto-select first candidate if score >= threshold, otherwise unresolved
        const autoSelect = bestScore >= thresholdDecimal ? 0 : null;
        return {
          ...citation,
          status: autoSelect !== null ? "resolved" : "unresolved",
          candidates: crossRefCandidates,
          selectedCandidateIndex: autoSelect,
        };
      }
    } catch (error) {
      addLog(`CrossRef error: ${error instanceof Error ? error.message : "Unknown"}`, "error");
    }

    // Tier 3: Semantic Scholar fallback
    try {
      addLog("Falling back to Semantic Scholar...", "info");
      const semanticCandidates = await fetchSemanticScholar(cleanQuery, rawText);

      if (semanticCandidates.length > 0) {
        const bestScore = semanticCandidates[0].score;
        const thresholdDecimal = threshold / 100;
        addLog(
          `Semantic Scholar found ${semanticCandidates.length} candidate(s), best: ${semanticCandidates[0].title.substring(0, 40)}... (${(bestScore * 100).toFixed(0)}%)`,
          bestScore >= thresholdDecimal ? "success" : "warning"
        );

        // Auto-select first candidate if score >= threshold, otherwise unresolved
        const autoSelect = bestScore >= thresholdDecimal ? 0 : null;
        return {
          ...citation,
          status: autoSelect !== null ? "resolved" : "unresolved",
          candidates: semanticCandidates,
          selectedCandidateIndex: autoSelect,
        };
      }
    } catch (error) {
      addLog(`Semantic Scholar error: ${error instanceof Error ? error.message : "Unknown"}`, "error");
    }

    addLog(`No match found for citation`, "error");
    return {
      ...citation,
      status: "unresolved",
      candidates: [],
      selectedCandidateIndex: null,
    };
  };

  const handleExecute = async () => {
    const lines = rawInput
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length === 0) {
      addLog("No citations to process", "warning");
      return;
    }

    setIsProcessing(true);
    setLogs([]);
    setProgress({ current: 0, total: lines.length });
    addLog(`Starting extraction for ${lines.length} citation(s)...`, "info");

    // Initialize citations - start with null (unresolved) selection
    const initialCitations: ProcessedCitation[] = lines.map((line) => ({
      id: generateId(),
      rawText: line,
      cleanQuery: sanitizeCitation(line),
      status: "pending",
      candidates: [],
      selectedCandidateIndex: null,
      resolvedByUser: false,
    }));

    setCitations(initialCitations);

    // Process each citation with 1s delay
    for (let i = 0; i < initialCitations.length; i++) {
      const citation = initialCitations[i];

      // Mark as processing
      setCitations((prev) =>
        prev.map((c) => (c.id === citation.id ? { ...c, status: "processing" } : c))
      );

      // Process
      const processed = await processCitation(citation);

      // Update with result
      setCitations((prev) =>
        prev.map((c) => (c.id === citation.id ? processed : c))
      );

      // Update progress
      setProgress({ current: i + 1, total: initialCitations.length });

      // Delay to avoid rate limits (skip on last)
      if (i < initialCitations.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    addLog("Processing complete!", "success");
    setIsProcessing(false);
  };

  const handleSelectCandidate = (citationId: string, candidateIndex: number | null) => {
    setCitations((prev) =>
      prev.map((c) => {
        if (c.id !== citationId) return c;
        // If null is selected, mark as unresolved
        if (candidateIndex === null) {
          return {
            ...c,
            selectedCandidateIndex: null,
            status: "unresolved",
            resolvedByUser: true,
          };
        }
        // Otherwise mark as resolved with the selected candidate
        return {
          ...c,
          selectedCandidateIndex: candidateIndex,
          status: "resolved",
          resolvedByUser: true,
        };
      })
    );
  };

  const handleExport = async () => {
    setIsExporting(true);
    addLog("Generating RIS export...", "info");

    const risEntries: string[] = [];

    for (const citation of citations) {
      const candidate = citation.selectedCandidateIndex !== null 
        ? citation.candidates[citation.selectedCandidateIndex] 
        : null;

      if (candidate?.doi) {
        const ris = await fetchRIS(candidate.doi);
        if (ris) {
          risEntries.push(ris);
          addLog(`Fetched RIS for DOI: ${candidate.doi}`, "success");
        } else {
          risEntries.push(generateUnresolvedRIS(citation.rawText));
          addLog(`RIS fetch failed for ${candidate.doi}, using fallback`, "warning");
        }
      } else {
        risEntries.push(generateUnresolvedRIS(citation.rawText));
        addLog(`No DOI for citation, using fallback entry`, "warning");
      }
    }

    const blob = new Blob([risEntries.join("\n")], { type: "application/x-research-info-systems" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "citations.ris";
    a.click();
    URL.revokeObjectURL(url);

    addLog(`Exported ${risEntries.length} citation(s) to RIS`, "success");
    setIsExporting(false);
  };

  const stats = calculateStats();

  // Get list of unresolved citation IDs
  const unresolvedIds = citations
    .filter((c) => c.selectedCandidateIndex === null && c.status !== "processing" && c.status !== "pending")
    .map((c) => c.id);

  // Navigate to next/previous unresolved
  const navigateUnresolved = (direction: "next" | "prev") => {
    if (unresolvedIds.length === 0) return;

    const currentIndex = highlightedCitationId 
      ? unresolvedIds.indexOf(highlightedCitationId) 
      : -1;

    let targetIndex: number;
    if (direction === "next") {
      targetIndex = currentIndex < unresolvedIds.length - 1 ? currentIndex + 1 : 0;
    } else {
      targetIndex = currentIndex > 0 ? currentIndex - 1 : unresolvedIds.length - 1;
    }

    const targetId = unresolvedIds[targetIndex];
    setHighlightedCitationId(targetId);

    // Scroll to element
    const element = document.getElementById(`citation-${targetId}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    // Clear highlight after animation
    setTimeout(() => setHighlightedCitationId(null), 500);
  };

  return (
    <div className="min-h-screen relative overflow-hidden transition-colors duration-500">
      {/* Gradient background */}
      <div className="fixed inset-0 bg-gradient-to-br from-slate-100 via-neutral-50 to-stone-100 dark:from-slate-950 dark:via-neutral-950 dark:to-zinc-900" />
      
      {/* Animated blurred gradient orbs with random colors */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {orbColors.length >= 4 && (
          <>
            <div 
              className="absolute w-[700px] h-[700px] rounded-full blur-[120px] -top-48 -left-48 animate-float1"
              style={{ background: `radial-gradient(circle, ${isDark ? orbColors[0].dark : orbColors[0].light}, transparent 70%)` }}
            />
            <div 
              className="absolute w-[600px] h-[600px] rounded-full blur-[120px] top-1/2 -right-32 animate-float2"
              style={{ background: `radial-gradient(circle, ${isDark ? orbColors[1].dark : orbColors[1].light}, transparent 70%)` }}
            />
            <div 
              className="absolute w-[500px] h-[500px] rounded-full blur-[120px] -bottom-32 left-1/3 animate-float3"
              style={{ background: `radial-gradient(circle, ${isDark ? orbColors[2].dark : orbColors[2].light}, transparent 70%)` }}
            />
            <div 
              className="absolute w-[550px] h-[550px] rounded-full blur-[120px] top-1/4 left-1/4 animate-float2"
              style={{ background: `radial-gradient(circle, ${isDark ? orbColors[3].dark : orbColors[3].light}, transparent 70%)` }}
            />
          </>
        )}
      </div>

      {/* Noise texture overlay */}
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
          <div className="flex items-center justify-between">
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
                  ISI Citation Resolver & RIS Exporter
                </p>
              </div>
            </div>
            <ThemeToggle />
          </div>
        </div>

        {/* Main grid - Left (Raw Citations + Terminal) | Right (Results) */}
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-6">
          {/* Left Panel - Raw Citations + Terminal - Fixed heights with scrolling */}
          <div className="flex flex-col gap-4">
            {/* Raw Citations - Fixed height with internal scroll */}
            <GlassPanel className="flex flex-col h-[340px]">
              <div className="flex items-center mb-3">
                <h2 className="text-lg font-medium text-neutral-800 dark:text-white">
                  Raw Citations
                </h2>
              </div>

              <textarea
                value={rawInput}
                onChange={(e) => setRawInput(e.target.value)}
                placeholder="Paste raw citations here, one per line..."
                className="flex-1 w-full p-3 rounded-xl resize-none font-mono text-xs overflow-y-auto
                  bg-white/50 dark:bg-black/20
                  border border-neutral-200/50 dark:border-white/[0.05]
                  text-neutral-800 dark:text-neutral-200
                  placeholder:text-neutral-400 dark:placeholder:text-neutral-500
                  focus:outline-none focus:ring-2 focus:ring-neutral-300 dark:focus:ring-white/20
                  transition-all duration-200"
              />

              {/* Threshold Slider */}
              <div className="mt-3 px-1">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
                    Auto-resolve threshold
                  </label>
                  <span className="text-xs font-bold text-neutral-800 dark:text-white px-2 py-0.5 rounded-md bg-neutral-200/70 dark:bg-white/10">
                    {threshold}%
                  </span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="90"
                  step="5"
                  value={threshold}
                  onChange={(e) => setThreshold(Number(e.target.value))}
                  disabled={isProcessing}
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer
                    bg-neutral-300 dark:bg-neutral-700
                    [&::-webkit-slider-thumb]:appearance-none
                    [&::-webkit-slider-thumb]:w-4
                    [&::-webkit-slider-thumb]:h-4
                    [&::-webkit-slider-thumb]:rounded-full
                    [&::-webkit-slider-thumb]:bg-neutral-800
                    [&::-webkit-slider-thumb]:dark:bg-white
                    [&::-webkit-slider-thumb]:shadow-md
                    [&::-webkit-slider-thumb]:cursor-pointer
                    [&::-webkit-slider-thumb]:transition-transform
                    [&::-webkit-slider-thumb]:hover:scale-110
                    [&::-moz-range-thumb]:w-4
                    [&::-moz-range-thumb]:h-4
                    [&::-moz-range-thumb]:rounded-full
                    [&::-moz-range-thumb]:bg-neutral-800
                    [&::-moz-range-thumb]:dark:bg-white
                    [&::-moz-range-thumb]:border-0
                    [&::-moz-range-thumb]:cursor-pointer
                    disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <div className="flex justify-between text-[10px] text-neutral-400 mt-1">
                  <span>10%</span>
                  <span>90%</span>
                </div>
              </div>

              <button
                onClick={handleExecute}
                disabled={isProcessing || !rawInput.trim()}
                className="mt-3 w-full py-2.5 px-4 rounded-xl font-medium text-sm
                  flex items-center justify-center gap-2
                  bg-neutral-900 dark:bg-white text-white dark:text-neutral-900
                  hover:bg-neutral-800 dark:hover:bg-neutral-100
                  disabled:opacity-50 disabled:cursor-not-allowed
                  transition-all duration-200"
              >
                {isProcessing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 dark:border-neutral-900/30 border-t-white dark:border-t-neutral-900 rounded-full animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" />
                    Execute Extraction
                  </>
                )}
              </button>
            </GlassPanel>

            {/* Processing Terminal - Fixed height with internal scroll */}
            <div className="h-[200px]">
              <ProcessingTerminal logs={logs} progress={progress} />
            </div>
          </div>

          {/* Right Panel - Stats + Results Dashboard */}
          <div className="flex flex-col gap-4">
            {/* Stats bar */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 text-sm">
                <span className="px-2.5 py-1.5 rounded-lg bg-neutral-200/50 dark:bg-white/[0.05] text-neutral-600 dark:text-neutral-400 font-medium">
                  Total: {stats.total}
                </span>
                <span className="px-2.5 py-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-medium">
                  Resolved: {stats.resolved}
                </span>
                <span className="px-2.5 py-1.5 rounded-lg bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 font-medium">
                  Unresolved: {stats.unresolved}
                </span>
                {/* Navigation buttons for unresolved */}
                {unresolvedIds.length > 0 && (
                  <div className="flex items-center gap-1 ml-2">
                    <button
                      onClick={() => navigateUnresolved("prev")}
                      className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-500/30 transition-colors"
                      title="Previous unresolved"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => navigateUnresolved("next")}
                      className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-500/30 transition-colors"
                      title="Next unresolved"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
              <button
                onClick={handleExport}
                disabled={citations.length === 0 || isExporting}
                className="py-2 px-4 rounded-lg text-sm font-medium
                  flex items-center gap-2
                  bg-neutral-200/50 dark:bg-white/[0.05] 
                  text-neutral-700 dark:text-neutral-300
                  hover:bg-neutral-300/50 dark:hover:bg-white/[0.08]
                  disabled:opacity-50 disabled:cursor-not-allowed
                  transition-all duration-200"
              >
                <Download className="h-4 w-4" />
                {isExporting ? "Exporting..." : "Download .ris"}
              </button>
            </div>

            {/* Results Dashboard - Min height with ability to expand up to 2X, internal scroll */}
            <GlassPanel className="flex flex-col min-h-[400px] max-h-[800px] overflow-hidden">
              <div className="flex items-center mb-4 shrink-0">
                <h2 className="text-lg font-medium text-neutral-800 dark:text-white">
                  Results Dashboard
                </h2>
              </div>

              <div ref={resultsContainerRef} className="flex-1 overflow-y-auto min-h-0">
                <ResultsList
                  citations={citations}
                  onSelectCandidate={handleSelectCandidate}
                  highlightedId={highlightedCitationId}
                  threshold={threshold}
                />
              </div>
            </GlassPanel>
          </div>
        </div>
      </div>
    </div>
  );
}
