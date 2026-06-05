import { NextRequest, NextResponse } from "next/server";
import mammoth from "mammoth";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
} from "docx";

// Increase body size limit to 50MB for large DOCX files
export const config = {
  api: {
    bodyParser: false,
  },
};

export const runtime = "nodejs";
export const maxDuration = 60;

// Types
interface RisRecord {
  position: number;
  authorRaw: string | null;
  authorUsed: string | null;
  year: string | null;
  title: string | null;
}

interface MappingEntry {
  wordCitationNumber: number;
  risPosition: number;
  endnoteRecordNumber: number;
  authorRaw: string | null;
  authorUsed: string | null;
  year: string | null;
  title: string | null;
  parsedCitation: string;
  hasWarning: boolean;
  warningMessage: string | null;
}

interface ConversionResult {
  mappingTable: MappingEntry[];
  convertedText: string;
  originalText: string;
  warnings: string[];
  stats: {
    uniqueCitationNumbers: number;
    risRecordCount: number;
    replacementsMade: number;
  };
}

// Extract author surname from raw author field
function extractAuthorUsed(authorRaw: string | null): string {
  if (!authorRaw || authorRaw.trim() === "") return "Unknown";
  
  const trimmed = authorRaw.trim();
  
  // Check if it contains a comma (surname, given name format)
  if (trimmed.includes(",")) {
    const surname = trimmed.split(",")[0].trim();
    return surname || "Unknown";
  }
  
  // Check if it looks like an institutional author (multiple words, no clear surname)
  const words = trimmed.split(/\s+/);
  if (words.length >= 3 && !trimmed.match(/^[A-Z][a-z]+\s+[A-Z]/)) {
    // Likely institutional - keep intact
    return trimmed;
  }
  
  // For "First Last" format, take the last word as surname
  if (words.length >= 2) {
    return words[words.length - 1];
  }
  
  // Single word - use as is
  return trimmed;
}

// Extract 4-digit year from various formats
function extractYear(value: string | null): string {
  if (!value || value.trim() === "") return "n.d.";
  
  const yearMatch = value.match(/(\d{4})/);
  return yearMatch ? yearMatch[1] : "n.d.";
}

// Build EndNote temporary citation for a single record
function buildEndNoteTemporaryCitation(authorUsed: string, year: string, recordNumber: number): string {
  return `${authorUsed}, ${year} #${recordNumber}`;
}

// Parse RIS file and extract records in order
function parseRis(risContent: string): RisRecord[] {
  const records: RisRecord[] = [];
  const entries = risContent.split(/ER\s*-/).filter((entry) => entry.trim());

  entries.forEach((entry, index) => {
    const lines = entry.split("\n");
    let authorRaw: string | null = null;
    let year: string | null = null;
    let title: string | null = null;

    for (const line of lines) {
      const match = line.match(/^([A-Z][A-Z0-9])\s{2}-\s(.*)$/);
      if (match) {
        const [, tag, value] = match;
        const trimmedValue = value.trim();

        // Author (first AU found, then A1 as fallback)
        if (!authorRaw && tag === "AU") {
          authorRaw = trimmedValue;
        } else if (!authorRaw && tag === "A1") {
          authorRaw = trimmedValue;
        }

        // Year (prefer PY, then Y1, then DA)
        if (!year && tag === "PY") {
          year = trimmedValue;
        } else if (!year && tag === "Y1") {
          year = trimmedValue;
        } else if (!year && tag === "DA") {
          year = trimmedValue;
        }

        // Title
        if (!title && (tag === "TI" || tag === "T1" || tag === "BT")) {
          title = trimmedValue;
        }
      }
    }

    records.push({
      position: index + 1,
      authorRaw,
      authorUsed: extractAuthorUsed(authorRaw),
      year: extractYear(year),
      title,
    });
  });

  return records;
}

// Extract citation numbers from text
function extractCitationNumbers(text: string): number[] {
  const citationPattern = /\[([0-9,\-–—\s]+)\]/g;
  const allNumbers: number[] = [];

  let match;
  while ((match = citationPattern.exec(text)) !== null) {
    const content = match[1];

    // Split by comma
    const parts = content.split(",").map((p) => p.trim());

    for (const part of parts) {
      // Check if it's a range (supports hyphen, en-dash, em-dash)
      const rangeMatch = part.match(/(\d+)\s*[-–—]\s*(\d+)/);
      if (rangeMatch) {
        const start = parseInt(rangeMatch[1], 10);
        const end = parseInt(rangeMatch[2], 10);
        for (let i = start; i <= end; i++) {
          allNumbers.push(i);
        }
      } else {
        // Single number
        const num = parseInt(part, 10);
        if (!isNaN(num)) {
          allNumbers.push(num);
        }
      }
    }
  }

  // Remove duplicates and sort
  return [...new Set(allNumbers)].sort((a, b) => a - b);
}

// Build citation mapping
function buildCitationMapping(
  citationNumbers: number[],
  risRecords: RisRecord[],
  startRecordNumber: number
): MappingEntry[] {
  return citationNumbers.map((wordNum, index) => {
    const risPosition = index + 1;
    const endnoteRecordNumber = startRecordNumber + index;
    const risRecord = risRecords[index] || {
      authorRaw: null,
      authorUsed: "Unknown",
      year: "n.d.",
      title: null,
    };

    const authorUsed = risRecord.authorUsed || "Unknown";
    const year = risRecord.year || "n.d.";
    const parsedCitation = `{${buildEndNoteTemporaryCitation(authorUsed, year, endnoteRecordNumber)}}`;
    
    // Determine warnings
    let hasWarning = false;
    let warningMessage: string | null = null;
    
    if (!risRecord.authorRaw && risRecord.year === "n.d.") {
      hasWarning = true;
      warningMessage = "Missing author and year";
    } else if (!risRecord.authorRaw) {
      hasWarning = true;
      warningMessage = "Missing author";
    } else if (risRecord.year === "n.d.") {
      hasWarning = true;
      warningMessage = "Missing year";
    }

    return {
      wordCitationNumber: wordNum,
      risPosition,
      endnoteRecordNumber,
      authorRaw: risRecord.authorRaw,
      authorUsed,
      year,
      title: risRecord.title,
      parsedCitation,
      hasWarning,
      warningMessage,
    };
  });
}

