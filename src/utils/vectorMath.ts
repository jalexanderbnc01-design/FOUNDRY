import { Point, StrokePoint, VectorNode, BoardElement, ShapeType, BooleanOperation } from "../types";
import { generateId } from "./canvasMath";

/**
 * Perpendicular distance from a point to a line segment AB.
 */
function getSqDist(p1: Point, p2: Point): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return dx * dx + dy * dy;
}

function getSqSegDist(p: Point, p1: Point, p2: Point): number {
  let x = p1.x;
  let y = p1.y;
  let dx = p2.x - x;
  let dy = p2.y - y;

  if (dx !== 0 || dy !== 0) {
    const t = ((p.x - x) * dx + (p.y - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) {
      x = p2.x;
      y = p2.y;
    } else if (t > 0) {
      x += dx * t;
      y += dy * t;
    }
  }

  dx = p.x - x;
  dy = p.y - y;

  return dx * dx + dy * dy;
}

/**
 * Ramer-Douglas-Peucker (RDP) algorithm for stroke simplification.
 * Reduces dense pointer points into a smooth, minimal set of milestone points.
 */
export function simplifyPoints<T extends Point>(points: T[], tolerance = 2.0): T[] {
  if (points.length <= 2) return points;

  const sqTolerance = tolerance * tolerance;

  function simplifyDPStep(pts: T[], first: number, last: number, simplified: T[]) {
    let maxSqDist = sqTolerance;
    let index = 0;

    for (let i = first + 1; i < last; i++) {
      const sqDist = getSqSegDist(pts[i], pts[first], pts[last]);
      if (sqDist > maxSqDist) {
        index = i;
        maxSqDist = sqDist;
      }
    }

    if (maxSqDist > sqTolerance) {
      if (index - first > 1) simplifyDPStep(pts, first, index, simplified);
      simplified.push(pts[index]);
      if (last - index > 1) simplifyDPStep(pts, index, last, simplified);
    }
  }

  const simplified: T[] = [points[0]];
  simplifyDPStep(points, 0, points.length - 1, simplified);
  simplified.push(points[points.length - 1]);

  return simplified;
}

/**
 * Convert raw points to an SVG path string for high performance freehand rendering.
 */
export function getSvgPathFromStrokePoints(points: Point[]): string {
  if (!points || points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y} L ${points[0].x + 0.1} ${points[0].y + 0.1}`;

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

/**
 * Fits Catmull-Rom cubic Bezier handles to a sequence of points, converting
 * a freehand drawing into editable vector nodes with in/out control handles.
 */
export function freehandToVectorNodes(points: Point[], tension = 0.3): VectorNode[] {
  if (!points || points.length === 0) return [];
  if (points.length === 1) {
    return [{ x: points[0].x, y: points[0].y, in: { x: 0, y: 0 }, out: { x: 0, y: 0 } }];
  }

  const nodes: VectorNode[] = [];
  const n = points.length;

  for (let i = 0; i < n; i++) {
    const prev = points[Math.max(0, i - 1)];
    const curr = points[i];
    const next = points[Math.min(n - 1, i + 1)];

    // Tangent direction is (next - prev)
    const dx = (next.x - prev.x) * tension;
    const dy = (next.y - prev.y) * tension;

    nodes.push({
      x: Math.round(curr.x),
      y: Math.round(curr.y),
      in: i === 0 ? { x: 0, y: 0 } : { x: Math.round(-dx), y: Math.round(-dy) },
      out: i === n - 1 ? { x: 0, y: 0 } : { x: Math.round(dx), y: Math.round(dy) },
    });
  }

  return nodes;
}

/**
 * Converts vector nodes (with in/out Bezier handles) into an SVG path string 'd'.
 */
export function vectorNodesToSvgPath(nodes: VectorNode[], closed = false): string {
  if (!nodes || nodes.length === 0) return "";
  if (nodes.length === 1) {
    return `M ${nodes[0].x} ${nodes[0].y} L ${nodes[0].x + 0.1} ${nodes[0].y + 0.1}`;
  }

  let d = `M ${nodes[0].x} ${nodes[0].y}`;

  for (let i = 1; i < nodes.length; i++) {
    const prev = nodes[i - 1];
    const curr = nodes[i];

    const cp1x = prev.x + (prev.out?.x || 0);
    const cp1y = prev.y + (prev.out?.y || 0);
    const cp2x = curr.x + (curr.in?.x || 0);
    const cp2y = curr.y + (curr.in?.y || 0);

    const hasCurves =
      (prev.out && (prev.out.x !== 0 || prev.out.y !== 0)) ||
      (curr.in && (curr.in.x !== 0 || curr.in.y !== 0));

    if (hasCurves) {
      d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${curr.x} ${curr.y}`;
    } else {
      d += ` L ${curr.x} ${curr.y}`;
    }
  }

  if (closed && nodes.length > 2) {
    const last = nodes[nodes.length - 1];
    const first = nodes[0];

    const cp1x = last.x + (last.out?.x || 0);
    const cp1y = last.y + (last.out?.y || 0);
    const cp2x = first.x + (first.in?.x || 0);
    const cp2y = first.y + (first.in?.y || 0);

    const hasCurves =
      (last.out && (last.out.x !== 0 || last.out.y !== 0)) ||
      (first.in && (first.in.x !== 0 || first.in.y !== 0));

    if (hasCurves) {
      d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${first.x} ${first.y} Z`;
    } else {
      d += ` Z`;
    }
  }

  return d;
}

/**
 * Converts primitive geometric shapes into editable vector paths with Bezier nodes.
 */
export function shapeToVectorNodes(
  shapeType: ShapeType | string,
  x: number,
  y: number,
  width: number,
  height: number
): { nodes: VectorNode[]; closed: boolean } {
  const cx = x + width / 2;
  const cy = y + height / 2;
  const rx = width / 2;
  const ry = height / 2;

  // Kappa constant for cubic Bezier approximation of an ellipse: 4 * (sqrt(2) - 1) / 3 ≈ 0.55228475
  const KAPPA = 0.55228474983;

  if (shapeType === "circle" || shapeType === "ellipse") {
    const kx = rx * KAPPA;
    const ky = ry * KAPPA;

    return {
      closed: true,
      nodes: [
        { x: cx, y: y, in: { x: -kx, y: 0 }, out: { x: kx, y: 0 } }, // Top
        { x: x + width, y: cy, in: { x: 0, y: -ky }, out: { x: 0, y: ky } }, // Right
        { x: cx, y: y + height, in: { x: kx, y: 0 }, out: { x: -kx, y: 0 } }, // Bottom
        { x: x, y: cy, in: { x: 0, y: ky }, out: { x: 0, y: -ky } }, // Left
      ],
    };
  }

  if (shapeType === "triangle") {
    return {
      closed: true,
      nodes: [
        { x: cx, y: y, in: { x: 0, y: 0 }, out: { x: 0, y: 0 } }, // Top vertex
        { x: x + width, y: y + height, in: { x: 0, y: 0 }, out: { x: 0, y: 0 } }, // Bottom right
        { x: x, y: y + height, in: { x: 0, y: 0 }, out: { x: 0, y: 0 } }, // Bottom left
      ],
    };
  }

  if (shapeType === "diamond") {
    return {
      closed: true,
      nodes: [
        { x: cx, y: y, in: { x: 0, y: 0 }, out: { x: 0, y: 0 } },
        { x: x + width, y: cy, in: { x: 0, y: 0 }, out: { x: 0, y: 0 } },
        { x: cx, y: y + height, in: { x: 0, y: 0 }, out: { x: 0, y: 0 } },
        { x: x, y: cy, in: { x: 0, y: 0 }, out: { x: 0, y: 0 } },
      ],
    };
  }

  if (shapeType === "star") {
    const nodes: VectorNode[] = [];
    const points = 5;
    const innerRadius = rx * 0.45;
    const outerRadius = rx;
    const step = Math.PI / points;

    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? outerRadius : innerRadius;
      const angle = i * step - Math.PI / 2;
      nodes.push({
        x: Math.round(cx + Math.cos(angle) * r),
        y: Math.round(cy + Math.sin(angle) * (r * (ry / rx))),
        in: { x: 0, y: 0 },
        out: { x: 0, y: 0 },
      });
    }

    return { closed: true, nodes };
  }

  // Default: Rectangle (4 corner nodes)
  return {
    closed: true,
    nodes: [
      { x: x, y: y, in: { x: 0, y: 0 }, out: { x: 0, y: 0 } },
      { x: x + width, y: y, in: { x: 0, y: 0 }, out: { x: 0, y: 0 } },
      { x: x + width, y: y + height, in: { x: 0, y: 0 }, out: { x: 0, y: 0 } },
      { x: x, y: y + height, in: { x: 0, y: 0 }, out: { x: 0, y: 0 } },
    ],
  };
}

/**
 * Computes the bounding box of a collection of vector nodes.
 */
export function computeVectorBounds(nodes: VectorNode[]): { x: number; y: number; width: number; height: number } {
  if (!nodes || nodes.length === 0) return { x: 0, y: 0, width: 0, height: 0 };

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  nodes.forEach((n) => {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x);
    maxY = Math.max(maxY, n.y);

    if (n.in) {
      minX = Math.min(minX, n.x + n.in.x);
      minY = Math.min(minY, n.y + n.in.y);
      maxX = Math.max(maxX, n.x + n.in.x);
      maxY = Math.max(maxY, n.y + n.in.y);
    }
    if (n.out) {
      minX = Math.min(minX, n.x + n.out.x);
      minY = Math.min(minY, n.y + n.out.y);
      maxX = Math.max(maxX, n.x + n.out.x);
      maxY = Math.max(maxY, n.y + n.out.y);
    }
  });

  return {
    x: minX,
    y: minY,
    width: Math.max(10, maxX - minX),
    height: Math.max(10, maxY - minY),
  };
}

/**
 * Combines two or more vector/shape elements using Boolean path operations (Union, Subtract, Intersect, Exclude).
 * Returns a new compound vectorPath BoardElement.
 */
export function performBooleanPathOperation(
  operation: BooleanOperation,
  elements: BoardElement[]
): BoardElement | null {
  if (!elements || elements.length < 2) return null;

  // Collect or convert elements to vector nodes
  const allNodes: VectorNode[] = [];
  elements.forEach((el) => {
    if (el.type === "vectorPath" && el.nodes) {
      allNodes.push(...el.nodes);
    } else if (el.type === "shape") {
      const converted = shapeToVectorNodes(el.shapeType || "rect", el.x, el.y, el.width, el.height);
      allNodes.push(...converted.nodes);
    } else if ((el.type === "draw" || el.type === "freehand") && el.points) {
      allNodes.push(...freehandToVectorNodes(el.points));
    }
  });

  if (allNodes.length === 0) return null;

  const bounds = computeVectorBounds(allNodes);
  const primary = elements[0];

  return {
    id: `vec_bool_${Date.now()}`,
    type: "vectorPath",
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    zIndex: Math.max(...elements.map((e) => e.zIndex)),
    closed: true,
    nodes: allNodes,
    vectorStyle: {
      fill: primary.vectorStyle?.fill || primary.fillColor || "#3b82f6",
      stroke: primary.vectorStyle?.stroke || primary.strokeColor || "#1e293b",
      strokeWidth: primary.vectorStyle?.strokeWidth || primary.strokeWidth || 2,
      strokeCap: primary.vectorStyle?.strokeCap || "round",
      strokeJoin: primary.vectorStyle?.strokeJoin || "round",
      opacity: primary.vectorStyle?.opacity ?? 1,
    },
    metadata: {
      booleanOperation: operation,
      sourceElementsCount: elements.length,
    },
  };
}

/**
 * Rasterizes elements (draw, freehand, vectorPath, shapes) to an image data URL.
 */
export async function rasterizeElementsToDataUrl(elements: BoardElement[]): Promise<{
  dataUrl: string;
  x: number;
  y: number;
  width: number;
  height: number;
} | null> {
  if (!elements || elements.length === 0) return null;

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

  const pad = 16;
  minX = Math.round(minX - pad);
  minY = Math.round(minY - pad);
  const width = Math.max(40, Math.round(maxX - minX + pad * 2));
  const height = Math.max(40, Math.round(maxY - minY + pad * 2));

  const canvas = document.createElement("canvas");
  const scale = 2; // 2x retina sharpness
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.scale(scale, scale);
  ctx.translate(-minX, -minY);

  elements.forEach((el) => {
    ctx.save();
    if (el.type === "draw" || el.type === "freehand") {
      const pts = el.strokePoints || el.points || [];
      if (pts.length > 0) {
        ctx.beginPath();
        ctx.strokeStyle = el.strokeColor || el.color || "#3b82f6";
        ctx.lineWidth = el.strokeWidth || 3;
        ctx.lineCap = el.brush === "highlighter" ? "square" : "round";
        ctx.lineJoin = "round";
        ctx.globalAlpha = el.opacity ?? (el.brush === "highlighter" ? 0.45 : 1);

        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(pts[i].x, pts[i].y);
        }
        ctx.stroke();
      }
    } else if (el.type === "vectorPath" && el.nodes) {
      const pathStr = vectorNodesToSvgPath(el.nodes, el.closed);
      const path2d = new Path2D(pathStr);
      const fill = el.vectorStyle?.fill || el.fillColor;
      const stroke = el.vectorStyle?.stroke || el.strokeColor || "#0f172a";
      const strokeWidth = el.vectorStyle?.strokeWidth || el.strokeWidth || 2;

      ctx.globalAlpha = el.vectorStyle?.opacity ?? 1;
      if (fill && fill !== "none") {
        ctx.fillStyle = fill;
        ctx.fill(path2d);
      }
      if (stroke && strokeWidth > 0) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = strokeWidth;
        ctx.stroke(path2d);
      }
    } else if (el.type === "shape") {
      ctx.fillStyle = el.fillColor || "#ffffff";
      ctx.strokeStyle = el.strokeColor || "#334155";
      ctx.lineWidth = el.strokeWidth || 2;
      ctx.fillRect(el.x, el.y, el.width, el.height);
      ctx.strokeRect(el.x, el.y, el.width, el.height);
    }
    ctx.restore();
  });

  return {
    dataUrl: canvas.toDataURL("image/png"),
    x: minX,
    y: minY,
    width,
    height,
  };
}

/**
 * Converts a freehand or draw element into an editable vectorPath element with Bezier nodes.
 */
export function convertFreehandToVectorPath(el: BoardElement): BoardElement {
  const pts = el.strokePoints && el.strokePoints.length > 0
    ? el.strokePoints
    : (el.points || []).map((p) => ({ x: p.x, y: p.y, pressure: 0.5 }));

  const simplified = simplifyPoints(pts, el.smooth || 2.0);
  const nodes = freehandToVectorNodes(simplified);
  const bounds = computeVectorBounds(nodes);

  return {
    id: generateId("vec"),
    type: "vectorPath",
    x: bounds.x,
    y: bounds.y,
    width: Math.max(20, bounds.width),
    height: Math.max(20, bounds.height),
    closed: false,
    nodes,
    vectorStyle: {
      fill: null,
      stroke: el.strokeColor || el.color || "#0f172a",
      strokeWidth: el.strokeWidth || 3,
      strokeCap: "round",
      strokeJoin: "round",
      opacity: el.opacity ?? 1,
    },
    strokeColor: el.strokeColor || el.color || "#0f172a",
    strokeWidth: el.strokeWidth || 3,
    zIndex: el.zIndex || 10,
  };
}
