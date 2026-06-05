// Fuzzy matching and weighted scoring algorithm

import { extractYear } from "./sanitize";

// Sørensen–Dice coefficient for fuzzy string matching
function diceCoefficient(str1: string, str2: string): number {
  // Handle null/undefined inputs
  if (!str1 || !str2) return 0;
  
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();

  if (s1 === s2) return 1;
  if (s1.length < 2 || s2.length < 2) return 0;

  const bigrams1 = new Set<string>();
  for (let i = 0; i < s1.length - 1; i++) {
    bigrams1.add(s1.substring(i, i + 2));
  }

  let intersection = 0;
  for (let i = 0; i < s2.length - 1; i++) {
    const bigram = s2.substring(i, i + 2);
    if (bigrams1.has(bigram)) {
      intersection++;
      bigrams1.delete(bigram); // Count each match only once
    }
  }

  return (2 * intersection) / (s1.length - 1 + s2.length - 1);
}

// Calculate match score (0.0 to 1.0) based on weighted criteria
export function calculateScore(
  rawText: string,
  candidateTitle: string,
  candidateYear: number | null,
  candidateAuthors: string[]
): number {
  // Title Match (Weight: 70%)
  const titleScore = diceCoefficient(rawText, candidateTitle);
  const titleWeight = 0.7;

  // Year Match (Weight: 20%)
  let yearScore = 0;
  const extractedYear = extractYear(rawText);
  if (extractedYear && candidateYear) {
    const yearDiff = Math.abs(extractedYear - candidateYear);
    if (yearDiff === 0) {
      yearScore = 1;
    } else if (yearDiff === 1) {
      yearScore = 0.4;
    } else if (yearDiff === 2) {
      yearScore = 0.2;
    }
  }
  const yearWeight = 0.2;

  // Author Match (Weight: 10%)
  let authorScore = 0;
  if (candidateAuthors.length > 0) {
    const rawLower = rawText.toLowerCase();
    const matchedAuthors = candidateAuthors.filter((author) => {
      // Extract family name (last part of name)
      const parts = author.split(" ");
      const familyName = parts[parts.length - 1].toLowerCase();
      return familyName.length > 2 && rawLower.includes(familyName);
    });
    authorScore = matchedAuthors.length / candidateAuthors.length;
  }
  const authorWeight = 0.1;

  // Calculate total weighted score
  const totalScore =
    titleScore * titleWeight +
    yearScore * yearWeight +
    authorScore * authorWeight;

  return Math.round(totalScore * 100) / 100;
}

// Confidence threshold for valid match
export const CONFIDENCE_THRESHOLD = 0.4;
