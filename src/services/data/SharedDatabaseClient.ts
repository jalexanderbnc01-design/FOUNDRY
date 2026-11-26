/**
 * Foundry Stage 3 — Shared Database Client (Phase 12)
 * Provides reactive access to courses, assignments, tasks, notes,
 * documents, and persistent memories with local caching and event broadcasts.
 */
import { eventBus, FOUNDRY_EVENTS } from "../EventBus";

export interface AcademicCourse {
  id: string;
  code: string;
  name: string;
  term: string;
  instructor?: string;
  description?: string;
  color?: string;
  active: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface AcademicAssignment {
  id: string;
  courseId: string;
  title: string;
  description?: string;
  dueDate: string;
  status: "not_started" | "in_progress" | "submitted" | "graded";
  weight?: number;
  points?: number;
  createdAt: number;
  updatedAt: number;
}

export interface AcademicTask {
  id: string;
  courseId?: string;
  assignmentId?: string;
  title: string;
  status: "pending" | "completed";
  priority: "low" | "medium" | "high";
  dueDate?: string;
  createdAt: number;
  updatedAt: number;
}

export interface AcademicNote {
  id: string;
  workspaceId?: string;
  courseId?: string;
  assignmentId?: string;
  title: string;
  content: string;
  format: "plain" | "markdown" | "html";
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

export interface KnowledgeDocument {
  id: string;
  name: string;
  sourceType: "local" | "google_drive" | "google_docs" | "google_slides" | "google_sheets" | "canvas_note" | "course_note";
  mimeType: string;
  workspaceId: string | null;
  courseId: string | null;
  assignmentId: string | null;
  filePath?: string | null;
  fileSize: number;
  tags: string[];
  extractionStatus: "pending" | "extracted" | "failed" | "unsupported";
  indexingStatus: "pending" | "indexed" | "failed";
  revision: number;
  sourceUrl?: string | null;
  googleFileId?: string | null;
  extractedText?: string | null;
  summary?: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface AIMemoryRecord {
  id: string;
  type: "conversation" | "working" | "workspace" | "course" | "project" | "preference" | "knowledge" | "procedural";
  content: string;
  scope: "user" | "workspace" | "course";
  workspaceId?: string | null;
  courseId?: string | null;
  sourceConversationId?: string | null;
  status: "candidate" | "approved" | "archived";
  createdAt: number;
  updatedAt: number;
}

class SharedDatabaseClient {
  private coursesCache: AcademicCourse[] = [];
  private assignmentsCache: Map<string, AcademicAssignment[]> = new Map();
  private tasksCache: Map<string, AcademicTask[]> = new Map();
  private documentsCache: KnowledgeDocument[] = [];
  private memoriesCache: AIMemoryRecord[] = [];
  private subscribers: Set<() => void> = new Set();
  private initialized = false;

  public subscribe(cb: () => void): () => void {
    this.subscribers.add(cb);
    return () => this.subscribers.delete(cb);
  }

  private notify() {
    this.subscribers.forEach((cb) => {
      try {
        cb();
      } catch {}
    });
  }

  public async init(): Promise<void> {
    if (this.initialized) return;
    try {
      await Promise.all([
        this.fetchCourses(),
        this.fetchDocuments(),
        this.fetchMemories(),
      ]);
      this.initialized = true;
    } catch (e) {
      console.warn("[SharedDatabaseClient] Init fetch error:", e);
    }
  }

  // --- Courses ---
  public async fetchCourses(): Promise<AcademicCourse[]> {
    try {
      const resp = await fetch("/api/academic/courses");
      if (resp.ok) {
        const data = await resp.json();
        if (data.ok && Array.isArray(data.courses)) {
          this.coursesCache = data.courses;
          this.notify();
          return this.coursesCache;
        }
      }
    } catch {}
    return this.coursesCache;
  }

  public getCourses(): AcademicCourse[] {
    return this.coursesCache;
  }

  public getCourse(id: string): AcademicCourse | undefined {
    return this.coursesCache.find((c) => c.id === id);
  }

  public async upsertCourse(course: Partial<AcademicCourse> & { code: string; name: string }): Promise<AcademicCourse | null> {
    try {
      const resp = await fetch("/api/academic/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(course),
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data.ok && data.course) {
          const idx = this.coursesCache.findIndex((c) => c.id === data.course.id);
          if (idx >= 0) this.coursesCache[idx] = data.course;
          else this.coursesCache.push(data.course);
          this.notify();
          return data.course;
        }
      }
    } catch {}
    return null;
  }

  // --- Assignments ---
  public async fetchAssignments(courseId?: string): Promise<AcademicAssignment[]> {
    try {
      const url = courseId ? `/api/academic/assignments?courseId=${encodeURIComponent(courseId)}` : "/api/academic/assignments";
      const resp = await fetch(url);
      if (resp.ok) {
        const data = await resp.json();
        if (data.ok && Array.isArray(data.assignments)) {
          const key = courseId || "all";
          this.assignmentsCache.set(key, data.assignments);
          this.notify();
          return data.assignments;
        }
      }
    } catch {}
    return this.assignmentsCache.get(courseId || "all") || [];
  }

  public getAssignments(courseId?: string): AcademicAssignment[] {
    return this.assignmentsCache.get(courseId || "all") || [];
  }

