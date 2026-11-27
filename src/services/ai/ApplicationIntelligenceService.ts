/**
 * Foundry Stage 4 — Application Intelligence Service (Phase 25)
 * Central coordinator routing all educational application AI requests through the
 * core Foundry AI Service, Context Manager, Knowledge Base, and Ollama.
 * Enforces structured schema validation, assistant profiles, and lifecycle tracking.
 */

import { foundryAIService } from "./FoundryAIService";
import { aiContextManager } from "./AIContextManager";
import { sharedContextManager } from "../SharedContextManager";
import { ragEngine } from "../rag/RAGEngine";
import { aiMemoryManager } from "./AIMemoryManager";
import { sharedDatabaseClient } from "../data/SharedDatabaseClient";
import { eventBus, FOUNDRY_EVENTS } from "../EventBus";

export type ApplicationAssistantId =
  | "deadline_assistant"
  | "argument_assistant"
  | "study_assistant"
  | "recall_assistant"
  | "academic_manager"
  | "teaching_assistant"
  | "lesson_assistant"
  | "choice_assistant";

export interface ApplicationAssistantProfile {
  id: ApplicationAssistantId;
  name: string;
  role: string;
  systemPrompt: string;
  supportedApps: string[];
  outputSchemaName: string;
  temperature: number;
}

export const APPLICATION_ASSISTANT_PROFILES: Record<ApplicationAssistantId, ApplicationAssistantProfile> = {
  deadline_assistant: {
    id: "deadline_assistant",
    name: "Deadline & Milestone Assistant",
    role: "Scheduling and backward planning for assignments and exams",
    systemPrompt:
      "You are the Foundry Deadline Assistant. You specialize in calculating backward study schedules, realistic milestones, and priority sequences from deadlines. Always return structured JSON with actionable milestones.",
    supportedApps: ["countdown", "student-command-center", "session-timer"],
    outputSchemaName: "countdown_plan",
    temperature: 0.2,
  },
  argument_assistant: {
    id: "argument_assistant",
    name: "Argument & Presentation Assistant",
    role: "Structuring academic essays into coherent, claim-driven presentation slides",
    systemPrompt:
      "You are the Foundry Argument Assistant. You analyze academic essays, extract the central thesis, supporting claims, evidence, and counterarguments, and convert them into clear, claim-first presentation slides. Each slide title must communicate an assertion, not a generic topic.",
    supportedApps: ["essay-to-slides", "foundry-whiteboard"],
    outputSchemaName: "presentation_deck",
    temperature: 0.3,
  },
  study_assistant: {
    id: "study_assistant",
    name: "Study Guide & Mastery Assistant",
    role: "Generating structured review guides, definitions, and active recall checks",
    systemPrompt:
      "You are the Foundry Study Assistant. You synthesize course documents, notes, and textbook excerpts into Kindle-style study guides with core concepts, definitions, common mistakes, and click-to-reveal practice questions.",
    supportedApps: ["finals-study-guide", "student-command-center"],
    outputSchemaName: "study_guide",
    temperature: 0.2,
  },
  recall_assistant: {
    id: "recall_assistant",
    name: "Active Recall & Flashcard Assistant",
    role: "Creating atomic, high-retention flashcards and self-check questions",
    systemPrompt:
      "You are the Foundry Recall Assistant. You extract key terms, principles, formulas, and contrast pairs into atomic flashcards with concise fronts, comprehensive backs, helpful hints, and verified source references.",
    supportedApps: ["digital-flashcards", "finals-study-guide"],
    outputSchemaName: "flashcard_set",
    temperature: 0.3,
  },
  academic_manager: {
    id: "academic_manager",
    name: "Academic Manager",
    role: "Orchestrating courses, coursework priorities, and student schedules",
    systemPrompt:
      "You are the Foundry Academic Manager. You synthesize academic context across all courses, track assignment statuses, identify bottlenecks, and suggest balanced daily study priorities.",
    supportedApps: ["student-command-center", "session-timer", "countdown"],
    outputSchemaName: "academic_summary",
    temperature: 0.2,
  },
  teaching_assistant: {
    id: "teaching_assistant",
    name: "Instructional Deck Assistant",
    role: "Building instructional sequences, visual anchor cards, and lecture slides",
    systemPrompt:
      "You are the Foundry Teaching Assistant. You structure pedagogical presentations with learning outcomes, formative checks, and instructional pacing.",
    supportedApps: ["teaching-deck-assistant", "essay-to-slides"],
    outputSchemaName: "instructional_deck",
    temperature: 0.3,
  },
  lesson_assistant: {
    id: "lesson_assistant",
    name: "UDL Lesson Planning Assistant",
    role: "Universal Design for Learning lesson planning and accessibility differentiation",
    systemPrompt:
      "You are the Foundry Lesson Assistant. You design UDL-aligned lesson plans featuring multiple means of engagement, representation, and action/expression, with concrete accommodations and scaffolding.",
    supportedApps: ["udl-lesson-planner", "choice-board"],
    outputSchemaName: "lesson_plan",
    temperature: 0.3,
  },
  choice_assistant: {
    id: "choice_assistant",
    name: "Differentiated Choice Assistant",
    role: "Designing tiered choice boards, multi-pathway learning tasks, and student interest surveys",
    systemPrompt:
      "You are the Foundry Choice Assistant. You construct multi-modal 3x3 choice boards balancing analytical, creative, and practical learning tasks aligned with course objectives and Bloom's Taxonomy.",
    supportedApps: ["choice-board", "udl-lesson-planner"],
    outputSchemaName: "choice_board",
    temperature: 0.4,
  },
};

