// API utilities for CrossRef and Semantic Scholar

import type { CitationCandidate } from "../types";
import { calculateScore } from "./scoring";

interface CrossRefWork {
  DOI: string;
  title?: string[];
  author?: Array<{ given?: string; family?: string }>;
  issued?: { "date-parts"?: number[][] };
  "container-title"?: string[];
}

interface SemanticScholarPaper {
  title: string;
  year?: number;
  authors?: Array<{ name: string }>;
  externalIds?: { DOI?: string };
  venue?: string;
}

interface PubMedResult {
  pmid: string;
  title: string;
  authors: string[];
  year: number | null;
  journal: string | null;
  doi: string | null;
}

interface OpenAlexResult {
  title: string;
  year: number | null;
  authors: string[];
  doi: string | null;
  journal: string | null;
}

// Returns true if a candidate has at least one real author AND a year.
function hasAuthorAndYear(c: CitationCandidate): boolean {
  const hasAuthor =
    Array.isArray(c.authors) &&
    c.authors.some((a) => typeof a === "string" && a.trim().length > 0);
  const hasYear = c.year !== null && c.year !== undefined;
  return hasAuthor && hasYear;
}

// Filter out candidates without author/year metadata when the option is on.
export function filterValidCandidates(
  candidates: CitationCandidate[],
  requireAuthorYear: boolean
): CitationCandidate[] {
  if (!requireAuthorYear) return candidates;
  return candidates.filter(hasAuthorAndYear);
}

// Merge candidate lists from multiple sources, de-duplicating by DOI (or by
// normalized title when no DOI exists), keeping the highest-scoring entry.
export function mergeCandidates(
  lists: CitationCandidate[][]
): CitationCandidate[] {
  const seen = new Map<string, CitationCandidate>();
  for (const candidate of lists.flat()) {
    const key = candidate.doi
      ? `doi:${candidate.doi.toLowerCase().trim()}`
      : `title:${(candidate.title || "").toLowerCase().replace(/\s+/g, " ").trim()}`;
    const existing = seen.get(key);
    if (!existing || candidate.score > existing.score) {
      seen.set(key, candidate);
    }
  }
  return Array.from(seen.values()).sort((a, b) => b.score - a.score);
}

// Verify DOI exists in CrossRef and get full metadata
export async function verifyDOIviaCrossRef(
  doi: string
): Promise<CitationCandidate | null> {
  try {
    const cleanDoi = doi.replace(/[.,;:]+$/, "").trim();
    const response = await fetch(`/api/crossref/verify?doi=${encodeURIComponent(cleanDoi)}`);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    if (!data.valid || !data.work) {
      return null;
    }

    const work = data.work as CrossRefWork;
    const title = work.title?.[0] || "";
    const authors = work.author?.map((a) => 
      a.family ? (a.given ? `${a.family}, ${a.given}` : a.family) : ""
    ).filter(Boolean) || [];
    const year = work.issued?.["date-parts"]?.[0]?.[0] || null;
    const journal = work["container-title"]?.[0] || null;

    return {
      title,
      doi: work.DOI,
      year,
      authors,
      score: 1.0, // Direct DOI match = 100%
      source: "crossref",
      journal,
    };
  } catch {
    return null;
  }
}

// Tier 2: CrossRef API (via proxy)
export async function fetchCrossRef(
  cleanQuery: string,
  rawText: string
): Promise<CitationCandidate[]> {
  const response = await fetch(`/api/crossref?query=${encodeURIComponent(cleanQuery)}`);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `CrossRef API error: ${response.status}`);
  }

  const data = await response.json();
  const items: CrossRefWork[] = data.message?.items || [];

  const candidates = items.map((item) => {
    const title = item.title?.[0] || "";
    const authors =
      item.author?.map((a) => `${a.given || ""} ${a.family || ""}`.trim()) ||
      [];
    const year = item.issued?.["date-parts"]?.[0]?.[0] || null;
    const journal = item["container-title"]?.[0] || null;

    return {
      title,
      doi: item.DOI || null,
      year,
      authors,
      score: calculateScore(rawText, title, year, authors),
      source: "crossref" as const,
      journal,
    };
  });

  // Sort by score descending so A is always highest
  return candidates.sort((a, b) => b.score - a.score);
}

