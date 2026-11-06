import { useState } from 'react';
import { useStore } from '../store';
import { ASSET_LABELS, ORIENTATION_LABELS, PRESETS, STORES, presetById, type Preset } from '../presets';
import { makeBoard, makeDevice } from '../lib/factory';
import type { StoreId } from '../types';

export const PRESET_MIME = 'application/x-storecanvas-preset';

/** プリセットのフレームを、ワールド座標 center を中心に追加する */
export function addPresetFrame(presetId: string, center?: { x: number; y: number }, withMockup = true) {
  const p = presetById(presetId);
  const s = useStore.getState();
  if (!p) return;
  const c = center ?? { x: (s.viewSize.w / 2 - s.pan.x) / s.zoom, y: (s.viewSize.h / 2 - s.pan.y) / s.zoom };
  const board = makeBoard({
    pageWidth: p.width,
    pageHeight: p.height,
    presetId: p.id,
    exportFormat: p.formats[0],
    name: p.device,
    x: Math.round(c.x - p.width / 2),
    y: Math.round(c.y - p.height / 2),
  });
  if (withMockup && p.asset === 'screenshot' && p.mockup) {
    const portrait = p.height >= p.width;
    const aspect = makeDevice({ model: p.mockup, width: 100, x: 0, y: 0 }).height / 100;
    const w = portrait ? Math.min(p.width * 0.7, (p.height * 0.68) / aspect) : (p.height * 0.8) / aspect;
    const d = makeDevice({ model: p.mockup, width: w, x: (p.width - w) / 2, y: 0 });
    d.y = portrait ? p.height * 0.28 : (p.height - d.height) / 2;
    board.elements.push(d);
  }
  s.addBoards([board], { keepPosition: true });
  s.setTool('select');
}

/** フレームツール中に右パネルに出す、ストア掲載用サイズの一覧（Figma のフレームプリセット風） */
export function FramePresetsPanel() {
  const [store, setStore] = useState<StoreId>('appstore');
  const [mockup, setMockup] = useState(true);
  const groups = new Map<string, Preset[]>();
  for (const p of PRESETS.filter((x) => x.store === store)) {
    const k = ASSET_LABELS[p.asset];
    groups.set(k, [...(groups.get(k) ?? []), p]);
  }
  return (
    <aside className="right panel">
      <div className="prop-section">
        <h4>フレームを追加</h4>
        <p className="note">
          ホワイトボード上を<b>ドラッグ</b>すると自由なサイズで作成できます。ストア用サイズは下の一覧から<b>ドラッグ＆ドロップ</b>するか、クリックで画面中央に追加します。
        </p>
        <div className="seg">
          {STORES.map((s) => (
            <button key={s.id} className={store === s.id ? 'on' : ''} onClick={() => setStore(s.id)}>
              {s.label}
            </button>
          ))}
        </div>
        <label className="check">
          <input type="checkbox" checked={mockup} onChange={(e) => setMockup(e.target.checked)} /> スクリーンショットに端末モックアップを配置
        </label>
      </div>
      {[...groups].map(([label, list]) => (
        <div key={label} className="prop-section preset-group">
          <h4>{label}</h4>
          {list.map((p) => (
            <button
              key={p.id}
              className="preset-item"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(PRESET_MIME, JSON.stringify({ id: p.id, mockup }));
                e.dataTransfer.effectAllowed = 'copy';
              }}
              onClick={() => addPresetFrame(p.id, undefined, mockup)}
              title="ドラッグしてホワイトボードに配置 / クリックで中央に追加"
            >
              <span className="preset-icon">
                <span className="preset-shape" style={{ aspectRatio: `${p.width} / ${p.height}`, [p.width >= p.height ? 'width' : 'height']: 18 }} />
              </span>
              <span className="preset-name">
                {p.device}
                {p.orientation !== 'square' && p.asset === 'screenshot' && <small> {ORIENTATION_LABELS[p.orientation]}</small>}
              </span>
              <small className="muted">
                {p.width}×{p.height}
              </small>
            </button>
          ))}
        </div>
      ))}
    </aside>
  );
}
