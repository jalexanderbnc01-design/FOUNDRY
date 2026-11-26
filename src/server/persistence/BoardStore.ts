import { BoardElement } from "../../types";

export interface BoardRecord {
  id: string;
  title: string;
  created_at: number;
  updated_at: number;
  schema_version: number;
}

export interface BoardStore {
  /**
   * Initializes the database connection, ensures directory exists,
   * sets PRAGMAs, creates tables, and verifies schema versioning.
   */
  initialize(): Promise<void>;

  /**
   * Retrieves board metadata by ID.
   */
  getBoard(boardId: string): Promise<BoardRecord | null>;

  /**
   * Creates a new board record.
   */
  createBoard(board: BoardRecord): Promise<void>;

  /**
   * Updates partial metadata for an existing board.
   */
  updateBoard(boardId: string, patch: Partial<BoardRecord>): Promise<void>;

  /**
   * Retrieves all boards in the store.
   */
  getAllBoards(): Promise<BoardRecord[]>;

  /**
   * Retrieves all whiteboard elements for a given board.
   */
  getElements(boardId: string): Promise<BoardElement[]>;

  /**
   * Retrieves a single whiteboard element by ID.
   */
  getElement(boardId: string, elementId: string): Promise<BoardElement | null>;

  /**
   * Persists a newly created whiteboard element.
   */
  createElement(boardId: string, element: BoardElement): Promise<void>;

  /**
   * Updates an existing whiteboard element (merging or overwriting JSON).
   */
  updateElement(boardId: string, element: BoardElement): Promise<void>;

  /**
   * Batch updates multiple whiteboard elements in a single transaction.
   */
  batchUpdateElements(boardId: string, elements: BoardElement[]): Promise<void>;

  /**
   * Deletes a whiteboard element by ID.
   */
  deleteElement(boardId: string, elementId: string): Promise<void>;

  /**
   * Batch deletes whiteboard elements in a single transaction.
   */
  batchDeleteElements(boardId: string, elementIds: string[]): Promise<void>;

  /**
   * Atomically replaces all elements of a board in a single transaction.
   */
  replaceBoardElements(boardId: string, elements: BoardElement[]): Promise<void>;

  /**
   * Deletes a board and all its associated elements.
   */
  deleteBoard(boardId: string): Promise<void>;

  /**
   * Closes the database cleanly.
   */
  close(): Promise<void>;
}
