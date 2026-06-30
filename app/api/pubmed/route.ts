import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("query");

  if (!query) {
    return NextResponse.json({ error: "Query parameter required" }, { status: 400 });
  }

  try {
    const encoded = encodeURIComponent(query);
    // NCBI recommends identifying tool & email; helps with rate limits.
    const ncbiParams = "&tool=bulcite&email=contact@bulcite.app";

    // Step 1: Search for PMIDs
    const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encoded}&retmax=3&retmode=json${ncbiParams}`;
    const searchResponse = await fetch(searchUrl);
    
    if (!searchResponse.ok) {
      throw new Error(`PubMed search error: ${searchResponse.status}`);
    }
    
    const searchData = await searchResponse.json();
    const pmids: string[] = searchData.esearchresult?.idlist || [];
    
    if (pmids.length === 0) {
      return NextResponse.json({ results: [] });
    }
    
    // Step 2: Fetch details for each PMID
    const idsParam = pmids.join(",");
    const summaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${idsParam}&retmode=json${ncbiParams}`;
    const summaryResponse = await fetch(summaryUrl);
    
    if (!summaryResponse.ok) {
      throw new Error(`PubMed summary error: ${summaryResponse.status}`);
    }
    
    const summaryData = await summaryResponse.json();
    const results = pmids.map((pmid) => {
      const article = summaryData.result?.[pmid];
      if (!article) return null;
      
      return {
        pmid,
        title: article.title || "",
        authors: article.authors?.map((a: { name: string }) => a.name) || [],
        year: article.pubdate ? parseInt(article.pubdate.substring(0, 4), 10) : null,
        journal: article.source || null,
        doi: article.elocationid?.replace("doi: ", "") || null,
      };
    }).filter(Boolean);
    
    return NextResponse.json({ results });
  } catch (error) {
    console.error("[v0] PubMed API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
