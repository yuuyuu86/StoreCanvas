import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Group, Layer, Line, Rect, Stage, Text, Transformer } from 'react-konva';
import type Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { boardW, currentProject, useStore } from '../store';
import type { Board, El } from '../types';
import { BoardNodes, deviceScreenRect, type NodeHandlers } from './BoardNodes';
import { elementBounds, intersects, type Box } from '../lib/geometry';
import { importImageFile } from '../lib/image';
import { makeBoard, makeImage, uid } from '../lib/factory';
import { addPresetFrame, PRESET_MIME } from './FramePresetsPanel';
import { presetById } from '../presets';

const ACCENT = '#1f5c3f';
const FIT_PAD = 80;

type Pt = { x: number; y: number };
interface DeviceHit {
  boardId: string;
  id: string;
  box: Box; // world
}

const contains = (b: Box, p: Pt) => p.x >= b.x && p.x <= b.x + b.width && p.y >= b.y && p.y <= b.y + b.height;
const boardBox = (b: Board): Box => ({ x: b.x, y: b.y, width: boardW(b), height: b.pageHeight });

/** ワールド座標 p にあるフレーム（上にあるもの優先） */
function boardAt(boards: Board[], p: Pt) {
  for (let i = boards.length - 1; i >= 0; i--) if (contains(boardBox(boards[i]), p)) return boards[i];
  return null;
}

/** ワールド座標 p にある端末モックアップの画面 */
function deviceAt(boards: Board[], p: Pt, excludeId?: string): DeviceHit | null {
  const b = boardAt(boards, p);
  if (!b) return null;
  const local = { x: p.x - b.x, y: p.y - b.y };
  for (let i = b.elements.length - 1; i >= 0; i--) {
    const el = b.elements[i];
    if (el.type !== 'device' || !el.visible || el.locked || el.id === excludeId) continue;
    // 回転を戻して判定
    const r = (-el.rotation * Math.PI) / 180;
    const dx = local.x - el.x;
    const dy = local.y - el.y;
    const lx = dx * Math.cos(r) - dy * Math.sin(r);
    const ly = dx * Math.sin(r) + dy * Math.cos(r);
    if (lx >= 0 && ly >= 0 && lx <= el.width && ly <= el.height) {
      const bb = elementBounds(el);
      return { boardId: b.id, id: el.id, box: { x: bb.x + b.x, y: bb.y + b.y, width: bb.width, height: bb.height } };
    }
  }
  return null;
}

