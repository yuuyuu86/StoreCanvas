import { create } from 'zustand';
import { produce, type Draft } from 'immer';
import { get as idbGet, set as idbSet } from 'idb-keyval';
import type { Board, El, Project } from './types';
import { uid } from './lib/factory';
import { elementBounds, intersects, unionBox } from './lib/geometry';

const STORAGE_KEY = 'storecanvas:projects:v1';

export type View = 'list' | 'editor' | 'preview';
export type Dialog = null | 'newCanvas' | 'export' | 'templates';
export type AlignMode = 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom';

interface State {
  loaded: boolean;
  saveState: 'idle' | 'saving' | 'saved' | 'error';
  projects: Project[];
  view: View;
  dialog: Dialog;
  projectId: string | null;
  boardId: string | null;
  selectedBoards: string[];
  selected: string[];
  past: Board[][];
  future: Board[][];
  clipboard: El[];
  zoom: number;
  pan: { x: number; y: number };
  viewSize: { w: number; h: number };
  tool: 'select' | 'frame';
  fitNonce: number;
  fitMode: 'board' | 'all';
  showGuides: boolean;

  load(): Promise<void>;
  setView(v: View): void;
  setDialog(d: Dialog): void;
  setZoom(z: number, anchor?: { x: number; y: number }): void;
  setPan(p: { x: number; y: number }): void;
  setViewSize(s: { w: number; h: number }): void;
  setTool(t: 'select' | 'frame'): void;
  requestFit(mode?: 'board' | 'all'): void;
  focusBoard(id: string): void;
  selectIn(boardId: string, ids: string[]): void;
  moveBoardPos(id: string, x: number, y: number): void;
  arrangeBoards(): void;
  moveElementsToBoard(ids: string[], fromId: string, toId: string): void;
  dropImageIntoDevice(fromBoardId: string, imageId: string, toBoardId: string, deviceId: string): void;
  setDeviceScreen(boardId: string, deviceId: string, src: string): void;
  toggleGuides(): void;

  createProject(name: string): string;
  renameProject(id: string, name: string): void;
  duplicateProject(id: string): void;
  deleteProject(id: string): void;
  openProject(id: string): void;

  mutate(fn: (p: Draft<Project>) => void, historyKey?: string): void;
  undo(): void;
  redo(): void;

  selectBoard(id: string, mode?: 'single' | 'toggle' | 'range'): void;
  addBoards(boards: Board[], opts?: { keepPosition?: boolean }): void;
  duplicateBoard(id: string): void;
  deleteBoards(ids: string[]): void;
  renameBoard(id: string, name: string): void;
  moveBoard(from: number, to: number): void;
  linkBoards(ids: string[]): string | null;
  unlinkBoard(id: string): void;
  setPageCount(id: string, n: number): void;
  updateBoard(patch: Partial<Board>, key?: string): void;

  setSelected(ids: string[]): void;
  addElements(els: El[]): void;
  updateElements(ids: string[], patch: Partial<El> | ((el: Draft<El>) => void), key?: string): void;
  patchSilent(boardId: string, id: string, patch: Partial<El>): void;
  deleteSelected(): void;
  copy(): void;
  paste(): void;
  duplicateSelected(): void;
  reorder(kind: 'forward' | 'backward' | 'front' | 'back'): void;
  moveElement(from: number, to: number): void;
  group(): void;
  ungroup(): void;
  align(mode: AlignMode): void;
  distribute(axis: 'h' | 'v'): void;
}

let lastKey: string | undefined;
let lastTime = 0;

export const currentProject = (s: State) => s.projects.find((p) => p.id === s.projectId) ?? null;
export const FRAME_GAP = 200;
export const boardW = (b: Board) => b.pageWidth * b.pageNames.length;

function layoutRow(boards: Board[]) {
  let x = 0;
  for (const b of boards) {
    b.x = x;
    b.y = 0;
    x += boardW(b) + FRAME_GAP;
  }
}

export const currentBoard = (s: State) => currentProject(s)?.boards.find((b) => b.id === s.boardId) ?? null;

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

