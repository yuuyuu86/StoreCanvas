import { useEffect, useRef } from 'react';
import { Circle, Ellipse, Group, Image as KImage, Rect, Stage, Layer, Text } from 'react-konva';
import type Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { Board, DeviceEl, DeviceModel, El, ImageEl, TextEl } from '../types';
import { useImageSrc } from '../lib/image';
import { roundRectPath } from '../lib/geometry';

type Ev = KonvaEventObject<MouseEvent | TouchEvent | DragEvent | Event>;

export interface NodeHandlers {
  onMouseDown?(e: Ev, el: El): void;
  onDragStart?(e: Ev, el: El): void;
  onDragMove?(e: Ev, el: El): void;
  onDragEnd?(e: Ev, el: El): void;
  onTransformEnd?(e: Ev, el: El): void;
  onDblClick?(e: Ev, el: El): void;
  onMeasure?(el: El, height: number): void;
}

export function BoardBackground({ board }: { board: Board }) {
  const W = board.pageWidth * board.pageNames.length;
  const H = board.pageHeight;
  const bg = board.background;
  if (bg.type === 'linear') {
    const a = (bg.angle * Math.PI) / 180;
    const len = Math.abs(W * Math.sin(a)) + Math.abs(H * Math.cos(a));
    const dx = (Math.sin(a) * len) / 2;
    const dy = (-Math.cos(a) * len) / 2;
    return (
      <Rect
        name="bg"
        width={W}
        height={H}
        fillLinearGradientStartPoint={{ x: W / 2 - dx, y: H / 2 - dy }}
        fillLinearGradientEndPoint={{ x: W / 2 + dx, y: H / 2 + dy }}
        fillLinearGradientColorStops={[0, bg.color, 1, bg.color2]}
      />
    );
  }
  return <Rect name="bg" width={W} height={H} fill={bg.color} />;
}

export function deviceGeometry(model: DeviceModel, w: number, h: number) {
  const spec = {
    iphone: { b: 0.048, r: 0.19 },
    android: { b: 0.035, r: 0.11 },
    ipad: { b: 0.05, r: 0.07 },
    tablet: { b: 0.045, r: 0.06 },
  }[model];
  const b = w * spec.b;
  const r = w * spec.r;
  return {
    r,
    sx: b,
    sy: b,
    sw: w - b * 2,
    sh: h - b * 2,
    sr: Math.max(0, r - b),
    island: model === 'iphone' ? { w: w * 0.29, h: w * 0.085, x: (w - w * 0.29) / 2, y: b + w * 0.032 } : null,
    hole: model === 'android' ? { x: w / 2, y: b + w * 0.05, r: w * 0.025 } : model === 'ipad' || model === 'tablet' ? { x: w / 2, y: b / 2, r: w * 0.008 } : null,
  };
}


/** 端末要素ローカル座標での画面矩形 */
export function deviceScreenRect(el: DeviceEl) {
  const g = deviceGeometry(el.model, el.width, el.height);
  return { x: g.sx, y: g.sy, width: g.sw, height: g.sh, r: g.sr };
}

function shade(hex: string, amt: number) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => Math.round(amt >= 0 ? c + (255 - c) * amt : c * (1 + amt)));
  return `rgb(${ch.join(',')})`;
}

