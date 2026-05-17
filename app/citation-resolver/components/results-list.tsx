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
      {citations.map((citation, index) => (
        <ResultRow
          key={citation.id}
          citation={citation}
          index={index + 1}
          onSelectCandidate={onSelectCandidate}
        />
      ))}
    </div>
  );
}

interface ResultRowProps {
  citation: ProcessedCitation;
  index: number;
  onSelectCandidate: (citationId: string, candidateIndex: number | null) => void;
}

function ResultRow({ citation, index, onSelectCandidate }: ResultRowProps) {
  const selectedCandidate = citation.selectedCandidateIndex !== null 
    ? citation.candidates[citation.selectedCandidateIndex] 
    : null;
  const isResolved = citation.selectedCandidateIndex !== null && selectedCandidate;
  const isProcessing = citation.status === "processing";
  const isUnresolvedSelected = citation.selectedCandidateIndex === null;

  const candidateLabels = ["A", "B", "C"];

  return (
    <div
      className={`
        p-4 rounded-xl transition-all duration-300 
        ${isResolved 
          ? "bg-emerald-50/50 dark:bg-emerald-500/[0.05] border border-emerald-200/50 dark:border-emerald-500/20" 
          : "bg-amber-50/30 dark:bg-amber-500/[0.03] border border-amber-200/30 dark:border-amber-500/10"
        }
        hover:shadow-md hover:shadow-neutral-200/50 dark:hover:shadow-black/20
      `}
    >
      {/* Index badge and raw citation */}
      <div className="flex items-start gap-3 mb-3">
        <span className={`
          shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold
          ${isResolved 
            ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400" 
            : "bg-amber-500/20 text-amber-700 dark:text-amber-400"
          }
        `}>
          {index}
        </span>
        <p className="text-sm text-neutral-700 dark:text-neutral-300 line-clamp-2 flex-1">
          {citation.rawText}
        </p>
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
        {/* UNRESOLVED button with improved styling */}
        <button
          onClick={() => onSelectCandidate(citation.id, null)}
          disabled={isProcessing}
          className={`
            px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200
            ${
              isUnresolvedSelected
                ? "bg-amber-500 text-white shadow-md shadow-amber-500/30"
                : "bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-500/30"
            }
            disabled:opacity-50 disabled:cursor-not-allowed
          `}
        >
          UNRESOLVED
        </button>

        {/* A, B, C candidate buttons with improved colors */}
        {citation.candidates.slice(0, 3).map((candidate, idx) => {
          const isSelected = citation.selectedCandidateIndex === idx;
          const percentage = (candidate.score * 100).toFixed(0);
          const isHighConfidence = candidate.score >= 0.4;

          return (
            <button
              key={idx}
              onClick={() => onSelectCandidate(citation.id, idx)}
              disabled={isProcessing}
              className={`
                px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200
                ${
                  isSelected
                    ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/30"
                    : isHighConfidence
                      ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-500/30"
                      : "bg-neutral-200/70 dark:bg-white/[0.08] text-neutral-600 dark:text-neutral-400 hover:bg-neutral-300/70 dark:hover:bg-white/[0.12]"
                }
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
              title={candidate.title}
            >
              {candidateLabels[idx]} {percentage}%
            </button>
          );
        })}
      </div>
    </div>
  );
}