  public async upsertAssignment(assign: Partial<AcademicAssignment> & { courseId: string; title: string; dueDate: string }): Promise<AcademicAssignment | null> {
    try {
      const resp = await fetch("/api/academic/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(assign),
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data.ok && data.assignment) {
          await this.fetchAssignments(assign.courseId);
          return data.assignment;
        }
      }
    } catch {}
    return null;
  }

  // --- Tasks ---
  public async fetchTasks(courseId?: string): Promise<AcademicTask[]> {
    try {
      const url = courseId ? `/api/academic/tasks?courseId=${encodeURIComponent(courseId)}` : "/api/academic/tasks";
      const resp = await fetch(url);
      if (resp.ok) {
        const data = await resp.json();
        if (data.ok && Array.isArray(data.tasks)) {
          const key = courseId || "all";
          this.tasksCache.set(key, data.tasks);
          this.notify();
          return data.tasks;
        }
      }
    } catch {}
    return this.tasksCache.get(courseId || "all") || [];
  }

  public getTasks(courseId?: string): AcademicTask[] {
    return this.tasksCache.get(courseId || "all") || [];
  }

  public async upsertTask(task: Partial<AcademicTask> & { title: string }): Promise<AcademicTask | null> {
    try {
      const resp = await fetch("/api/academic/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(task),
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data.ok && data.task) {
          await this.fetchTasks(task.courseId);
          return data.task;
        }
      }
    } catch {}
    return null;
  }

  // --- Knowledge Documents ---
  public async fetchDocuments(filter?: { courseId?: string; query?: string }): Promise<KnowledgeDocument[]> {
    try {
      const params = new URLSearchParams();
      if (filter?.courseId) params.set("courseId", filter.courseId);
      if (filter?.query) params.set("query", filter.query);
      const url = `/api/knowledge/documents?${params.toString()}`;
      const resp = await fetch(url);
      if (resp.ok) {
        const data = await resp.json();
        if (data.ok && Array.isArray(data.documents)) {
          this.documentsCache = data.documents;
          this.notify();
          return data.documents;
        }
      }
    } catch {}
    return this.documentsCache;
  }

  public getDocuments(): KnowledgeDocument[] {
    return this.documentsCache;
  }

  public getDocument(id: string): KnowledgeDocument | undefined {
    return this.documentsCache.find((d) => d.id === id);
  }

  public async upsertDocument(doc: Partial<KnowledgeDocument> & { name: string; sourceType: KnowledgeDocument["sourceType"]; mimeType: string }): Promise<KnowledgeDocument | null> {
    try {
      const resp = await fetch("/api/knowledge/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(doc),
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data.ok && data.document) {
          const idx = this.documentsCache.findIndex((d) => d.id === data.document.id);
          if (idx >= 0) this.documentsCache[idx] = data.document;
          else this.documentsCache.unshift(data.document);
          this.notify();
          return data.document;
        }
      }
    } catch {}
    return null;
  }

  public async deleteDocument(id: string): Promise<boolean> {
    try {
      const resp = await fetch(`/api/knowledge/documents/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (resp.ok) {
        this.documentsCache = this.documentsCache.filter((d) => d.id !== id);
        this.notify();
        return true;
      }
    } catch {}
    return false;
  }

  // --- Persistent AI Memories ---
  public async fetchMemories(filter?: { courseId?: string; scope?: string; type?: string }): Promise<AIMemoryRecord[]> {
    try {
      const params = new URLSearchParams();
      if (filter?.courseId) params.set("courseId", filter.courseId);
      if (filter?.scope) params.set("scope", filter.scope);
      if (filter?.type) params.set("type", filter.type);
      const url = `/api/memory?${params.toString()}`;
      const resp = await fetch(url);
      if (resp.ok) {
        const data = await resp.json();
        if (data.ok && Array.isArray(data.memories)) {
          this.memoriesCache = data.memories;
          this.notify();
          return data.memories;
        }
      }
    } catch {}
    return this.memoriesCache;
  }

  public getMemories(): AIMemoryRecord[] {
    return this.memoriesCache;
  }

  public async upsertMemory(mem: Partial<AIMemoryRecord> & { content: string; type: AIMemoryRecord["type"] }): Promise<AIMemoryRecord | null> {
    try {
      const resp = await fetch("/api/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mem),
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data.ok && data.memory) {
          const idx = this.memoriesCache.findIndex((m) => m.id === data.memory.id);
          if (idx >= 0) this.memoriesCache[idx] = data.memory;
          else this.memoriesCache.unshift(data.memory);
          this.notify();
          return data.memory;
        }
      }
    } catch {}
    return null;
  }

  public async deleteMemory(id: string): Promise<boolean> {
    try {
      const resp = await fetch(`/api/memory/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (resp.ok) {
        this.memoriesCache = this.memoriesCache.filter((m) => m.id !== id);
        this.notify();
        return true;
      }
    } catch {}
    return false;
  }

  public async getStats(): Promise<any> {
    try {
      const resp = await fetch("/api/data/stats");
      if (resp.ok) {
        const data = await resp.json();
        if (data.ok) return data.stats;
      }
    } catch {}
    return null;
  }
}

export const sharedDatabaseClient = new SharedDatabaseClient();
