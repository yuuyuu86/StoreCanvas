import { nanoid } from 'nanoid';
import type { Background, Board, DeviceEl, DeviceModel, ImageEl, ShapeEl, TextEl } from '../types';

export const uid = () => nanoid(10);

const base = { rotation: 0, opacity: 1, visible: true, locked: false, groupId: null };

export const DEVICE_ASPECT: Record<DeviceModel, number> = {
  iphone: 0.48,
  android: 0.468,
  ipad: 0.77,
  tablet: 0.647,
};

export const DEVICE_LABEL: Record<DeviceModel, string> = {
  iphone: 'iPhone',
  android: 'Android スマホ',
  ipad: 'iPad',
  tablet: 'Android タブレット',
};

export const FONTS = ['Noto Sans JP', 'M PLUS Rounded 1c', 'Dela Gothic One', 'Inter', 'serif'];

type Req<T, K extends keyof T> = Partial<T> & Pick<T, K>;

export function makeText(p: Req<TextEl, 'x' | 'y' | 'width' | 'text'>): TextEl {
  const fontSize = p.fontSize ?? 64;
  return {
    ...base,
    id: uid(),
    name: 'テキスト',
    type: 'text',
    height: fontSize * 1.3,
    fontSize,
    fontFamily: 'Noto Sans JP',
    fontStyle: 'bold',
    fill: '#1b1b1b',
    align: 'center',
    lineHeight: 1.25,
    ...p,
  };
}

export function makeShape(p: Req<ShapeEl, 'x' | 'y' | 'width' | 'height' | 'type'>): ShapeEl {
  return {
    ...base,
    id: uid(),
    name: p.type === 'rect' ? '長方形' : '楕円',
    fill: '#d9e7df',
    stroke: '#1f5c3f',
    strokeWidth: 0,
    cornerRadius: 0,
    ...p,
  };
}

export function makeImage(p: Req<ImageEl, 'x' | 'y' | 'width' | 'height' | 'src'>): ImageEl {
  return { ...base, id: uid(), name: '画像', type: 'image', cornerRadius: 0, ...p };
}

export function makeDevice(p: Req<DeviceEl, 'x' | 'y' | 'width' | 'model'>): DeviceEl {
  return {
    ...base,
    id: uid(),
    name: DEVICE_LABEL[p.model],
    type: 'device',
    height: p.width / DEVICE_ASPECT[p.model],
    frameColor: '#1c1c1e',
    screenSrc: null,
    screenScale: 1,
    screenOffsetX: 0,
    screenOffsetY: 0,
    shadow: p.width * 0.06,
    ...p,
  };
}

export const defaultBackground = (): Background => ({ type: 'solid', color: '#ffffff', color2: '#e6f0ea', angle: 180 });

export function makeBoard(p: Req<Board, 'pageWidth' | 'pageHeight'>): Board {
  return {
    id: uid(),
    name: 'ページ',
    pageNames: ['1'],
    background: defaultBackground(),
    elements: [],
    presetId: null,
    exportFormat: 'png',
    ...p,
  };
}