// Tier 3: Semantic Scholar API (via proxy)
export async function fetchSemanticScholar(
  cleanQuery: string,
  rawText: string
): Promise<CitationCandidate[]> {
  const response = await fetch(`/api/semantic-scholar?query=${encodeURIComponent(cleanQuery)}`);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Semantic Scholar API error: ${response.status}`);
  }

  const data = await response.json();
  const papers: SemanticScholarPaper[] = data.data || [];

  const candidates = papers.map((paper) => {
    const title = paper.title || "";
    const authors = paper.authors?.map((a) => a.name) || [];
    const year = paper.year || null;
    const doi = paper.externalIds?.DOI || null;
    const journal = paper.venue || null;

    return {
      title,
      doi,
      year,
      authors,
      score: calculateScore(rawText, title, year, authors),
      source: "semantic-scholar" as const,
      journal,
    };
  });

  // Sort by score descending so A is always highest
  return candidates.sort((a, b) => b.score - a.score);
}

// PubMed API (via proxy)
export async function fetchPubMed(
  cleanQuery: string,
  rawText: string
): Promise<CitationCandidate[]> {
  const response = await fetch(`/api/pubmed?query=${encodeURIComponent(cleanQuery)}`);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `PubMed API error: ${response.status}`);
  }

  const data = await response.json();
  const results: PubMedResult[] = data.results || [];

  const candidates = results.map((result) => {
    const title = result.title || "";
    const authors = result.authors || [];
    return {
      title,
      doi: result.doi,
      year: result.year,
      authors,
      score: calculateScore(rawText, title, result.year, authors),
      source: "pubmed" as const,
      journal: result.journal,
    };
  });

  // Sort by score descending so A is always highest
  return candidates.sort((a, b) => b.score - a.score);
}

// OpenAlex API (via proxy)
export async function fetchOpenAlex(
  cleanQuery: string,
  rawText: string
): Promise<CitationCandidate[]> {
  const response = await fetch(`/api/openalex?query=${encodeURIComponent(cleanQuery)}`);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `OpenAlex API error: ${response.status}`);
  }

  const data = await response.json();
  const results: OpenAlexResult[] = data.results || [];

  const candidates = results.map((result) => {
    const title = result.title || "";
    const authors = result.authors || [];
    return {
      title,
      doi: result.doi,
      year: result.year,
      authors,
      score: calculateScore(rawText, title, result.year, authors),
      source: "openalex" as const,
      journal: result.journal,
    };
  });

  // Sort by score descending so A is always highest
  return candidates.sort((a, b) => b.score - a.score);
}

// Fetch RIS format from DOI (via proxy to avoid CORS)
export async function fetchRIS(doi: string): Promise<string> {
  const response = await fetch(`/api/ris?doi=${encodeURIComponent(doi)}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch RIS: ${response.status}`);
  }

  const data = await response.json();
  
  if (!data.ris || !data.ris.trim()) {
    throw new Error("Empty RIS response");
  }
  
  return data.ris;
}

// Generate fallback RIS for unresolved citations
export function generateUnresolvedRIS(rawText: string): string {
  return `TY  - JOUR
TI  - [UNRESOLVED] ${rawText.substring(0, 200)}
ER  - 

`;
}

// Generate RIS from a selected candidate's metadata.
// Used when the DOI-based RIS fetch fails, so the user's selection is still
// reflected in the export instead of falling back to the raw unresolved text.
export function generateRISFromCandidate(candidate: {
  title: string;
  doi: string | null;
  year: number | null;
  authors: string[];
  journal?: string | null;
}): string {
  const lines: string[] = ["TY  - JOUR"];

  if (candidate.title) {
    lines.push(`TI  - ${candidate.title}`);
  }

  for (const author of candidate.authors || []) {
    if (author && author.trim()) {
      lines.push(`AU  - ${author.trim()}`);
    }
  }

  if (candidate.year) {
    lines.push(`PY  - ${candidate.year}`);
  }

  if (candidate.journal) {
    lines.push(`JO  - ${candidate.journal}`);
  }

  if (candidate.doi) {
    const cleanDoi = candidate.doi.replace(/[.,;:]+$/, "").trim();
    lines.push(`DO  - ${cleanDoi}`);
  }

  lines.push("ER  - ");
  lines.push("");

  return lines.join("\n");
}