function remapIds(els: El[]): El[] {
  const groups = new Map<string, string>();
  return els.map((e) => {
    const c = clone(e);
    c.id = uid();
    if (c.groupId) {
      if (!groups.has(c.groupId)) groups.set(c.groupId, uid());
      c.groupId = groups.get(c.groupId)!;
    }
    return c;
  });
}

export const useStore = create<State>((set, get) => ({
  loaded: false,
  saveState: 'idle',
  projects: [],
  view: 'list',
  dialog: null,
  projectId: null,
  boardId: null,
  selectedBoards: [],
  selected: [],
  past: [],
  future: [],
  clipboard: [],
  zoom: 0.25,
  pan: { x: 0, y: 0 },
  viewSize: { w: 800, h: 600 },
  tool: 'select',
  fitNonce: 0,
  fitMode: 'board',
  showGuides: true,

  async load() {
    try {
      const data = (await idbGet(STORAGE_KEY)) as Project[] | undefined;
      const projects = Array.isArray(data) ? data : [];
      for (const p of projects) if (p.boards.some((b) => typeof b.x !== 'number')) layoutRow(p.boards);
      set({ projects, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },
  setView: (view) => set({ view }),
  setDialog: (dialog) => set({ dialog }),
  setZoom: (z, anchor) =>
    set((s) => {
      const zoom = Math.min(8, Math.max(0.02, z));
      const a = anchor ?? { x: s.viewSize.w / 2, y: s.viewSize.h / 2 };
      const k = zoom / s.zoom;
      return { zoom, pan: { x: a.x - (a.x - s.pan.x) * k, y: a.y - (a.y - s.pan.y) * k } };
    }),
  setPan: (pan) => set({ pan }),
  setViewSize: (viewSize) => set({ viewSize }),
  setTool: (tool) => set({ tool }),
  requestFit: (mode = 'board') => set((s) => ({ fitNonce: s.fitNonce + 1, fitMode: mode })),
  focusBoard(id) {
    set({ boardId: id, selectedBoards: [id], selected: [] });
    get().requestFit('board');
  },
  selectIn(boardId, ids) {
    const s = get();
    if (s.boardId !== boardId) set({ boardId, selectedBoards: [boardId], selected: ids });
    else set({ selected: ids });
  },
  moveBoardPos(id, x, y) {
    get().mutate((d) => {
      const b = d.boards.find((v) => v.id === id);
      if (b) {
        b.x = x;
        b.y = y;
      }
    });
  },
  arrangeBoards() {
    get().mutate((d) => layoutRow(d.boards as Board[]));
    get().requestFit('all');
  },
  moveElementsToBoard(ids, fromId, toId) {
    get().mutate((d) => {
      const from = d.boards.find((b) => b.id === fromId);
      const to = d.boards.find((b) => b.id === toId);
      if (!from || !to) return;
      const moving = from.elements.filter((e) => ids.includes(e.id));
      from.elements = from.elements.filter((e) => !ids.includes(e.id));
      for (const e of moving) {
        e.x += from.x - to.x;
        e.y += from.y - to.y;
        to.elements.push(e);
      }
    });
    set({ boardId: toId, selectedBoards: [toId], selected: ids });
  },
  dropImageIntoDevice(fromBoardId, imageId, toBoardId, deviceId) {
    get().mutate((d) => {
      const from = d.boards.find((b) => b.id === fromBoardId);
      const img = from?.elements.find((e) => e.id === imageId);
      const dev = d.boards.find((b) => b.id === toBoardId)?.elements.find((e) => e.id === deviceId);
      if (!from || !img || img.type !== 'image' || !dev || dev.type !== 'device') return;
      dev.screenSrc = img.src;
      dev.screenScale = 1;
      dev.screenOffsetX = 0;
      dev.screenOffsetY = 0;
      from.elements = from.elements.filter((e) => e.id !== imageId);
    });
    set({ boardId: toBoardId, selectedBoards: [toBoardId], selected: [deviceId] });
  },
  setDeviceScreen(boardId, deviceId, src) {
    get().mutate((d) => {
      const dev = d.boards.find((b) => b.id === boardId)?.elements.find((e) => e.id === deviceId);
      if (dev && dev.type === 'device') {
        dev.screenSrc = src;
        dev.screenScale = 1;
        dev.screenOffsetX = 0;
        dev.screenOffsetY = 0;
      }
    });
    set({ boardId, selectedBoards: [boardId], selected: [deviceId] });
  },
  toggleGuides: () => set((s) => ({ showGuides: !s.showGuides })),

  createProject(name) {
    const now = Date.now();
    const p: Project = { id: uid(), name: name || '無題のプロジェクト', createdAt: now, updatedAt: now, boards: [] };
    set((s) => ({ projects: [p, ...s.projects] }));
    return p.id;
  },
  renameProject(id, name) {
    set((s) => ({ projects: s.projects.map((p) => (p.id === id ? { ...p, name, updatedAt: Date.now() } : p)) }));
  },
  duplicateProject(id) {
    const src = get().projects.find((p) => p.id === id);
    if (!src) return;
    const now = Date.now();
    const copy: Project = {
      ...clone(src),
      id: uid(),
      name: `${src.name} のコピー`,
      createdAt: now,
      updatedAt: now,
    };
    copy.boards = copy.boards.map((b) => ({ ...b, id: uid(), elements: remapIds(b.elements) }));
    set((s) => ({ projects: [copy, ...s.projects] }));
  },
  deleteProject(id) {
    set((s) => ({ projects: s.projects.filter((p) => p.id !== id) }));
  },
  openProject(id) {
    const p = get().projects.find((x) => x.id === id);
    if (!p) return;
    const boardId = p.boards[0]?.id ?? null;
    set({
      projectId: id,
      boardId,
      selectedBoards: boardId ? [boardId] : [],
      selected: [],
      past: [],
      future: [],
      view: 'editor',
      dialog: p.boards.length ? null : 'newCanvas',
    });
  },

  mutate(fn, historyKey) {
    const s = get();
    const p = currentProject(s);
    if (!p) return;
    const now = Date.now();
    let past = s.past;
    if (!(historyKey && historyKey === lastKey && now - lastTime < 800)) {
      past = [...s.past, p.boards].slice(-100);
    }
    lastKey = historyKey;
    lastTime = now;
    const np = produce(p, (d) => {
      fn(d);
      d.updatedAt = now;
    });
    set({ projects: s.projects.map((x) => (x.id === p.id ? np : x)), past, future: [] });
  },
  undo() {
    const s = get();
    const p = currentProject(s);
    if (!p || !s.past.length) return;
    const prev = s.past[s.past.length - 1];
    restore(prev, s.past.slice(0, -1), [p.boards, ...s.future]);
  },
  redo() {
    const s = get();
    const p = currentProject(s);
    if (!p || !s.future.length) return;
    const next = s.future[0];
    restore(next, [...s.past, p.boards], s.future.slice(1));
  },

  selectBoard(id, mode = 'single') {
    const s = get();
    if (mode === 'toggle') {
      const has = s.selectedBoards.includes(id);
      const sel = has ? s.selectedBoards.filter((x) => x !== id) : [...s.selectedBoards, id];
      set({ selectedBoards: sel.length ? sel : [id], boardId: id, selected: [] });
    } else if (mode === 'range') {
      const boards = currentProject(s)?.boards ?? [];
      const a = boards.findIndex((b) => b.id === s.boardId);
      const b = boards.findIndex((x) => x.id === id);
      const [lo, hi] = a < b ? [a, b] : [b, a];
      set({ selectedBoards: boards.slice(Math.max(0, lo), hi + 1).map((x) => x.id), boardId: id, selected: [] });
    } else {
      set({ selectedBoards: [id], boardId: id, selected: [] });
    }
  },
  addBoards(boards, opts) {
    const s = get();
    const p = currentProject(s);
    if (!p || !boards.length) return;
    const idx = p.boards.findIndex((b) => b.id === s.boardId);
    const placed = clone(boards);
    if (!opts?.keepPosition) {
      let x = p.boards.length ? Math.max(...p.boards.map((b) => b.x + boardW(b))) + FRAME_GAP : 0;
      const y = p.boards.find((b) => b.id === s.boardId)?.y ?? 0;
      for (const b of placed) {
        b.x = x;
        b.y = y;
        x += boardW(b) + FRAME_GAP;
      }
    }
    get().mutate((d) => {
      d.boards.splice(idx < 0 ? d.boards.length : idx + 1, 0, ...placed);
    });
    set({ boardId: boards[0].id, selectedBoards: boards.map((b) => b.id), selected: [] });
  },
  duplicateBoard(id) {
    const b = currentProject(get())?.boards.find((x) => x.id === id);
    if (!b) return;
    const copy: Board = { ...clone(b), id: uid(), name: `${b.name} のコピー`, elements: remapIds(b.elements) };
    get().selectBoard(id);
    get().addBoards([copy]);
  },
  deleteBoards(ids) {
    const p = currentProject(get());
    if (!p) return;
    const firstIdx = p.boards.findIndex((b) => ids.includes(b.id));
    get().mutate((d) => {
      d.boards = d.boards.filter((b) => !ids.includes(b.id));
    });
    const rest = currentProject(get())!.boards;
    const next = rest[Math.min(Math.max(0, firstIdx), rest.length - 1)];
    set({ boardId: next?.id ?? null, selectedBoards: next ? [next.id] : [], selected: [] });
  },
  renameBoard(id, name) {
    get().mutate((d) => {
      const b = d.boards.find((x) => x.id === id);
      if (b) b.name = name;
    });
  },
  moveBoard(from, to) {
    get().mutate((d) => {
      const [b] = d.boards.splice(from, 1);
      d.boards.splice(to, 0, b);
    });
  },
  linkBoards(ids) {
    const p = currentProject(get());
    if (!p) return null;
    const boards = p.boards.filter((b) => ids.includes(b.id));
    if (boards.length < 2) return null;
    const { pageWidth: w, pageHeight: h } = boards[0];
    if (boards.some((b) => b.pageWidth !== w || b.pageHeight !== h)) return null;
    const first = boards[0];
    const merged: Board = { ...clone(first), id: uid(), name: '連結グループ', pageNames: [], elements: [] };
    let offset = 0;
    for (const b of boards) {
      for (const el of b.elements) merged.elements.push({ ...clone(el), x: el.x + offset * w });
      b.pageNames.forEach((n, i) => merged.pageNames.push(b.pageNames.length > 1 ? `${b.name} ${i + 1}` : b.name || n));
      offset += b.pageNames.length;
    }
    const insertAt = p.boards.findIndex((b) => b.id === first.id);
    get().mutate((d) => {
      d.boards = d.boards.filter((b) => !ids.includes(b.id));
      d.boards.splice(insertAt, 0, merged as Draft<Board>);
    });
    set({ boardId: merged.id, selectedBoards: [merged.id], selected: [] });
    get().requestFit();
    return merged.id;
  },
  unlinkBoard(id) {
    const p = currentProject(get());
    const b = p?.boards.find((x) => x.id === id);
    if (!p || !b || b.pageNames.length < 2) return;
    const w = b.pageWidth;
    const parts: Board[] = b.pageNames.map((name, i) => {
      const page = { x: i * w, y: 0, width: w, height: b.pageHeight };
      const els = b.elements.filter((el) => intersects(elementBounds(el), page)).map((el) => ({ ...clone(el), x: el.x - i * w }));
      return { ...clone(b), id: uid(), name, pageNames: [name], elements: remapIds(els), x: b.x + i * (w + FRAME_GAP), y: b.y };
    });
    const idx = p.boards.findIndex((x) => x.id === id);
    const shift = (b.pageNames.length - 1) * FRAME_GAP;
    get().mutate((d) => {
      for (const o of d.boards) if (o.id !== id && o.x > b.x) o.x += shift;
      d.boards.splice(idx, 1, ...(parts as Draft<Board>[]));
    });
    set({ boardId: parts[0].id, selectedBoards: parts.map((x) => x.id), selected: [] });
    get().requestFit();
  },
  setPageCount(id, n) {
    get().mutate((d) => {
      const b = d.boards.find((x) => x.id === id);
      if (!b) return;
      const count = Math.max(1, Math.min(10, n));
      while (b.pageNames.length < count) b.pageNames.push(String(b.pageNames.length + 1));
      b.pageNames.length = count;
    });
    get().requestFit();
  },
  updateBoard(patch, key) {
    const id = get().boardId;
    get().mutate((d) => {
      const b = d.boards.find((x) => x.id === id);
      if (b) Object.assign(b, patch);
    }, key);
  },

  setSelected: (ids) => set({ selected: ids }),
  addElements(els) {
    const id = get().boardId;
    get().mutate((d) => {
      d.boards.find((b) => b.id === id)?.elements.push(...(clone(els) as Draft<El>[]));
    });
    set({ selected: els.map((e) => e.id) });
  },
  updateElements(ids, patch, key) {
    const id = get().boardId;
    get().mutate((d) => {
      const b = d.boards.find((x) => x.id === id);
      if (!b) return;
      for (const el of b.elements) {
        if (!ids.includes(el.id)) continue;
        if (typeof patch === 'function') patch(el);
        else Object.assign(el, patch);
      }
    }, key);
  },
  patchSilent(boardId, id, patch) {
    const s = get();
    const p = currentProject(s);
    if (!p) return;
    const np = produce(p, (d) => {
      const el = d.boards.find((b) => b.id === boardId)?.elements.find((e) => e.id === id);
      if (el) Object.assign(el, patch);
    });
    set({ projects: s.projects.map((x) => (x.id === p.id ? np : x)) });
  },
  deleteSelected() {
    const { selected, boardId } = get();
    if (!selected.length) return;
    get().mutate((d) => {
      const b = d.boards.find((x) => x.id === boardId);
      if (b) b.elements = b.elements.filter((e) => !selected.includes(e.id));
    });
    set({ selected: [] });
  },
  copy() {
    const b = currentBoard(get());
    if (!b) return;
    set({ clipboard: clone(b.elements.filter((e) => get().selected.includes(e.id))) });
  },
  paste() {
    const { clipboard } = get();
    if (!clipboard.length) return;
    const els = remapIds(clipboard).map((e) => ({ ...e, x: e.x + 40, y: e.y + 40 }));
    set({ clipboard: clone(els) });
    get().addElements(els);
  },
  duplicateSelected() {
    get().copy();
    get().paste();
  },
  reorder(kind) {
    const { selected, boardId } = get();
    get().mutate((d) => {
      const b = d.boards.find((x) => x.id === boardId);
      if (!b) return;
      const els = b.elements;
      const sel = els.filter((e) => selected.includes(e.id));
      const rest = els.filter((e) => !selected.includes(e.id));
      if (kind === 'front') b.elements = [...rest, ...sel];
      else if (kind === 'back') b.elements = [...sel, ...rest];
      else if (kind === 'forward') {
        for (let i = els.length - 2; i >= 0; i--) {
          if (selected.includes(els[i].id) && !selected.includes(els[i + 1].id)) [els[i], els[i + 1]] = [els[i + 1], els[i]];
        }
      } else {
        for (let i = 1; i < els.length; i++) {
          if (selected.includes(els[i].id) && !selected.includes(els[i - 1].id)) [els[i], els[i - 1]] = [els[i - 1], els[i]];
        }
      }
    });
  },
  moveElement(from, to) {
    const id = get().boardId;
    get().mutate((d) => {
      const b = d.boards.find((x) => x.id === id);
      if (!b) return;
      const [el] = b.elements.splice(from, 1);
      b.elements.splice(to, 0, el);
    });
  },
  group() {
    const { selected } = get();
    if (selected.length < 2) return;
    const gid = uid();
    get().updateElements(selected, { groupId: gid });
  },
  ungroup() {
    get().updateElements(get().selected, { groupId: null });
  },
  align(mode) {
    const s = get();
    const b = currentBoard(s);
    if (!b) return;
    const els = b.elements.filter((e) => s.selected.includes(e.id) && !e.locked);
    if (!els.length) return;
    const boxes = els.map(elementBounds);
    const ref = unionBox(boxes)!;
    const groupIds = new Set(els.map((e) => e.groupId));
    const treatAsOne = els.length === 1 || (groupIds.size === 1 && !groupIds.has(null));
    if (treatAsOne) {
      const cx = ref.x + ref.width / 2;
      const page = Math.max(0, Math.min(b.pageNames.length - 1, Math.floor(cx / b.pageWidth)));
      const target = { x: page * b.pageWidth, y: 0, width: b.pageWidth, height: b.pageHeight };
      const dx = calc(mode, ref, target, 'x');
      const dy = calc(mode, ref, target, 'y');
      s.updateElements(els.map((e) => e.id), (el) => {
        el.x += dx;
        el.y += dy;
      });
      return;
    }
    s.updateElements(els.map((e) => e.id), (el) => {
      const bx = elementBounds(el as El);
      el.x += calc(mode, bx, ref, 'x');
      el.y += calc(mode, bx, ref, 'y');
    });
  },
  distribute(axis) {
    const s = get();
    const b = currentBoard(s);
    if (!b) return;
    const els = b.elements.filter((e) => s.selected.includes(e.id) && !e.locked);
    if (els.length < 3) return;
    const pos = axis === 'h' ? 'x' : 'y';
    const size = axis === 'h' ? 'width' : 'height';
    const items = els.map((e) => ({ id: e.id, box: elementBounds(e) })).sort((a, c) => a.box[pos] - c.box[pos]);
    const start = items[0].box[pos];
    const end = Math.max(...items.map((i) => i.box[pos] + i.box[size]));
    const total = items.reduce((acc, i) => acc + i.box[size], 0);
    const gap = (end - start - total) / (items.length - 1);
    const delta = new Map<string, number>();
    let cur = start;
    for (const i of items) {
      delta.set(i.id, cur - i.box[pos]);
      cur += i.box[size] + gap;
    }
    s.updateElements(items.map((i) => i.id), (el) => {
      el[pos] += delta.get(el.id) ?? 0;
    });
  },
}));

function calc(mode: AlignMode, box: { x: number; y: number; width: number; height: number }, ref: typeof box, axis: 'x' | 'y') {
  if (axis === 'x') {
    if (mode === 'left') return ref.x - box.x;
    if (mode === 'hcenter') return ref.x + ref.width / 2 - (box.x + box.width / 2);
    if (mode === 'right') return ref.x + ref.width - (box.x + box.width);
    return 0;
  }
  if (mode === 'top') return ref.y - box.y;
  if (mode === 'vcenter') return ref.y + ref.height / 2 - (box.y + box.height / 2);
  if (mode === 'bottom') return ref.y + ref.height - (box.y + box.height);
  return 0;
}

function restore(boards: Board[], past: Board[][], future: Board[][]) {
  const s = useStore.getState();
  const p = currentProject(s);
  if (!p) return;
  const np = { ...p, boards, updatedAt: Date.now() };
  const boardId = boards.some((b) => b.id === s.boardId) ? s.boardId : boards[0]?.id ?? null;
  const ids = new Set(boards.find((b) => b.id === boardId)?.elements.map((e) => e.id));
  useStore.setState({
    projects: s.projects.map((x) => (x.id === p.id ? np : x)),
    past,
    future,
    boardId,
    selectedBoards: boardId ? [boardId] : [],
    selected: s.selected.filter((id) => ids.has(id)),
  });
  lastKey = undefined;
}

/** 自動保存: projects が変わったら IndexedDB に保存 */
export function startAutosave() {
  let timer: ReturnType<typeof setTimeout> | undefined;
  useStore.subscribe((s, prev) => {
    if (!s.loaded || s.projects === prev.projects) return;
    if (s.saveState !== 'saving') useStore.setState({ saveState: 'saving' });
    clearTimeout(timer);
    timer = setTimeout(async () => {
      try {
        await idbSet(STORAGE_KEY, useStore.getState().projects);
        useStore.setState({ saveState: 'saved' });
      } catch {
        useStore.setState({ saveState: 'error' });
      }
    }, 600);
  });
}
