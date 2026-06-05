import { ThemeProvider } from "@/components/theme-provider";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "BulCite - Citation Tools Suite",
  description:
    "Advanced citation tools including ISI Citation Resolver with fuzzy matching, multi-tier API lookup, RIS export, and IEEE to EndNote converter.",
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
