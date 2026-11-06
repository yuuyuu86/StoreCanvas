import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Group, Layer, Line, Rect, Stage, Text, Transformer } from 'react-konva';
import type Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { currentBoard, useStore } from '../store';
import type { El } from '../types';
import { BoardNodes, type NodeHandlers } from './BoardNodes';
import { elementBounds, intersects } from '../lib/geometry';
import { readFileAsDataURL, loadImage } from '../lib/image';
import { makeImage } from '../lib/factory';

const PAD = 72;
const ACCENT = '#1f5c3f';

export function EditorCanvas() {
  const board = useStore(currentBoard);
  const zoom = useStore((s) => s.zoom);
  const selected = useStore((s) => s.selected);
  const showGuides = useStore((s) => s.showGuides);
  const fitNonce = useStore((s) => s.fitNonce);
  const { setSelected, updateElements, setZoom, patchSilent, addElements } = useStore.getState();

  const wrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const contentRef = useRef<Konva.Group>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const dragStarts = useRef(new Map<string, { x: number; y: number }>());
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [snap, setSnap] = useState<{ v: number[]; h: number[] }>({ v: [], h: [] });
  const [marquee, setMarquee] = useState<null | { x0: number; y0: number; x1: number; y1: number }>(null);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const W = board ? board.pageWidth * board.pageNames.length : 0;
  const H = board?.pageHeight ?? 0;

  // ボード切替・フィット要求時に全体表示
  useEffect(() => {
    if (!board || !size.w) return;
    setZoom(Math.min((size.w - PAD * 2) / W, (size.h - PAD * 2) / H));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board?.id, fitNonce, size.w > 0, W]);

  // Ctrl/⌘ + ホイールでズーム
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const z = useStore.getState().zoom;
      useStore.getState().setZoom(z * Math.exp(-e.deltaY * 0.01));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // Transformer に選択ノードをセット
  useEffect(() => {
    const tr = trRef.current;
    const stage = stageRef.current;
    if (!tr || !stage || !board) return;
    const nodes = board.elements
      .filter((e) => selected.includes(e.id) && e.visible && !e.locked)
      .map((e) => stage.findOne((n: Konva.Node) => n.id() === e.id))
      .filter((n): n is Konva.Node => !!n);
    tr.nodes(nodes);
    tr.getLayer()?.batchDraw();
  }, [selected, board]);

  if (!board) {
    return (
      <div className="canvas-wrap" ref={wrapRef}>
        <div className="canvas-empty">ページがありません。左のパネルから追加してください。</div>
      </div>
    );
  }

  const n = board.pageNames.length;
  const pw = board.pageWidth;
  const stageW = Math.max(size.w, W * zoom + PAD * 2);
  const stageH = Math.max(size.h, H * zoom + PAD * 2);
  const ox = Math.max(PAD, (stageW - W * zoom) / 2);
  const oy = Math.max(PAD, (stageH - H * zoom) / 2);
  const u = 1 / zoom; // 1画面px あたりのボード座標

  const groupIds = (el: El) => (el.groupId ? board.elements.filter((e) => e.groupId === el.groupId).map((e) => e.id) : [el.id]);
  const nodeById = (id: string) => stageRef.current?.findOne((nd: Konva.Node) => nd.id() === id);

  const snapTargets = (exclude: Set<string>) => {
    const xs: number[] = [];
    const ys: number[] = [0, H / 2, H];
    for (let i = 0; i <= n; i++) xs.push(i * pw);
    for (let i = 0; i < n; i++) xs.push(i * pw + pw / 2);
    for (const e of board.elements) {
      if (exclude.has(e.id) || !e.visible) continue;
      const b = elementBounds(e);
      xs.push(b.x, b.x + b.width / 2, b.x + b.width);
      ys.push(b.y, b.y + b.height / 2, b.y + b.height);
    }
    return { xs, ys };
  };

  const best = (vals: number[], targets: number[], thr: number) => {
    let d = Infinity;
    let line = 0;
    for (const v of vals)
      for (const t of targets) {
        if (Math.abs(t - v) < Math.abs(d)) {
          d = t - v;
          line = t;
        }
      }
    return Math.abs(d) <= thr ? { d, line } : null;
  };

  const h: NodeHandlers = {
    onMouseDown(e, el) {
      e.cancelBubble = true;
      const ids = groupIds(el);
      const evt = e.evt as MouseEvent;
      if (evt.shiftKey || evt.metaKey) {
        const all = ids.every((i) => selected.includes(i));
        setSelected(all ? selected.filter((i) => !ids.includes(i)) : [...new Set([...selected, ...ids])]);
      } else if (!ids.every((i) => selected.includes(i))) {
        setSelected(ids);
      }
    },
    onDragStart(_e, el) {
      const ids = groupIds(el);
      const eff = ids.every((i) => selected.includes(i)) ? selected : ids;
      dragStarts.current.clear();
      for (const id of eff) {
        const target = board.elements.find((x) => x.id === id);
        const nd = nodeById(id);
        if (target && !target.locked && nd) dragStarts.current.set(id, { x: nd.x(), y: nd.y() });
      }
    },
    onDragMove(e, el) {
      const node = e.target;
      const start = dragStarts.current.get(el.id);
      if (!start || !contentRef.current) return;
      const exclude = new Set(dragStarts.current.keys());
      // 複数選択中は全体の外接矩形でスナップ
      const rects = [...exclude].map((id) => nodeById(id)?.getClientRect({ relativeTo: contentRef.current! })).filter(Boolean) as { x: number; y: number; width: number; height: number }[];
      const r = rects.reduce((a, b) => ({
        x: Math.min(a.x, b.x),
        y: Math.min(a.y, b.y),
        width: Math.max(a.x + a.width, b.x + b.width) - Math.min(a.x, b.x),
        height: Math.max(a.y + a.height, b.y + b.height) - Math.min(a.y, b.y),
      }));
      const { xs, ys } = snapTargets(exclude);
      const thr = 6 * u;
      const sx = (e.evt as MouseEvent)?.altKey ? null : best([r.x, r.x + r.width / 2, r.x + r.width], xs, thr);
      const sy = (e.evt as MouseEvent)?.altKey ? null : best([r.y, r.y + r.height / 2, r.y + r.height], ys, thr);
      if (sx) node.x(node.x() + sx.d);
      if (sy) node.y(node.y() + sy.d);
      setSnap({ v: sx ? [sx.line] : [], h: sy ? [sy.line] : [] });
      const dx = node.x() - start.x;
      const dy = node.y() - start.y;
      for (const [id, p] of dragStarts.current) {
        if (id === el.id) continue;
        nodeById(id)?.position({ x: p.x + dx, y: p.y + dy });
      }
    },
    onDragEnd() {
      const pos = new Map<string, { x: number; y: number }>();
      for (const id of dragStarts.current.keys()) {
        const nd = nodeById(id);
        if (nd) pos.set(id, { x: nd.x(), y: nd.y() });
      }
      updateElements([...pos.keys()], (d) => {
        const p = pos.get(d.id);
        if (p) {
          d.x = p.x;
          d.y = p.y;
        }
      });
      dragStarts.current.clear();
      setSnap({ v: [], h: [] });
    },
    onTransformEnd(e, el) {
      const node = e.target;
      const sx = node.scaleX();
      const sy = node.scaleY();
      node.scaleX(1);
      node.scaleY(1);
      updateElements(
        [el.id],
        (d) => {
          d.x = node.x();
          d.y = node.y();
          d.rotation = node.rotation();
          d.width = Math.max(4, d.width * sx);
          if (d.type === 'text') {
            if (Math.abs(sy - 1) > 0.001) d.fontSize = Math.max(4, d.fontSize * sy);
          } else {
            d.height = Math.max(4, d.height * sy);
          }
        },
        'transform',
      );
    },
    onDblClick(_e, el) {
      if (el.type === 'text') window.dispatchEvent(new CustomEvent('sc:edit-text'));
    },
    onMeasure(el, height) {
      patchSilent(board.id, el.id, { height });
    },
  };

  const onStageDown = (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
    const t = e.target;
    if (t !== stageRef.current && t.name() !== 'bg') return;
    const evt = e.evt as MouseEvent;
    if (!evt.shiftKey && !evt.metaKey) setSelected([]);
    const p = contentRef.current?.getRelativePointerPosition();
    if (p) setMarquee({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
  };
  const onStageMove = () => {
    if (!marquee) return;
    const p = contentRef.current?.getRelativePointerPosition();
    if (p) setMarquee({ ...marquee, x1: p.x, y1: p.y });
  };
  const onStageUp = () => {
    if (!marquee) return;
    const box = {
      x: Math.min(marquee.x0, marquee.x1),
      y: Math.min(marquee.y0, marquee.y1),
      width: Math.abs(marquee.x1 - marquee.x0),
      height: Math.abs(marquee.y1 - marquee.y0),
    };
    setMarquee(null);
    if (box.width * zoom < 3 && box.height * zoom < 3) return;
    const hit = board.elements.filter((el) => el.visible && !el.locked && intersects(elementBounds(el), box));
    const ids = new Set(selected);
    for (const el of hit) groupIds(el).forEach((i) => ids.add(i));
    setSelected([...ids]);
  };

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'));
    if (!files.length || !stageRef.current || !contentRef.current) return;
    stageRef.current.setPointersPositions(e.nativeEvent);
    const p = contentRef.current.getRelativePointerPosition() ?? { x: pw / 2, y: H / 2 };
    const device = [...board.elements]
      .reverse()
      .find((el) => el.type === 'device' && el.visible && !el.locked && intersects(elementBounds(el), { x: p.x, y: p.y, width: 1, height: 1 }));
    if (device) {
      const src = await readFileAsDataURL(files[0]);
      updateElements([device.id], { screenSrc: src } as Partial<El>);
      setSelected([device.id]);
      return;
    }
    const els = [];
    for (const [i, f] of files.entries()) {
      const src = await readFileAsDataURL(f);
      const img = await loadImage(src);
      const s = Math.min(1, (pw * 0.6) / img.width, (H * 0.6) / img.height);
      const w = img.width * s;
      const hh = img.height * s;
      els.push(makeImage({ src, x: p.x - w / 2 + i * 40, y: p.y - hh / 2 + i * 40, width: w, height: hh, name: f.name.replace(/\.[^.]+$/, '') }));
    }
    addElements(els);
  };

  return (
    <div className="canvas-wrap" ref={wrapRef} onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
      <Stage
        ref={stageRef}
        width={stageW}
        height={stageH}
        onMouseDown={onStageDown}
        onTouchStart={onStageDown}
        onMouseMove={onStageMove}
        onTouchMove={onStageMove}
        onMouseUp={onStageUp}
        onTouchEnd={onStageUp}
      >
        <Layer>
          <Group x={ox} y={oy} scaleX={zoom} scaleY={zoom} ref={contentRef}>
            <Rect x={-2 * u} y={-2 * u} width={W + 4 * u} height={H + 4 * u} fill="rgba(0,0,0,0.06)" listening={false} cornerRadius={2 * u} />
            <BoardNodes board={board} h={h} interactive />
            <Group listening={false}>
              {/* キャンバス外を薄く覆う */}
              <Rect x={-1e5} y={-1e5} width={2e5} height={1e5} fill="rgba(240,240,237,0.72)" />
              <Rect x={-1e5} y={H} width={2e5} height={1e5} fill="rgba(240,240,237,0.72)" />
              <Rect x={-1e5} y={0} width={1e5} height={H} fill="rgba(240,240,237,0.72)" />
              <Rect x={W} y={0} width={1e5} height={H} fill="rgba(240,240,237,0.72)" />
              {board.pageNames.map((name, i) => (
                <Text
                  key={i}
                  x={i * pw}
                  y={-22 * u}
                  text={n > 1 ? `${i + 1} / ${n}  ${name}` : `${board.name}  ${pw}×${H}`}
                  fontSize={12 * u}
                  fill="#6b6b66"
                  fontFamily="Inter, Noto Sans JP"
                />
              ))}
              {showGuides &&
                Array.from({ length: n - 1 }, (_, i) => (
                  <Line
                    key={i}
                    points={[(i + 1) * pw, -14 * u, (i + 1) * pw, H + 14 * u]}
                    stroke="#e5484d"
                    strokeWidth={1.5 * u}
                    dash={[8 * u, 6 * u]}
                  />
                ))}
              {snap.v.map((x, i) => (
                <Line key={`v${i}`} points={[x, -1e4, x, 1e4]} stroke="#ff2fa0" strokeWidth={u} />
              ))}
              {snap.h.map((y, i) => (
                <Line key={`h${i}`} points={[-1e4, y, 1e5, y]} stroke="#ff2fa0" strokeWidth={u} />
              ))}
              {marquee && (
                <Rect
                  x={Math.min(marquee.x0, marquee.x1)}
                  y={Math.min(marquee.y0, marquee.y1)}
                  width={Math.abs(marquee.x1 - marquee.x0)}
                  height={Math.abs(marquee.y1 - marquee.y0)}
                  fill="rgba(31,92,63,0.08)"
                  stroke={ACCENT}
                  strokeWidth={u}
                />
              )}
            </Group>
          </Group>
          <Transformer
            ref={trRef}
            rotateEnabled
            keepRatio
            borderStroke={ACCENT}
            anchorStroke={ACCENT}
            anchorFill="#fff"
            anchorSize={8}
            anchorCornerRadius={2}
            rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
            rotationSnapTolerance={4}
            boundBoxFunc={(oldB, newB) => (newB.width < 4 || newB.height < 4 ? oldB : newB)}
          />
        </Layer>
      </Stage>
    </div>
  );
}
