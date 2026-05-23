import { NextRequest, NextResponse } from "next/server";

// Helper to delay execution
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Retry with exponential backoff
async function fetchWithRetry(url: string, maxRetries = 3): Promise<Response> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "BulCite/1.0 (Citation Resolver Tool)",
      },
    });
    
    if (response.ok) {
      return response;
    }
    
    // If rate limited (429), wait and retry
    if (response.status === 429 && attempt < maxRetries - 1) {
      const waitTime = Math.pow(2, attempt + 1) * 1000; // 2s, 4s, 8s
      console.log(`[v0] Semantic Scholar rate limited, waiting ${waitTime}ms before retry...`);
      await delay(waitTime);
      continue;
    }
    
    // For other errors or final retry, throw
    throw new Error(`Semantic Scholar API error: ${response.status}`);
  }
  
  throw new Error("Max retries exceeded");
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("query");

  if (!query) {
    return NextResponse.json({ error: "Query parameter required" }, { status: 400 });
  }

  try {
    const encoded = encodeURIComponent(query);
    const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encoded}&limit=3&fields=title,year,authors,externalIds,venue`;

    const response = await fetchWithRetry(url);
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("[v0] Semantic Scholar API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
