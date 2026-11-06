import { useEffect, useState } from 'react';
import { currentBoard, currentProject, useStore } from '../store';
import { EditorCanvas } from './EditorCanvas';
import { LayersPanel, PagesPanel } from './Panels';
import { PropertiesPanel } from './PropertiesPanel';
import { Icon } from './Icon';
import { DEVICE_LABEL, uid, makeDevice, makeImage, makeShape, makeText } from '../lib/factory';
import { loadImage, pickImageFiles, readFileAsDataURL } from '../lib/image';
import type { DeviceModel, El } from '../types';
import { presetById } from '../presets';

function insertPoint() {
  const b = currentBoard(useStore.getState());
  return b ? { pw: b.pageWidth, ph: b.pageHeight, preset: presetById(b.presetId) } : null;
}

async function addImages(files: File[]) {
  const ip = insertPoint();
  if (!ip) return;
  const els: El[] = [];
  for (const [i, f] of files.entries()) {
    const src = await readFileAsDataURL(f);
    const img = await loadImage(src);
    const s = Math.min(1, (ip.pw * 0.6) / img.width, (ip.ph * 0.6) / img.height);
    els.push(makeImage({ src, width: img.width * s, height: img.height * s, x: (ip.pw - img.width * s) / 2 + i * 40, y: (ip.ph - img.height * s) / 2 + i * 40, name: f.name.replace(/\.[^.]+$/, '') }));
  }
  useStore.getState().addElements(els);
}

const tools = {
  text() {
    const ip = insertPoint();
    if (!ip) return;
    const fs = Math.round(Math.min(ip.pw, ip.ph) * 0.07);
    useStore.getState().addElements([makeText({ text: 'テキストを入力', x: ip.pw * 0.1, y: ip.ph * 0.1, width: ip.pw * 0.8, fontSize: fs })]);
  },
  rect() {
    const ip = insertPoint();
    if (!ip) return;
    const w = ip.pw * 0.4;
    useStore.getState().addElements([makeShape({ type: 'rect', x: (ip.pw - w) / 2, y: ip.ph / 2 - w / 3, width: w, height: w * 0.66, cornerRadius: w * 0.06 })]);
  },
  ellipse() {
    const ip = insertPoint();
    if (!ip) return;
    const w = Math.min(ip.pw, ip.ph) * 0.4;
    useStore.getState().addElements([makeShape({ type: 'ellipse', x: (ip.pw - w) / 2, y: (ip.ph - w) / 2, width: w, height: w })]);
  },
  device(model: DeviceModel) {
    const ip = insertPoint();
    if (!ip) return;
    const portrait = ip.ph >= ip.pw;
    const aspect = makeDevice({ model, width: 100, x: 0, y: 0 }).height / 100;
    const w = portrait ? Math.min(ip.pw * 0.7, (ip.ph * 0.68) / aspect) : (ip.ph * 0.8) / aspect;
    const d = makeDevice({ model, width: w, x: (ip.pw - w) / 2, y: 0 });
    d.y = portrait ? ip.ph * 0.28 : (ip.ph - d.height) / 2;
    useStore.getState().addElements([d]);
  },
  /** iPhone 2台を並べたモックアップ（グループ化済み・後ろの1台は少し下げて重ねる） */
  iphoneDuo() {
    const ip = insertPoint();
    if (!ip) return;
    const aspect = makeDevice({ model: 'iphone', width: 100, x: 0, y: 0 }).height / 100;
    const portrait = ip.ph >= ip.pw;
    const w = portrait ? Math.min(ip.pw * 0.5, (ip.ph * 0.6) / aspect) : (ip.ph * 0.72) / aspect;
    const gap = -w * 0.12; // 少し重ねる
    const total = w * 2 + gap;
    const x0 = (ip.pw - total) / 2;
    const y0 = portrait ? ip.ph * 0.3 : (ip.ph - w * aspect) / 2;
    const gid = uid();
    const back = makeDevice({ model: 'iphone', width: w, x: x0, y: y0 + w * 0.18, name: 'iPhone（左）', groupId: gid });
    const front = makeDevice({ model: 'iphone', width: w, x: x0 + w + gap, y: y0, name: 'iPhone（右）', groupId: gid });
    useStore.getState().addElements([back, front]);
  },
  async image() {
    const files = await pickImageFiles();
    if (files.length) await addImages(files);
  },
};