export function EditorCanvas() {
  const project = useStore(currentProject);
  const boardId = useStore((s) => s.boardId);
  const zoom = useStore((s) => s.zoom);
  const pan = useStore((s) => s.pan);
  const tool = useStore((s) => s.tool);
  const selected = useStore((s) => s.selected);
  const showGuides = useStore((s) => s.showGuides);
  const fitNonce = useStore((s) => s.fitNonce);
  const st = useStore.getState();

  const wrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const worldRef = useRef<Konva.Group>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const dragStarts = useRef(new Map<string, Pt>());
  const panStart = useRef<null | { p: Pt; pan: Pt }>(null);
  const titleDrag = useRef<null | { id: string }>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [spaceDown, setSpaceDown] = useState(false);
  const [snap, setSnap] = useState<{ v: number[]; h: number[] }>({ v: [], h: [] });
  const [marquee, setMarquee] = useState<null | { boardId: string; x0: number; y0: number; x1: number; y1: number }>(null);
  const [draft, setDraft] = useState<null | { x0: number; y0: number; x1: number; y1: number }>(null);
  const [hoverDevice, setHoverDevice] = useState<DeviceHit | null>(null);

  const boards = project?.boards ?? [];

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const upd = () => {
      setSize({ w: el.clientWidth, h: el.clientHeight });
      useStore.getState().setViewSize({ w: el.clientWidth, h: el.clientHeight });
    };
    const ro = new ResizeObserver(upd);
    ro.observe(el);
    upd();
    return () => ro.disconnect();
  }, []);

  // フィット（フレーム or 全体）
  const fitTo = (box: Box | null) => {
    if (!box || !size.w) return;
    const z = Math.min(4, (size.w - FIT_PAD * 2) / box.width, (size.h - FIT_PAD * 2) / box.height);
    useStore.setState({
      zoom: z,
      pan: { x: size.w / 2 - (box.x + box.width / 2) * z, y: size.h / 2 - (box.y + box.height / 2) * z },
    });
  };
  useEffect(() => {
    const s = useStore.getState();
    const p = currentProject(s);
    if (!p || !size.w) return;
    if (s.fitMode === 'all' || !s.boardId) {
      const bs = p.boards.map(boardBox);
      if (!bs.length) return;
      const x = Math.min(...bs.map((b) => b.x));
      const y = Math.min(...bs.map((b) => b.y));
      fitTo({ x, y, width: Math.max(...bs.map((b) => b.x + b.width)) - x, height: Math.max(...bs.map((b) => b.y + b.height)) - y });
    } else {
      const b = p.boards.find((v) => v.id === s.boardId);
      if (b) fitTo(boardBox(b));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitNonce, size.w > 0, project?.id]);

  // ホイール: パン / ⌘・Ctrl でカーソル位置ズーム
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const s = useStore.getState();
      if (e.ctrlKey || e.metaKey) {
        const rect = el.getBoundingClientRect();
        s.setZoom(s.zoom * Math.exp(-e.deltaY * 0.01), { x: e.clientX - rect.left, y: e.clientY - rect.top });
      } else {
        s.setPan({ x: s.pan.x - e.deltaX, y: s.pan.y - e.deltaY });
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // スペースキーでパン
  useEffect(() => {
    const isField = (t: EventTarget | null) => t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isField(e.target)) {
        e.preventDefault();
        setSpaceDown(true);
      }
    };
    const up = (e: KeyboardEvent) => e.code === 'Space' && setSpaceDown(false);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  // Transformer に選択ノードをセット
  const curBoard = boards.find((b) => b.id === boardId);
  useEffect(() => {
    const tr = trRef.current;
    const stage = stageRef.current;
    if (!tr || !stage) return;
    const nodes = (curBoard?.elements ?? [])
      .filter((e) => selected.includes(e.id) && e.visible && !e.locked)
      .map((e) => stage.findOne((n: Konva.Node) => n.id() === e.id))
      .filter((n): n is Konva.Node => !!n);
    tr.nodes(nodes);
    tr.getLayer()?.batchDraw();
  }, [selected, curBoard]);

  const u = 1 / zoom;
  const nodeById = (id: string) => stageRef.current?.findOne((nd: Konva.Node) => nd.id() === id);
  const worldPointer = () => worldRef.current?.getRelativePointerPosition() ?? null;

  const makeHandlers = (board: Board): NodeHandlers => {
    const groupIds = (el: El) => (el.groupId ? board.elements.filter((e) => e.groupId === el.groupId).map((e) => e.id) : [el.id]);
    const snapTargets = (exclude: Set<string>) => {
      const n = board.pageNames.length;
      const pw = board.pageWidth;
      const H = board.pageHeight;
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
        for (const t of targets)
          if (Math.abs(t - v) < Math.abs(d)) {
            d = t - v;
            line = t;
          }
      return Math.abs(d) <= thr ? { d, line } : null;
    };
    const sel = () => (useStore.getState().boardId === board.id ? useStore.getState().selected : []);

    return {
      onMouseDown(e, el) {
        if (spaceDown || useStore.getState().tool === 'frame') return;
        e.cancelBubble = true;
        const ids = groupIds(el);
        const cur = sel();
        const evt = e.evt as MouseEvent;
        if (evt.shiftKey || evt.metaKey) {
          const all = ids.every((i) => cur.includes(i));
          st.selectIn(board.id, all ? cur.filter((i) => !ids.includes(i)) : [...new Set([...cur, ...ids])]);
        } else if (!ids.every((i) => cur.includes(i))) {
          st.selectIn(board.id, ids);
        } else st.selectIn(board.id, cur);
      },
      onDragStart(e, el) {
        // フレームツール中・パン中は要素を動かさない
        if (useStore.getState().tool === 'frame' || spaceDown) {
          e.target.stopDrag();
          dragStarts.current.clear();
          return;
        }
        const ids = groupIds(el);
        const cur = sel();
        const eff = ids.every((i) => cur.includes(i)) ? cur : ids;
        dragStarts.current.clear();
        for (const id of eff) {
          const t = board.elements.find((x) => x.id === id);
          const nd = nodeById(id);
          if (t && !t.locked && nd) dragStarts.current.set(id, { x: nd.x(), y: nd.y() });
        }
      },
      onDragMove(e, el) {
        const node = e.target;
        const start = dragStarts.current.get(el.id);
        if (!start) return;
        const bg = nodeById(`board:${board.id}`);
        if (!start || !bg) return;
        const exclude = new Set(dragStarts.current.keys());
        const rects = [...exclude].map((id) => nodeById(id)?.getClientRect({ relativeTo: bg as Konva.Container })).filter(Boolean) as Box[];
        const r = rects.reduce((a, b) => ({
          x: Math.min(a.x, b.x),
          y: Math.min(a.y, b.y),
          width: Math.max(a.x + a.width, b.x + b.width) - Math.min(a.x, b.x),
          height: Math.max(a.y + a.height, b.y + b.height) - Math.min(a.y, b.y),
        }));
        const { xs, ys } = snapTargets(exclude);
        const noSnap = (e.evt as MouseEvent)?.altKey;
        const sx = noSnap ? null : best([r.x, r.x + r.width / 2, r.x + r.width], xs, 6 * u);
        const sy = noSnap ? null : best([r.y, r.y + r.height / 2, r.y + r.height], ys, 6 * u);
        if (sx) node.x(node.x() + sx.d);
        if (sy) node.y(node.y() + sy.d);
        setSnap({ v: sx ? [sx.line + board.x] : [], h: sy ? [sy.line + board.y] : [] });
        const dx = node.x() - start.x;
        const dy = node.y() - start.y;
        for (const [id, p] of dragStarts.current) if (id !== el.id) nodeById(id)?.position({ x: p.x + dx, y: p.y + dy });
        // 画像を端末にはめ込むプレビュー
        if (el.type === 'image' && dragStarts.current.size === 1) {
          const p = worldPointer();
          setHoverDevice(p ? deviceAt(useStore.getState().projects.find((x) => x.id === project?.id)?.boards ?? [], p) : null);
        }
      },
      onDragEnd(_e, el) {
        const ids = [...dragStarts.current.keys()];
        if (!ids.length) return;
        const pos = new Map<string, Pt>();
        for (const id of ids) {
          const nd = nodeById(id);
          if (nd) pos.set(id, { x: nd.x(), y: nd.y() });
        }
        dragStarts.current.clear();
        setSnap({ v: [], h: [] });
        const allBoards = currentProject(useStore.getState())?.boards ?? [];
        // 画像 → 端末の画面へ
        const p = worldPointer();
        const hit = el.type === 'image' && ids.length === 1 && p ? deviceAt(allBoards, p) : null;
        setHoverDevice(null);
        if (hit) {
          st.dropImageIntoDevice(board.id, el.id, hit.boardId, hit.id);
          return;
        }
        const hk = `drag-${uid()}`; // 位置更新とフレーム移動を1回の「元に戻す」にまとめる
        st.updateElements(
          ids,
          (d) => {
            const q = pos.get(d.id);
            if (q) {
              d.x = q.x;
              d.y = q.y;
            }
          },
          hk,
        );
        // 別のフレームへ移動（ドロップ位置のフレームに所属させる）
        if (p) {
          const target = boardAt(allBoards, p);
          if (target && target.id !== board.id) st.moveElementsToBoard(ids, board.id, target.id, hk);
        }
      },
      onTransformEnd(e, el) {
        const node = e.target;
        const sx = node.scaleX();
        const sy = node.scaleY();
        node.scaleX(1);
        node.scaleY(1);
        st.updateElements(
          [el.id],
          (d) => {
            d.x = node.x();
            d.y = node.y();
            d.rotation = node.rotation();
            d.width = Math.max(4, d.width * sx);
            if (d.type === 'text') {
              if (Math.abs(sy - 1) > 0.001) d.fontSize = Math.max(4, d.fontSize * sy);
            } else d.height = Math.max(4, d.height * sy);
          },
          'transform',
        );
      },
      onDblClick(_e, el) {
        if (el.type === 'text') window.dispatchEvent(new CustomEvent('sc:edit-text'));
      },
      onMeasure(el, height) {
        st.patchSilent(board.id, el.id, { height });
      },
    };
  };

  const onStageDown = (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
    const evt = e.evt as MouseEvent;
    const stage = stageRef.current!;
    if (spaceDown || evt.button === 1) {
      const sp = stage.getPointerPosition();
      if (sp) panStart.current = { p: sp, pan: { ...useStore.getState().pan } };
      return;
    }
    const p = worldPointer();
    if (!p) return;
    if (tool === 'frame') {
      setDraft({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
      return;
    }
    const t = e.target;
    const onBg = t.name() === 'bg';
    if (t !== stage && !onBg) return;
    const b = onBg ? boardAt(boards, p) : null;
    const target = b ?? curBoard;
    if (!evt.shiftKey && !evt.metaKey) {
      if (b) st.selectIn(b.id, []);
      else st.setSelected([]);
    }
    if (target) setMarquee({ boardId: target.id, x0: p.x, y0: p.y, x1: p.x, y1: p.y });
  };
  const onStageMove = () => {
    if (panStart.current) {
      const sp = stageRef.current?.getPointerPosition();
      if (sp) st.setPan({ x: panStart.current.pan.x + sp.x - panStart.current.p.x, y: panStart.current.pan.y + sp.y - panStart.current.p.y });
      return;
    }
    const p = worldPointer();
    if (!p) return;
    if (draft) setDraft({ ...draft, x1: p.x, y1: p.y });
    if (marquee) setMarquee({ ...marquee, x1: p.x, y1: p.y });
  };
  const onStageUp = () => {
    if (panStart.current) {
      panStart.current = null;
      return;
    }
    if (draft) {
      const box = { x: Math.min(draft.x0, draft.x1), y: Math.min(draft.y0, draft.y1), width: Math.abs(draft.x1 - draft.x0), height: Math.abs(draft.y1 - draft.y0) };
      setDraft(null);
      // クリックだけ（ドラッグなし）の場合はツールを維持し、右パネルからサイズを選べるようにする
      if (box.width * zoom < 6 || box.height * zoom < 6) return;
      st.setTool('select');
      const w = Math.round(box.width);
      const h = Math.round(box.height);
      const nb = makeBoard({ pageWidth: w, pageHeight: h, x: Math.round(box.x), y: Math.round(box.y), name: `フレーム ${boards.length + 1}` });
      st.addBoards([nb], { keepPosition: true });
      return;
    }
    if (!marquee) return;
    const b = boards.find((x) => x.id === marquee.boardId);
    const box = {
      x: Math.min(marquee.x0, marquee.x1) - (b?.x ?? 0),
      y: Math.min(marquee.y0, marquee.y1) - (b?.y ?? 0),
      width: Math.abs(marquee.x1 - marquee.x0),
      height: Math.abs(marquee.y1 - marquee.y0),
    };
    setMarquee(null);
    if (!b || (box.width * zoom < 3 && box.height * zoom < 3)) return;
    const hit = b.elements.filter((el) => el.visible && !el.locked && intersects(elementBounds(el), box));
    const ids = new Set(useStore.getState().boardId === b.id ? useStore.getState().selected : []);
    for (const el of hit) (el.groupId ? b.elements.filter((x) => x.groupId === el.groupId) : [el]).forEach((x) => ids.add(x.id));
    st.selectIn(b.id, [...ids]);
  };

  // ファイルのドラッグ＆ドロップ
  const pointerFromDom = (e: React.DragEvent) => {
    stageRef.current?.setPointersPositions(e.nativeEvent);
    return worldPointer();
  };
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!e.dataTransfer.types.includes('Files')) return;
    const p = pointerFromDom(e);
    const hit = p ? deviceAt(boards, p) : null;
    if (hit?.id !== hoverDevice?.id) setHoverDevice(hit);
  };
  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setHoverDevice(null);
    const preset = e.dataTransfer.getData(PRESET_MIME);
    if (preset) {
      // 外部からドラッグされたデータの可能性もあるため、検証してから使う
      const p = pointerFromDom(e);
      try {
        const data = JSON.parse(preset) as unknown;
        if (p && data && typeof data === 'object' && typeof (data as { id?: unknown }).id === 'string' && presetById((data as { id: string }).id)) {
          addPresetFrame((data as { id: string }).id, p, (data as { mockup?: unknown }).mockup !== false);
        }
      } catch {
        /* 不正なデータは無視 */
      }
      return;
    }
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'));
    if (!files.length) return;
    const p = pointerFromDom(e);
    if (!p) return;
    const hit = deviceAt(boards, p);
    if (hit) {
      const r = await importImageFile(files[0]);
      if (r) st.setDeviceScreen(hit.boardId, hit.id, r.src);
      return;
    }
    const target = boardAt(boards, p) ?? curBoard;
    if (!target) return;
    const local = contains(boardBox(target), p) ? { x: p.x - target.x, y: p.y - target.y } : { x: boardW(target) / 2, y: target.pageHeight / 2 };
    const els = [];
    for (const [i, f] of files.entries()) {
      const r = await importImageFile(f);
      if (!r) continue;
      const { src, img } = r;
      const s = Math.min(1, (target.pageWidth * 0.6) / img.width, (target.pageHeight * 0.6) / img.height);
      const w = img.width * s;
      const h = img.height * s;
      els.push(makeImage({ src, x: local.x - w / 2 + i * 40, y: local.y - h / 2 + i * 40, width: w, height: h, name: f.name.replace(/\.[^.]+$/, '') }));
    }
    if (!els.length) return;
    st.selectIn(target.id, []);
    st.addElements(els);
  };

  // キャンバス外でマウスを離しても範囲選択・パン・フレーム作成を確実に終了させる
  const upRef = useRef(onStageUp);
  upRef.current = onStageUp;
  useEffect(() => {
    const up = () => upRef.current();
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, []);

  const cls = `canvas-wrap ${spaceDown ? 'pan' : ''} ${tool === 'frame' ? 'frame-tool' : ''}`;

  return (
    <div className={cls} ref={wrapRef} onDragOver={onDragOver} onDragLeave={() => setHoverDevice(null)} onDrop={onDrop}>
      {!boards.length && <div className="canvas-empty">ホワイトボードは空です。「フレーム」（F）を選んで、ドラッグで自由サイズ、または右パネルからストア用サイズを配置してください。</div>}
      <Stage
        ref={stageRef}
        width={size.w}
        height={size.h}
        onMouseDown={onStageDown}
        onTouchStart={onStageDown}
        onMouseMove={onStageMove}
        onTouchMove={onStageMove}
        onTouchEnd={onStageUp}
      >
        <Layer>
          <Group ref={worldRef} x={pan.x} y={pan.y} scaleX={zoom} scaleY={zoom}>
            {boards.map((b) => {
              const W = boardW(b);
              const H = b.pageHeight;
              const n = b.pageNames.length;
              const active = b.id === boardId;
              return (
                <Group key={b.id}>
                  <Rect x={b.x} y={b.y} width={W} height={H} fill="#fff" shadowColor="#000" shadowOpacity={0.12} shadowBlur={10 * u} shadowOffsetY={2 * u} listening={false} />
                  <Group id={`board:${b.id}`} x={b.x} y={b.y} clipX={0} clipY={0} clipWidth={W} clipHeight={H}>
                    <BoardNodes board={b} h={makeHandlers(b)} interactive />
                  </Group>
                  <Group x={b.x} y={b.y} listening={false}>
                    {active && <Rect width={W} height={H} stroke={ACCENT} strokeWidth={2 * u} />}
                    {showGuides &&
                      Array.from({ length: n - 1 }, (_, i) => (
                        <Line key={i} points={[(i + 1) * b.pageWidth, -8 * u, (i + 1) * b.pageWidth, H + 8 * u]} stroke="#e5484d" strokeWidth={1.5 * u} dash={[8 * u, 6 * u]} />
                      ))}
                    {b.pageWidth * zoom > 80 && b.pageNames.slice(1).map((name, i) => (
                      <Text key={i} x={(i + 1) * b.pageWidth + 4 * u} y={-18 * u} text={`${i + 2}. ${name}`} fontSize={11 * u} fill="#8a8a84" fontFamily="Inter, Noto Sans JP" />
                    ))}
                  </Group>
                  {/* フレーム名：クリックで選択、ドラッグで移動 */}
                  <Text
                    x={b.x}
                    y={b.y - 20 * u}
                    text={`${b.name}${n > 1 ? `  ·  連結 ×${n}` : ''}   ${b.pageWidth}×${H}`}
                    fontSize={12 * u}
                    fill={active ? ACCENT : '#6b6b66'}
                    fontStyle={active ? 'bold' : 'normal'}
                    fontFamily="Inter, Noto Sans JP"
                    width={W}
                    wrap="none"
                    ellipsis
                    draggable={!spaceDown && tool !== 'frame'}
                    onMouseDown={(e) => {
                      e.cancelBubble = true;
                      st.selectIn(b.id, []);
                    }}
                    onDragStart={() => {
                      titleDrag.current = { id: b.id };
                    }}
                    onDragMove={(e) => {
                      const t = e.target;
                      const dx = t.x() - b.x;
                      const dy = t.y() + 20 * u - b.y;
                      t.getParent()?.getChildren().forEach((c) => c !== t && c.position({ x: b.x + dx, y: b.y + dy }));
                    }}
                    onDragEnd={(e) => {
                      const t = e.target;
                      titleDrag.current = null;
                      st.moveBoardPos(b.id, Math.round(t.x()), Math.round(t.y() + 20 * u));
                    }}
                  />
                </Group>
              );
            })}
            <Group listening={false}>
              {snap.v.map((x, i) => (
                <Line key={`v${i}`} points={[x, -1e6, x, 1e6]} stroke="#ff2fa0" strokeWidth={u} />
              ))}
              {snap.h.map((y, i) => (
                <Line key={`h${i}`} points={[-1e6, y, 1e6, y]} stroke="#ff2fa0" strokeWidth={u} />
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
              {draft && (
                <>
                  <Rect
                    x={Math.min(draft.x0, draft.x1)}
                    y={Math.min(draft.y0, draft.y1)}
                    width={Math.abs(draft.x1 - draft.x0)}
                    height={Math.abs(draft.y1 - draft.y0)}
                    fill="rgba(255,255,255,0.7)"
                    stroke={ACCENT}
                    strokeWidth={1.5 * u}
                  />
                  <Text
                    x={Math.min(draft.x0, draft.x1)}
                    y={Math.max(draft.y0, draft.y1) + 6 * u}
                    text={`${Math.round(Math.abs(draft.x1 - draft.x0))} × ${Math.round(Math.abs(draft.y1 - draft.y0))}`}
                    fontSize={11 * u}
                    fill={ACCENT}
                  />
                </>
              )}
              {hoverDevice && <DeviceDropHint hit={hoverDevice} boards={boards} u={u} />}
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

/** 端末の画面部分をハイライトして「ここにはめ込む」ことを示す */
function DeviceDropHint({ hit, boards, u }: { hit: DeviceHit; boards: Board[]; u: number }) {
  const b = boards.find((x) => x.id === hit.boardId);
  const el = b?.elements.find((x) => x.id === hit.id);
  if (!b || !el || el.type !== 'device') return null;
  const s = deviceScreenRect(el);
  return (
    <Group x={b.x + el.x} y={b.y + el.y} rotation={el.rotation}>
      <Rect x={s.x} y={s.y} width={s.width} height={s.height} cornerRadius={s.r} fill="rgba(31,92,63,0.35)" stroke="#7cf0b0" strokeWidth={3 * u} dash={[10 * u, 6 * u]} />
      <Text x={s.x} y={s.y + s.height / 2 - 12 * u} width={s.width} align="center" text="ここに画面をはめ込む" fontSize={14 * u} fill="#fff" fontStyle="bold" fontFamily="Noto Sans JP" />
    </Group>
  );
}
