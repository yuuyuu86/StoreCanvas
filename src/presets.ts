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
  { id: 'appstore', label: 'App Store', desc: 'スクリーンショット・アイコン・イベント画像' },
  { id: 'googleplay', label: 'Google Play', desc: 'スクリーンショット・アイコン・ヘッダー画像' },
  { id: 'other', label: 'その他', desc: 'Web・SNS のヘッダーやバナー、任意サイズ' },
];

export const ASSET_LABELS: Record<AssetKind, string> = {
  screenshot: 'スクリーンショット',
  icon: 'アプリアイコン',
  feature: 'フィーチャーグラフィック',
  header: 'ヘッダー・イベント画像',
  banner: 'バナー・SNS画像',
  custom: '任意サイズ',
};

/** 一覧での表示順 */
export const ASSET_ORDER: AssetKind[] = ['screenshot', 'header', 'feature', 'icon', 'banner', 'custom'];

type Base = Omit<Preset, 'id' | 'orientation'>;

// device はストア掲載画像としての名前（一覧・ファイル名・チェックに表示される）
const portraitScreens: (Base & { key: string })[] = [
  // App Store — iPhone
  { key: 'as-iphone-69', store: 'appstore', asset: 'screenshot', device: 'iPhone用 スクリーンショット 6.9インチ（必須）', width: 1320, height: 2868, formats: ['png', 'jpeg'], mockup: 'iphone', note: 'App Store の iPhone 掲載画像。1290×2796 / 1260×2736 も可' },
  { key: 'as-iphone-69b', store: 'appstore', asset: 'screenshot', device: 'iPhone用 スクリーンショット 6.9インチ（1290幅）', width: 1290, height: 2796, formats: ['png', 'jpeg'], mockup: 'iphone' },
  { key: 'as-iphone-65', store: 'appstore', asset: 'screenshot', device: 'iPhone用 スクリーンショット 6.5インチ', width: 1284, height: 2778, formats: ['png', 'jpeg'], mockup: 'iphone', note: '6.9インチ用がない場合に必要。1242×2688 も可' },
  { key: 'as-iphone-63', store: 'appstore', asset: 'screenshot', device: 'iPhone用 スクリーンショット 6.3インチ', width: 1206, height: 2622, formats: ['png', 'jpeg'], mockup: 'iphone' },
  { key: 'as-iphone-55', store: 'appstore', asset: 'screenshot', device: 'iPhone用 スクリーンショット 5.5インチ', width: 1242, height: 2208, formats: ['png', 'jpeg'], mockup: 'iphone' },
  // App Store — iPad
  { key: 'as-ipad-13', store: 'appstore', asset: 'screenshot', device: 'iPad用 スクリーンショット 13インチ（必須）', width: 2064, height: 2752, formats: ['png', 'jpeg'], mockup: 'ipad', note: 'iPad 対応アプリで必須。2048×2732 も可' },
  { key: 'as-ipad-129', store: 'appstore', asset: 'screenshot', device: 'iPad用 スクリーンショット 12.9インチ', width: 2048, height: 2732, formats: ['png', 'jpeg'], mockup: 'ipad' },
  { key: 'as-ipad-11', store: 'appstore', asset: 'screenshot', device: 'iPad用 スクリーンショット 11インチ', width: 1668, height: 2388, formats: ['png', 'jpeg'], mockup: 'ipad' },
  // Google Play
  { key: 'gp-phone', store: 'googleplay', asset: 'screenshot', device: 'スマホ用 スクリーンショット', width: 1080, height: 1920, formats: ['png', 'jpeg'], mockup: 'android', note: '2〜8枚。各辺320〜3840px、長辺は短辺の2倍以内' },
  { key: 'gp-phone-hd', store: 'googleplay', asset: 'screenshot', device: 'スマホ用 スクリーンショット（高解像度）', width: 1440, height: 2560, formats: ['png', 'jpeg'], mockup: 'android' },
  { key: 'gp-tablet-7', store: 'googleplay', asset: 'screenshot', device: '7インチタブレット用 スクリーンショット', width: 1200, height: 1920, formats: ['png', 'jpeg'], mockup: 'tablet' },
  { key: 'gp-tablet-10', store: 'googleplay', asset: 'screenshot', device: '10インチタブレット用 スクリーンショット', width: 1600, height: 2560, formats: ['png', 'jpeg'], mockup: 'tablet' },
];

const fixed: Preset[] = [
  { id: 'as-icon', store: 'appstore', asset: 'icon', device: 'アプリアイコン（App Store）', orientation: 'square', width: 1024, height: 1024, formats: ['png'], note: 'PNG、透過・角丸なし（角丸はストア側で適用）' },
  { id: 'as-event-card', store: 'appstore', asset: 'header', device: 'App内イベント カード画像', orientation: 'landscape', width: 1920, height: 1080, formats: ['png', 'jpeg'], note: 'App内イベントのカードに表示される 16:9 の画像' },
  { id: 'as-event-detail', store: 'appstore', asset: 'header', device: 'App内イベント 詳細ページ画像', orientation: 'portrait', width: 1080, height: 1920, formats: ['png', 'jpeg'], note: 'App内イベント詳細ページ上部の 9:16 の画像' },
  { id: 'gp-feature', store: 'googleplay', asset: 'header', device: 'フィーチャーグラフィック（ヘッダー画像）', orientation: 'landscape', width: 1024, height: 500, formats: ['jpeg', 'png'], note: 'ストアページ上部などに表示。JPEG または 24ビットPNG（透過なし）' },
  { id: 'gp-icon', store: 'googleplay', asset: 'icon', device: 'アプリアイコン（Google Play）', orientation: 'square', width: 512, height: 512, formats: ['png'], note: '32ビットPNG、1MB以下' },
  { id: 'gp-chromebook', store: 'googleplay', asset: 'screenshot', device: 'Chromebook用 スクリーンショット', orientation: 'landscape', width: 1920, height: 1080, formats: ['png', 'jpeg'] },
  { id: 'ot-hero', store: 'other', asset: 'header', device: 'Webサイト ヘッダー（ヒーロー）', orientation: 'landscape', width: 1920, height: 1080, formats: ['png', 'jpeg'] },
  { id: 'ot-x-header', store: 'other', asset: 'header', device: 'X（Twitter）ヘッダー', orientation: 'landscape', width: 1500, height: 500, formats: ['png', 'jpeg'] },
  { id: 'ot-yt-banner', store: 'other', asset: 'header', device: 'YouTube チャンネルバナー', orientation: 'landscape', width: 2560, height: 1440, formats: ['png', 'jpeg'], note: '中央 1546×423 が全デバイスで表示される安全領域' },
  { id: 'ot-fb-cover', store: 'other', asset: 'header', device: 'Facebook カバー画像', orientation: 'landscape', width: 1640, height: 624, formats: ['png', 'jpeg'] },
  { id: 'ot-ogp', store: 'other', asset: 'banner', device: 'OGP 画像（リンクのサムネイル）', orientation: 'landscape', width: 1200, height: 630, formats: ['png', 'jpeg'] },
  { id: 'ot-x-post', store: 'other', asset: 'banner', device: 'X 投稿画像', orientation: 'landscape', width: 1600, height: 900, formats: ['png', 'jpeg'] },
  { id: 'ot-ig-square', store: 'other', asset: 'banner', device: 'Instagram 投稿（正方形）', orientation: 'square', width: 1080, height: 1080, formats: ['png', 'jpeg'] },
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
