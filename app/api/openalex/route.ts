import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("query");

  if (!query) {
    return NextResponse.json({ error: "Query parameter required" }, { status: 400 });
  }

  try {
    const encoded = encodeURIComponent(query);
    const url = `https://api.openalex.org/works?search=${encoded}&per_page=3&mailto=bulcite@example.com`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": "BulCite/1.0 (Citation Resolver Tool; mailto:bulcite@example.com)",
      },
    });

    if (!response.ok) {
      throw new Error(`OpenAlex API error: ${response.status}`);
    }

    const data = await response.json();
    const results = (data.results || []).map((work: {
      title?: string;
      publication_year?: number;
      authorships?: Array<{ author: { display_name: string } }>;
      doi?: string;
      primary_location?: { source?: { display_name?: string } };
    }) => ({
      title: work.title || "",
      year: work.publication_year || null,
      authors: work.authorships?.map((a) => a.author?.display_name).filter(Boolean) || [],
      doi: work.doi?.replace("https://doi.org/", "") || null,
      journal: work.primary_location?.source?.display_name || null,
    }));

    return NextResponse.json({ results });
  } catch (error) {
    console.error("[v0] OpenAlex API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
