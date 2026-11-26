/**
 * Foundry Stage 3 — Document Extraction Engine (Phase 14)
 * Format-aware document parsing with structural segmentation,
 * source reference preservation, and truthful unsupported-format error handling.
 */

export interface ExtractedChunk {
  chunkIndex: number;
  content: string;
  tokenCount: number;
  metadata: {
    documentName: string;
    courseId?: string | null;
    pageNumber?: number;
    slideNumber?: number;
    sheetName?: string;
    sectionHeading?: string;
    revision: number;
  };
}

export interface ExtractionResult {
  ok: boolean;
  format: string;
  sourceType: string;
  fullText: string;
  summary: string;
  chunks: ExtractedChunk[];
  metadata: Record<string, any>;
  error?: string;
  unsupported?: boolean;
}

export class DocumentExtractor {
  /**
   * Determine format from filename and mimeType
   */
  public static detectFormat(fileName: string, mimeType?: string): string {
    const ext = fileName.toLowerCase().split(".").pop() || "";
    if (["txt", "text"].includes(ext) || mimeType?.includes("text/plain")) return "txt";
    if (["md", "markdown"].includes(ext) || mimeType?.includes("markdown")) return "md";
    if (["csv"].includes(ext) || mimeType?.includes("text/csv")) return "csv";
    if (["html", "htm"].includes(ext) || mimeType?.includes("text/html")) return "html";
    if (["pdf"].includes(ext) || mimeType?.includes("application/pdf")) return "pdf";
    if (["docx"].includes(ext) || mimeType?.includes("wordprocessingml")) return "docx";
    if (["pptx"].includes(ext) || mimeType?.includes("presentationml")) return "pptx";
    if (["xlsx"].includes(ext) || mimeType?.includes("spreadsheetml")) return "xlsx";
    if (mimeType?.includes("google-apps.document")) return "google_doc";
    if (mimeType?.includes("google-apps.presentation")) return "google_slides";
    if (mimeType?.includes("google-apps.spreadsheet")) return "google_sheets";
    return ext || "unknown";
  }

