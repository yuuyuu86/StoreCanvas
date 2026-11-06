import type { Background, Board, El, Project } from '../types';
import { FRAME_GAP_DEFAULT } from './constants';

/**
 * IndexedDB から読み込んだデータを検証・正規化する。
 * 壊れたデータや想定外の値（巨大なサイズ、外部URLの画像など）でアプリが落ちたり、
 * 意図しない外部通信が発生したりしないようにする。
 */

const MAX_SIDE = 10000;
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown, d = '') => (typeof v === 'string' ? v : d);
const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const bool = (v: unknown, d = false) => (typeof v === 'boolean' ? v : d);
/** 画像は埋め込み（data:image/）のみ許可。外部URLは読み込まない */
const imgSrc = (v: unknown) => (typeof v === 'string' && /^data:image\/(png|jpeg|webp|gif|avif|bmp);/i.test(v) ? v : null);
const color = (v: unknown, d: string) => (typeof v === 'string' && v.length <= 64 ? v : d);

function sanitizeBackground(v: unknown): Background {
  const b = isObj(v) ? v : {};
  return {
    type: b.type === 'linear' ? 'linear' : 'solid',
    color: color(b.color, '#ffffff'),
    color2: color(b.color2, '#ffffff'),
    angle: num(b.angle, 180),
  };
}

function sanitizeElement(v: unknown): El | null {
  if (!isObj(v) || typeof v.id !== 'string') return null;
  const base = {
    id: v.id,
    name: str(v.name, '要素').slice(0, 200),
    x: num(v.x),
    y: num(v.y),
    width: clamp(num(v.width, 100), 1, MAX_SIDE * 10),
    height: clamp(num(v.height, 100), 1, MAX_SIDE * 10),
    rotation: num(v.rotation),
    opacity: clamp(num(v.opacity, 1), 0, 1),
    visible: bool(v.visible, true),
    locked: bool(v.locked),
    groupId: typeof v.groupId === 'string' ? v.groupId : null,
  };
  switch (v.type) {
    case 'text':
      return {
        ...base,
        type: 'text',
        text: str(v.text).slice(0, 10000),
        fontSize: clamp(num(v.fontSize, 48), 1, 2000),
        fontFamily: str(v.fontFamily, 'Noto Sans JP').slice(0, 100),
        fontStyle: str(v.fontStyle, 'normal').slice(0, 20),
        fill: color(v.fill, '#000000'),
        align: v.align === 'left' || v.align === 'right' ? v.align : 'center',
        lineHeight: clamp(num(v.lineHeight, 1.2), 0.1, 10),
      };
    case 'image': {
      const src = imgSrc(v.src);
      if (!src) return null;
      return { ...base, type: 'image', src, cornerRadius: Math.max(0, num(v.cornerRadius)) };
    }
    case 'rect':
    case 'ellipse':
      return {
        ...base,
        type: v.type,
        fill: color(v.fill, '#cccccc'),
        stroke: color(v.stroke, '#000000'),
        strokeWidth: Math.max(0, num(v.strokeWidth)),
        cornerRadius: Math.max(0, num(v.cornerRadius)),
      };
    case 'device':
      return {
        ...base,
        type: 'device',
        model: v.model === 'android' || v.model === 'ipad' || v.model === 'tablet' ? v.model : 'iphone',
        frameColor: color(v.frameColor, '#1c1c1e'),
        screenSrc: imgSrc(v.screenSrc),
        screenScale: clamp(num(v.screenScale, 1), 0.1, 10),
        screenOffsetX: clamp(num(v.screenOffsetX), -2, 2),
        screenOffsetY: clamp(num(v.screenOffsetY), -2, 2),
        shadow: Math.max(0, num(v.shadow)),
        glare: bool(v.glare),
      };
    default:
      return null;
  }
}

function sanitizeBoard(v: unknown): Board | null {
  if (!isObj(v) || typeof v.id !== 'string') return null;
  const pageNames = Array.isArray(v.pageNames) ? v.pageNames.filter((n): n is string => typeof n === 'string').slice(0, 10) : [];
  return {
    id: v.id,
    name: str(v.name, 'ページ').slice(0, 200),
    pageNames: pageNames.length ? pageNames : ['1'],
    pageWidth: Math.round(clamp(num(v.pageWidth, 1080), 16, MAX_SIDE)),
    pageHeight: Math.round(clamp(num(v.pageHeight, 1920), 16, MAX_SIDE)),
    background: sanitizeBackground(v.background),
    elements: Array.isArray(v.elements) ? (v.elements.map(sanitizeElement).filter(Boolean) as El[]) : [],
    presetId: typeof v.presetId === 'string' ? v.presetId : null,
    exportFormat: v.exportFormat === 'jpeg' ? 'jpeg' : 'png',
    x: typeof v.x === 'number' && Number.isFinite(v.x) ? v.x : NaN,
    y: typeof v.y === 'number' && Number.isFinite(v.y) ? v.y : NaN,
  };
}

export function sanitizeProjects(data: unknown): Project[] {
  if (!Array.isArray(data)) return [];
  const out: Project[] = [];
  for (const v of data) {
    if (!isObj(v) || typeof v.id !== 'string') continue;
    const boards = Array.isArray(v.boards) ? (v.boards.map(sanitizeBoard).filter(Boolean) as Board[]) : [];
    // 位置情報のない（旧バージョンの）フレームは横一列に配置
    if (boards.some((b) => Number.isNaN(b.x) || Number.isNaN(b.y))) {
      let x = 0;
      for (const b of boards) {
        b.x = x;
        b.y = 0;
        x += b.pageWidth * b.pageNames.length + FRAME_GAP_DEFAULT;
      }
    }
    const now = Date.now();
    out.push({
      id: v.id,
      name: str(v.name, '無題のプロジェクト').slice(0, 200),
      createdAt: num(v.createdAt, now),
      updatedAt: num(v.updatedAt, now),
      boards,
    });
  }
  return out;
}
