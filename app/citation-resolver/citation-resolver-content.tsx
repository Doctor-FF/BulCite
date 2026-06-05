"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Play, Download, ChevronUp, ChevronDown } from "lucide-react";
import type { ProcessedCitation, LogEntry, ProcessingStats } from "./types";
import { sanitizeCitation, extractDOI } from "./utils/sanitize";
import { fetchCrossRef, fetchSemanticScholar, fetchPubMed, fetchOpenAlex, fetchRIS, generateUnresolvedRIS } from "./utils/api";
import { GlassPanel } from "./components/glass-panel";
import { ProcessingTerminal } from "./components/processing-terminal";
import { ResultsList } from "./components/results-list";

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

export default function CitationResolverContent() {
  const [rawInput, setRawInput] = useState("");
  const [citations, setCitations] = useState<ProcessedCitation[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [threshold, setThreshold] = useState(40);
  const [searchEngine, setSearchEngine] = useState<"auto" | "crossref" | "semantic-scholar" | "pubmed" | "openalex">("auto");
  const [highlightedCitationId, setHighlightedCitationId] = useState<string | null>(null);
  const resultsContainerRef = useRef<HTMLDivElement>(null);

  // Re-evaluate default selections when threshold changes
  useEffect(() => {
    if (citations.length === 0) return;
    
    const thresholdDecimal = threshold / 100;
    setCitations((prev) =>
      prev.map((c) => {
        if (c.resolvedByUser || c.status === "processing" || c.status === "pending") {
          return c;
        }
        
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
        {
          id: generateId(),
          timestamp: new Date(),
          message,
          type,
        },
      ]);
    },
    []
  );

  const processCitation = async (
    citation: ProcessedCitation
  ): Promise<ProcessedCitation> => {
    const rawText = citation.rawText;

    // Tier 1: Try to extract DOI directly
    const directDOI = extractDOI(rawText);
    if (directDOI) {
      addLog(`Found DOI in text: ${directDOI}`, "success");
      return {
        ...citation,
        status: "resolved",
        candidates: [
          {
            title: "Direct DOI Match",
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

    const { cleanQuery } = sanitizeCitation(rawText);
    addLog(`Clean query: "${cleanQuery.substring(0, 50)}..."`, "info");

    // Tier 2: CrossRef API
    if (searchEngine === "auto" || searchEngine === "crossref") {
      try {
        addLog("Querying CrossRef API...", "info");
        const crossRefCandidates = await fetchCrossRef(cleanQuery, rawText);

        if (crossRefCandidates.length > 0) {
          const bestScore = crossRefCandidates[0].score;
          const thresholdDecimal = threshold / 100;
          addLog(
            `CrossRef found ${crossRefCandidates.length} candidate(s), best: ${(crossRefCandidates[0].title || "Unknown title").substring(0, 40)}... (${(bestScore * 100).toFixed(0)}%)`,
            bestScore >= thresholdDecimal ? "success" : "warning"
          );

          const autoSelect = bestScore >= thresholdDecimal ? 0 : null;
          
          if (searchEngine === "crossref" || bestScore >= thresholdDecimal) {
            return {
              ...citation,
              status: autoSelect !== null ? "resolved" : "unresolved",
              candidates: crossRefCandidates,
              selectedCandidateIndex: autoSelect,
            };
          }
        }
      } catch (error) {
        addLog(`CrossRef error: ${error instanceof Error ? error.message : "Unknown"}`, "error");
      }
    }

    // Tier 3: Semantic Scholar
    if (searchEngine === "auto" || searchEngine === "semantic-scholar") {
      try {
        addLog(searchEngine === "auto" ? "Falling back to Semantic Scholar..." : "Querying Semantic Scholar...", "info");
        const semanticCandidates = await fetchSemanticScholar(cleanQuery, rawText);

        if (semanticCandidates.length > 0) {
          const bestScore = semanticCandidates[0].score;
          const thresholdDecimal = threshold / 100;
          addLog(
            `Semantic Scholar found ${semanticCandidates.length} candidate(s), best: ${(semanticCandidates[0].title || "Unknown title").substring(0, 40)}... (${(bestScore * 100).toFixed(0)}%)`,
            bestScore >= thresholdDecimal ? "success" : "warning"
          );

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
    }

    // PubMed
    if (searchEngine === "pubmed") {
      try {
        addLog("Querying PubMed...", "info");
        const pubmedCandidates = await fetchPubMed(cleanQuery, rawText);

        if (pubmedCandidates.length > 0) {
          const bestScore = pubmedCandidates[0].score;
          const thresholdDecimal = threshold / 100;
          addLog(
            `PubMed found ${pubmedCandidates.length} candidate(s), best: ${(pubmedCandidates[0].title || "Unknown title").substring(0, 40)}... (${(bestScore * 100).toFixed(0)}%)`,
            bestScore >= thresholdDecimal ? "success" : "warning"
          );

          const autoSelect = bestScore >= thresholdDecimal ? 0 : null;
          return {
            ...citation,
            status: autoSelect !== null ? "resolved" : "unresolved",
            candidates: pubmedCandidates,
            selectedCandidateIndex: autoSelect,
          };
        }
      } catch (error) {
        addLog(`PubMed error: ${error instanceof Error ? error.message : "Unknown"}`, "error");
      }
    }

    // OpenAlex
    if (searchEngine === "openalex") {
      try {
        addLog("Querying OpenAlex...", "info");
        const openalexCandidates = await fetchOpenAlex(cleanQuery, rawText);

        if (openalexCandidates.length > 0) {
          const bestScore = openalexCandidates[0].score;
          const thresholdDecimal = threshold / 100;
          addLog(
            `OpenAlex found ${openalexCandidates.length} candidate(s), best: ${(openalexCandidates[0].title || "Unknown title").substring(0, 40)}... (${(bestScore * 100).toFixed(0)}%)`,
            bestScore >= thresholdDecimal ? "success" : "warning"
          );

          const autoSelect = bestScore >= thresholdDecimal ? 0 : null;
          return {
            ...citation,
            status: autoSelect !== null ? "resolved" : "unresolved",
            candidates: openalexCandidates,
            selectedCandidateIndex: autoSelect,
          };
        }
      } catch (error) {
        addLog(`OpenAlex error: ${error instanceof Error ? error.message : "Unknown"}`, "error");
      }
    }

    addLog(`No match found for citation`, "error");
    return { ...citation, status: "unresolved", candidates: [] };
  };

  const handleExecute = async () => {
    const lines = rawInput
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length === 0) {
      addLog("No citations to process", "error");
      return;
    }

    setIsProcessing(true);
    setLogs([]);
    setProgress({ current: 0, total: lines.length });

    const initialCitations: ProcessedCitation[] = lines.map((line) => ({
      id: generateId(),
      rawText: line,
      status: "pending",
      candidates: [],
      selectedCandidateIndex: null,
    }));

    setCitations(initialCitations);
    addLog(`Starting extraction for ${lines.length} citation(s)...`, "info");

    const results: ProcessedCitation[] = [];

    for (let i = 0; i < initialCitations.length; i++) {
      const citation = initialCitations[i];
      setProgress({ current: i + 1, total: lines.length });

      setCitations((prev) =>
        prev.map((c) =>
          c.id === citation.id ? { ...c, status: "processing" } : c
        )
      );

      addLog(`Processing: "${citation.rawText.substring(0, 50)}..."`, "info");

      try {
        const processed = await processCitation(citation);
        results.push(processed);

        setCitations((prev) =>
          prev.map((c) => (c.id === citation.id ? processed : c))
        );
      } catch (error) {
        console.error("[v0] Error processing citation:", error);
        addLog(`Error processing citation ${i + 1}: ${error instanceof Error ? error.message : "Unknown error"}`, "error");
        
        // Mark as unresolved but continue with next citation
        const failedCitation: ProcessedCitation = {
          ...citation,
          status: "unresolved",
          candidates: [],
        };
        results.push(failedCitation);
        
        setCitations((prev) =>
          prev.map((c) => (c.id === citation.id ? failedCitation : c))
        );
      }

      // Small delay between requests to avoid rate limiting
      if (i < initialCitations.length - 1) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    addLog("Processing complete!", "success");
    setIsProcessing(false);
  };

  const handleSelectCandidate = useCallback(
    (citationId: string, candidateIndex: number | null) => {
      setCitations((prev) =>
        prev.map((c) => {
          if (c.id !== citationId) return c;
          return {
            ...c,
            selectedCandidateIndex: candidateIndex,
            status: candidateIndex !== null ? "resolved" : "unresolved",
            resolvedByUser: true,
          };
        })
      );
    },
    []
  );

  const calculateStats = useCallback((): ProcessingStats => {
    const total = citations.length;
    const resolved = citations.filter(
      (c) => c.status === "resolved" && c.selectedCandidateIndex !== null
    ).length;
    const unresolved = citations.filter(
      (c) => c.status === "unresolved" || c.selectedCandidateIndex === null
    ).length;
    const processing = citations.filter(
      (c) => c.status === "processing" || c.status === "pending"
    ).length;

    return { total, resolved, unresolved, processing };
  }, [citations]);

  const handleExport = async () => {
    const toExport = citations.filter(
      (c) => c.status === "resolved" || c.status === "unresolved"
    );
    if (toExport.length === 0) {
      addLog("No citations to export", "error");
      return;
    }

    setIsExporting(true);
    addLog(`Exporting ${toExport.length} citation(s) to RIS...`, "info");

    const risEntries: string[] = [];

    for (const citation of toExport) {
      if (
        citation.selectedCandidateIndex !== null &&
        citation.candidates[citation.selectedCandidateIndex]?.doi
      ) {
        const doi = citation.candidates[citation.selectedCandidateIndex].doi!;
        try {
          const ris = await fetchRIS(doi);
          risEntries.push(ris);
          addLog(`Fetched RIS for DOI: ${doi}`, "success");
        } catch (error) {
          addLog(`Failed to fetch RIS for ${doi}: ${error}`, "error");
          const fallbackRIS = generateUnresolvedRIS(citation.rawText);
          risEntries.push(fallbackRIS);
        }
      } else {
        const fallbackRIS = generateUnresolvedRIS(citation.rawText);
        risEntries.push(fallbackRIS);
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

  const jumpToUnresolved = (direction: "next" | "prev") => {
    const nodes = Array.from(document.querySelectorAll('div[data-unresolved="true"]'));
    
    if (nodes.length === 0) {
      addLog("All citations are resolved.", "success");
      return;
    }

    const viewportCenter = window.innerHeight / 2;
    let targetNode: Element | null = null;

    if (direction === "next") {
      for (const node of nodes) {
        const rect = node.getBoundingClientRect();
        if (rect.top > viewportCenter) {
          targetNode = node;
          break;
        }
      }
      if (!targetNode) {
        targetNode = nodes[0];
      }
    } else {
      for (let i = nodes.length - 1; i >= 0; i--) {
        const rect = nodes[i].getBoundingClientRect();
        if (rect.bottom < viewportCenter) {
          targetNode = nodes[i];
          break;
        }
      }
      if (!targetNode) {
        targetNode = nodes[nodes.length - 1];
      }
    }

    if (targetNode) {
      const citationId = targetNode.id.replace("citation-", "");
      targetNode.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightedCitationId(citationId);
      setTimeout(() => setHighlightedCitationId(null), 400);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-6">
      {/* Left Panel */}
      <div className="flex flex-col gap-4">
        <GlassPanel className="flex flex-col h-[400px]">
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

          {/* Search Engine Selection */}
          <div className="mt-3 px-1">
            <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1.5 block">
              Search Engine
            </label>
            <div className="flex flex-wrap gap-1.5">
              {(["auto", "crossref", "semantic-scholar", "pubmed", "openalex"] as const).map((engine) => (
                <button
                  key={engine}
                  onClick={() => setSearchEngine(engine)}
                  disabled={isProcessing}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200
                    ${searchEngine === engine
                      ? "bg-neutral-800 dark:bg-white text-white dark:text-neutral-900"
                      : "bg-neutral-200/70 dark:bg-white/[0.08] text-neutral-600 dark:text-neutral-400 hover:bg-neutral-300/70 dark:hover:bg-white/[0.12]"
                    }
                    disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {engine === "auto" ? "Auto" : engine === "crossref" ? "CrossRef" : engine === "semantic-scholar" ? "Semantic" : engine === "pubmed" ? "PubMed" : "OpenAlex"}
                </button>
              ))}
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

        <div className="h-[200px]">
          <ProcessingTerminal logs={logs} progress={progress} />
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex flex-col gap-4">
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
            <div className="flex items-center gap-1 ml-2">
              <button
                onClick={() => jumpToUnresolved("prev")}
                className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-500/30 transition-colors"
                title="Previous unresolved"
              >
                <ChevronUp className="h-4 w-4" />
              </button>
              <button
                onClick={() => jumpToUnresolved("next")}
                className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-500/30 transition-colors"
                title="Next unresolved"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
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
  );
}
