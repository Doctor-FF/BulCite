import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const doi = request.nextUrl.searchParams.get("doi");

  if (!doi) {
    return NextResponse.json({ error: "DOI is required" }, { status: 400 });
  }

  try {
    const cleanDoi = doi.replace(/[.,;:]+$/, "").trim();
    const url = `https://api.crossref.org/works/${encodeURIComponent(cleanDoi)}`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": "BulCite/1.0 (Citation Resolver Tool)",
      },
    });

    if (!response.ok) {
      return NextResponse.json({ valid: false, error: `DOI not found: ${response.status}` });
    }

    const data = await response.json();
    
    if (!data.message) {
      return NextResponse.json({ valid: false, error: "No data returned" });
    }

    return NextResponse.json({ 
      valid: true, 
      work: {
        DOI: data.message.DOI,
        title: data.message.title,
        author: data.message.author,
        issued: data.message.issued,
        "container-title": data.message["container-title"],
      }
    });
  } catch (error) {
    console.error("CrossRef verify error:", error);
    return NextResponse.json(
      { valid: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
