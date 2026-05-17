// API utilities for CrossRef and Semantic Scholar

import type { CitationCandidate } from "../types";
import { calculateScore } from "./scoring";

interface CrossRefWork {
  DOI: string;
  title?: string[];
  author?: Array<{ given?: string; family?: string }>;
  issued?: { "date-parts"?: number[][] };
}

interface SemanticScholarPaper {
  title: string;
  year?: number;
  authors?: Array<{ name: string }>;
  externalIds?: { DOI?: string };
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

  return items.map((item) => {
    const title = item.title?.[0] || "";
    const authors =
      item.author?.map((a) => `${a.given || ""} ${a.family || ""}`.trim()) ||
      [];
    const year = item.issued?.["date-parts"]?.[0]?.[0] || null;

    return {
      title,
      doi: item.DOI || null,
      year,
      authors,
      score: calculateScore(rawText, title, year, authors),
      source: "crossref" as const,
    };
  });
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

  return papers.map((paper) => {
    const title = paper.title || "";
    const authors = paper.authors?.map((a) => a.name) || [];
    const year = paper.year || null;
    const doi = paper.externalIds?.DOI || null;

    return {
      title,
      doi,
      year,
      authors,
      score: calculateScore(rawText, title, year, authors),
      source: "semantic-scholar" as const,
    };
  });
}

// Fetch RIS format from DOI
export async function fetchRIS(doi: string): Promise<string | null> {
  try {
    const response = await fetch(`https://doi.org/${doi}`, {
      headers: {
        Accept: "application/x-research-info-systems",
      },
      redirect: "follow",
    });

    if (!response.ok) {
      return null;
    }

    return await response.text();
  } catch {
    return null;
  }
}

// Generate fallback RIS for unresolved citations
export function generateUnresolvedRIS(rawText: string): string {
  return `TY  - JOUR
TI  - [UNRESOLVED] ${rawText.substring(0, 200)}
ER  - 

`;
}
