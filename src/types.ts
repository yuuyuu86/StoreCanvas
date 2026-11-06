export type StoreId = 'appstore' | 'googleplay' | 'other';
export type AssetKind = 'screenshot' | 'icon' | 'feature' | 'banner' | 'custom';
export type DeviceModel = 'iphone' | 'android' | 'ipad' | 'tablet';
export type ImageFormat = 'png' | 'jpeg';

export interface Background {
  type: 'solid' | 'linear';
  color: string;
  color2: string;
  angle: number;
}

interface BaseEl {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  visible: boolean;
  locked: boolean;
  groupId: string | null;
}

export interface TextEl extends BaseEl {
  type: 'text';
  text: string;
  fontSize: number;
  fontFamily: string;
  fontStyle: string;
  fill: string;
  align: 'left' | 'center' | 'right';
  lineHeight: number;
}

export interface ImageEl extends BaseEl {
  type: 'image';
  src: string;
  cornerRadius: number;
}

export interface ShapeEl extends BaseEl {
  type: 'rect' | 'ellipse';
  fill: string;
  stroke: string;
  strokeWidth: number;
  cornerRadius: number;
}

export interface DeviceEl extends BaseEl {
  type: 'device';
  model: DeviceModel;
  frameColor: string;
  screenSrc: string | null;
  screenScale: number;
  screenOffsetX: number;
  screenOffsetY: number;
  shadow: number;
  glare?: boolean;
}

export type El = TextEl | ImageEl | ShapeEl | DeviceEl;

/**
 * Board = 編集単位。pageNames.length === 1 なら通常ページ、2以上なら連結グループ。
 * 連結グループは pageWidth * ページ数 の横長キャンバスとして編集し、書き出し時に自動分割する。
 */
export interface Board {
  id: string;
  name: string;
  pageNames: string[];
  pageWidth: number;
  pageHeight: number;
  background: Background;
  elements: El[];
  presetId: string | null;
  exportFormat: ImageFormat;
  /** 編集キャンバス上の位置（Figmaのフレーム配置） */
  x: number;
  y: number;
}

export interface Project {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  boards: Board[];
}
