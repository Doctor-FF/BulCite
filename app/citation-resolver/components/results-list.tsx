"use client";

import { CheckCircle2, XCircle, ExternalLink, AlertCircle } from "lucide-react";
import type { ProcessedCitation } from "../types";

interface ResultsListProps {
  citations: ProcessedCitation[];
  onSelectCandidate: (citationId: string, candidateIndex: number | null) => void;
}

export function ResultsList({ citations, onSelectCandidate }: ResultsListProps) {
  if (citations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-neutral-500 dark:text-neutral-400">
        <AlertCircle className="h-8 w-8 mb-2 opacity-50" />
        <p>No citations processed yet</p>
        <p className="text-sm mt-1">Paste citations and click Execute to begin</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {citations.map((citation) => (
        <ResultRow
          key={citation.id}
          citation={citation}
          onSelectCandidate={onSelectCandidate}
        />
      ))}
    </div>
  );
}

interface ResultRowProps {
  citation: ProcessedCitation;
  onSelectCandidate: (citationId: string, candidateIndex: number | null) => void;
}

function ResultRow({ citation, onSelectCandidate }: ResultRowProps) {
  const selectedCandidate = citation.selectedCandidateIndex !== null 
    ? citation.candidates[citation.selectedCandidateIndex] 
    : null;
  const isResolved = citation.selectedCandidateIndex !== null && selectedCandidate;
  const isProcessing = citation.status === "processing";
  const isUnresolvedSelected = citation.selectedCandidateIndex === null;

  const candidateLabels = ["A", "B", "C"];

  return (
    <div
      className="p-4 rounded-xl transition-all duration-300 bg-neutral-100/50 dark:bg-white/[0.02] border border-neutral-200/50 dark:border-white/[0.05] hover:border-neutral-300/50 dark:hover:border-white/[0.08]"
    >
      {/* Raw citation text */}
      <div className="text-sm text-neutral-600 dark:text-neutral-400 mb-3 line-clamp-2">
        {citation.rawText}
      </div>

      {/* Status indicator */}
      {isProcessing ? (
        <div className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400 mb-3">
          <div className="w-4 h-4 border-2 border-neutral-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Processing...</span>
        </div>
      ) : isResolved && selectedCandidate ? (
        <div className="space-y-1 mb-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
            <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200 truncate">
              {selectedCandidate.title}
            </span>
          </div>
          {selectedCandidate.doi && (
            <a
              href={`https://doi.org/${selectedCandidate.doi}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
              {selectedCandidate.doi}
            </a>
          )}
          <div className="text-xs text-neutral-500 dark:text-neutral-400">
            Score: {(selectedCandidate.score * 100).toFixed(0)}% via {selectedCandidate.source}
          </div>
        </div>
      ) : (
        <div className="space-y-1 mb-3">
          <div className="flex items-center gap-2">
            <XCircle className="h-4 w-4 text-amber-500 shrink-0" />
            <span className="text-sm font-medium text-amber-600 dark:text-amber-400">
              UNRESOLVED
            </span>
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Select a candidate below to resolve
          </p>
        </div>
      )}

      {/* Selection buttons below title - UNRESOLVED, A, B, C */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* UNRESOLVED button */}
        <button
          onClick={() => onSelectCandidate(citation.id, null)}
          disabled={isProcessing}
          className={`
            px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200
            ${
              isUnresolvedSelected
                ? "bg-amber-500/20 text-amber-600 dark:text-amber-400 ring-2 ring-amber-500/50"
                : "bg-neutral-200/50 dark:bg-white/[0.05] text-neutral-600 dark:text-neutral-400 hover:bg-neutral-300/50 dark:hover:bg-white/[0.08]"
            }
            disabled:opacity-50 disabled:cursor-not-allowed
          `}
        >
          UNRESOLVED
        </button>

        {/* A, B, C candidate buttons */}
        {citation.candidates.slice(0, 3).map((candidate, index) => {
          const isSelected = citation.selectedCandidateIndex === index;
          const percentage = (candidate.score * 100).toFixed(0);

          return (
            <button
              key={index}
              onClick={() => onSelectCandidate(citation.id, index)}
              disabled={isProcessing}
              className={`
                px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200
                ${
                  isSelected
                    ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 ring-2 ring-emerald-500/50"
                    : "bg-neutral-200/50 dark:bg-white/[0.05] text-neutral-600 dark:text-neutral-400 hover:bg-neutral-300/50 dark:hover:bg-white/[0.08]"
                }
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
              title={candidate.title}
            >
              {candidateLabels[index]} {percentage}%
            </button>
          );
        })}
      </div>
    </div>
  );
}
