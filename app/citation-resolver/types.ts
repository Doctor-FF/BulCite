// Core types for Citation Resolver

export interface CitationCandidate {
  title: string;
  doi: string | null;
  year: number | null;
  authors: string[];
  score: number;
  source: "regex" | "crossref" | "semantic-scholar";
}

export interface ProcessedCitation {
  id: string;
  rawText: string;
  cleanQuery: string;
  status: "pending" | "processing" | "resolved" | "unresolved";
  candidates: CitationCandidate[];
  selectedCandidateIndex: number | null;
  resolvedByUser: boolean;
}

export interface LogEntry {
  id: string;
  timestamp: Date;
  message: string;
  type: "info" | "success" | "warning" | "error";
}

export interface ProcessingStats {
  total: number;
  resolved: number;
  unresolved: number;
  processing: number;
}
