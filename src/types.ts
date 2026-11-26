export type ElementType =
  | "sticky"
  | "shape"
  | "text"
  | "connector"
  | "draw"
  | "freehand"
  | "vectorPath"
  | "frame"
  | "html"
  | "image"
  | "file"
  | "link"
  | "comment";

export type ToolType =
  | "select"
  | "hand"
  | "draw"
  | "vector"
  | "vector-node"
  | "vector-pen"
  | "vector-line"
  | "vector-rect"
  | "vector-ellipse"
  | "vector-star"
  | "vector-polygon"
  | "eraser"
  | "sticky"
  | "shape"
  | "text"
  | "connector"
  | "frame"
  | "html"
  | "image"
  | "file"
  | "link"
  | "comment"
  | "laser"
  | "eyedropper"
  | "ai";

export type BrushType = "pen" | "pencil" | "marker" | "highlighter" | "eraser";

export interface StrokePoint {
  x: number;
  y: number;
  pressure?: number;
}

export interface VectorNode {
  x: number;
  y: number;
  in?: Point;  // relative offset e.g. { x: -25, y: 0 }
  out?: Point; // relative offset e.g. { x: 40, y: 20 }
  nodeType?: "corner" | "smooth";
}

export interface VectorStyle {
  fill?: string | null;
  stroke: string;
  strokeWidth: number;
  strokeCap?: "round" | "butt" | "square";
  strokeJoin?: "round" | "miter" | "bevel";
  opacity?: number;
}

export type BooleanOperation = "union" | "subtract" | "intersect" | "exclude";

export type ShapeType =
  | "rect"
  | "rounded-rect"
  | "circle"
  | "diamond"
  | "triangle"
  | "star"
  | "cloud"
  | "cylinder";

export type LineStyle = "straight" | "curved" | "orthogonal";

export type AnchorPosition = "top" | "bottom" | "left" | "right" | "center";

export type EditorRailMode = "select" | "draw" | "vector";

export type ViewMode = "flat" | "soft-3d" | "deep-3d" | "presentation";

export type HtmlCardState = "live" | "snapshot" | "image" | "code";

export interface AnchorBinding {
  elementId: string;
  anchor: AnchorPosition;
}

export interface Point {
  x: number;
  y: number;
}

export interface CommentReply {
  id: string;
  author: string;
  authorColor?: string;
  authorId?: string;
  text: string;
  timestamp: number;
}

export interface BoardElement {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  zIndex: number;
  content?: string;
  shapeType?: ShapeType;
  color?: string;
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  strokeStyle?: "solid" | "dashed";
  fontSize?: number;
  textAlign?: "left" | "center" | "right";
  points?: Point[]; // for freehand drawings
  strokePoints?: StrokePoint[]; // with pressure data
  brush?: BrushType;
  opacity?: number;
  smooth?: number;
  stabilize?: boolean;

  // Vector Path specific fields
  nodes?: VectorNode[];
  closed?: boolean;
  vectorStyle?: VectorStyle;
  startBinding?: AnchorBinding;
  endBinding?: AnchorBinding;
  startPoint?: Point;
  endPoint?: Point;
  arrowStart?: boolean;
  arrowEnd?: boolean;
  lineStyle?: LineStyle;
  title?: string;
  locked?: boolean;
  hidden?: boolean;
  cornerRadius?: number;
  groupId?: string;
  frameId?: string;
  createdBy?: string;
  depth?: number; // 0 = board surface, 1 = notes, 2 = media/HTML, 3 = active elevated
  metadata?: Record<string, any>;

  // HTML Card specific fields
  rawHtml?: string;
  rasterUrl?: string;
  isRasterized?: boolean;
  htmlState?: HtmlCardState;
  sourceName?: string;

  // Media / File / Link / Comment fields
  imageUrl?: string;
  fileName?: string;
  fileSize?: string;
  fileType?: string;
  fileData?: string;
  linkUrl?: string;
  linkTitle?: string;
  linkDescription?: string;
  linkFavicon?: string;
  commentAuthor?: string;
  commentResolved?: boolean;
  commentReplies?: CommentReply[];

  authorId?: string;
  authorName?: string;
  reactions?: Record<string, number>;
  revision?: number;
}

// ----------------------------------------------------
// Multiplayer Operation-Based Undo / Redo Types
// ----------------------------------------------------

export type OperationType =
  | "create"
  | "update"
  | "delete"
  | "batch_create"
  | "batch_update"
  | "batch_delete";

export interface BaseOperation {
  operationId: string;
  transactionId: string;
  boardId: string;
  actorId: string;
  actorName?: string;
  timestamp: number;
  description: string;
}

export interface CreateElementOp extends BaseOperation {
  type: "create";
  element: BoardElement;
}

export interface UpdateElementOp extends BaseOperation {
  type: "update";
  elementId: string;
  before: BoardElement;
  after: BoardElement;
  baseRevision?: number;
}

export interface DeleteElementOp extends BaseOperation {
  type: "delete";
  elementId: string;
  before: BoardElement;
  baseRevision?: number;
}

export interface BatchCreateOp extends BaseOperation {
  type: "batch_create";
  elements: BoardElement[];
}

export interface BatchUpdateOp extends BaseOperation {
  type: "batch_update";
  updates: Array<{
    id: string;
    before: BoardElement;
    after: BoardElement;
    baseRevision?: number;
  }>;
}

export interface BatchDeleteOp extends BaseOperation {
  type: "batch_delete";
  elements: BoardElement[]; // snapshots of deleted elements
}

export type BoardOperation =
  | CreateElementOp
  | UpdateElementOp
  | DeleteElementOp
  | BatchCreateOp
  | BatchUpdateOp
  | BatchDeleteOp;

export interface ConflictResolutionResult {
  hasConflict: boolean;
  canApplyPartial: boolean;
  reason?: string;
  conflictingFields?: string[];
  reconciledElement?: BoardElement;
}

export interface UserPresence {
  id: string;
  name: string;
  color: string;
  cursor?: Point;
  selectedIds?: string[];
  activeAction?: string; // e.g. "Editing note", "Viewing HTML card", "Moving frame"
  activeTool?: string;
  lastActive: number;
}

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

export interface ActivityLogItem {
  id: string;
  userId: string;
  userName: string;
  userColor: string;
  action: string;
  timestamp: number;
  elementId?: string;
  elementTitle?: string;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  category: "Agile" | "Diagramming" | "Brainstorming" | "Architecture";
  elements: Omit<BoardElement, "id">[];
}

export interface AiRequestOptions {
  action:
    | "summarize"
    | "cluster"
    | "flowchart"
    | "action_items"
    | "find_duplicates"
    | "generate_notes";
  selectedElements?: BoardElement[];
  userPrompt?: string;
  boardTitle?: string;
}

export interface BoardMetadata {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  elementCount?: number;
}

export interface LaserPoint {
  x: number;
  y: number;
  color: string;
  userId: string;
  userName?: string;
  timestamp: number;
}

export interface ReactionBurst {
  id: string;
  emoji: string;
  x: number;
  y: number;
  userId: string;
  userName: string;
  timestamp: number;
}

export interface ExportOptions {
  format: "png" | "svg" | "json";
  scale: 1 | 2 | 3;
  scope: "all" | "viewport" | "selected";
  transparentBg?: boolean;
}

