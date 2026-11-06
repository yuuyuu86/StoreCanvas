import type { Board, El } from '../types';

export interface Box { x: number; y: number; width: number; height: number }

/** 回転を考慮した要素の外接矩形（Konva同様、左上を回転中心とする） */
export function elementBounds(el: El): Box {
  const r = (el.rotation * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const pts = [
    [0, 0],
    [el.width, 0],
    [el.width, el.height],
    [0, el.height],
  ].map(([px, py]) => [el.x + px * cos - py * sin, el.y + px * sin + py * cos]);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

export function unionBox(boxes: Box[]): Box | null {
  if (!boxes.length) return null;
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  const r = Math.max(...boxes.map((b) => b.x + b.width));
  const btm = Math.max(...boxes.map((b) => b.y + b.height));
  return { x, y, width: r - x, height: btm - y };
}

export const intersects = (a: Box, b: Box) =>
  a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

export const boardWidth = (b: Board) => b.pageWidth * b.pageNames.length;

export function overflowingElements(board: Board): El[] {
  const W = boardWidth(board);
  const H = board.pageHeight;
  const eps = 0.5;
  return board.elements.filter((el) => {
    if (!el.visible) return false;
    const b = elementBounds(el);
    return b.x < -eps || b.y < -eps || b.x + b.width > W + eps || b.y + b.height > H + eps;
  });
}

export function roundRectPath(
  ctx: { beginPath(): void; moveTo(x: number, y: number): void; arcTo(a: number, b: number, c: number, d: number, r: number): void; closePath(): void },
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
