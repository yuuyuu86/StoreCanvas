import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { ASSET_LABELS, ORIENTATION_LABELS, PRESETS, PRESETS_CHECKED_AT, STORES, type Orientation } from '../presets';
import type { AssetKind, StoreId } from '../types';
import { makeBoard, makeDevice } from '../lib/factory';
import { Icon } from './Icon';

export function NewCanvasDialog() {
  const st = useStore.getState();
  const hasBoards = useStore((s) => (s.projects.find((p) => p.id === s.projectId)?.boards.length ?? 0) > 0);
  const [store, setStore] = useState<StoreId>('appstore');
  const [asset, setAsset] = useState<AssetKind>('screenshot');
  const [device, setDevice] = useState<string>('');
  const [orientation, setOrientation] = useState<Orientation>('portrait');
  const [count, setCount] = useState(3);
  const [linked, setLinked] = useState(false);
  const [mockup, setMockup] = useState(true);
  const [custom, setCustom] = useState({ w: 1080, h: 1080 });

  const assets = useMemo(() => {
    const kinds = [...new Set(PRESETS.filter((p) => p.store === store).map((p) => p.asset))];
    return store === 'other' ? [...kinds, 'custom' as AssetKind] : kinds;
  }, [store]);
  const effAsset = assets.includes(asset) ? asset : assets[0];
  const devices = useMemo(() => [...new Set(PRESETS.filter((p) => p.store === store && p.asset === effAsset).map((p) => p.device))], [store, effAsset]);
  const effDevice = devices.includes(device) ? device : devices[0];
  const orientations = PRESETS.filter((p) => p.store === store && p.asset === effAsset && p.device === effDevice).map((p) => p.orientation);
  const effOrient = orientations.includes(orientation) ? orientation : orientations[0];
  const preset = effAsset === 'custom' ? null : PRESETS.find((p) => p.store === store && p.asset === effAsset && p.device === effDevice && p.orientation === effOrient) ?? null;
  const width = preset?.width ?? custom.w;
  const height = preset?.height ?? custom.h;
  const isShot = effAsset === 'screenshot';
  const n = isShot ? count : 1;

  const create = () => {
    const formats = preset?.formats ?? ['png'];
    const base = {
      pageWidth: width,
      pageHeight: height,
      presetId: preset?.id ?? null,
      exportFormat: formats[0],
    };
    const addMock = (offsetPage: number) => {
      if (!isShot || !mockup || !preset?.mockup) return [];
      const portrait = height >= width;
      const dw = portrait ? width * 0.7 : height * 0.55 * (preset.mockup === 'ipad' ? 0.77 : 0.48);
      const d = makeDevice({ model: preset.mockup, width: dw, x: offsetPage * width + (width - dw) / 2, y: 0 });
      d.y = portrait ? height * 0.27 : (height - d.height) / 2;
      return [d];
    };
    const label = preset?.device ?? `${width}×${height}`;
    if (linked && n > 1) {
      st.addBoards([
        makeBoard({
          ...base,
          name: `${label} 連結`,
          pageNames: Array.from({ length: n }, (_, i) => String(i + 1)),
          elements: Array.from({ length: n }, (_, i) => addMock(i)).flat(),
        }),
      ]);
    } else {
      st.addBoards(Array.from({ length: n }, (_, i) => makeBoard({ ...base, name: n > 1 ? `${label} ${i + 1}` : label, elements: addMock(0) })));
    }
    st.setDialog(null);
    st.requestFit();
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && hasBoards && st.setDialog(null)}>
      <div className="modal wizard">
        <header className="modal-head">
          <h2>キャンバスを作成</h2>
          {hasBoards && (
            <button className="icon-btn" onClick={() => st.setDialog(null)}>
              <Icon name="close" />
            </button>
          )}
        </header>
        <div className="wizard-body">
          <div className="wizard-steps">
            <Step n={1} title="掲載先">
              <div className="choice-grid three">
                {STORES.map((s) => (
                  <button key={s.id} className={`choice ${store === s.id ? 'on' : ''}`} onClick={() => setStore(s.id)}>
                    <b>{s.label}</b>
                    <small>{s.desc}</small>
                  </button>
                ))}
              </div>
            </Step>
            <Step n={2} title="素材">
              <div className="chips">
                {assets.map((a) => (
                  <button key={a} className={`chip ${effAsset === a ? 'on' : ''}`} onClick={() => setAsset(a)}>
                    {ASSET_LABELS[a]}
                  </button>
                ))}
              </div>
            </Step>
            {effAsset === 'custom' ? (
              <Step n={3} title="サイズ">
                <div className="row gap8 center">
                  <label className="field num inline">
                    <span>幅</span>
                    <input type="number" min={16} max={8000} value={custom.w} onChange={(e) => setCustom({ ...custom, w: +e.target.value || 1 })} />
                  </label>
                  <span className="muted">×</span>
                  <label className="field num inline">
                    <span>高さ</span>
                    <input type="number" min={16} max={8000} value={custom.h} onChange={(e) => setCustom({ ...custom, h: +e.target.value || 1 })} />
                  </label>
                  <span className="muted">px</span>
                </div>
              </Step>
            ) : (
              <>
                <Step n={3} title="端末・サイズ">
                  <div className="device-list">
                    {devices.map((d) => {
                      const p = PRESETS.find((x) => x.store === store && x.asset === effAsset && x.device === d)!;
                      return (
                        <button key={d} className={`device-row ${effDevice === d ? 'on' : ''}`} onClick={() => setDevice(d)}>
                          <span>{d}</span>
                          <small>
                            {p.width}×{p.height}
                          </small>
                        </button>
                      );
                    })}
                  </div>
                </Step>
                {orientations.length > 1 && (
                  <Step n={4} title="向き">
                    <div className="chips">
                      {orientations.map((o) => (
                        <button key={o} className={`chip ${effOrient === o ? 'on' : ''}`} onClick={() => setOrientation(o)}>
                          {ORIENTATION_LABELS[o]}
                        </button>
                      ))}
                    </div>
                  </Step>
                )}
              </>
            )}
            {isShot && (
              <Step n={orientations.length > 1 ? 5 : 4} title="枚数・連結">
                <div className="row gap16 center wrap">
                  <label className="field num inline">
                    <span>枚数</span>
                    <input type="number" min={1} max={10} value={count} onChange={(e) => setCount(Math.max(1, Math.min(10, +e.target.value || 1)))} />
                  </label>
                  <label className="check">
                    <input type="checkbox" checked={linked} disabled={count < 2} onChange={(e) => setLinked(e.target.checked)} /> 連結スクリーンショットとして作成
                  </label>
                  {preset?.mockup && (
                    <label className="check">
                      <input type="checkbox" checked={mockup} onChange={(e) => setMockup(e.target.checked)} /> 端末モックアップを配置
                    </label>
                  )}
                </div>
              </Step>
            )}
          </div>
          <aside className="wizard-summary">
            <div className="summary-preview">
              <div
                className={`summary-frame ${linked && n > 1 ? 'linked' : ''}`}
                style={{ aspectRatio: `${width * (linked && n > 1 ? n : 1)} / ${height}` }}
              >
                {linked && n > 1 && Array.from({ length: n - 1 }, (_, i) => <i key={i} style={{ left: `${((i + 1) / n) * 100}%` }} />)}
              </div>
            </div>
            <dl>
              <dt>掲載先</dt>
              <dd>{STORES.find((s) => s.id === store)?.label}</dd>
              <dt>素材</dt>
              <dd>{ASSET_LABELS[effAsset]}</dd>
              {preset && (
                <>
                  <dt>端末</dt>
                  <dd>
                    {preset.device}（{ORIENTATION_LABELS[preset.orientation]}）
                  </dd>
                </>
              )}
              <dt>画像サイズ</dt>
              <dd className="size">
                {width} × {height} px
              </dd>
              <dt>対応形式</dt>
              <dd>{(preset?.formats ?? ['png', 'jpeg']).map((f) => f.toUpperCase()).join(' / ')}</dd>
              {isShot && (
                <>
                  <dt>作成数</dt>
                  <dd>
                    {n}枚{linked && n > 1 ? `（連結: ${width * n}×${height}pxで編集）` : ''}
                  </dd>
                </>
              )}
            </dl>
            {preset?.note && <p className="note">{preset.note}</p>}
            <p className="note muted">プリセット確認日: {PRESETS_CHECKED_AT}。最新の仕様は各ストアの公式ドキュメントをご確認ください。</p>
            <button className="btn primary block" onClick={create}>
              キャンバスを作成
            </button>
          </aside>
        </div>
      </div>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="step">
      <h3>
        <span className="step-n">{n}</span>
        {title}
      </h3>
      {children}
    </section>
  );
}