  /**
   * Extract text and generate chunks from content
   */
  public static extract(
    fileName: string,
    rawContent: string | ArrayBuffer,
    options?: {
      mimeType?: string;
      sourceType?: string;
      courseId?: string | null;
      revision?: number;
      chunkSize?: number;
      chunkOverlap?: number;
    }
  ): ExtractionResult {
    const format = this.detectFormat(fileName, options?.mimeType);
    const revision = options?.revision || 1;
    const courseId = options?.courseId || null;
    const chunkSize = options?.chunkSize || 450;
    const overlap = options?.chunkOverlap || 50;

    let fullText = "";
    const sections: Array<{ text: string; page?: number; slide?: number; sheet?: string; heading?: string }> = [];

    if (typeof rawContent !== "string") {
      // Binary content check
      if (["exe", "bin", "zip", "tar", "iso", "dll", "so", "unknown"].includes(format)) {
        return {
          ok: false,
          format,
          sourceType: options?.sourceType || "local",
          fullText: "",
          summary: "",
          chunks: [],
          metadata: {},
          unsupported: true,
          error: `Format ".${format}" is not supported for text extraction.`,
        };
      }
      // Convert buffer to string if possible
      try {
        const decoder = new TextDecoder("utf-8");
        fullText = decoder.decode(rawContent);
      } catch {
        return {
          ok: false,
          format,
          sourceType: options?.sourceType || "local",
          fullText: "",
          summary: "",
          chunks: [],
          metadata: {},
          unsupported: true,
          error: `Failed to decode binary content for "${fileName}".`,
        };
      }
    } else {
      fullText = rawContent;
    }

    if (!fullText.trim()) {
      return {
        ok: false,
        format,
        sourceType: options?.sourceType || "local",
        fullText: "",
        summary: "",
        chunks: [],
        metadata: {},
        error: "Document content is empty.",
      };
    }

    // Format-aware parsing
    switch (format) {
      case "md":
      case "markdown": {
        // Heading-aware segmentation
        const lines = fullText.split("\n");
        let currentHeading = "Overview";
        let currentBuffer: string[] = [];

        for (const line of lines) {
          const headingMatch = line.match(/^#{1,4}\s+(.+)$/);
          if (headingMatch) {
            if (currentBuffer.length > 0) {
              sections.push({ text: currentBuffer.join("\n").trim(), heading: currentHeading });
              currentBuffer = [];
            }
            currentHeading = headingMatch[1].trim();
          } else {
            currentBuffer.push(line);
          }
        }
        if (currentBuffer.length > 0) {
          sections.push({ text: currentBuffer.join("\n").trim(), heading: currentHeading });
        }
        break;
      }

      case "pdf": {
        // Page boundary detection (e.g. --- Page X --- or FormFeed \f)
        const pages = fullText.split(/(?:--- Page \d+ ---|\f)/i);
        pages.forEach((p, idx) => {
          const clean = p.trim();
          if (clean) sections.push({ text: clean, page: idx + 1, heading: `Page ${idx + 1}` });
        });
        break;
      }

      case "pptx":
      case "google_slides": {
        // Slide boundary detection (e.g. --- Slide X ---)
        const slides = fullText.split(/(?:--- Slide \d+ ---|## Slide \d+:?)/i);
        slides.forEach((s, idx) => {
          const clean = s.trim();
          if (clean) sections.push({ text: clean, slide: idx + 1, heading: `Slide ${idx + 1}` });
        });
        break;
      }

      case "xlsx":
      case "google_sheets": {
        // Worksheet boundary detection (e.g. [Sheet: SheetName])
        const sheets = fullText.split(/(?:\[Sheet:\s*([^\]]+)\])/i);
        if (sheets.length > 1) {
          for (let i = 1; i < sheets.length; i += 2) {
            const sheetName = sheets[i];
            const content = sheets[i + 1] || "";
            if (content.trim()) {
              sections.push({ text: content.trim(), sheet: sheetName, heading: `Sheet: ${sheetName}` });
            }
          }
        } else {
          sections.push({ text: fullText.trim(), sheet: "Sheet1", heading: "Sheet1" });
        }
        break;
      }

      case "csv": {
        // Tabular structure normalization
        const rows = fullText.split("\n").filter((r) => r.trim());
        const header = rows[0] || "Columns";
        // Chunk by groups of 10 rows
        for (let i = 1; i < rows.length; i += 10) {
          const chunkRows = rows.slice(i, i + 10);
          sections.push({
            text: `Columns: ${header}\n${chunkRows.join("\n")}`,
            heading: `Rows ${i}–${Math.min(i + 9, rows.length - 1)}`,
          });
        }
        break;
      }

      case "html": {
        // Strip tags, script, style while preserving text and structure
        const cleaned = fullText
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
          .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
          .replace(/<h[1-4][^>]*>(.*?)<\/h[1-4]>/gi, "\n\n### $1\n")
          .replace(/<\/p>/gi, "\n\n")
          .replace(/<br\s*\/?>/gi, "\n")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim();

        // Split by markdown headings if generated
        const parts = cleaned.split(/(?=### )/);
        parts.forEach((part) => {
          if (part.trim()) sections.push({ text: part.trim(), heading: "Section" });
        });
        break;
      }

      default: {
        // Plain text / default fallback: paragraph-aware splitting
        const paragraphs = fullText.split(/\n\s*\n/);
        paragraphs.forEach((p) => {
          if (p.trim()) sections.push({ text: p.trim(), heading: "Notes" });
        });
        break;
      }
    }

    if (sections.length === 0) {
      sections.push({ text: fullText.trim(), heading: "Document Content" });
    }

    // Generate Chunks with overlap and source reference metadata
    const chunks: ExtractedChunk[] = [];
    let chunkCounter = 0;

    for (const sec of sections) {
      const text = sec.text;
      if (text.length <= chunkSize) {
        chunks.push({
          chunkIndex: chunkCounter++,
          content: text,
          tokenCount: Math.ceil(text.length / 4),
          metadata: {
            documentName: fileName,
            courseId,
            pageNumber: sec.page,
            slideNumber: sec.slide,
            sheetName: sec.sheet,
            sectionHeading: sec.heading,
            revision,
          },
        });
      } else {
        // Split section with overlap
        let start = 0;
        while (start < text.length) {
          const end = Math.min(start + chunkSize, text.length);
          const chunkText = text.slice(start, end).trim();
          if (chunkText) {
            chunks.push({
              chunkIndex: chunkCounter++,
              content: chunkText,
              tokenCount: Math.ceil(chunkText.length / 4),
              metadata: {
                documentName: fileName,
                courseId,
                pageNumber: sec.page,
                slideNumber: sec.slide,
                sheetName: sec.sheet,
                sectionHeading: sec.heading,
                revision,
              },
            });
          }
          if (end >= text.length) break;
          start += chunkSize - overlap;
        }
      }
    }

    // Build brief summary
    const summary = fullText.slice(0, 200).replace(/\s+/g, " ").trim() + (fullText.length > 200 ? "..." : "");

    return {
      ok: true,
      format,
      sourceType: options?.sourceType || "local",
      fullText,
      summary,
      chunks,
      metadata: {
        totalCharacters: fullText.length,
        totalChunks: chunks.length,
        estimatedTokens: Math.ceil(fullText.length / 4),
        sectionsCount: sections.length,
        revision,
      },
    };
  }
}
