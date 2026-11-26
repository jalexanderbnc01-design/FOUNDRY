/**
 * Foundry Stage 3 — Educational Application Data Adapters (Phase 23)
 * Bridges structured course, assignment, and Knowledge Base data with
 * Digital Flashcards, Finals Study Guide, Essay to Slides, Choice Board,
 * Countdown, Student Command Center, UDL Planner, and the Whiteboard Canvas.
 */
import { sharedDatabaseClient, KnowledgeDocument, AcademicAssignment } from "../data/SharedDatabaseClient";
import { RetrievedChunk } from "../rag/RAGEngine";
import { eventBus, FOUNDRY_EVENTS } from "../EventBus";

export class ApplicationDataAdapters {
  // --- Digital Flashcards Studio Adapter ---
  public async importCardsToFlashcardStudio(
    deckTitle: string,
    cards: Array<{ front: string; back: string; hint?: string; sourceRef?: any }>,
    courseId = "CS-304"
  ): Promise<{ ok: boolean; deckId?: string; cardCount: number }> {
    try {
      const deckResp = await fetch("/api/academic/flashcards/decks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: deckTitle,
          courseId,
          tags: ["generated", "rag"],
        }),
      });
      const deckData = await deckResp.json();
      if (!deckData.ok || !deckData.deck) throw new Error("Failed to create flashcard deck");

      const deckId = deckData.deck.id;
      for (const c of cards) {
        await fetch("/api/academic/flashcards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deckId,
            front: c.front,
            back: c.back,
            hint: c.hint,
            sourceRef: c.sourceRef,
          }),
        });
      }

      eventBus.emit(FOUNDRY_EVENTS.APP_OPENED, { appId: "digital-flashcards", deckId }, "adapters");
      return { ok: true, deckId, cardCount: cards.length };
    } catch (e: any) {
      return { ok: false, cardCount: 0 };
    }
  }

  // --- Finals Study Guide Adapter ---
  public async importToStudyGuide(
    title: string,
    sections: Array<{ heading: string; content: string; keyTerms?: string[] }>,
    courseId = "CS-304"
  ): Promise<{ ok: boolean; guideId?: string }> {
    try {
      const guideId = `guide_${Date.now()}`;
      await sharedDatabaseClient.upsertNote({
        id: guideId,
        courseId,
        title,
        content: sections.map((s) => `## ${s.heading}\n${s.content}`).join("\n\n"),
        format: "markdown",
        tags: ["study_guide", "finals"],
      });

      eventBus.emit(FOUNDRY_EVENTS.APP_OPENED, { appId: "finals-study-guide", guideId }, "adapters");
      return { ok: true, guideId };
    } catch {
      return { ok: false };
    }
  }

  // --- Essay to Slides Adapter ---
  public formatEssayIntoSlidesOutline(
    essayTitle: string,
    essayText: string
  ): Array<{ slideTitle: string; bullets: string[] }> {
    const paragraphs = essayText.split(/\n\s*\n/).filter((p) => p.trim());
    const slides: Array<{ slideTitle: string; bullets: string[] }> = [];

    // Title slide
    slides.push({
      slideTitle: essayTitle || "Presentation",
      bullets: ["Structured Overview & Analysis", "Automated Slide Outline"],
    });

    paragraphs.forEach((p, idx) => {
      const sentences = p.split(/(?<=[.!?])\s+/).filter(Boolean);
      const title = sentences[0]?.slice(0, 45) || `Point ${idx + 1}`;
      const bullets = sentences.slice(0, 3).map((s) => s.trim());
      slides.push({
        slideTitle: title,
        bullets: bullets.length > 0 ? bullets : [p.slice(0, 100)],
      });
    });

    return slides;
  }

  // --- Countdown & Milestones Adapter ---
  public async getCountdownMilestones(courseId?: string): Promise<Array<{ id: string; title: string; due: string; status: string }>> {
    const assignments = await sharedDatabaseClient.fetchAssignments(courseId);
    return assignments.map((a) => ({
      id: a.id,
      title: a.title,
      due: a.dueDate,
      status: a.status,
    }));
  }

  // --- Whiteboard Canvas Reference Cards ---
  public buildCanvasStickyFromChunk(chunk: RetrievedChunk, pos = { x: 0, y: 0 }) {
    const docName = chunk.metadata.documentName || "Document";
    const loc = chunk.metadata.pageNumber
      ? ` (p. ${chunk.metadata.pageNumber})`
      : chunk.metadata.slideNumber
      ? ` (slide ${chunk.metadata.slideNumber})`
      : "";

    return {
      id: `sticky_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: "sticky",
      x: pos.x,
      y: pos.y,
      width: 200,
      height: 180,
      color: "#bae6fd", // pastel sky
      content: `📌 [${docName}${loc}]\n\n${chunk.content.slice(0, 240)}...`,
      zIndex: 20,
    };
  }

  public buildCanvasNoteFromDocument(doc: KnowledgeDocument, pos = { x: 0, y: 0 }) {
    return {
      id: `card_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: "sticky",
      x: pos.x,
      y: pos.y,
      width: 240,
      height: 200,
      color: "#fef08a", // pastel yellow
      content: `📄 ${doc.name}\nType: ${doc.sourceType}\nRevs: ${doc.revision}\n\n${doc.summary || doc.extractedText?.slice(0, 160) || "No preview"}`,
      zIndex: 20,
    };
  }
}

export const applicationDataAdapters = new ApplicationDataAdapters();
