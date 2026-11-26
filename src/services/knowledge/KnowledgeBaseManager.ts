/**
 * Foundry Stage 3 — Knowledge Base Manager (Phase 13)
 * Manages document hierarchy, import validation, format-aware extraction,
 * folder categorizations, course tagging, and search.
 */
import { DocumentExtractor, ExtractionResult } from "./DocumentExtractor";
import { sharedDatabaseClient, KnowledgeDocument } from "../data/SharedDatabaseClient";
import { eventBus, FOUNDRY_EVENTS } from "../EventBus";

export interface KnowledgeFolder {
  id: string;
  name: string;
  courseId?: string | null;
  parentId?: string | null;
  documentCount?: number;
}

export const SUPPORTED_EXTRACTION_FORMATS = [
  { ext: "txt", name: "Plain Text", mime: "text/plain" },
  { ext: "md", name: "Markdown", mime: "text/markdown" },
  { ext: "csv", name: "CSV Table", mime: "text/csv" },
  { ext: "html", name: "HTML Page", mime: "text/html" },
  { ext: "pdf", name: "PDF Document", mime: "application/pdf" },
  { ext: "docx", name: "Word Document", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
  { ext: "pptx", name: "PowerPoint Deck", mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation" },
  { ext: "xlsx", name: "Excel Sheet", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
  { ext: "gdoc", name: "Google Doc", mime: "application/vnd.google-apps.document" },
  { ext: "gslides", name: "Google Slides", mime: "application/vnd.google-apps.presentation" },
  { ext: "gsheet", name: "Google Sheets", mime: "application/vnd.google-apps.spreadsheet" },
];

export class KnowledgeBaseManager {
  private folders: KnowledgeFolder[] = [
    { id: "folder-lectures", name: "Lecture Notes", courseId: "CS-304" },
    { id: "folder-labs", name: "Labs & Projects", courseId: "CS-304" },
    { id: "folder-readings", name: "Required Readings", courseId: "CS-304" },
    { id: "folder-math", name: "Linear Algebra Notes", courseId: "MATH-240" },
    { id: "folder-phys", name: "Mechanics Notes", courseId: "PHYS-210" },
  ];

  public getFolders(courseId?: string): KnowledgeFolder[] {
    if (!courseId) return this.folders;
    return this.folders.filter((f) => !f.courseId || f.courseId === courseId);
  }

  public createFolder(name: string, courseId?: string | null): KnowledgeFolder {
    const f: KnowledgeFolder = {
      id: `f_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: name.trim(),
      courseId: courseId || null,
    };
    this.folders.push(f);
    return f;
  }

  public getSupportedFormats() {
    return SUPPORTED_EXTRACTION_FORMATS;
  }

  /**
   * Import document from text or file content
   */
  public async importDocument(params: {
    name: string;
    content: string | ArrayBuffer;
    sourceType: KnowledgeDocument["sourceType"];
    mimeType?: string;
    courseId?: string | null;
    assignmentId?: string | null;
    tags?: string[];
  }): Promise<{ success: boolean; document?: KnowledgeDocument; extraction?: ExtractionResult; error?: string }> {
    try {
      const { name, content, sourceType, mimeType, courseId, assignmentId, tags = [] } = params;
      const extraction = DocumentExtractor.extract(name, content, {
        mimeType,
        sourceType,
        courseId,
      });

      if (!extraction.ok && extraction.unsupported) {
        return {
          success: false,
          extraction,
          error: extraction.error || "Unsupported file format.",
        };
      }

      const docId = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const docPayload: Partial<KnowledgeDocument> & { name: string; sourceType: KnowledgeDocument["sourceType"]; mimeType: string } = {
        id: docId,
        name,
        sourceType,
        mimeType: mimeType || "text/plain",
        workspaceId: "default",
        courseId: courseId || null,
        assignmentId: assignmentId || null,
        fileSize: typeof content === "string" ? content.length : content.byteLength,
        tags,
        extractionStatus: extraction.ok ? "extracted" : "failed",
        indexingStatus: extraction.ok ? "indexed" : "failed",
        revision: 1,
        extractedText: extraction.fullText,
        summary: extraction.summary,
      };

      const savedDoc = await sharedDatabaseClient.upsertDocument(docPayload);
      if (!savedDoc) {
        return { success: false, error: "Failed to persist document to database." };
      }

      // Save chunks to database
      if (extraction.chunks.length > 0) {
        await fetch(`/api/knowledge/documents/${encodeURIComponent(docId)}/chunks`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            extraction.chunks.map((c) => ({
              id: `${docId}_chunk_${c.chunkIndex}`,
              documentId: docId,
              chunkIndex: c.chunkIndex,
              content: c.content,
              metadata: c.metadata,
              tokenCount: c.tokenCount,
              createdAt: Date.now(),
            }))
          ),
        }).catch(() => {});
      }

      eventBus.emit(FOUNDRY_EVENTS.STORAGE_STATE_CHANGED, { action: "import", documentId: docId }, "knowledge-base");
      return { success: true, document: savedDoc, extraction };
    } catch (e: any) {
      return { success: false, error: e?.message || "Document import failed." };
    }
  }

  /**
   * Search Knowledge Base documents
   */
  public async search(query: string, courseId?: string): Promise<KnowledgeDocument[]> {
    return sharedDatabaseClient.fetchDocuments({ query, courseId });
  }

  public async deleteDocument(id: string): Promise<boolean> {
    return sharedDatabaseClient.deleteDocument(id);
  }
}

export const knowledgeBaseManager = new KnowledgeBaseManager();