function SaveIndicator() {
  const s = useStore((x) => x.saveState);
  const label = { idle: '保存済み', saved: '保存済み', saving: '保存中…', error: '保存に失敗しました' }[s];
  return <span className={`save-state ${s}`}>{label}</span>;
}

function Toolbar() {
  const project = useStore(currentProject)!;
  const zoom = useStore((s) => s.zoom);
  const canUndo = useStore((s) => s.past.length > 0);
  const canRedo = useStore((s) => s.future.length > 0);
  const showGuides = useStore((s) => s.showGuides);
  const linked = useStore((s) => (currentBoard(s)?.pageNames.length ?? 1) > 1);
  const st = useStore.getState();
  const [deviceMenu, setDeviceMenu] = useState(false);
  const tool = useStore((x) => x.tool);
  const [editingName, setEditingName] = useState(false);
  return (
    <header className="topbar">
      <button className="icon-btn" title="プロジェクト一覧へ" onClick={() => st.setView('list')}>
        <Icon name="back" />
      </button>
      <div className="brand-mark" />
      {editingName ? (
        <input
          className="inline-input title-input"
          autoFocus
          defaultValue={project.name}
          onBlur={(e) => {
            setEditingName(false);
            if (e.target.value.trim()) st.renameProject(project.id, e.target.value.trim());
          }}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
      ) : (
        <b className="project-title" onDoubleClick={() => setEditingName(true)} title="ダブルクリックで名前を変更">
          {project.name}
        </b>
      )}
      <SaveIndicator />
      <div className="tool-group">
        <button className={`tool ${tool === 'frame' ? 'on' : ''}`} title="フレーム (F)：キャンバス上をドラッグして作成、クリックでサイズを選択" onClick={() => st.setTool(tool === 'frame' ? 'select' : 'frame')}>
          <Icon name="frame" />
          <span>フレーム</span>
        </button>
        <button className="tool" title="テキスト (T)" onClick={tools.text}>
          <Icon name="text" />
          <span>テキスト</span>
        </button>
        <button className="tool" title="画像 (I)" onClick={tools.image}>
          <Icon name="image" />
          <span>画像</span>
        </button>
        <button className="tool" title="長方形 (R)" onClick={tools.rect}>
          <Icon name="rect" />
          <span>長方形</span>
        </button>
        <button className="tool" title="楕円 (O)" onClick={tools.ellipse}>
          <Icon name="ellipse" />
          <span>楕円</span>
        </button>
        <div className="menu-anchor">
          <button className="tool" title="端末モックアップ" onClick={() => setDeviceMenu((v) => !v)}>
            <Icon name="phone" />
            <span>端末</span>
          </button>
          {deviceMenu && (
            <div className="menu" onMouseLeave={() => setDeviceMenu(false)}>
              {(Object.keys(DEVICE_LABEL) as DeviceModel[]).map((m) => (
                <button
                  key={m}
                  onClick={() => {
                    tools.device(m);
                    setDeviceMenu(false);
                  }}
                >
                  {DEVICE_LABEL[m]}
                </button>
              ))}
              <button
                onClick={() => {
                  tools.iphoneDuo();
                  setDeviceMenu(false);
                }}
              >
                iPhone ×2（Duo）
              </button>
            </div>
          )}
        </div>
        <span className="divider" />
        <button className="tool" title="テンプレート" onClick={() => st.setDialog('templates')}>
          <Icon name="template" />
          <span>テンプレート</span>
        </button>
      </div>
      <div className="spacer" />
      <button className="icon-btn" title="元に戻す (⌘Z)" disabled={!canUndo} onClick={st.undo}>
        <Icon name="undo" />
      </button>
      <button className="icon-btn" title="やり直し (⌘⇧Z)" disabled={!canRedo} onClick={st.redo}>
        <Icon name="redo" />
      </button>
      {linked && (
        <button className={`icon-btn ${showGuides ? 'on' : ''}`} title="分割ガイドの表示・非表示" onClick={st.toggleGuides}>
          <Icon name="guides" />
        </button>
      )}
      <div className="zoom">
        <button className="icon-btn" onClick={() => st.setZoom(zoom / 1.25)} title="縮小 (⌘-)">
          −
        </button>
        <button className="zoom-val" onClick={() => st.requestFit('all')} title="すべてのフレームを表示 (⇧1) / 選択中のフレーム (⇧2)">
          {Math.round(zoom * 100)}%
        </button>
        <button className="icon-btn" onClick={() => st.setZoom(zoom * 1.25)} title="拡大 (⌘+)">
          +
        </button>
      </div>
      <button className="btn" onClick={() => st.setView('preview')}>
        <Icon name="play" /> プレビュー
      </button>
      <button className="btn primary" onClick={() => st.setDialog('export')}>
        <Icon name="download" /> 書き出し
      </button>
    </header>
  );
}

