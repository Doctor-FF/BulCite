"use client";

import { useState, useCallback } from "react";
import { Upload, Download, FileText, AlertTriangle, CheckCircle, Loader2 } from "lucide-react";
import { GlassPanel } from "./components/glass-panel";

interface MappingEntry {
  wordCitationNumber: number;
  risPosition: number;
  endnoteRecordNumber: number;
  author: string | null;
  year: string | null;
  title: string | null;
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
  mappingCsv: string;
  convertedDocxBase64: string;
}

export default function CitationConverterClient() {
  const [docxFile, setDocxFile] = useState<File | null>(null);
  const [risFile, setRisFile] = useState<File | null>(null);
  const [startRecordNumber, setStartRecordNumber] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<ConversionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDocxChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.name.endsWith(".docx")) {
      setDocxFile(file);
      setError(null);
    } else if (file) {
      setError("Please upload a .docx file");
    }
  }, []);

  const handleRisChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.name.endsWith(".ris")) {
      setRisFile(file);
      setError(null);
    } else if (file) {
      setError("Please upload a .ris file");
    }
  }, []);

  const handleConvert = async () => {
    if (!docxFile || !risFile) {
      setError("Please upload both DOCX and RIS files");
      return;
    }

    setIsProcessing(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("docx", docxFile);
      formData.append("ris", risFile);
      formData.append("startRecordNumber", startRecordNumber.toString());

      const response = await fetch("/api/citation-converter", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Conversion failed");
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadConvertedDocx = () => {
    if (!result?.convertedDocxBase64 || !docxFile) return;

    const binary = atob(result.convertedDocxBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const blob = new Blob([bytes], {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

    const originalName = docxFile.name.replace(".docx", "");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${originalName}_endnote_ready.docx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadMappingCsv = () => {
    if (!result?.mappingCsv) return;

    const blob = new Blob([result.mappingCsv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "citation_mapping.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Description */}
      <GlassPanel>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
            <FileText className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h2 className="text-lg font-medium text-neutral-800 dark:text-white mb-1">
              IEEE to EndNote Temporary Citation Converter
            </h2>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Upload a Word document and RIS file. The tool maps the citation numbers used in 
              the Word document to RIS order, then converts plain-text IEEE citations like [8] 
              and [10] into EndNote temporary citations like {"{#8}"} and {"{#9}"}.
            </p>
          </div>
        </div>
      </GlassPanel>

      {/* Upload Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* DOCX Upload */}
        <GlassPanel>
          <h3 className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-3">
            Word Document (.docx)
          </h3>
          <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-neutral-300 dark:border-neutral-600 rounded-xl cursor-pointer hover:border-neutral-400 dark:hover:border-neutral-500 transition-colors">
            <input
              type="file"
              accept=".docx"
              onChange={handleDocxChange}
              className="hidden"
            />
            <Upload className="h-8 w-8 text-neutral-400 mb-2" />
            {docxFile ? (
              <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                {docxFile.name}
              </span>
            ) : (
              <span className="text-sm text-neutral-500">Click to upload .docx</span>
            )}
          </label>
        </GlassPanel>

        {/* RIS Upload */}
        <GlassPanel>
          <h3 className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-3">
            RIS Reference File (.ris)
          </h3>
          <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-neutral-300 dark:border-neutral-600 rounded-xl cursor-pointer hover:border-neutral-400 dark:hover:border-neutral-500 transition-colors">
            <input
              type="file"
              accept=".ris"
              onChange={handleRisChange}
              className="hidden"
            />
            <Upload className="h-8 w-8 text-neutral-400 mb-2" />
            {risFile ? (
              <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                {risFile.name}
              </span>
            ) : (
              <span className="text-sm text-neutral-500">Click to upload .ris</span>
            )}
          </label>
        </GlassPanel>
      </div>

      {/* Start Record Number + Convert Button */}
      <GlassPanel>
        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
              Start EndNote Record Number
            </label>
            <input
              type="number"
              min="1"
              value={startRecordNumber}
              onChange={(e) => setStartRecordNumber(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full sm:w-32 px-3 py-2 rounded-lg bg-white/50 dark:bg-black/20 border border-neutral-200/50 dark:border-white/[0.05] text-neutral-800 dark:text-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300 dark:focus:ring-white/20"
            />
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              The record number of the first imported RIS entry in EndNote
            </p>
          </div>
          <button
            onClick={handleConvert}
            disabled={!docxFile || !risFile || isProcessing}
            className="px-6 py-2.5 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-medium text-sm hover:bg-neutral-800 dark:hover:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              "Analyze and Convert"
            )}
          </button>
        </div>
      </GlassPanel>

      {/* Warning Panel */}
      <GlassPanel className="bg-amber-50/50 dark:bg-amber-500/[0.05] border-amber-200/50 dark:border-amber-500/20">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800 dark:text-amber-300">
            If a citation range such as [8-10] is used, the tool treats it as [8], [9], and [10]. 
            If reference 9 was intentionally removed from your reference list, use [8,10] instead 
            to avoid mapping errors.
          </p>
        </div>
      </GlassPanel>

      {/* Error Display */}
      {error && (
        <GlassPanel className="bg-red-50/50 dark:bg-red-500/[0.05] border-red-200/50 dark:border-red-500/20">
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </GlassPanel>
      )}

      {/* Results */}
      {result && (
        <>
          {/* Stats */}
          <GlassPanel>
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle className="h-5 w-5 text-emerald-500" />
              <h3 className="text-lg font-medium text-neutral-800 dark:text-white">
                Conversion Complete
              </h3>
            </div>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center p-3 rounded-lg bg-neutral-100/50 dark:bg-white/[0.03]">
                <div className="text-2xl font-bold text-neutral-800 dark:text-white">
                  {result.stats.uniqueCitationNumbers}
                </div>
                <div className="text-xs text-neutral-500 dark:text-neutral-400">
                  Unique Citations
                </div>
              </div>
              <div className="text-center p-3 rounded-lg bg-neutral-100/50 dark:bg-white/[0.03]">
                <div className="text-2xl font-bold text-neutral-800 dark:text-white">
                  {result.stats.risRecordCount}
                </div>
                <div className="text-xs text-neutral-500 dark:text-neutral-400">
                  RIS Records
                </div>
              </div>
              <div className="text-center p-3 rounded-lg bg-neutral-100/50 dark:bg-white/[0.03]">
                <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {result.stats.replacementsMade}
                </div>
                <div className="text-xs text-neutral-500 dark:text-neutral-400">
                  Replacements
                </div>
              </div>
            </div>

            {/* Warnings */}
            {result.warnings.length > 0 && (
              <div className="mb-4 space-y-2">
                {result.warnings.map((warning, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 p-2 rounded-lg bg-amber-100/50 dark:bg-amber-500/10"
                  >
                    <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-800 dark:text-amber-300">{warning}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Download Buttons */}
            <div className="flex flex-wrap gap-3">
              <button
                onClick={downloadConvertedDocx}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium transition-colors"
              >
                <Download className="h-4 w-4" />
                Download Converted DOCX
              </button>
              <button
                onClick={downloadMappingCsv}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-neutral-200 dark:bg-white/10 hover:bg-neutral-300 dark:hover:bg-white/20 text-neutral-800 dark:text-white text-sm font-medium transition-colors"
              >
                <Download className="h-4 w-4" />
                Download Mapping CSV
              </button>
            </div>
          </GlassPanel>

          {/* Success Message */}
          <GlassPanel className="bg-emerald-50/50 dark:bg-emerald-500/[0.05] border-emerald-200/50 dark:border-emerald-500/20">
            <p className="text-sm text-emerald-800 dark:text-emerald-300">
              Open the converted Word file in Microsoft Word, open the correct EndNote library, 
              then click <strong>EndNote → Update Citations and Bibliography</strong> to finalize 
              the citations.
            </p>
          </GlassPanel>

          {/* Mapping Table */}
          <GlassPanel>
            <h3 className="text-lg font-medium text-neutral-800 dark:text-white mb-4">
              Citation Mapping Table
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 dark:border-white/10">
                    <th className="text-left py-2 px-2 text-neutral-600 dark:text-neutral-400 font-medium">
                      Word [#]
                    </th>
                    <th className="text-left py-2 px-2 text-neutral-600 dark:text-neutral-400 font-medium">
                      RIS Pos
                    </th>
                    <th className="text-left py-2 px-2 text-neutral-600 dark:text-neutral-400 font-medium">
                      EndNote {"{#}"}
                    </th>
                    <th className="text-left py-2 px-2 text-neutral-600 dark:text-neutral-400 font-medium">
                      Author
                    </th>
                    <th className="text-left py-2 px-2 text-neutral-600 dark:text-neutral-400 font-medium">
                      Year
                    </th>
                    <th className="text-left py-2 px-2 text-neutral-600 dark:text-neutral-400 font-medium">
                      Title
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {result.mappingTable.map((entry, i) => (
                    <tr
                      key={i}
                      className="border-b border-neutral-100 dark:border-white/5 hover:bg-neutral-50/50 dark:hover:bg-white/[0.02]"
                    >
                      <td className="py-2 px-2 text-neutral-800 dark:text-neutral-200">
                        [{entry.wordCitationNumber}]
                      </td>
                      <td className="py-2 px-2 text-neutral-600 dark:text-neutral-400">
                        {entry.risPosition}
                      </td>
                      <td className="py-2 px-2 text-emerald-600 dark:text-emerald-400 font-medium">
                        {"{#"}{entry.endnoteRecordNumber}{"}"}
                      </td>
                      <td className="py-2 px-2 text-neutral-600 dark:text-neutral-400 max-w-[150px] truncate">
                        {entry.author || "—"}
                      </td>
                      <td className="py-2 px-2 text-neutral-600 dark:text-neutral-400">
                        {entry.year || "—"}
                      </td>
                      <td className="py-2 px-2 text-neutral-600 dark:text-neutral-400 max-w-[250px] truncate">
                        {entry.title || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </GlassPanel>
        </>
      )}
    </div>
  );
}
