import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("query");

  if (!query) {
    return NextResponse.json({ error: "Query parameter required" }, { status: 400 });
  }

  try {
    const encoded = encodeURIComponent(query);
    // Adding mailto puts the request in CrossRef's faster "polite pool".
    const url = `https://api.crossref.org/works?query.bibliographic=${encoded}&filter=type:journal-article&select=DOI,title,author,issued,container-title&rows=3&mailto=contact@bulcite.app`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": "BulCite/1.0 (mailto:contact@bulcite.app)",
      },
    });

    if (!response.ok) {
      throw new Error(`CrossRef API error: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("[v0] CrossRef API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
