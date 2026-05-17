import { ThemeProvider } from "@/components/theme-provider";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Citation Resolver - ISI Citation Resolver & RIS Exporter",
  description:
    "Advanced ISI Citation Resolver with fuzzy matching, multi-tier API lookup, and RIS export functionality.",
};

export default function CitationResolverLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </ThemeProvider>
  );
}