export type GenerationState =
  | "idle"
  | "preparing_context"
  | "retrieving_sources"
  | "generating"
  | "validating"
  | "awaiting_approval"
  | "saving"
  | "completed"
  | "failed"
  | "cancelled";

export interface ApplicationGenerationRequest {
  assistantId: ApplicationAssistantId;
  appId: string;
  courseId?: string;
  userPrompt: string;
  sourceText?: string;
  targetDeadline?: string;
  options?: Record<string, any>;
  onStateChange?: (state: GenerationState, details?: string) => void;
}

export interface ApplicationGenerationResult<T = any> {
  ok: boolean;
  assistantId: ApplicationAssistantId;
  data?: T;
  rawText?: string;
  sources?: any[];
  error?: string;
}

export class ApplicationIntelligenceService {
  private activeStates: Map<string, GenerationState> = new Map();

  public getAssistantProfile(id: ApplicationAssistantId): ApplicationAssistantProfile {
    return APPLICATION_ASSISTANT_PROFILES[id] || APPLICATION_ASSISTANT_PROFILES.academic_manager;
  }

  public listAssistantProfiles(): ApplicationAssistantProfile[] {
    return Object.values(APPLICATION_ASSISTANT_PROFILES);
  }

  /**
   * Central entry point for structured application generation
   */
  public async generateForApplication<T = any>(
    req: ApplicationGenerationRequest
  ): Promise<ApplicationGenerationResult<T>> {
    const profile = this.getAssistantProfile(req.assistantId);
    const updateState = (st: GenerationState, msg?: string) => {
      this.activeStates.set(req.appId, st);
      req.onStateChange?.(st, msg);
    };

    updateState("preparing_context", "Loading active course context & memories...");

    try {
      // 1. Gather Course Context & Memories
      const courseId = req.courseId || sharedContextManager.getContext().activeCourseId || "CS-304";
      const memories = await aiMemoryManager.getRelevantMemories({ courseId });
      const memoryPrompt = aiMemoryManager.formatMemoriesForPrompt(memories);

      // 2. Query Knowledge Base via RAG
      updateState("retrieving_sources", "Retrieving course documents from Knowledge Base...");
      const ragQuery = req.sourceText?.slice(0, 300) || req.userPrompt;
      const ragResult = await ragEngine.retrieve(ragQuery, { courseId, limit: 3 });

      // 3. Assemble Schema Instruction
      const schemaPrompt = this.getSchemaInstructions(profile.outputSchemaName);

      // 4. Construct Prompt
      const fullPrompt = [
        profile.systemPrompt,
        memoryPrompt ? `\n${memoryPrompt}` : "",
        ragResult.contextBlock ? `\n${ragResult.contextBlock}` : "",
        `\n\nTASK:\n${req.userPrompt}`,
        req.sourceText ? `\n\nSOURCE MATERIAL:\n${req.sourceText}` : "",
        req.targetDeadline ? `\nTARGET DEADLINE: ${req.targetDeadline}` : "",
        `\n\nOUTPUT FORMAT DIRECTIVE:\n${schemaPrompt}`,
        "\nIMPORTANT: Output ONLY valid, parseable JSON matching the requested schema. No markdown formatting outside of JSON, no markdown code fence blocks, no conversational preamble.",
      ].join("\n");

      updateState("generating", "Streaming structured generation via Ollama...");

      // 5. Submit to server /api/ai/providers/ollama/generate
      const resp = await fetch("/api/ai/providers/ollama/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: fullPrompt,
        }),
      });

      if (!resp.ok) {
        throw new Error(`Generation failed with HTTP ${resp.status}`);
      }

      const resData = await resp.json();
      if (!resData.ok && !resData.response) {
        throw new Error(resData.error || "Ollama generation returned empty response");
      }

      const raw = resData.response || resData.content || "";
      updateState("validating", "Validating structured JSON output...");

      // 6. Parse and Validate
      const parsed = this.parseJsonSafely<T>(raw);
      if (!parsed) {
        throw new Error("Model response was not valid JSON conforming to the requested schema.");
      }

      updateState("completed", "Generation finished successfully.");

      return {
        ok: true,
        assistantId: req.assistantId,
        data: parsed,
        rawText: raw,
        sources: ragResult.chunks || [],
      };
    } catch (err: any) {
      updateState("failed", err?.message || "Generation error");
      return {
        ok: false,
        assistantId: req.assistantId,
        error: err?.message || "Failed to generate structured application content.",
      };
    }
  }

  private getSchemaInstructions(schemaName: string): string {
    switch (schemaName) {
      case "countdown_plan":
        return `Schema: {
  "title": string,
  "targetDeadline": string,
  "summary": string,
  "milestones": [
    {
      "id": string,
      "title": string,
      "description": string,
      "dueDate": string,
      "estimatedDurationHours": number,
      "status": "pending" | "completed",
      "priority": "high" | "medium" | "low"
    }
  ]
}`;
      case "presentation_deck":
        return `Schema: {
  "title": string,
  "thesis": string,
  "slides": [
    {
      "id": string,
      "title": string,
      "mainClaim": string,
      "bullets": string[],
      "speakerNotes": string,
      "sourceReferences": string[],
      "layout": "standard" | "quote" | "comparison"
    }
  ]
}`;
      case "study_guide":
        return `Schema: {
  "title": string,
  "courseId": string,
  "sections": [
    {
      "heading": string,
      "summary": string,
      "keyTerms": [{ "term": string, "definition": string }],
      "coreConcepts": string[],
      "commonMistakes": string[],
      "practiceQuestions": [
        {
          "question": string,
          "answer": string,
          "explanation": string
        }
      ]
    }
  ]
}`;
      case "flashcard_set":
        return `Schema: {
  "deckTitle": string,
  "cards": [
    {
      "front": string,
      "back": string,
      "hint": string,
      "category": string
    }
  ]
}`;
      case "lesson_plan":
        return `Schema: {
  "title": string,
  "courseId": string,
  "gradeLevel": string,
  "subject": string,
  "duration": string,
  "learningOutcomes": string[],
  "udlCheckpoints": {
    "engagement": string[],
    "representation": string[],
    "expression": string[]
  },
  "materials": string[],
  "activities": [
    {
      "phase": "Hook" | "Direct Instruction" | "Guided Practice" | "Independent Practice" | "Closure",
      "minutes": number,
      "description": string,
      "accommodations": string
    }
  ],
  "formativeAssessment": string
}`;
      case "choice_board":
        return `Schema: {
  "title": string,
  "courseId": string,
  "learningGoal": string,
  "grid": [
    {
      "row": number,
      "col": number,
      "title": string,
      "description": string,
      "modality": "analytical" | "creative" | "practical",
      "bloomLevel": "Apply" | "Analyze" | "Evaluate" | "Create",
      "deliverable": string
    }
  ]
}`;
      default:
        return `Schema: { "result": any }`;
    }
  }

  private parseJsonSafely<T>(str: string): T | null {
    try {
      return JSON.parse(str.trim());
    } catch {
      // Attempt extracting between outer brackets
      const jsonMatch = str.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]);
        } catch {}
      }
      return null;
    }
  }
}

export const applicationIntelligenceService = new ApplicationIntelligenceService();
