/**
 * Foundry Stage 3 — Shared Database Authority (Phases 12–24)
 * Local-first SQLite database supporting all 24 logical collections,
 * schema versioning, migrations, full-text search, and academic context.
 */
import { DatabaseSync, StatementSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

export const SHARED_DB_SCHEMA_VERSION = 1;

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

export interface DocumentChunk {
  id: string;
  documentId: string;
  chunkIndex: number;
  content: string;
  metadata: {
    documentName: string;
    courseId?: string | null;
    pageNumber?: number;
    slideNumber?: number;
    sheetName?: string;
    sectionHeading?: string;
    revision: number;
  };
  tokenCount: number;
  createdAt: number;
}

export interface DocumentEmbedding {
  chunkId: string;
  model: string;
  embedding: number[];
  createdAt: number;
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

export interface FlashcardDeck {
  id: string;
  courseId: string;
  title: string;
  description?: string;
  sourceDocumentId?: string | null;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

export interface FlashcardItem {
  id: string;
  deckId: string;
  front: string;
  back: string;
  hint?: string;
  sourceRef?: any;
  reviewCount: number;
  easeFactor: number;
  createdAt: number;
  updatedAt: number;
}

export interface SynchronizationJob {
  id: string;
  targetType: string;
  targetId: string;
  provider: string;
  action: string;
  status: "pending" | "in_progress" | "synchronized" | "failed" | "conflict";
  details: any;
  createdAt: number;
  completedAt?: number | null;
}

export class SharedDatabase {
  private dbPath: string;
  private db: DatabaseSync | null = null;
  private initialized = false;

  constructor(customPath?: string) {
    this.dbPath =
      customPath ||
      path.join(process.cwd(), "data", "foundry", "foundry_shared.sqlite");
  }

  public initialize(): void {
    if (this.initialized && this.db) return;

    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new DatabaseSync(this.dbPath);
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.db.exec("PRAGMA foreign_keys = ON;");
    this.db.exec("PRAGMA synchronous = NORMAL;");

    this.createTables();
    this.seedDefaultData();
    this.initialized = true;
  }

  private createTables() {
    if (!this.db) return;

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS db_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT,
        name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'student',
        preferences_json TEXT NOT NULL DEFAULT '{}',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS workspaces (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        settings_json TEXT NOT NULL DEFAULT '{}',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS courses (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL,
        name TEXT NOT NULL,
        term TEXT NOT NULL,
        instructor TEXT,
        description TEXT,
        color TEXT,
        active INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS assignments (
        id TEXT PRIMARY KEY,
        course_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        due_date TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'not_started',
        weight REAL,
        points REAL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY(course_id) REFERENCES courses(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        course_id TEXT,
        assignment_id TEXT,
        title TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        priority TEXT NOT NULL DEFAULT 'medium',
        due_date TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY,
        workspace_id TEXT,
        course_id TEXT,
        assignment_id TEXT,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        format TEXT NOT NULL DEFAULT 'markdown',
        tags_json TEXT NOT NULL DEFAULT '[]',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        source_type TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        workspace_id TEXT,
        course_id TEXT,
        assignment_id TEXT,
        file_path TEXT,
        file_size INTEGER NOT NULL DEFAULT 0,
        tags_json TEXT NOT NULL DEFAULT '[]',
        extraction_status TEXT NOT NULL DEFAULT 'pending',
        indexing_status TEXT NOT NULL DEFAULT 'pending',
        revision INTEGER NOT NULL DEFAULT 1,
        source_url TEXT,
        google_file_id TEXT,
        extracted_text TEXT,
        summary TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS document_chunks (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL,
        chunk_index INTEGER NOT NULL,
        content TEXT NOT NULL,
        metadata_json TEXT NOT NULL DEFAULT '{}',
        token_count INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        FOREIGN KEY(document_id) REFERENCES documents(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS document_embeddings (
        chunk_id TEXT NOT NULL,
        model TEXT NOT NULL,
        embedding_json TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        PRIMARY KEY(chunk_id, model),
        FOREIGN KEY(chunk_id) REFERENCES document_chunks(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        scope TEXT NOT NULL DEFAULT 'user',
        workspace_id TEXT,
        course_id TEXT,
        source_conversation_id TEXT,
        status TEXT NOT NULL DEFAULT 'approved',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS flashcard_decks (
        id TEXT PRIMARY KEY,
        course_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        source_document_id TEXT,
        tags_json TEXT NOT NULL DEFAULT '[]',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS flashcards (
        id TEXT PRIMARY KEY,
        deck_id TEXT NOT NULL,
        front TEXT NOT NULL,
        back TEXT NOT NULL,
        hint TEXT,
        source_ref_json TEXT,
        review_count INTEGER NOT NULL DEFAULT 0,
        ease_factor REAL NOT NULL DEFAULT 2.5,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY(deck_id) REFERENCES flashcard_decks(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS quiz_questions (
        id TEXT PRIMARY KEY,
        course_id TEXT,
        assignment_id TEXT,
        question TEXT NOT NULL,
        options_json TEXT NOT NULL,
        answer TEXT NOT NULL,
        explanation TEXT,
        source_ref_json TEXT,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS study_sessions (
        id TEXT PRIMARY KEY,
        course_id TEXT,
        deck_id TEXT,
        duration_seconds INTEGER NOT NULL,
        score REAL,
        notes TEXT,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS study_guides (
        id TEXT PRIMARY KEY,
        course_id TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        sections_json TEXT NOT NULL DEFAULT '[]',
        source_document_ids_json TEXT NOT NULL DEFAULT '[]',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS presentations (
        id TEXT PRIMARY KEY,
        course_id TEXT,
        title TEXT NOT NULL,
        slides_json TEXT NOT NULL DEFAULT '[]',
        source_document_id TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS lesson_plans (
        id TEXT PRIMARY KEY,
        course_id TEXT,
        title TEXT NOT NULL,
        objectives_json TEXT NOT NULL DEFAULT '[]',
        materials_json TEXT NOT NULL DEFAULT '[]',
        activities_json TEXT NOT NULL DEFAULT '[]',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS choice_boards (
        id TEXT PRIMARY KEY,
        course_id TEXT,
        title TEXT NOT NULL,
        grid_json TEXT NOT NULL DEFAULT '[]',
        survey_responses_json TEXT NOT NULL DEFAULT '[]',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS integration_accounts (
        id TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        account_email TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'connected',
        authorized_scopes_json TEXT NOT NULL DEFAULT '[]',
        credentials_ref TEXT,
        last_sync_at INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS synchronization_jobs (
        id TEXT PRIMARY KEY,
        target_type TEXT NOT NULL,
        target_id TEXT NOT NULL,
        provider TEXT NOT NULL,
        action TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        details_json TEXT NOT NULL DEFAULT '{}',
        created_at INTEGER NOT NULL,
        completed_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS execution_logs (
        id TEXT PRIMARY KEY,
        operation TEXT NOT NULL,
        status TEXT NOT NULL,
        duration_ms INTEGER NOT NULL,
        details_json TEXT NOT NULL DEFAULT '{}',
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS permissions (
        id TEXT PRIMARY KEY,
        resource TEXT NOT NULL,
        action TEXT NOT NULL,
        policy TEXT NOT NULL DEFAULT 'allow',
        last_updated INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_assignments_course ON assignments(course_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_course ON tasks(course_id);
      CREATE INDEX IF NOT EXISTS idx_notes_course ON notes(course_id);
      CREATE INDEX IF NOT EXISTS idx_documents_course ON documents(course_id);
      CREATE INDEX IF NOT EXISTS idx_chunks_doc ON document_chunks(document_id);
      CREATE INDEX IF NOT EXISTS idx_memories_course ON memories(course_id);
      CREATE INDEX IF NOT EXISTS idx_flashcards_deck ON flashcards(deck_id);
    `);
  }

  private seedDefaultData() {
    if (!this.db) return;

    // Check if courses exist
    const countRow = this.db.prepare("SELECT COUNT(*) as count FROM courses").get() as any;
    if (countRow && countRow.count > 0) return;

    const now = Date.now();
    const seedCourses: AcademicCourse[] = [
      {
        id: "CS-304",
        code: "CS-304",
        name: "Computer Architecture & Organization",
        term: "Fall 2026",
        instructor: "Dr. A. Vance",
        description: "Cache coherence protocols, pipelining, memory hierarchies, and vector processors.",
        color: "#3b82f6",
        active: true,
        createdAt: now - 3600000 * 24 * 30,
        updatedAt: now,
      },
      {
        id: "MATH-240",
        code: "MATH-240",
        name: "Linear Algebra & Applications",
        term: "Fall 2026",
        instructor: "Prof. S. Kovalev",
        description: "Vector spaces, linear transformations, eigenvalues, singular value decomposition.",
        color: "#10b981",
        active: false,
        createdAt: now - 3600000 * 24 * 30,
        updatedAt: now,
      },
      {
        id: "PHYS-210",
        code: "PHYS-210",
        name: "Classical Mechanics & Dynamics",
        term: "Fall 2026",
        instructor: "Dr. E. Thorne",
        description: "Newtonian dynamics, Lagrangian formulation, harmonic oscillators, and orbital mechanics.",
        color: "#f59e0b",
        active: false,
        createdAt: now - 3600000 * 24 * 30,
        updatedAt: now,
      },
    ];

    const insertCourse = this.db.prepare(`
      INSERT INTO courses (id, code, name, term, instructor, description, color, active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const c of seedCourses) {
      insertCourse.run(c.id, c.code, c.name, c.term, c.instructor || "", c.description || "", c.color || "", c.active ? 1 : 0, c.createdAt, c.updatedAt);
    }

    // Seed assignments & tasks for CS-304 matching the Education Controller defaults
    const insertAssign = this.db.prepare(`
      INSERT INTO assignments (id, course_id, title, description, due_date, status, weight, points, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertAssign.run("cs304-q4", "CS-304", "Quiz 4: Cache Coherence", "MSI and MESI protocol state transitions and invalidation queues", "2:45 h", "in_progress", 0.15, 100, now, now);
    insertAssign.run("cs304-l3", "CS-304", "Lab 3: Simulator Build", "Build cycle-accurate pipelined CPU simulator with branch prediction", "2:35 h", "in_progress", 0.25, 100, now, now);
    insertAssign.run("cs304-pr", "CS-304", "Peer Code Review", "Review peer implementation of memory controller lock-free ring buffer", "4:10 h", "not_started", 0.10, 50, now, now);

    // Seed sample knowledge base document
    const insertDoc = this.db.prepare(`
      INSERT INTO documents (id, name, source_type, mime_type, workspace_id, course_id, assignment_id, file_size, tags_json, extraction_status, indexing_status, revision, extracted_text, summary, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const docText = `# CS-304 Lecture 04: Cache Coherence & Snooping Protocols\n\n## 1. The Coherence Problem\nIn symmetric multiprocessor (SMP) systems with private L1 caches, multiple processors may cache copies of the same shared memory location. When one processor modifies its cached copy, other processors' cached copies become stale.\n\n## 2. MSI Protocol States\n- Modified (M): Cache block has been modified, exists only in this cache, memory is stale.\n- Shared (S): Block is present in one or more caches, unmodified, memory is consistent.\n- Invalid (I): Block contains invalid or stale data.\n\n## 3. Directory vs. Snooping\nSnooping relies on a shared broadcast bus where each cache controller monitors bus transactions. Directory protocols scale to large multicore systems by maintaining a centralized or distributed state directory without requiring broadcast.`;

    insertDoc.run(
      "doc-cs304-lec4",
      "CS-304 Lecture 04: Cache Coherence.md",
      "course_note",
      "text/markdown",
      "default",
      "CS-304",
      "cs304-q4",
      docText.length,
      JSON.stringify(["architecture", "caches", "coherence", "msi"]),
      "extracted",
      "indexed",
      1,
      docText,
      "Covers the cache coherence problem, MSI state transitions, and comparison between snooping and directory-based protocols.",
      now,
      now
    );

    // Seed document chunks
    const insertChunk = this.db.prepare(`
      INSERT INTO document_chunks (id, document_id, chunk_index, content, metadata_json, token_count, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    insertChunk.run(
      "chunk-cs304-1",
      "doc-cs304-lec4",
      0,
      "The Coherence Problem: In symmetric multiprocessor (SMP) systems with private L1 caches, multiple processors may cache copies of the same shared memory location. When one processor modifies its cached copy, other processors' cached copies become stale.",
      JSON.stringify({ documentName: "CS-304 Lecture 04: Cache Coherence.md", courseId: "CS-304", sectionHeading: "The Coherence Problem", pageNumber: 1, revision: 1 }),
      45,
      now
    );

    insertChunk.run(
      "chunk-cs304-2",
      "doc-cs304-lec4",
      1,
      "MSI Protocol States: Modified (M): Cache block has been modified, exists only in this cache, memory is stale. Shared (S): Block is present in one or more caches, unmodified, memory is consistent. Invalid (I): Block contains invalid or stale data.",
      JSON.stringify({ documentName: "CS-304 Lecture 04: Cache Coherence.md", courseId: "CS-304", sectionHeading: "MSI Protocol States", pageNumber: 2, revision: 1 }),
      50,
      now
    );

    // Seed a sample AI memory
    const insertMem = this.db.prepare(`
      INSERT INTO memories (id, type, content, scope, course_id, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertMem.run(
      "mem-1",
      "preference",
      "User prefers concise, step-by-step technical explanations with code snippets or hardware diagrams.",
      "user",
      null,
      "approved",
      now,
      now
    );
    insertMem.run(
      "mem-2",
      "course",
      "CS-304 focuses on RISC-V and x86 cache hierarchies, pipelining, and MSI/MESI coherence protocols.",
      "course",
      "CS-304",
      "approved",
      now,
      now
    );
  }

  // --- Collection Queries & Operations ---

  public getCourses(): AcademicCourse[] {
    if (!this.db) return [];
    const rows = this.db.prepare("SELECT * FROM courses ORDER BY code ASC").all() as any[];
    return rows.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      term: r.term,
      instructor: r.instructor || undefined,
      description: r.description || undefined,
      color: r.color || undefined,
      active: Boolean(r.active),
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  public getCourse(id: string): AcademicCourse | null {
    if (!this.db) return null;
    const r = this.db.prepare("SELECT * FROM courses WHERE id = ?").get(id) as any;
    if (!r) return null;
    return {
      id: r.id,
      code: r.code,
      name: r.name,
      term: r.term,
      instructor: r.instructor || undefined,
      description: r.description || undefined,
      color: r.color || undefined,
      active: Boolean(r.active),
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }

  public upsertCourse(course: AcademicCourse): void {
    if (!this.db) return;
    this.db.prepare(`
      INSERT INTO courses (id, code, name, term, instructor, description, color, active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        code=excluded.code,
        name=excluded.name,
        term=excluded.term,
        instructor=excluded.instructor,
        description=excluded.description,
        color=excluded.color,
        active=excluded.active,
        updated_at=excluded.updated_at
    `).run(
      course.id,
      course.code,
      course.name,
      course.term,
      course.instructor || "",
      course.description || "",
      course.color || "",
      course.active ? 1 : 0,
      course.createdAt,
      course.updatedAt
    );
  }

  public getAssignments(courseId?: string): AcademicAssignment[] {
    if (!this.db) return [];
    const query = courseId
      ? "SELECT * FROM assignments WHERE course_id = ? ORDER BY due_date ASC"
      : "SELECT * FROM assignments ORDER BY due_date ASC";
    const stmt = this.db.prepare(query);
    const rows = (courseId ? stmt.all(courseId) : stmt.all()) as any[];
    return rows.map((r) => ({
      id: r.id,
      courseId: r.course_id,
      title: r.title,
      description: r.description || undefined,
      dueDate: r.due_date,
      status: r.status,
      weight: r.weight ?? undefined,
      points: r.points ?? undefined,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  public upsertAssignment(assignment: AcademicAssignment): void {
    if (!this.db) return;
    this.db.prepare(`
      INSERT INTO assignments (id, course_id, title, description, due_date, status, weight, points, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        course_id=excluded.course_id,
        title=excluded.title,
        description=excluded.description,
        due_date=excluded.due_date,
        status=excluded.status,
        weight=excluded.weight,
        points=excluded.points,
        updated_at=excluded.updated_at
    `).run(
      assignment.id,
      assignment.courseId,
      assignment.title,
      assignment.description || "",
      assignment.dueDate,
      assignment.status,
      assignment.weight ?? null,
      assignment.points ?? null,
      assignment.createdAt,
      assignment.updatedAt
    );
  }

  public getTasks(courseId?: string): AcademicTask[] {
    if (!this.db) return [];
    const query = courseId
      ? "SELECT * FROM tasks WHERE course_id = ? ORDER BY created_at DESC"
      : "SELECT * FROM tasks ORDER BY created_at DESC";
    const stmt = this.db.prepare(query);
    const rows = (courseId ? stmt.all(courseId) : stmt.all()) as any[];
    return rows.map((r) => ({
      id: r.id,
      courseId: r.course_id || undefined,
      assignmentId: r.assignment_id || undefined,
      title: r.title,
      status: r.status,
      priority: r.priority,
      dueDate: r.due_date || undefined,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  public upsertTask(task: AcademicTask): void {
    if (!this.db) return;
    this.db.prepare(`
      INSERT INTO tasks (id, course_id, assignment_id, title, status, priority, due_date, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        course_id=excluded.course_id,
        assignment_id=excluded.assignment_id,
        title=excluded.title,
        status=excluded.status,
        priority=excluded.priority,
        due_date=excluded.due_date,
        updated_at=excluded.updated_at
    `).run(
      task.id,
      task.courseId || null,
      task.assignmentId || null,
      task.title,
      task.status,
      task.priority,
      task.dueDate || null,
      task.createdAt,
      task.updatedAt
    );
  }

  public getNotes(courseId?: string): AcademicNote[] {
    if (!this.db) return [];
    const query = courseId
      ? "SELECT * FROM notes WHERE course_id = ? ORDER BY updated_at DESC"
      : "SELECT * FROM notes ORDER BY updated_at DESC";
    const stmt = this.db.prepare(query);
    const rows = (courseId ? stmt.all(courseId) : stmt.all()) as any[];
    return rows.map((r) => ({
      id: r.id,
      workspaceId: r.workspace_id || undefined,
      courseId: r.course_id || undefined,
      assignmentId: r.assignment_id || undefined,
      title: r.title,
      content: r.content,
      format: r.format,
      tags: JSON.parse(r.tags_json || "[]"),
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  public upsertNote(note: AcademicNote): void {
    if (!this.db) return;
    this.db.prepare(`
      INSERT INTO notes (id, workspace_id, course_id, assignment_id, title, content, format, tags_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        workspace_id=excluded.workspace_id,
        course_id=excluded.course_id,
        assignment_id=excluded.assignment_id,
        title=excluded.title,
        content=excluded.content,
        format=excluded.format,
        tags_json=excluded.tags_json,
        updated_at=excluded.updated_at
    `).run(
      note.id,
      note.workspaceId || null,
      note.courseId || null,
      note.assignmentId || null,
      note.title,
      note.content,
      note.format,
      JSON.stringify(note.tags || []),
      note.createdAt,
      note.updatedAt
    );
  }

  public deleteNote(id: string): boolean {
    if (!this.db) return false;
    this.db.prepare("DELETE FROM notes WHERE id = ?").run(id);
    return true;
  }

  // --- Knowledge Documents ---

  public getDocuments(filter?: { courseId?: string; query?: string }): KnowledgeDocument[] {
    if (!this.db) return [];
    let sql = "SELECT * FROM documents";
    const params: any[] = [];
    const clauses: string[] = [];

    if (filter?.courseId) {
      clauses.push("course_id = ?");
      params.push(filter.courseId);
    }
    if (filter?.query) {
      clauses.push("(name LIKE ? OR extracted_text LIKE ? OR tags_json LIKE ?)");
      const term = `%${filter.query}%`;
      params.push(term, term, term);
    }
    if (clauses.length > 0) {
      sql += " WHERE " + clauses.join(" AND ");
    }
    sql += " ORDER BY updated_at DESC";

    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      sourceType: r.source_type,
      mimeType: r.mime_type,
      workspaceId: r.workspace_id,
      courseId: r.course_id,
      assignmentId: r.assignment_id,
      filePath: r.file_path,
      fileSize: r.file_size,
      tags: JSON.parse(r.tags_json || "[]"),
      extractionStatus: r.extraction_status,
      indexingStatus: r.indexing_status,
      revision: r.revision,
      sourceUrl: r.source_url,
      googleFileId: r.google_file_id,
      extractedText: r.extracted_text,
      summary: r.summary,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  public getDocument(id: string): KnowledgeDocument | null {
    if (!this.db) return null;
    const r = this.db.prepare("SELECT * FROM documents WHERE id = ?").get(id) as any;
    if (!r) return null;
    return {
      id: r.id,
      name: r.name,
      sourceType: r.source_type,
      mimeType: r.mime_type,
      workspaceId: r.workspace_id,
      courseId: r.course_id,
      assignmentId: r.assignment_id,
      filePath: r.file_path,
      fileSize: r.file_size,
      tags: JSON.parse(r.tags_json || "[]"),
      extractionStatus: r.extraction_status,
      indexingStatus: r.indexing_status,
      revision: r.revision,
      sourceUrl: r.source_url,
      googleFileId: r.google_file_id,
      extractedText: r.extracted_text,
      summary: r.summary,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }

  public upsertDocument(doc: KnowledgeDocument): void {
    if (!this.db) return;
    this.db.prepare(`
      INSERT INTO documents (
        id, name, source_type, mime_type, workspace_id, course_id, assignment_id,
        file_path, file_size, tags_json, extraction_status, indexing_status, revision,
        source_url, google_file_id, extracted_text, summary, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name=excluded.name,
        source_type=excluded.source_type,
        mime_type=excluded.mime_type,
        workspace_id=excluded.workspace_id,
        course_id=excluded.course_id,
        assignment_id=excluded.assignment_id,
        file_path=excluded.file_path,
        file_size=excluded.file_size,
        tags_json=excluded.tags_json,
        extraction_status=excluded.extraction_status,
        indexing_status=excluded.indexing_status,
        revision=excluded.revision,
        source_url=excluded.source_url,
        google_file_id=excluded.google_file_id,
        extracted_text=excluded.extracted_text,
        summary=excluded.summary,
        updated_at=excluded.updated_at
    `).run(
      doc.id,
      doc.name,
      doc.sourceType,
      doc.mimeType,
      doc.workspaceId,
      doc.courseId,
      doc.assignmentId,
      doc.filePath || null,
      doc.fileSize,
      JSON.stringify(doc.tags || []),
      doc.extractionStatus,
      doc.indexingStatus,
      doc.revision,
      doc.sourceUrl || null,
      doc.googleFileId || null,
      doc.extractedText || null,
      doc.summary || null,
      doc.createdAt,
      doc.updatedAt
    );
  }

  public deleteDocument(id: string): boolean {
    if (!this.db) return false;
    this.db.prepare("DELETE FROM documents WHERE id = ?").run(id);
    return true;
  }

  // --- Document Chunks & RAG Indexing ---

  public setDocumentChunks(documentId: string, chunks: DocumentChunk[]): void {
    if (!this.db) return;
    this.db.prepare("DELETE FROM document_chunks WHERE document_id = ?").run(documentId);

    const insert = this.db.prepare(`
      INSERT INTO document_chunks (id, document_id, chunk_index, content, metadata_json, token_count, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    for (const c of chunks) {
      insert.run(
        c.id,
        documentId,
        c.chunkIndex,
        c.content,
        JSON.stringify(c.metadata || {}),
        c.tokenCount,
        c.createdAt
      );
    }
  }

  public getDocumentChunks(documentId: string): DocumentChunk[] {
    if (!this.db) return [];
    const rows = this.db.prepare("SELECT * FROM document_chunks WHERE document_id = ? ORDER BY chunk_index ASC").all(documentId) as any[];
    return rows.map((r) => ({
      id: r.id,
      documentId: r.document_id,
      chunkIndex: r.chunk_index,
      content: r.content,
      metadata: JSON.parse(r.metadata_json || "{}"),
      tokenCount: r.token_count,
      createdAt: r.created_at,
    }));
  }

  public searchChunks(query: string, options?: { courseId?: string; limit?: number }): Array<DocumentChunk & { rank: number }> {
    if (!this.db) return [];
    const limit = Math.min(20, Math.max(1, options?.limit || 5));
    const term = `%${query.trim()}%`;
    const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);

    let sql = `
      SELECT c.*, d.name as doc_name, d.course_id as doc_course_id
      FROM document_chunks c
      JOIN documents d ON c.document_id = d.id
    `;
    const params: any[] = [];
    if (options?.courseId) {
      sql += " WHERE (d.course_id = ? OR c.metadata_json LIKE ?)";
      params.push(options.courseId, `%"courseId":"${options.courseId}"%`);
    }

    const rows = this.db.prepare(sql).all(...params) as any[];
    const scored: Array<DocumentChunk & { rank: number }> = [];

    for (const r of rows) {
      const text = r.content.toLowerCase();
      let matchCount = 0;
      for (const t of tokens) {
        if (text.includes(t)) matchCount++;
      }
      if (matchCount > 0) {
        scored.push({
          id: r.id,
          documentId: r.document_id,
          chunkIndex: r.chunk_index,
          content: r.content,
          metadata: JSON.parse(r.metadata_json || "{}"),
          tokenCount: r.token_count,
          createdAt: r.created_at,
          rank: matchCount / tokens.length,
        });
      }
    }

    return scored.sort((a, b) => b.rank - a.rank).slice(0, limit);
  }

  public storeEmbedding(chunkId: string, model: string, embedding: number[]): void {
    if (!this.db) return;
    this.db.prepare(`
      INSERT INTO document_embeddings (chunk_id, model, embedding_json, created_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(chunk_id, model) DO UPDATE SET
        embedding_json=excluded.embedding_json,
        created_at=excluded.created_at
    `).run(chunkId, model, JSON.stringify(embedding), Date.now());
  }

  // --- AI Memories ---

  public getMemories(filter?: { courseId?: string; scope?: string; type?: string }): AIMemoryRecord[] {
    if (!this.db) return [];
    let sql = "SELECT * FROM memories WHERE status = 'approved'";
    const params: any[] = [];

    if (filter?.courseId) {
      sql += " AND (course_id = ? OR scope = 'user')";
      params.push(filter.courseId);
    }
    if (filter?.scope) {
      sql += " AND scope = ?";
      params.push(filter.scope);
    }
    if (filter?.type) {
      sql += " AND type = ?";
      params.push(filter.type);
    }
    sql += " ORDER BY updated_at DESC";

    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      content: r.content,
      scope: r.scope,
      workspaceId: r.workspace_id,
      courseId: r.course_id,
      sourceConversationId: r.source_conversation_id,
      status: r.status,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  public upsertMemory(mem: AIMemoryRecord): void {
    if (!this.db) return;
    this.db.prepare(`
      INSERT INTO memories (id, type, content, scope, workspace_id, course_id, source_conversation_id, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        type=excluded.type,
        content=excluded.content,
        scope=excluded.scope,
        workspace_id=excluded.workspace_id,
        course_id=excluded.course_id,
        source_conversation_id=excluded.source_conversation_id,
        status=excluded.status,
        updated_at=excluded.updated_at
    `).run(
      mem.id,
      mem.type,
      mem.content,
      mem.scope,
      mem.workspaceId || null,
      mem.courseId || null,
      mem.sourceConversationId || null,
      mem.status,
      mem.createdAt,
      mem.updatedAt
    );
  }

  public getAllMemories(): AIMemoryRecord[] {
    if (!this.db) return [];
    const rows = this.db.prepare("SELECT * FROM memories ORDER BY updated_at DESC").all() as any[];
    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      content: r.content,
      scope: r.scope,
      workspaceId: r.workspace_id,
      courseId: r.course_id,
      sourceConversationId: r.source_conversation_id,
      status: r.status,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  public deleteMemory(id: string): boolean {
    if (!this.db) return false;
    this.db.prepare("DELETE FROM memories WHERE id = ?").run(id);
    return true;
  }

  // --- Flashcard Decks & Cards ---

  public getFlashcardDecks(courseId?: string): FlashcardDeck[] {
    if (!this.db) return [];
    const sql = courseId
      ? "SELECT * FROM flashcard_decks WHERE course_id = ? ORDER BY updated_at DESC"
      : "SELECT * FROM flashcard_decks ORDER BY updated_at DESC";
    const stmt = this.db.prepare(sql);
    const rows = (courseId ? stmt.all(courseId) : stmt.all()) as any[];
    return rows.map((r) => ({
      id: r.id,
      courseId: r.course_id,
      title: r.title,
      description: r.description || undefined,
      sourceDocumentId: r.source_document_id,
      tags: JSON.parse(r.tags_json || "[]"),
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  public upsertFlashcardDeck(deck: FlashcardDeck): void {
    if (!this.db) return;
    this.db.prepare(`
      INSERT INTO flashcard_decks (id, course_id, title, description, source_document_id, tags_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        course_id=excluded.course_id,
        title=excluded.title,
        description=excluded.description,
        source_document_id=excluded.source_document_id,
        tags_json=excluded.tags_json,
        updated_at=excluded.updated_at
    `).run(
      deck.id,
      deck.courseId,
      deck.title,
      deck.description || "",
      deck.sourceDocumentId || null,
      JSON.stringify(deck.tags || []),
      deck.createdAt,
      deck.updatedAt
    );
  }

  public getFlashcards(deckId: string): FlashcardItem[] {
    if (!this.db) return [];
    const rows = this.db.prepare("SELECT * FROM flashcards WHERE deck_id = ? ORDER BY created_at ASC").all(deckId) as any[];
    return rows.map((r) => ({
      id: r.id,
      deckId: r.deck_id,
      front: r.front,
      back: r.back,
      hint: r.hint || undefined,
      sourceRef: r.source_ref_json ? JSON.parse(r.source_ref_json) : undefined,
      reviewCount: r.review_count,
      easeFactor: r.ease_factor,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  public upsertFlashcard(item: FlashcardItem): void {
    if (!this.db) return;
    this.db.prepare(`
      INSERT INTO flashcards (id, deck_id, front, back, hint, source_ref_json, review_count, ease_factor, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        deck_id=excluded.deck_id,
        front=excluded.front,
        back=excluded.back,
        hint=excluded.hint,
        source_ref_json=excluded.source_ref_json,
        review_count=excluded.review_count,
        ease_factor=excluded.ease_factor,
        updated_at=excluded.updated_at
    `).run(
      item.id,
      item.deckId,
      item.front,
      item.back,
      item.hint || null,
      item.sourceRef ? JSON.stringify(item.sourceRef) : null,
      item.reviewCount,
      item.easeFactor,
      item.createdAt,
      item.updatedAt
    );
  }

  public deleteFlashcardDeck(id: string): boolean {
    if (!this.db) return false;
    this.db.prepare("DELETE FROM flashcard_decks WHERE id = ?").run(id);
    return true;
  }

  public deleteFlashcard(id: string): boolean {
    if (!this.db) return false;
    this.db.prepare("DELETE FROM flashcards WHERE id = ?").run(id);
    return true;
  }

  // --- Study Guides, Presentations, Lessons, Choice Boards, Quizzes, Sessions ---

  public getStudyGuides(courseId?: string): any[] {
    if (!this.db) return [];
    const sql = courseId
      ? "SELECT * FROM study_guides WHERE course_id = ? ORDER BY updated_at DESC"
      : "SELECT * FROM study_guides ORDER BY updated_at DESC";
    const stmt = this.db.prepare(sql);
    const rows = (courseId ? stmt.all(courseId) : stmt.all()) as any[];
    return rows.map((r) => ({
      id: r.id,
      courseId: r.course_id,
      title: r.title,
      content: r.content,
      sections: JSON.parse(r.sections_json || "[]"),
      sourceDocumentIds: JSON.parse(r.source_document_ids_json || "[]"),
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  public upsertStudyGuide(guide: any): void {
    if (!this.db) return;
    this.db.prepare(`
      INSERT INTO study_guides (id, course_id, title, content, sections_json, source_document_ids_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        course_id=excluded.course_id,
        title=excluded.title,
        content=excluded.content,
        sections_json=excluded.sections_json,
        source_document_ids_json=excluded.source_document_ids_json,
        updated_at=excluded.updated_at
    `).run(
      guide.id,
      guide.courseId,
      guide.title,
      guide.content || "",
      JSON.stringify(guide.sections || []),
      JSON.stringify(guide.sourceDocumentIds || []),
      guide.createdAt || Date.now(),
      guide.updatedAt || Date.now()
    );
  }

  public deleteStudyGuide(id: string): boolean {
    if (!this.db) return false;
    this.db.prepare("DELETE FROM study_guides WHERE id = ?").run(id);
    return true;
  }

  public getPresentations(courseId?: string): any[] {
    if (!this.db) return [];
    const sql = courseId
      ? "SELECT * FROM presentations WHERE course_id = ? ORDER BY updated_at DESC"
      : "SELECT * FROM presentations ORDER BY updated_at DESC";
    const stmt = this.db.prepare(sql);
    const rows = (courseId ? stmt.all(courseId) : stmt.all()) as any[];
    return rows.map((r) => ({
      id: r.id,
      courseId: r.course_id,
      title: r.title,
      slides: JSON.parse(r.slides_json || "[]"),
      sourceDocumentId: r.source_document_id,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  public upsertPresentation(pres: any): void {
    if (!this.db) return;
    this.db.prepare(`
      INSERT INTO presentations (id, course_id, title, slides_json, source_document_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        course_id=excluded.course_id,
        title=excluded.title,
        slides_json=excluded.slides_json,
        source_document_id=excluded.source_document_id,
        updated_at=excluded.updated_at
    `).run(
      pres.id,
      pres.courseId || null,
      pres.title,
      JSON.stringify(pres.slides || []),
      pres.sourceDocumentId || null,
      pres.createdAt || Date.now(),
      pres.updatedAt || Date.now()
    );
  }

  public deletePresentation(id: string): boolean {
    if (!this.db) return false;
    this.db.prepare("DELETE FROM presentations WHERE id = ?").run(id);
    return true;
  }

  public getLessonPlans(courseId?: string): any[] {
    if (!this.db) return [];
    const sql = courseId
      ? "SELECT * FROM lesson_plans WHERE course_id = ? ORDER BY updated_at DESC"
      : "SELECT * FROM lesson_plans ORDER BY updated_at DESC";
    const stmt = this.db.prepare(sql);
    const rows = (courseId ? stmt.all(courseId) : stmt.all()) as any[];
    return rows.map((r) => ({
      id: r.id,
      courseId: r.course_id,
      title: r.title,
      objectives: JSON.parse(r.objectives_json || "[]"),
      materials: JSON.parse(r.materials_json || "[]"),
      activities: JSON.parse(r.activities_json || "[]"),
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  public upsertLessonPlan(plan: any): void {
    if (!this.db) return;
    this.db.prepare(`
      INSERT INTO lesson_plans (id, course_id, title, objectives_json, materials_json, activities_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        course_id=excluded.course_id,
        title=excluded.title,
        objectives_json=excluded.objectives_json,
        materials_json=excluded.materials_json,
        activities_json=excluded.activities_json,
        updated_at=excluded.updated_at
    `).run(
      plan.id,
      plan.courseId || null,
      plan.title,
      JSON.stringify(plan.objectives || []),
      JSON.stringify(plan.materials || []),
      JSON.stringify(plan.activities || []),
      plan.createdAt || Date.now(),
      plan.updatedAt || Date.now()
    );
  }

  public deleteLessonPlan(id: string): boolean {
    if (!this.db) return false;
    this.db.prepare("DELETE FROM lesson_plans WHERE id = ?").run(id);
    return true;
  }

  public getChoiceBoards(courseId?: string): any[] {
    if (!this.db) return [];
    const sql = courseId
      ? "SELECT * FROM choice_boards WHERE course_id = ? ORDER BY updated_at DESC"
      : "SELECT * FROM choice_boards ORDER BY updated_at DESC";
    const stmt = this.db.prepare(sql);
    const rows = (courseId ? stmt.all(courseId) : stmt.all()) as any[];
    return rows.map((r) => ({
      id: r.id,
      courseId: r.course_id,
      title: r.title,
      grid: JSON.parse(r.grid_json || "[]"),
      surveyResponses: JSON.parse(r.survey_responses_json || "[]"),
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  public upsertChoiceBoard(board: any): void {
    if (!this.db) return;
    this.db.prepare(`
      INSERT INTO choice_boards (id, course_id, title, grid_json, survey_responses_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        course_id=excluded.course_id,
        title=excluded.title,
        grid_json=excluded.grid_json,
        survey_responses_json=excluded.survey_responses_json,
        updated_at=excluded.updated_at
    `).run(
      board.id,
      board.courseId || null,
      board.title,
      JSON.stringify(board.grid || []),
      JSON.stringify(board.surveyResponses || []),
      board.createdAt || Date.now(),
      board.updatedAt || Date.now()
    );
  }

  public deleteChoiceBoard(id: string): boolean {
    if (!this.db) return false;
    this.db.prepare("DELETE FROM choice_boards WHERE id = ?").run(id);
    return true;
  }

  public getStudySessions(courseId?: string): any[] {
    if (!this.db) return [];
    const sql = courseId
      ? "SELECT * FROM study_sessions WHERE course_id = ? ORDER BY created_at DESC"
      : "SELECT * FROM study_sessions ORDER BY created_at DESC";
    const stmt = this.db.prepare(sql);
    const rows = (courseId ? stmt.all(courseId) : stmt.all()) as any[];
    return rows.map((r) => ({
      id: r.id,
      courseId: r.course_id,
      deckId: r.deck_id,
      durationSeconds: r.duration_seconds,
      score: r.score,
      notes: r.notes,
      createdAt: r.created_at,
    }));
  }

  public recordStudySession(session: any): void {
    if (!this.db) return;
    this.db.prepare(`
      INSERT INTO study_sessions (id, course_id, deck_id, duration_seconds, score, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      session.id || `sess_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      session.courseId || null,
      session.deckId || null,
      session.durationSeconds || 0,
      session.score ?? null,
      session.notes || null,
      session.createdAt || Date.now()
    );
  }

  public getQuizQuestions(courseId?: string): any[] {
    if (!this.db) return [];
    const sql = courseId
      ? "SELECT * FROM quiz_questions WHERE course_id = ? ORDER BY created_at DESC"
      : "SELECT * FROM quiz_questions ORDER BY created_at DESC";
    const stmt = this.db.prepare(sql);
    const rows = (courseId ? stmt.all(courseId) : stmt.all()) as any[];
    return rows.map((r) => ({
      id: r.id,
      courseId: r.course_id,
      assignmentId: r.assignment_id,
      question: r.question,
      options: JSON.parse(r.options_json || "[]"),
      answer: r.answer,
      explanation: r.explanation,
      sourceRef: r.source_ref_json ? JSON.parse(r.source_ref_json) : null,
      createdAt: r.created_at,
    }));
  }

  public upsertQuizQuestion(q: any): void {
    if (!this.db) return;
    this.db.prepare(`
      INSERT INTO quiz_questions (id, course_id, assignment_id, question, options_json, answer, explanation, source_ref_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        course_id=excluded.course_id,
        assignment_id=excluded.assignment_id,
        question=excluded.question,
        options_json=excluded.options_json,
        answer=excluded.answer,
        explanation=excluded.explanation,
        source_ref_json=excluded.source_ref_json
    `).run(
      q.id || `quiz_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      q.courseId || null,
      q.assignmentId || null,
      q.question,
      JSON.stringify(q.options || []),
      q.answer,
      q.explanation || null,
      q.sourceRef ? JSON.stringify(q.sourceRef) : null,
      q.createdAt || Date.now()
    );
  }

  // --- Synchronization & Execution Logs ---

  public recordSyncJob(job: SynchronizationJob): void {
    if (!this.db) return;
    this.db.prepare(`
      INSERT INTO synchronization_jobs (id, target_type, target_id, provider, action, status, details_json, created_at, completed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        status=excluded.status,
        details_json=excluded.details_json,
        completed_at=excluded.completed_at
    `).run(
      job.id,
      job.targetType,
      job.targetId,
      job.provider,
      job.action,
      job.status,
      JSON.stringify(job.details || {}),
      job.createdAt,
      job.completedAt || null
    );
  }

  public getSyncJobs(limit = 20): SynchronizationJob[] {
    if (!this.db) return [];
    const rows = this.db.prepare("SELECT * FROM synchronization_jobs ORDER BY created_at DESC LIMIT ?").all(limit) as any[];
    return rows.map((r) => ({
      id: r.id,
      targetType: r.target_type,
      targetId: r.target_id,
      provider: r.provider,
      action: r.action,
      status: r.status,
      details: JSON.parse(r.details_json || "{}"),
      createdAt: r.created_at,
      completedAt: r.completed_at,
    }));
  }

  public recordExecutionLog(op: { operation: string; status: string; durationMs: number; details: any }): void {
    if (!this.db) return;
    const id = `exec_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    this.db.prepare(`
      INSERT INTO execution_logs (id, operation, status, duration_ms, details_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, op.operation, op.status, op.durationMs, JSON.stringify(op.details || {}), Date.now());
  }

  public getExecutionLogs(limit = 30): any[] {
    if (!this.db) return [];
    const rows = this.db.prepare("SELECT * FROM execution_logs ORDER BY created_at DESC LIMIT ?").all(limit) as any[];
    return rows.map((r) => ({
      id: r.id,
      operation: r.operation,
      status: r.status,
      durationMs: r.duration_ms,
      details: JSON.parse(r.details_json || "{}"),
      createdAt: r.created_at,
    }));
  }

  // --- Diagnostics & Storage Stats ---

  public getStats(): {
    courses: number;
    assignments: number;
    tasks: number;
    notes: number;
    documents: number;
    chunks: number;
    memories: number;
    flashcards: number;
    dbSizeEstimateBytes: number;
  } {
    if (!this.db) {
      return { courses: 0, assignments: 0, tasks: 0, notes: 0, documents: 0, chunks: 0, memories: 0, flashcards: 0, dbSizeEstimateBytes: 0 };
    }
    const count = (table: string) => {
      try {
        const row = this.db!.prepare(`SELECT COUNT(*) as c FROM ${table}`).get() as any;
        return row?.c || 0;
      } catch {
        return 0;
      }
    };

    let size = 0;
    try {
      const stat = fs.statSync(this.dbPath);
      size = stat.size;
    } catch {}

    return {
      courses: count("courses"),
      assignments: count("assignments"),
      tasks: count("tasks"),
      notes: count("notes"),
      documents: count("documents"),
      chunks: count("document_chunks"),
      memories: count("memories"),
      flashcards: count("flashcards"),
      dbSizeEstimateBytes: size,
    };
  }
}

export const sharedDatabase = new SharedDatabase();
