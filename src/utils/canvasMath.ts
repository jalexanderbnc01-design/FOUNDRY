import { Point, BoardElement, AnchorPosition, Viewport } from "../types";

export function screenToWorld(screenX: number, screenY: number, viewport: Viewport): Point {
  return {
    x: (screenX - viewport.x) / viewport.zoom,
    y: (screenY - viewport.y) / viewport.zoom,
  };
}

export function worldToScreen(worldX: number, worldY: number, viewport: Viewport): Point {
  return {
    x: worldX * viewport.zoom + viewport.x,
    y: worldY * viewport.zoom + viewport.y,
  };
}

export function getAnchorPoint(element: BoardElement, anchor: AnchorPosition): Point {
  const { x, y, width, height, rotation } = element;
  let p: Point;
  switch (anchor) {
    case "top":
      p = { x: x + width / 2, y };
      break;
    case "bottom":
      p = { x: x + width / 2, y: y + height };
      break;
    case "left":
      p = { x, y: y + height / 2 };
      break;
    case "right":
      p = { x: x + width, y: y + height / 2 };
      break;
    case "center":
    default:
      p = { x: x + width / 2, y: y + height / 2 };
      break;
  }

  if (rotation && rotation !== 0 && anchor !== "center") {
    const cx = x + width / 2;
    const cy = y + height / 2;
    const rad = (rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const dx = p.x - cx;
    const dy = p.y - cy;
    return {
      x: cx + dx * cos - dy * sin,
      y: cy + dx * sin + dy * cos,
    };
  }

  return p;
}

export function getNearestAnchor(
  element: BoardElement,
  point: Point
): { anchor: AnchorPosition; point: Point; distance: number } {
  const anchors: AnchorPosition[] = ["top", "bottom", "left", "right", "center"];
  let nearestAnchor = anchors[0];
  let minDistance = Infinity;
  let nearestPoint = getAnchorPoint(element, nearestAnchor);

  for (const anchor of anchors) {
    const p = getAnchorPoint(element, anchor);
    const dist = Math.hypot(p.x - point.x, p.y - point.y);
    if (dist < minDistance) {
      minDistance = dist;
      nearestAnchor = anchor;
      nearestPoint = p;
    }
  }

  return { anchor: nearestAnchor, point: nearestPoint, distance: minDistance };
}

export function getConnectorPath(
  start: Point,
  end: Point,
  style: "straight" | "curved" | "orthogonal" = "curved"
): string {
  if (style === "straight") {
    return `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
  }

  if (style === "orthogonal") {
    const midX = (start.x + end.x) / 2;
    return `M ${start.x} ${start.y} L ${midX} ${start.y} L ${midX} ${end.y} L ${end.x} ${end.y}`;
  }

  // Curved (smooth Bezier)
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const cx1 = start.x + dx * 0.5;
  const cy1 = start.y;
  const cx2 = start.x + dx * 0.5;
  const cy2 = end.y;

  return `M ${start.x} ${start.y} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${end.x} ${end.y}`;
}

export function getSvgPathFromPoints(points: Point[]): string {
  if (!points || points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y} L ${points[0].x} ${points[0].y}`;

  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const midX = (points[i].x + points[i + 1].x) / 2;
    const midY = (points[i].y + points[i + 1].y) / 2;
    path += ` Q ${points[i].x} ${points[i].y}, ${midX} ${midY}`;
  }
  const last = points[points.length - 1];
  path += ` L ${last.x} ${last.y}`;
  return path;
}

export function isElementInBox(
  el: BoardElement,
  box: { x: number; y: number; width: number; height: number }
): boolean {
  const boxRight = box.x + box.width;
  const boxBottom = box.y + box.height;
  const elRight = el.x + el.width;
  const elBottom = el.y + el.height;

  return (
    el.x < boxRight &&
    elRight > box.x &&
    el.y < boxBottom &&
    elBottom > box.y
  );
}

export function computeSelectionBounds(elements: BoardElement[]): {
  x: number;
  y: number;
  width: number;
  height: number;
} | null {
  if (elements.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  elements.forEach((el) => {
    minX = Math.min(minX, el.x);
    minY = Math.min(minY, el.y);
    maxX = Math.max(maxX, el.x + el.width);
    maxY = Math.max(maxY, el.y + el.height);
  });

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

export function generateId(prefix = "el"): string {
  return prefix + "-" + Math.random().toString(36).substring(2, 9) + "-" + Date.now().toString(36);
}
