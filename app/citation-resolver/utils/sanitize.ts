// Aggressive sanitization to clean citations before API queries

export function sanitizeCitation(raw: string): string {
  let clean = raw;

  // Remove leading indices like [1], 1., [218], etc.
  clean = clean.replace(/^\s*\[?\d+\]?\.?\s*/g, "");

  // Remove publisher noise
  const publishers = [
    "Elsevier",
    "ScienceDirect",
    "Springer",
    "Wiley",
    "Nature Publishing Group",
    "Taylor & Francis",
    "SAGE Publications",
    "Oxford University Press",
    "Cambridge University Press",
    "IEEE",
    "ACM",
    "PLOS",
    "BioMed Central",
    "Frontiers",
    "MDPI",
  ];
  const publisherPattern = new RegExp(
    `\\b(${publishers.join("|")})\\b`,
    "gi"
  );
  clean = clean.replace(publisherPattern, "");

  // Remove volume/issue/page artifacts
  clean = clean.replace(/\bvol\.?\s*\d+/gi, "");
  clean = clean.replace(/\bvolume\.?\s*\d+/gi, "");
  clean = clean.replace(/\bpp\.?\s*\d+[-–]\d+/gi, "");
  clean = clean.replace(/\bp\.?\s*\d+/gi, "");
  clean = clean.replace(/\bissue\.?\s*\d+/gi, "");
  clean = clean.replace(/\bno\.?\s*\d+/gi, "");

  // Remove common URL artifacts
  clean = clean.replace(/https?:\/\/[^\s]+/g, "");
  clean = clean.replace(/doi\.org\/[^\s]+/g, "");

  // Remove "Available at:", "Accessed:", etc.
  clean = clean.replace(/available\s+at:?/gi, "");
  clean = clean.replace(/accessed:?\s*\d+.*/gi, "");
  clean = clean.replace(/retrieved:?\s*\d+.*/gi, "");

  // Normalize whitespace
  clean = clean.replace(/\s+/g, " ").trim();

  return clean;
}

// Extract DOI using regex (Tier 1)
export function extractDOI(text: string): string | null {
  const doiPattern = /10\.\d{4,9}\/[-._;()/:a-zA-Z0-9]+/;
  const match = text.match(doiPattern);
  return match ? match[0] : null;
}

// Extract year from citation text
export function extractYear(text: string): number | null {
  // Match 4-digit years between 1900 and 2099
  const yearPattern = /\b(19|20)\d{2}\b/g;
  const matches = text.match(yearPattern);
  if (matches && matches.length > 0) {
    // Return the most likely publication year (usually the first or second one)
    return parseInt(matches[0], 10);
  }
  return null;
}