function ScreenContent({ el, g, img }: { el: DeviceEl; g: ReturnType<typeof deviceGeometry>; img?: HTMLImageElement }) {
  const w = el.width;
  let imgBox: { x: number; y: number; width: number; height: number } | null = null;
  if (img) {
    const s = Math.max(g.sw / img.width, g.sh / img.height) * el.screenScale;
    const iw = img.width * s;
    const ih = img.height * s;
    imgBox = { x: g.sx + (g.sw - iw) / 2 + el.screenOffsetX * g.sw, y: g.sy + (g.sh - ih) / 2 + el.screenOffsetY * g.sh, width: iw, height: ih };
  }
  return (
    <Group clipFunc={(ctx) => roundRectPath(ctx, g.sx, g.sy, g.sw, g.sh, g.sr)}>
      <Rect x={g.sx} y={g.sy} width={g.sw} height={g.sh} fill="#0e0e10" />
      {img && imgBox && <KImage image={img} {...imgBox} />}
      {!img && (
        <Text x={g.sx} y={g.sy + g.sh / 2 - w * 0.03} width={g.sw} align="center" text="画面画像をドロップ" fontSize={w * 0.05} fill="#6b6b70" fontFamily="Noto Sans JP" />
      )}
      {el.glare && (
        <Rect
          x={g.sx}
          y={g.sy}
          width={g.sw}
          height={g.sh}
          fillLinearGradientStartPoint={{ x: g.sx, y: g.sy }}
          fillLinearGradientEndPoint={{ x: g.sx + g.sw * 0.9, y: g.sy + g.sh * 0.55 }}
          fillLinearGradientColorStops={[0, 'rgba(255,255,255,0.16)', 0.45, 'rgba(255,255,255,0.05)', 0.451, 'rgba(255,255,255,0)', 1, 'rgba(255,255,255,0)']}
          listening={false}
        />
      )}
    </Group>
  );
}

/** 実機に近い iPhone（チタンフレーム・サイドボタン・Dynamic Island） */
function IPhoneNode({ el, groupProps }: { el: DeviceEl; groupProps: Konva.GroupConfig }) {
  const img = useImageSrc(el.screenSrc);
  const { width: w, height: h } = el;
  const g = deviceGeometry('iphone', w, h);
  const c = el.frameColor;
  const metal = {
    fillLinearGradientStartPoint: { x: 0, y: 0 },
    fillLinearGradientEndPoint: { x: w, y: 0 },
    fillLinearGradientColorStops: [0, shade(c, -0.35), 0.012, shade(c, 0.45), 0.035, shade(c, 0.05), 0.5, c, 0.965, shade(c, 0.05), 0.988, shade(c, 0.45), 1, shade(c, -0.35)],
  };
  const btnW = w * 0.016;
  const btn = (x: number, y: number, bh: number, key: string) => (
    <Rect key={key} x={x} y={y} width={btnW} height={bh} cornerRadius={btnW * 0.45} fill={shade(c, 0.12)} stroke={shade(c, -0.3)} strokeWidth={w * 0.002} />
  );
  const band = w * 0.018; // 金属フレームの幅
  const ant = shade(c, -0.25);
  const isl = g.island!;
  return (
    <Group {...groupProps}>
      {/* サイドボタン（本体の後ろ） */}
      {btn(-btnW * 0.6, h * 0.155, h * 0.036, 'action')}
      {btn(-btnW * 0.6, h * 0.215, h * 0.062, 'volup')}
      {btn(-btnW * 0.6, h * 0.292, h * 0.062, 'voldown')}
      {btn(w - btnW * 0.4, h * 0.235, h * 0.1, 'power')}
      {btn(w - btnW * 0.4, h * 0.6, h * 0.075, 'camera')}
      {/* 本体 */}
      <Rect
        width={w}
        height={h}
        cornerRadius={g.r}
        {...metal}
        shadowEnabled={el.shadow > 0}
        shadowColor="#000"
        shadowBlur={el.shadow}
        shadowOpacity={0.4}
        shadowOffsetY={el.shadow * 0.35}
      />
      {/* アンテナライン */}
      {[0.09, 0.91].map((ty) => (
        <Group key={ty}>
          <Rect x={0} y={h * ty} width={band} height={w * 0.012} fill={ant} />
          <Rect x={w - band} y={h * ty} width={band} height={w * 0.012} fill={ant} />
        </Group>
      ))}
      <Rect x={w * 0.24} y={h - band} width={w * 0.012} height={band} fill={ant} />
      <Rect x={w * 0.75} y={0} width={w * 0.012} height={band} fill={ant} />
      {/* 黒いベゼル */}
      <Rect x={band} y={band} width={w - band * 2} height={h - band * 2} cornerRadius={g.r - band} fill="#050506" />
      <Rect width={w} height={h} cornerRadius={g.r} stroke="rgba(255,255,255,0.28)" strokeWidth={w * 0.003} />
      <ScreenContent el={el} g={g} img={img} />
      {/* Dynamic Island */}
      <Rect x={isl.x} y={isl.y} width={isl.w} height={isl.h} cornerRadius={isl.h / 2} fill="#000" />
      <Circle x={isl.x + isl.w - isl.h * 0.55} y={isl.y + isl.h / 2} radius={isl.h * 0.24} fill="#0d1020" stroke="#1d2235" strokeWidth={isl.h * 0.05} />
      <Circle x={isl.x + isl.w - isl.h * 0.6} y={isl.y + isl.h * 0.42} radius={isl.h * 0.06} fill="rgba(120,150,255,0.45)" />
    </Group>
  );
}

