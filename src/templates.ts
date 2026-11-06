import type { Background, El } from './types';
import { makeDevice, makeShape, makeText } from './lib/factory';

export const GENRES = ['シンプル', 'ポップ', 'ゲーム', '仕事効率化', '天気', '写真・動画'] as const;
export const MOODS = ['落ち着き', '明るい', '迫力', '爽やか', '洗練'] as const;
export type Genre = (typeof GENRES)[number];
export type Mood = (typeof MOODS)[number];

export interface TemplateResult {
  background: Background;
  elements: El[];
  pageNames: string[];
}

export interface Template {
  id: string;
  name: string;
  genre: Genre;
  mood: Mood;
  kind: 'single' | 'linked';
  build(pw: number, ph: number): TemplateResult;
}

const lin = (color: string, color2: string, angle = 180): Background => ({ type: 'linear', color, color2, angle });
const solid = (color: string): Background => ({ type: 'solid', color, color2: color, angle: 180 });

/** 縦長ページ用の基本レイアウト（見出し + サブ + 端末） */
function headlineLayout(
  pw: number,
  ph: number,
  o: { title: string; sub: string; color: string; subColor: string; font?: string; style?: string; frame?: string; model?: 'iphone' | 'android'; tilt?: number; offsetX?: number },
): El[] {
  const landscape = pw > ph * 1.1;
  const fs = landscape ? ph * 0.1 : Math.min(pw * 0.085, ph * 0.06);
  const title = makeText({
    x: landscape ? pw * 0.06 : pw * 0.08,
    y: landscape ? ph * 0.22 : ph * 0.06,
    width: landscape ? pw * 0.5 : pw * 0.84,
    align: landscape ? 'left' : 'center',
    text: o.title,
    fontSize: fs,
    fill: o.color,
    fontFamily: o.font ?? 'Noto Sans JP',
    fontStyle: o.style ?? 'bold',
    name: '見出し',
  });
  const sub = makeText({
    x: landscape ? pw * 0.06 : pw * 0.1,
    y: (landscape ? ph * 0.22 : ph * 0.06) + fs * 2.75,
    width: landscape ? pw * 0.5 : pw * 0.8,
    align: landscape ? 'left' : 'center',
    text: o.sub,
    fontSize: fs * 0.45,
    fill: o.subColor,
    fontStyle: 'normal',
    name: 'サブテキスト',
  });
  const dw = landscape ? ph * 0.86 * 0.48 : pw * 0.7;
  const device = makeDevice({
    model: o.model ?? 'iphone',
    x: landscape ? pw * 0.68 : (pw - dw) / 2 + (o.offsetX ?? 0) * pw,
    y: landscape ? ph * 0.1 : ph * 0.29,
    width: dw,
    rotation: o.tilt ?? 0,
    frameColor: o.frame ?? '#1c1c1e',
  });
  return [title, sub, device];
}

