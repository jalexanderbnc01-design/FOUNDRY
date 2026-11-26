import { DatabaseSync, StatementSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { BoardElement } from "../../types";
import { BoardRecord, BoardStore } from "./BoardStore";

export const CURRENT_SCHEMA_VERSION = 1;

export class SqliteBoardStore implements BoardStore {
  private dbPath: string;
  private db: DatabaseSync | null = null;

  // Cached prepared statements
  private stmtGetBoard: StatementSync | null = null;
  private stmtInsertBoard: StatementSync | null = null;
  private stmtUpdateBoardTitle: StatementSync | null = null;
  private stmtGetAllBoards: StatementSync | null = null;
  private stmtDeleteBoard: StatementSync | null = null;

  private stmtGetElements: StatementSync | null = null;
  private stmtGetElement: StatementSync | null = null;
  private stmtUpsertElement: StatementSync | null = null;
  private stmtDeleteElement: StatementSync | null = null;
  private stmtDeleteAllElements: StatementSync | null = null;

  constructor(customPath?: string) {
    this.dbPath =
      customPath ||
      path.join(process.cwd(), "data", "whiteboard", "whiteboard.sqlite");
  }

  public async initialize(): Promise<void> {
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new DatabaseSync(this.dbPath);

    // Optimize performance and enforce constraints
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.db.exec("PRAGMA foreign_keys = ON;");
    this.db.exec("PRAGMA synchronous = NORMAL;");

    // Initialize base tables
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS boards (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        schema_version INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS elements (
        id TEXT NOT NULL,
        board_id TEXT NOT NULL,
        type TEXT NOT NULL,
        data_json TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY(board_id, id),
        FOREIGN KEY(board_id) REFERENCES boards(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_elements_board_id ON elements(board_id);
    `);

    // Check schema version
    this.verifyAndApplySchemaVersion();

    // Prepare statement caches
    this.stmtGetBoard = this.db.prepare(
      "SELECT id, title, created_at, updated_at, schema_version FROM boards WHERE id = ?"
    );
    this.stmtInsertBoard = this.db.prepare(
      "INSERT INTO boards (id, title, created_at, updated_at, schema_version) VALUES (?, ?, ?, ?, ?)"
    );
    this.stmtUpdateBoardTitle = this.db.prepare(
      "UPDATE boards SET title = ?, updated_at = ? WHERE id = ?"
    );
    this.stmtGetAllBoards = this.db.prepare(
      "SELECT id, title, created_at, updated_at, schema_version FROM boards ORDER BY updated_at DESC"
    );
    this.stmtDeleteBoard = this.db.prepare(
      "DELETE FROM boards WHERE id = ?"
    );

    this.stmtGetElements = this.db.prepare(
      "SELECT data_json FROM elements WHERE board_id = ? ORDER BY created_at ASC"
    );
    this.stmtGetElement = this.db.prepare(
      "SELECT data_json FROM elements WHERE board_id = ? AND id = ?"
    );
    this.stmtUpsertElement = this.db.prepare(`
      INSERT INTO elements (id, board_id, type, data_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(board_id, id) DO UPDATE SET
        type = excluded.type,
        data_json = excluded.data_json,
        updated_at = excluded.updated_at
    `);
    this.stmtDeleteElement = this.db.prepare(
      "DELETE FROM elements WHERE board_id = ? AND id = ?"
    );
    this.stmtDeleteAllElements = this.db.prepare(
      "DELETE FROM elements WHERE board_id = ?"
    );
  }

  private verifyAndApplySchemaVersion(): void {
    if (!this.db) throw new Error("Database not initialized");

    const getMeta = this.db.prepare(
      "SELECT value FROM schema_meta WHERE key = 'schema_version'"
    );
    const row = getMeta.get() as { value?: string } | undefined;

    if (!row || !row.value) {
      // Fresh database
      const setMeta = this.db.prepare(
        "INSERT INTO schema_meta (key, value) VALUES ('schema_version', ?)"
      );
      setMeta.run(String(CURRENT_SCHEMA_VERSION));
    } else {
      const storedVersion = parseInt(row.value, 10);
      if (storedVersion > CURRENT_SCHEMA_VERSION) {
        throw new Error(
          `Unsupported newer database schema version ${storedVersion} (maximum supported is ${CURRENT_SCHEMA_VERSION}). Halting to prevent data corruption.`
        );
      }
      if (storedVersion < CURRENT_SCHEMA_VERSION) {
        // Migration path hook for future versions
        // (For version 1, no prior migrations are required)
        const updateMeta = this.db.prepare(
          "UPDATE schema_meta SET value = ? WHERE key = 'schema_version'"
        );
        updateMeta.run(String(CURRENT_SCHEMA_VERSION));
      }
    }
  }

  public async getBoard(boardId: string): Promise<BoardRecord | null> {
    if (!this.stmtGetBoard) throw new Error("Store not initialized");
    const row = this.stmtGetBoard.get(boardId) as any;
    if (!row) return null;
    return {
      id: row.id,
      title: row.title,
      created_at: Number(row.created_at),
      updated_at: Number(row.updated_at),
      schema_version: Number(row.schema_version),
    };
  }

  public async createBoard(board: BoardRecord): Promise<void> {
    if (!this.stmtInsertBoard) throw new Error("Store not initialized");
    this.stmtInsertBoard.run(
      board.id,
      board.title,
      board.created_at || Date.now(),
      board.updated_at || Date.now(),
      board.schema_version || CURRENT_SCHEMA_VERSION
    );
  }

  public async updateBoard(
    boardId: string,
    patch: Partial<BoardRecord>
  ): Promise<void> {
    if (!this.db || !this.stmtUpdateBoardTitle)
      throw new Error("Store not initialized");
    if (patch.title !== undefined) {
      this.stmtUpdateBoardTitle.run(patch.title, Date.now(), boardId);
    }
  }

  public async getAllBoards(): Promise<BoardRecord[]> {
    if (!this.stmtGetAllBoards) throw new Error("Store not initialized");
    const rows = this.stmtGetAllBoards.all() as any[];
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      created_at: Number(r.created_at),
      updated_at: Number(r.updated_at),
      schema_version: Number(r.schema_version),
    }));
  }

  public async deleteBoard(boardId: string): Promise<void> {
    if (!this.stmtDeleteBoard) throw new Error("Store not initialized");
    this.stmtDeleteBoard.run(boardId);
  }

  public async getElements(boardId: string): Promise<BoardElement[]> {
    if (!this.stmtGetElements) throw new Error("Store not initialized");
    const rows = this.stmtGetElements.all(boardId) as { data_json: string }[];
    const result: BoardElement[] = [];
    for (const r of rows) {
      try {
        result.push(JSON.parse(r.data_json));
      } catch (e) {
        console.error("Failed to parse element JSON from database:", e);
      }
    }
    return result;
  }

  public async getElement(
    boardId: string,
    elementId: string
  ): Promise<BoardElement | null> {
    if (!this.stmtGetElement) throw new Error("Store not initialized");
    const row = this.stmtGetElement.get(boardId, elementId) as
      | { data_json: string }
      | undefined;
    if (!row) return null;
    try {
      return JSON.parse(row.data_json);
    } catch {
      return null;
    }
  }

  public async createElement(
    boardId: string,
    element: BoardElement
  ): Promise<void> {
    if (!this.stmtUpsertElement) throw new Error("Store not initialized");
    const now = Date.now();
    this.stmtUpsertElement.run(
      element.id,
      boardId,
      element.type || "shape",
      JSON.stringify(element),
      now,
      now
    );
  }

  public async updateElement(
    boardId: string,
    element: BoardElement
  ): Promise<void> {
    if (!this.stmtUpsertElement) throw new Error("Store not initialized");
    const now = Date.now();
    this.stmtUpsertElement.run(
      element.id,
      boardId,
      element.type || "shape",
      JSON.stringify(element),
      now,
      now
    );
  }

  public async batchUpdateElements(
    boardId: string,
    elements: BoardElement[]
  ): Promise<void> {
    if (!this.db || !this.stmtUpsertElement)
      throw new Error("Store not initialized");
    if (elements.length === 0) return;

    this.db.exec("BEGIN;");
    try {
      const now = Date.now();
      for (const el of elements) {
        this.stmtUpsertElement.run(
          el.id,
          boardId,
          el.type || "shape",
          JSON.stringify(el),
          now,
          now
        );
      }
      this.db.exec("COMMIT;");
    } catch (err) {
      this.db.exec("ROLLBACK;");
      throw err;
    }
  }

  public async deleteElement(
    boardId: string,
    elementId: string
  ): Promise<void> {
    if (!this.stmtDeleteElement) throw new Error("Store not initialized");
    this.stmtDeleteElement.run(boardId, elementId);
  }

  public async batchDeleteElements(
    boardId: string,
    elementIds: string[]
  ): Promise<void> {
    if (!this.db || !this.stmtDeleteElement)
      throw new Error("Store not initialized");
    if (elementIds.length === 0) return;

    this.db.exec("BEGIN;");
    try {
      for (const id of elementIds) {
        this.stmtDeleteElement.run(boardId, id);
      }
      this.db.exec("COMMIT;");
    } catch (err) {
      this.db.exec("ROLLBACK;");
      throw err;
    }
  }

  public async replaceBoardElements(
    boardId: string,
    elements: BoardElement[]
  ): Promise<void> {
    if (!this.db || !this.stmtDeleteAllElements || !this.stmtUpsertElement) {
      throw new Error("Store not initialized");
    }

    this.db.exec("BEGIN;");
    try {
      this.stmtDeleteAllElements.run(boardId);
      const now = Date.now();
      for (const el of elements) {
        this.stmtUpsertElement.run(
          el.id,
          boardId,
          el.type || "shape",
          JSON.stringify(el),
          now,
          now
        );
      }
      this.db.exec("COMMIT;");
    } catch (err) {
      this.db.exec("ROLLBACK;");
      throw err;
    }
  }

  public async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}