function DeviceNode({ el, groupProps }: { el: DeviceEl; groupProps: Konva.GroupConfig }) {
  return el.model === 'iphone' ? <IPhoneNode el={el} groupProps={groupProps} /> : <GenericDeviceNode el={el} groupProps={groupProps} />;
}

function GenericDeviceNode({ el, groupProps }: { el: DeviceEl; groupProps: Konva.GroupConfig }) {
  const img = useImageSrc(el.screenSrc);
  const { width: w, height: h } = el;
  const g = deviceGeometry(el.model, w, h);
  let imgBox: { x: number; y: number; width: number; height: number } | null = null;
  if (img) {
    const s = Math.max(g.sw / img.width, g.sh / img.height) * el.screenScale;
    const iw = img.width * s;
    const ih = img.height * s;
    imgBox = {
      x: g.sx + (g.sw - iw) / 2 + el.screenOffsetX * g.sw,
      y: g.sy + (g.sh - ih) / 2 + el.screenOffsetY * g.sh,
      width: iw,
      height: ih,
    };
  }
  return (
    <Group {...groupProps}>
      <Rect
        width={w}
        height={h}
        cornerRadius={g.r}
        fill={el.frameColor}
        shadowEnabled={el.shadow > 0}
        shadowColor="#000"
        shadowBlur={el.shadow}
        shadowOpacity={0.35}
        shadowOffsetY={el.shadow * 0.35}
      />
      <Rect width={w} height={h} cornerRadius={g.r} stroke="rgba(255,255,255,0.18)" strokeWidth={Math.max(1, w * 0.006)} />
      <Group clipFunc={(ctx) => roundRectPath(ctx, g.sx, g.sy, g.sw, g.sh, g.sr)}>
        <Rect x={g.sx} y={g.sy} width={g.sw} height={g.sh} fill="#0e0e10" />
        {img && imgBox && <KImage image={img} {...imgBox} />}
        {!img && (
          <Text
            x={g.sx}
            y={g.sy + g.sh / 2 - w * 0.03}
            width={g.sw}
            align="center"
            text="画面画像をドロップ"
            fontSize={w * 0.05}
            fill="#6b6b70"
            fontFamily="Noto Sans JP"
          />
        )}
      </Group>
      {g.island && <Rect x={g.island.x} y={g.island.y} width={g.island.w} height={g.island.h} cornerRadius={g.island.h / 2} fill="#000" />}
      {g.hole && <Circle x={g.hole.x} y={g.hole.y} radius={g.hole.r} fill="#000" stroke="#2a2a2e" strokeWidth={g.hole.r * 0.3} />}
    </Group>
  );
}

function ImageNode({ el, groupProps }: { el: ImageEl; groupProps: Konva.GroupConfig }) {
  const img = useImageSrc(el.src);
  return (
    <Group {...groupProps}>
      {img ? (
        <KImage image={img} width={el.width} height={el.height} cornerRadius={el.cornerRadius} />
      ) : (
        <Rect width={el.width} height={el.height} fill="#e4e4e0" cornerRadius={el.cornerRadius} />
      )}
    </Group>
  );
}

