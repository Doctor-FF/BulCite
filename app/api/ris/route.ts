import { NextRequest, NextResponse } from "next/server";

// Generate RIS from CrossRef metadata
function generateRISFromCrossRef(work: {
  DOI?: string;
  title?: string[];
  author?: Array<{ given?: string; family?: string }>;
  issued?: { "date-parts"?: number[][] };
  "container-title"?: string[];
  volume?: string;
  issue?: string;
  page?: string;
  publisher?: string;
  type?: string;
}): string {
  const lines: string[] = [];
  
  // Determine type
  const type = work.type === "journal-article" ? "JOUR" : "GEN";
  lines.push(`TY  - ${type}`);
  
  // Title
  if (work.title?.[0]) {
    lines.push(`TI  - ${work.title[0]}`);
  }
  
  // Authors
  if (work.author) {
    for (const author of work.author) {
      if (author.family) {
        const name = author.given 
          ? `${author.family}, ${author.given}`
          : author.family;
        lines.push(`AU  - ${name}`);
      }
    }
  }
  
  // Year
  if (work.issued?.["date-parts"]?.[0]?.[0]) {
    lines.push(`PY  - ${work.issued["date-parts"][0][0]}`);
  }
  
  // Journal
  if (work["container-title"]?.[0]) {
    lines.push(`JO  - ${work["container-title"][0]}`);
  }
  
  // Volume, Issue, Pages
  if (work.volume) lines.push(`VL  - ${work.volume}`);
  if (work.issue) lines.push(`IS  - ${work.issue}`);
  if (work.page) lines.push(`SP  - ${work.page}`);
  
  // Publisher
  if (work.publisher) {
    lines.push(`PB  - ${work.publisher}`);
  }
  
  // DOI
  if (work.DOI) {
    lines.push(`DO  - ${work.DOI}`);
  }
  
  lines.push(`ER  - `);
  
  return lines.join("\n");
}

export async function GET(request: NextRequest) {
  const doi = request.nextUrl.searchParams.get("doi");

  if (!doi) {
    return NextResponse.json({ error: "DOI is required" }, { status: 400 });
  }

  // Clean DOI - remove trailing punctuation
  const cleanDoi = doi.replace(/[.,;:]+$/, "").trim();

  try {
    // First try doi.org for official RIS
    const response = await fetch(`https://doi.org/${cleanDoi}`, {
      headers: {
        Accept: "application/x-research-info-systems",
      },
      redirect: "follow",
    });

    if (response.ok) {
      const ris = await response.text();
      if (ris && ris.trim() && ris.includes("TY  -")) {
        return NextResponse.json({ ris });
      }
    }

    // Fallback: fetch from CrossRef and generate RIS
    const crossrefResponse = await fetch(
      `https://api.crossref.org/works/${encodeURIComponent(cleanDoi)}`,
      {
        headers: {
          "User-Agent": "BulCite/1.0 (Citation Resolver Tool)",
        },
      }
    );

    if (crossrefResponse.ok) {
      const data = await crossrefResponse.json();
      if (data.message) {
        const ris = generateRISFromCrossRef(data.message);
        return NextResponse.json({ ris, source: "crossref" });
      }
    }

    // If both fail, return error
    return NextResponse.json(
      { error: `DOI not found: ${cleanDoi}` },
      { status: 404 }
    );
  } catch (error) {
    console.error("RIS fetch error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