// Convert citations in text
function convertDocxCitations(
  text: string,
  mapping: MappingEntry[]
): { converted: string; replacementCount: number } {
  // Create a lookup from word citation number to mapping entry
  const lookup = new Map<number, MappingEntry>();
  for (const entry of mapping) {
    lookup.set(entry.wordCitationNumber, entry);
  }

  let replacementCount = 0;

  // Replace each citation group
  const converted = text.replace(
    /\[([0-9,\-–—\s]+)\]/g,
    (match, content: string) => {
      const parts = content.split(",").map((p) => p.trim());
      const citationItems: string[] = [];

      for (const part of parts) {
        const rangeMatch = part.match(/(\d+)\s*[-–—]\s*(\d+)/);
        if (rangeMatch) {
          const start = parseInt(rangeMatch[1], 10);
          const end = parseInt(rangeMatch[2], 10);
          for (let i = start; i <= end; i++) {
            const entry = lookup.get(i);
            if (entry) {
              citationItems.push(buildEndNoteTemporaryCitation(
                entry.authorUsed || "Unknown",
                entry.year || "n.d.",
                entry.endnoteRecordNumber
              ));
            }
          }
        } else {
          const num = parseInt(part, 10);
          if (!isNaN(num)) {
            const entry = lookup.get(num);
            if (entry) {
              citationItems.push(buildEndNoteTemporaryCitation(
                entry.authorUsed || "Unknown",
                entry.year || "n.d.",
                entry.endnoteRecordNumber
              ));
            }
          }
        }
      }

      if (citationItems.length > 0) {
        replacementCount++;
        // Format as {Author1, Year1 #1; Author2, Year2 #2}
        return `{${citationItems.join("; ")}}`;
      }

      // If no valid numbers found, return original
      return match;
    }
  );

  return { converted, replacementCount };
}

// Generate CSV from mapping
function generateMappingCsv(mapping: MappingEntry[]): string {
  const headers = [
    "Word Citation Number",
    "RIS Position",
    "EndNote Record Number",
    "Parsed EndNote Citation",
    "Author Raw",
    "Author Used",
    "Year",
    "Title",
    "Warning",
  ];
  const rows = mapping.map((entry) => [
    entry.wordCitationNumber.toString(),
    entry.risPosition.toString(),
    entry.endnoteRecordNumber.toString(),
    `"${entry.parsedCitation}"`,
    `"${(entry.authorRaw || "").replace(/"/g, '""')}"`,
    `"${(entry.authorUsed || "").replace(/"/g, '""')}"`,
    entry.year || "",
    `"${(entry.title || "").replace(/"/g, '""')}"`,
    entry.warningMessage || "",
  ]);

  return [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const docxFile = formData.get("docx") as File | null;
    const risFile = formData.get("ris") as File | null;
    const startRecordNumber = parseInt(
      (formData.get("startRecordNumber") as string) || "1",
      10
    );

    if (!docxFile || !risFile) {
      return NextResponse.json(
        { error: "Both DOCX and RIS files are required" },
        { status: 400 }
      );
    }

    // Parse RIS file
    const risContent = await risFile.text();
    const risRecords = parseRis(risContent);

    // Extract text from DOCX
    const docxBuffer = await docxFile.arrayBuffer();
    const { value: docxText } = await mammoth.extractRawText({
      buffer: Buffer.from(docxBuffer),
    });

    // Extract citation numbers
    const citationNumbers = extractCitationNumbers(docxText);

    // Build warnings
    const warnings: string[] = [];
    if (citationNumbers.length > risRecords.length) {
      warnings.push(
        `The Word document contains ${citationNumbers.length} unique citation numbers, but the RIS file contains only ${risRecords.length} records.`
      );
    }

    // Check for potential range issues
    const maxCitation = Math.max(...citationNumbers, 0);
    const minCitation = Math.min(...citationNumbers, Infinity);
    if (maxCitation - minCitation + 1 !== citationNumbers.length) {
      warnings.push(
        `Note: Citation numbers are not consecutive (${citationNumbers.length} unique numbers from ${minCitation} to ${maxCitation}). This is normal if some references were removed.`
      );
    }

    // Build mapping
    const mapping = buildCitationMapping(
      citationNumbers,
      risRecords,
      startRecordNumber
    );

    // Convert citations
    const { converted, replacementCount } = convertDocxCitations(
      docxText,
      mapping
    );

    // Generate CSV
    const mappingCsv = generateMappingCsv(mapping);

    // Create converted DOCX
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: converted.split("\n\n").map(
            (para) =>
              new Paragraph({
                children: [new TextRun(para)],
              })
          ),
        },
      ],
    });

    const docxBuffer2 = await Packer.toBuffer(doc);

    const result: ConversionResult = {
      mappingTable: mapping,
      convertedText: converted,
      originalText: docxText,
      warnings,
      stats: {
        uniqueCitationNumbers: citationNumbers.length,
        risRecordCount: risRecords.length,
        replacementsMade: replacementCount,
      },
    };

    return NextResponse.json({
      ...result,
      mappingCsv,
      convertedDocxBase64: Buffer.from(docxBuffer2).toString("base64"),
    });
  } catch (error) {
    console.error("[v0] Citation converter error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