function TextNode({ el, groupProps, onMeasure }: { el: TextEl; groupProps: Konva.GroupConfig; onMeasure?: NodeHandlers['onMeasure'] }) {
  const ref = useRef<Konva.Text>(null);
  useEffect(() => {
    const t = ref.current;
    if (!t || !onMeasure) return;
    const h = t.height();
    if (Math.abs(h - el.height) > 1) onMeasure(el, h);
  });
  return (
    <Group {...groupProps}>
      <Text
        ref={ref}
        width={el.width}
        text={el.text}
        fontSize={el.fontSize}
        fontFamily={el.fontFamily}
        fontStyle={el.fontStyle}
        fill={el.fill}
        align={el.align}
        lineHeight={el.lineHeight}
      />
    </Group>
  );
}

export function ElementNode({ el, h, interactive }: { el: El; h?: NodeHandlers; interactive?: boolean }) {
  if (!el.visible) return null;
  const bind = (fn?: (e: Ev, el: El) => void) => (fn ? (e: Ev) => fn(e, el) : undefined);
  const groupProps: Konva.GroupConfig = {
    id: el.id,
    x: el.x,
    y: el.y,
    rotation: el.rotation,
    opacity: el.opacity,
    draggable: !!interactive && !el.locked,
    listening: !!interactive,
    onMouseDown: bind(h?.onMouseDown),
    onTouchStart: bind(h?.onMouseDown),
    onDragStart: bind(h?.onDragStart),
    onDragMove: bind(h?.onDragMove),
    onDragEnd: bind(h?.onDragEnd),
    onTransformEnd: bind(h?.onTransformEnd),
    onDblClick: bind(h?.onDblClick),
    onDblTap: bind(h?.onDblClick),
  };
  switch (el.type) {
    case 'rect':
      return (
        <Group {...groupProps}>
          <Rect
            width={el.width}
            height={el.height}
            fill={el.fill}
            cornerRadius={el.cornerRadius}
            stroke={el.strokeWidth > 0 ? el.stroke : undefined}
            strokeWidth={el.strokeWidth}
          />
        </Group>
      );
    case 'ellipse':
      return (
        <Group {...groupProps}>
          <Ellipse
            x={el.width / 2}
            y={el.height / 2}
            radiusX={el.width / 2}
            radiusY={el.height / 2}
            fill={el.fill}
            stroke={el.strokeWidth > 0 ? el.stroke : undefined}
            strokeWidth={el.strokeWidth}
          />
        </Group>
      );
    case 'text':
      return <TextNode el={el} groupProps={groupProps} onMeasure={h?.onMeasure} />;
    case 'image':
      return <ImageNode el={el} groupProps={groupProps} />;
    case 'device':
      return <DeviceNode el={el} groupProps={groupProps} />;
  }
}

export function BoardNodes({ board, h, interactive }: { board: Board; h?: NodeHandlers; interactive?: boolean }) {
  return (
    <>
      <BoardBackground board={board} />
      {board.elements.map((el) => (
        <ElementNode key={el.id} el={el} h={h} interactive={interactive} />
      ))}
    </>
  );
}

/** 静的なサムネイル表示 */
export function BoardThumb({ board, maxW, maxH, page }: { board: Board; maxW: number; maxH: number; page?: number }) {
  const n = page === undefined ? board.pageNames.length : 1;
  const W = board.pageWidth * n;
  const H = board.pageHeight;
  const z = Math.min(maxW / W, maxH / H);
  const ox = page === undefined ? 0 : -page * board.pageWidth;
  return (
    <Stage width={Math.round(W * z)} height={Math.round(H * z)} listening={false}>
      <Layer listening={false}>
        <Group scaleX={z} scaleY={z} x={ox * z}>
          <BoardNodes board={board} />
        </Group>
      </Layer>
    </Stage>
  );
}