function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      const s = useStore.getState();
      if (s.dialog) return;
      const mod = e.metaKey || e.ctrlKey;
      const k = e.key.toLowerCase();
      const run = (fn: () => void) => {
        e.preventDefault();
        fn();
      };
      if (mod && k === 'z') return run(e.shiftKey ? s.redo : s.undo);
      if (mod && k === 'y') return run(s.redo);
      if (mod && k === 'c') return run(s.copy);
      if (mod && k === 'v') return run(s.paste);
      if (mod && k === 'd') return run(s.duplicateSelected);
      if (mod && k === 'g') return run(e.shiftKey ? s.ungroup : s.group);
      if (mod && k === 'a') return run(() => s.setSelected(currentBoard(s)?.elements.filter((x) => x.visible && !x.locked).map((x) => x.id) ?? []));
      if (mod && (k === '=' || k === '+')) return run(() => s.setZoom(s.zoom * 1.25));
      if (mod && k === '-') return run(() => s.setZoom(s.zoom / 1.25));
      if (mod && k === ']') return run(() => s.reorder(e.shiftKey ? 'front' : 'forward'));
      if (mod && k === '[') return run(() => s.reorder(e.shiftKey ? 'back' : 'backward'));
      if (e.shiftKey && e.code === 'Digit1') return run(() => s.requestFit('all'));
      if (e.shiftKey && e.code === 'Digit2') return run(() => s.requestFit('board'));
      if (k === 'delete' || k === 'backspace') return run(s.deleteSelected);
      if (k === 'escape') return run(() => {
        s.setTool('select');
        s.setSelected([]);
      });
      if (k.startsWith('arrow') && s.selected.length) {
        const d = e.shiftKey ? 10 : 1;
        const dx = k === 'arrowleft' ? -d : k === 'arrowright' ? d : 0;
        const dy = k === 'arrowup' ? -d : k === 'arrowdown' ? d : 0;
        return run(() =>
          s.updateElements(
            s.selected,
            (el) => {
              if (el.locked) return;
              el.x += dx;
              el.y += dy;
            },
            'nudge',
          ),
        );
      }
      if (mod) return;
      if (k === 'f' || k === 'a') return run(() => s.setTool('frame'));
      if (k === 'v') return run(() => s.setTool('select'));
      if (k === 't') return run(tools.text);
      if (k === 'r') return run(tools.rect);
      if (k === 'o') return run(tools.ellipse);
      if (k === 'i') return run(tools.image);
    };
    const onPaste = (e: ClipboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      const files = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith('image/'));
      if (files.length) {
        e.preventDefault();
        addImages(files);
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('paste', onPaste);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('paste', onPaste);
    };
  }, []);
}

export function Editor() {
  useShortcuts();
  return (
    <div className="editor">
      <Toolbar />
      <div className="editor-body">
        <aside className="left">
          <PagesPanel />
          <LayersPanel />
        </aside>
        <main className="center">
          <EditorCanvas />
        </main>
        <PropertiesPanel />
      </div>
    </div>
  );
}
