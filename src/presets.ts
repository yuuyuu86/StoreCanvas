import type { AssetKind, DeviceModel, ImageFormat, StoreId } from './types';

/**
 * ストア別サイズプリセット。
 * 各ストアの公開仕様をもとに管理している。ストア側の仕様変更に合わせてこのファイルを更新し、
 * PRESETS_CHECKED_AT も更新すること。
 *
 * 参照:
 *  - App Store Connect: Screenshot specifications / App icon
 *  - Google Play Console Help: Add preview assets to showcase your app
 */
export const PRESETS_CHECKED_AT = '2026-11-06';

export type Orientation = 'portrait' | 'landscape' | 'square';

export interface Preset {
  id: string;
  store: StoreId;
  asset: AssetKind;
  device: string;
  orientation: Orientation;
  width: number;
  height: number;
  formats: ImageFormat[];
  mockup?: DeviceModel;
  note?: string;
}

export const STORES: { id: StoreId; label: string; desc: string }[] = [
  { id: 'appstore', label: 'App Store', desc: 'iPhone・iPad・アイコン' },
  { id: 'googleplay', label: 'Google Play', desc: 'スマホ・タブレット・フィーチャーグラフィック' },
  { id: 'other', label: 'その他', desc: 'Web・SNS用バナー、任意サイズ' },
];

export const ASSET_LABELS: Record<AssetKind, string> = {
  screenshot: 'スクリーンショット',
  icon: 'アプリアイコン',
  feature: 'フィーチャーグラフィック',
  banner: 'バナー',
  custom: '任意サイズ',
};

type Base = Omit<Preset, 'id' | 'orientation'>;

const portraitScreens: (Base & { key: string })[] = [
  // App Store — iPhone
  { key: 'as-iphone-69', store: 'appstore', asset: 'screenshot', device: 'iPhone 6.9"', width: 1320, height: 2868, formats: ['png', 'jpeg'], mockup: 'iphone', note: '6.9インチ（必須）。1290×2796 / 1260×2736 も可' },
  { key: 'as-iphone-69b', store: 'appstore', asset: 'screenshot', device: 'iPhone 6.9" (1290)', width: 1290, height: 2796, formats: ['png', 'jpeg'], mockup: 'iphone' },
  { key: 'as-iphone-65', store: 'appstore', asset: 'screenshot', device: 'iPhone 6.5"', width: 1284, height: 2778, formats: ['png', 'jpeg'], mockup: 'iphone', note: '1242×2688 も可' },
  { key: 'as-iphone-63', store: 'appstore', asset: 'screenshot', device: 'iPhone 6.3"', width: 1206, height: 2622, formats: ['png', 'jpeg'], mockup: 'iphone' },
  { key: 'as-iphone-55', store: 'appstore', asset: 'screenshot', device: 'iPhone 5.5"', width: 1242, height: 2208, formats: ['png', 'jpeg'], mockup: 'iphone' },
  // App Store — iPad
  { key: 'as-ipad-13', store: 'appstore', asset: 'screenshot', device: 'iPad 13"', width: 2064, height: 2752, formats: ['png', 'jpeg'], mockup: 'ipad', note: 'iPad向け（必須）。2048×2732 も可' },
  { key: 'as-ipad-129', store: 'appstore', asset: 'screenshot', device: 'iPad Pro 12.9" (第2世代)', width: 2048, height: 2732, formats: ['png', 'jpeg'], mockup: 'ipad' },
  { key: 'as-ipad-11', store: 'appstore', asset: 'screenshot', device: 'iPad 11"', width: 1668, height: 2388, formats: ['png', 'jpeg'], mockup: 'ipad' },
  // Google Play
  { key: 'gp-phone', store: 'googleplay', asset: 'screenshot', device: 'スマートフォン (9:16)', width: 1080, height: 1920, formats: ['png', 'jpeg'], mockup: 'android', note: '各辺320〜3840px、長辺は短辺の2倍以内' },
  { key: 'gp-phone-hd', store: 'googleplay', asset: 'screenshot', device: 'スマートフォン 高解像度 (9:16)', width: 1440, height: 2560, formats: ['png', 'jpeg'], mockup: 'android' },
  { key: 'gp-tablet-7', store: 'googleplay', asset: 'screenshot', device: '7インチタブレット', width: 1200, height: 1920, formats: ['png', 'jpeg'], mockup: 'tablet' },
  { key: 'gp-tablet-10', store: 'googleplay', asset: 'screenshot', device: '10インチタブレット', width: 1600, height: 2560, formats: ['png', 'jpeg'], mockup: 'tablet' },
];

const fixed: Preset[] = [
  { id: 'as-icon', store: 'appstore', asset: 'icon', device: 'App Store アイコン', orientation: 'square', width: 1024, height: 1024, formats: ['png'], note: 'PNG、透過・角丸なし（角丸はストア側で適用）' },
  { id: 'gp-icon', store: 'googleplay', asset: 'icon', device: 'Google Play アイコン', orientation: 'square', width: 512, height: 512, formats: ['png'], note: '32ビットPNG、1MB以下' },
  { id: 'gp-feature', store: 'googleplay', asset: 'feature', device: 'フィーチャーグラフィック', orientation: 'landscape', width: 1024, height: 500, formats: ['jpeg', 'png'], note: 'JPEG または 24ビットPNG（透過なし）' },
  { id: 'gp-chromebook', store: 'googleplay', asset: 'screenshot', device: 'Chromebook', orientation: 'landscape', width: 1920, height: 1080, formats: ['png', 'jpeg'] },
  { id: 'ot-ogp', store: 'other', asset: 'banner', device: 'Webサイト OGP', orientation: 'landscape', width: 1200, height: 630, formats: ['png', 'jpeg'] },
  { id: 'ot-hero', store: 'other', asset: 'banner', device: 'Webサイト ヒーロー', orientation: 'landscape', width: 1920, height: 1080, formats: ['png', 'jpeg'] },
  { id: 'ot-x-header', store: 'other', asset: 'banner', device: 'X ヘッダー', orientation: 'landscape', width: 1500, height: 500, formats: ['png', 'jpeg'] },
  { id: 'ot-x-post', store: 'other', asset: 'banner', device: 'X 投稿画像', orientation: 'landscape', width: 1600, height: 900, formats: ['png', 'jpeg'] },
  { id: 'ot-ig-square', store: 'other', asset: 'banner', device: 'Instagram 正方形', orientation: 'square', width: 1080, height: 1080, formats: ['png', 'jpeg'] },
  { id: 'ot-ig-story', store: 'other', asset: 'banner', device: 'Instagram ストーリーズ', orientation: 'portrait', width: 1080, height: 1920, formats: ['png', 'jpeg'] },
];

export const PRESETS: Preset[] = [
  ...portraitScreens.flatMap(({ key, ...p }) => [
    { ...p, id: key, orientation: 'portrait' as const },
    { ...p, id: `${key}-l`, orientation: 'landscape' as const, width: p.height, height: p.width },
  ]),
  ...fixed,
];

export const presetById = (id: string | null | undefined) => PRESETS.find((p) => p.id === id);

export const ORIENTATION_LABELS: Record<Orientation, string> = {
  portrait: '縦向き',
  landscape: '横向き',
  square: '正方形',
};

export const STORE_LABEL: Record<StoreId, string> = {
  appstore: 'App Store',
  googleplay: 'Google Play',
  other: 'その他',
};
