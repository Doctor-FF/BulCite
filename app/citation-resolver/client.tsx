"use client";

import { useState, useCallback } from "react";
import { Play, Download, Beaker } from "lucide-react";
import type { ProcessedCitation, LogEntry, ProcessingStats } from "./types";
import { sanitizeCitation, extractDOI } from "./utils/sanitize";
import { fetchCrossRef, fetchSemanticScholar, fetchRIS, generateUnresolvedRIS } from "./utils/api";
import { CONFIDENCE_THRESHOLD } from "./utils/scoring";
import { GlassPanel } from "./components/glass-panel";
import { ProcessingTerminal } from "./components/processing-terminal";
import { ResultsList } from "./components/results-list";
import { ThemeToggle } from "./components/theme-toggle";

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

export default function CitationResolverClient() {
  const [rawInput, setRawInput] = useState("");
  const [citations, setCitations] = useState<ProcessedCitation[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

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
      if (c.status === "resolved") return true;
      const candidate = c.candidates[c.selectedCandidateIndex];
      return candidate && candidate.score > CONFIDENCE_THRESHOLD;
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
        if (bestScore > CONFIDENCE_THRESHOLD) {
          addLog(
            `CrossRef match: ${crossRefCandidates[0].title.substring(0, 40)}... (${(bestScore * 100).toFixed(0)}%)`,
            "success"
          );
        } else {
          addLog(`CrossRef: Low confidence match (${(bestScore * 100).toFixed(0)}%)`, "warning");
        }

        return {
          ...citation,
          status: bestScore > CONFIDENCE_THRESHOLD ? "resolved" : "unresolved",
          candidates: crossRefCandidates,
          selectedCandidateIndex: 0,
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
        if (bestScore > CONFIDENCE_THRESHOLD) {
          addLog(
            `Semantic Scholar match: ${semanticCandidates[0].title.substring(0, 40)}... (${(bestScore * 100).toFixed(0)}%)`,
            "success"
          );
        } else {
          addLog(`Semantic Scholar: Low confidence match (${(bestScore * 100).toFixed(0)}%)`, "warning");
        }

        return {
          ...citation,
          status: bestScore > CONFIDENCE_THRESHOLD ? "resolved" : "unresolved",
          candidates: semanticCandidates,
          selectedCandidateIndex: 0,
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
      selectedCandidateIndex: 0,
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
    addLog(`Starting extraction for ${lines.length} citation(s)...`, "info");

    // Initialize citations
    const initialCitations: ProcessedCitation[] = lines.map((line) => ({
      id: generateId(),
      rawText: line,
      cleanQuery: sanitizeCitation(line),
      status: "pending",
      candidates: [],
      selectedCandidateIndex: 0,
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

      // Delay to avoid rate limits (skip on last)
      if (i < initialCitations.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    addLog("Processing complete!", "success");
    setIsProcessing(false);
  };

  const handleSelectCandidate = (citationId: string, candidateIndex: number) => {
    setCitations((prev) =>
      prev.map((c) => {
        if (c.id !== citationId) return c;
        const candidate = c.candidates[candidateIndex];
        const newStatus =
          candidate && candidate.score > CONFIDENCE_THRESHOLD ? "resolved" : c.status;
        return {
          ...c,
          selectedCandidateIndex: candidateIndex,
          status: newStatus === "unresolved" && candidate ? "resolved" : newStatus,
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
      const candidate = citation.candidates[citation.selectedCandidateIndex];

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

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#f5f5f7] dark:bg-[#0a0a0c] transition-colors duration-500">
      {/* Animated background orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute w-[600px] h-[600px] rounded-full bg-neutral-300/30 dark:bg-neutral-700/20 blur-[100px] -top-48 -left-48 animate-float1" />
        <div className="absolute w-[500px] h-[500px] rounded-full bg-neutral-400/20 dark:bg-neutral-600/15 blur-[100px] top-1/2 -right-32 animate-float2" />
        <div className="absolute w-[400px] h-[400px] rounded-full bg-neutral-300/25 dark:bg-neutral-700/20 blur-[100px] -bottom-32 left-1/3 animate-float3" />
        <div className="absolute w-[450px] h-[450px] rounded-full bg-neutral-400/15 dark:bg-neutral-500/10 blur-[100px] top-1/4 left-1/4 animate-float2" />
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
                <h1 className="text-xl font-semibold text-neutral-900 dark:text-white">
                  Citation Resolver
                </h1>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  ISI Citation Resolver & RIS Exporter
                </p>
              </div>
            </div>
            <ThemeToggle />
          </div>
        </div>

        {/* Main grid */}
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Panel - Input */}
          <GlassPanel className="flex flex-col h-[calc(100vh-180px)] min-h-[500px]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-neutral-800 dark:text-white">
                Raw Citations
              </h2>
              <div className="flex items-center gap-2 text-sm">
                <span className="px-2 py-1 rounded-md bg-neutral-200/50 dark:bg-white/[0.05] text-neutral-600 dark:text-neutral-400">
                  Total: {stats.total}
                </span>
                <span className="px-2 py-1 rounded-md bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400">
                  Resolved: {stats.resolved}
                </span>
                <span className="px-2 py-1 rounded-md bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400">
                  Unresolved: {stats.unresolved}
                </span>
              </div>
            </div>

            <textarea
              value={rawInput}
              onChange={(e) => setRawInput(e.target.value)}
              placeholder="Paste raw citations here, one per line...

Example:
Smith J, Doe A. (2023) Machine learning in research. Nature 123:45-67.
[2] Brown et al. Deep learning applications. Science 2022;456:89-101."
              className="flex-1 w-full p-4 rounded-xl resize-none font-mono text-sm
                bg-white/50 dark:bg-black/20
                border border-neutral-200/50 dark:border-white/[0.05]
                text-neutral-800 dark:text-neutral-200
                placeholder:text-neutral-400 dark:placeholder:text-neutral-500
                focus:outline-none focus:ring-2 focus:ring-neutral-300 dark:focus:ring-white/20
                transition-all duration-200"
            />

            <button
              onClick={handleExecute}
              disabled={isProcessing || !rawInput.trim()}
              className="mt-4 w-full py-3 px-4 rounded-xl font-medium text-sm
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

          {/* Right Panel - Terminal & Results */}
          <div className="flex flex-col gap-6 h-[calc(100vh-180px)] min-h-[500px]">
            {/* Processing Terminal */}
            <div className="h-[40%]">
              <ProcessingTerminal logs={logs} />
            </div>

            {/* Results Dashboard */}
            <GlassPanel className="flex-1 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-medium text-neutral-800 dark:text-white">
                  Results Dashboard
                </h2>
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

              <div className="flex-1 overflow-y-auto">
                <ResultsList
                  citations={citations}
                  onSelectCandidate={handleSelectCandidate}
                />
              </div>
            </GlassPanel>
          </div>
        </div>
      </div>
    </div>
  );
}