export const TEMPLATES: Template[] = [
  {
    id: 'simple-clean',
    name: 'クリーン',
    genre: 'シンプル',
    mood: '落ち着き',
    kind: 'single',
    build: (pw, ph) => ({
      background: solid('#f4f4f1'),
      pageNames: ['1'],
      elements: headlineLayout(pw, ph, { title: 'アプリの魅力を\nひとことで', sub: 'サブテキストで機能をわかりやすく説明します', color: '#1b1b1b', subColor: '#6b6b66' }),
    }),
  },
  {
    id: 'pop-bright',
    name: 'ビビッド',
    genre: 'ポップ',
    mood: '明るい',
    kind: 'single',
    build: (pw, ph) => ({
      background: lin('#ff7eb3', '#ff9a3c', 160),
      pageNames: ['1'],
      elements: [
        makeShape({ type: 'ellipse', x: -pw * 0.2, y: ph * 0.55, width: pw * 0.7, height: pw * 0.7, fill: 'rgba(255,255,255,0.22)', name: '円' }),
        makeShape({ type: 'ellipse', x: pw * 0.7, y: ph * 0.2, width: pw * 0.45, height: pw * 0.45, fill: 'rgba(255,255,255,0.18)', name: '円' }),
        ...headlineLayout(pw, ph, { title: 'たのしく、\nかんたん！', sub: 'ワンタップではじめよう', color: '#ffffff', subColor: '#fff5ea', font: 'M PLUS Rounded 1c', style: 'bold', tilt: -6, offsetX: 0.02 }),
      ],
    }),
  },
  {
    id: 'game-dark',
    name: 'ナイトバトル',
    genre: 'ゲーム',
    mood: '迫力',
    kind: 'single',
    build: (pw, ph) => ({
      background: lin('#160f3f', '#5b1e8c', 180),
      pageNames: ['1'],
      elements: [
        makeShape({ type: 'rect', x: -pw * 0.1, y: ph * 0.62, width: pw * 1.2, height: ph * 0.12, rotation: -8, fill: '#ffcf33', name: '帯' }),
        ...headlineLayout(pw, ph, { title: 'バトルが\nアツい！', sub: '世界中のプレイヤーと対戦', color: '#ffd84d', subColor: '#d9ccff', font: 'Dela Gothic One', style: 'normal', model: 'android' }),
      ],
    }),
  },
  {
    id: 'productivity',
    name: 'すっきりタスク',
    genre: '仕事効率化',
    mood: '落ち着き',
    kind: 'single',
    build: (pw, ph) => ({
      background: solid('#e7f1eb'),
      pageNames: ['1'],
      elements: headlineLayout(pw, ph, { title: '毎日のタスクを\nすっきり整理', sub: 'チームの予定もひと目で把握', color: '#173d2b', subColor: '#4b6b5a', frame: '#f2f2f2' }),
    }),
  },
  {
    id: 'weather-sky',
    name: 'そらもよう',
    genre: '天気',
    mood: '爽やか',
    kind: 'single',
    build: (pw, ph) => ({
      background: lin('#4ea6ff', '#c4e6ff', 180),
      pageNames: ['1'],
      elements: [
        makeShape({ type: 'ellipse', x: pw * 0.68, y: -pw * 0.08, width: pw * 0.42, height: pw * 0.42, fill: '#ffd34d', name: '太陽' }),
        ...headlineLayout(pw, ph, { title: '1時間ごとの\n天気がわかる', sub: '雨雲レーダーで外出も安心', color: '#ffffff', subColor: '#eaf6ff' }),
      ],
    }),
  },
  {
    id: 'photo-mono',
    name: 'モノクローム',
    genre: '写真・動画',
    mood: '洗練',
    kind: 'single',
    build: (pw, ph) => ({
      background: solid('#0d0d0d'),
      pageNames: ['1'],
      elements: headlineLayout(pw, ph, { title: '思い出を、\n美しく。', sub: 'プロ品質のフィルターと編集機能', color: '#ffffff', subColor: '#9a9a9a', style: 'normal', frame: '#2b2b2b' }),
    }),
  },
  {
    id: 'linked-green',
    name: 'つながるグリーン（3枚連結）',
    genre: 'シンプル',
    mood: '落ち着き',
    kind: 'linked',
    build: (pw, ph) => {
      const fs = Math.min(pw * 0.08, ph * 0.055);
      const texts = ['アプリの魅力を\nひとことで', '境界をまたいで\n端末を配置', '書き出し時に\n自動で分割'];
      const els: El[] = texts.map((t, i) =>
        makeText({ x: i * pw + pw * 0.08, y: ph * 0.06, width: pw * 0.84, text: t, fontSize: fs, fill: '#ffffff', name: `見出し ${i + 1}` }),
      );
      els.unshift(
        makeShape({ type: 'ellipse', x: pw * 0.55, y: ph * 0.45, width: pw * 0.9, height: pw * 0.9, fill: 'rgba(255,255,255,0.12)', name: '円' }),
      );
      const dw = Math.min(pw * 0.66, ph * 0.62 * 0.48);
      els.push(makeDevice({ model: 'iphone', x: pw * 0.62, y: ph * 0.3, width: dw, rotation: 10, name: 'iPhone（境界またぎ）' }));
      els.push(makeDevice({ model: 'iphone', x: pw * 2 + (pw - dw) / 2, y: ph * 0.32, width: dw }));
      return { background: lin('#0f5132', '#7cc59b', 120), pageNames: ['1', '2', '3'], elements: els };
    },
  },
  {
    id: 'linked-pop',
    name: 'ポップウェーブ（3枚連結）',
    genre: 'ポップ',
    mood: '明るい',
    kind: 'linked',
    build: (pw, ph) => {
      const fs = Math.min(pw * 0.085, ph * 0.06);
      const texts = ['かんたん\nスタート', 'もっと\nたのしく', 'みんなで\nシェア'];
      const els: El[] = [
        makeShape({ type: 'rect', x: -pw * 0.1, y: ph * 0.7, width: pw * 3.2, height: ph * 0.1, rotation: -4, fill: '#ffffff', opacity: 0.35, name: '帯' }),
        ...texts.map((t, i) =>
          makeText({ x: i * pw + pw * 0.08, y: ph * 0.06, width: pw * 0.84, text: t, fontSize: fs, fill: '#ffffff', fontFamily: 'M PLUS Rounded 1c', name: `見出し ${i + 1}` }),
        ),
      ];
      const dw = Math.min(pw * 0.64, ph * 0.62 * 0.468);
      els.push(makeDevice({ model: 'android', x: (pw - dw) / 2, y: ph * 0.32, width: dw, rotation: -5 }));
      els.push(makeDevice({ model: 'android', x: pw * 1.68, y: ph * 0.3, width: dw, rotation: 8, name: 'Android（境界またぎ）' }));
      return { background: lin('#7b61ff', '#ff7eb3', 100), pageNames: ['1', '2', '3'], elements: els };
    },
  },
];
