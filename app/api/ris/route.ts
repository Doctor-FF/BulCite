import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const doi = request.nextUrl.searchParams.get("doi");

  if (!doi) {
    return NextResponse.json({ error: "DOI is required" }, { status: 400 });
  }

  try {
    const response = await fetch(`https://doi.org/${doi}`, {
      headers: {
        Accept: "application/x-research-info-systems",
      },
      redirect: "follow",
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch RIS: ${response.status}` },
        { status: response.status }
      );
    }

    const ris = await response.text();
    return NextResponse.json({ ris });
  } catch (error) {
    console.error("RIS fetch error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
