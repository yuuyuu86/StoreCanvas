import { useEffect, useRef, useState, type ReactNode } from 'react';
import { currentBoard, useStore } from '../store';
import type { Board, DeviceEl, DeviceModel, El, ImageFormat } from '../types';
import { presetById, PRESETS, PRESETS_CHECKED_AT, STORE_LABEL } from '../presets';
import { DEVICE_LABEL, FONTS } from '../lib/factory';
import { importImageFile, pickImageFiles } from '../lib/image';
import { Icon } from './Icon';
import { FramePresetsPanel } from './FramePresetsPanel';

const r = (n: number) => Math.round(n * 100) / 100;

function Num({ label, value, onChange, step = 1, min, max }: { label: string; value: number; onChange(v: number): void; step?: number; min?: number; max?: number }) {
  const [v, setV] = useState(String(r(value)));
  useEffect(() => setV(String(r(value))), [value]);
  const commit = (s: string) => {
    let n = parseFloat(s);
    if (isNaN(n)) return setV(String(r(value)));
    if (min !== undefined) n = Math.max(min, n);
    if (max !== undefined) n = Math.min(max, n);
    if (n !== value) onChange(n);
    setV(String(r(n)));
  };
  return (
    <label className="field num">
      <span>{label}</span>
      <input
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit((e.target as HTMLInputElement).value);
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            commit(String(value + (e.key === 'ArrowUp' ? 1 : -1) * step * (e.shiftKey ? 10 : 1)));
          }
        }}
      />
    </label>
  );
}

function Color({ label, value, onChange }: { label: string; value: string; onChange(v: string): void }) {
  const hex = /^#[0-9a-f]{6}$/i.test(value) ? value : '#000000';
  return (
    <label className="field color">
      <span>{label}</span>
      <input type="color" value={hex} onChange={(e) => onChange(e.target.value)} />
      <input className="hex" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function Range({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange(v: number): void }) {
  return (
    <label className="field range">
      <span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} />
      <em>{r(value)}</em>
    </label>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="prop-section">
      <h4>{title}</h4>
      {children}
    </div>
  );
}

function BoardProps({ board }: { board: Board }) {
  const st = useStore.getState();
  const showGuides = useStore((s) => s.showGuides);
  const preset = presetById(board.presetId);
  const bg = board.background;
  const setBg = (p: Partial<Board['background']>) => st.updateBoard({ background: { ...bg, ...p } }, 'bg');
  const n = board.pageNames.length;
  return (
    <>
      <Section title={n > 1 ? '連結グループ' : 'ページ'}>
        <div className="kv">
          <span>掲載先</span>
          <b>{preset ? preset.device : 'カスタムサイズ'}</b>
        </div>
        <div className="kv">
          <span>書き出しサイズ</span>
          <b>
            {board.pageWidth} × {board.pageHeight}px{n > 1 ? ` × ${n}枚` : ''}
          </b>
        </div>
        {preset && (
          <div className="kv">
            <span>対応形式</span>
            <b>{preset.formats.map((f) => f.toUpperCase()).join(' / ')}</b>
          </div>
        )}
        <div className="grid2">
          <Num label="W" value={board.pageWidth} min={16} max={8000} onChange={(v) => st.updateBoard({ pageWidth: Math.round(v), presetId: preset && preset.width === Math.round(v) ? preset.id : null })} />
          <Num label="H" value={board.pageHeight} min={16} max={8000} onChange={(v) => st.updateBoard({ pageHeight: Math.round(v), presetId: preset && preset.height === Math.round(v) ? preset.id : null })} />
        </div>
        <label className="field">
          <span>プリセット</span>
          <select
            value={board.presetId ?? ''}
            onChange={(e) => {
              const p = PRESETS.find((x) => x.id === e.target.value);
              if (p) st.updateBoard({ presetId: p.id, pageWidth: p.width, pageHeight: p.height, exportFormat: p.formats[0] });
            }}
          >
            <option value="">カスタム</option>
            {PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {STORE_LABEL[p.store]} · {p.device}（{p.width}×{p.height}）
              </option>
            ))}
          </select>
        </label>
        {preset?.note && <p className="note">{preset.note}</p>}
        <p className="note muted">プリセット確認日: {PRESETS_CHECKED_AT}</p>
        <label className="field">
          <span>書き出し形式</span>
          <select value={board.exportFormat} onChange={(e) => st.updateBoard({ exportFormat: e.target.value as ImageFormat })}>
            <option value="png">PNG</option>
            <option value="jpeg">JPEG</option>
          </select>
        </label>
      </Section>
      {n > 1 && (
        <Section title="分割">
          <div className="row gap8 center">
            <span className="muted">ページ数</span>
            <button className="icon-btn" onClick={() => st.setPageCount(board.id, n - 1)} disabled={n <= 2}>
              −
            </button>
            <b>{n}</b>
            <button className="icon-btn" onClick={() => st.setPageCount(board.id, n + 1)} disabled={n >= 10}>
              +
            </button>
          </div>
          <label className="check">
            <input type="checkbox" checked={showGuides} onChange={() => st.toggleGuides()} /> 分割ガイドを表示
          </label>
          <p className="note">分割位置はページ幅（{board.pageWidth}px）から自動計算されます。ガイドは書き出し画像に含まれません。</p>
        </Section>
      )}
      <Section title="背景">
        <div className="seg">
          <button className={bg.type === 'solid' ? 'on' : ''} onClick={() => setBg({ type: 'solid' })}>
            単色
          </button>
          <button className={bg.type === 'linear' ? 'on' : ''} onClick={() => setBg({ type: 'linear' })}>
            グラデーション
          </button>
        </div>
        <Color label={bg.type === 'linear' ? '開始色' : '色'} value={bg.color} onChange={(v) => setBg({ color: v })} />
        {bg.type === 'linear' && (
          <>
            <Color label="終了色" value={bg.color2} onChange={(v) => setBg({ color2: v })} />
            <Range label="角度" value={bg.angle} min={0} max={360} step={1} onChange={(v) => setBg({ angle: v })} />
          </>
        )}
      </Section>
    </>
  );
}

function AlignBar({ count }: { count: number }) {
  const st = useStore.getState();
  const items: [string, () => void, string][] = [
    ['alignLeft', () => st.align('left'), '左揃え'],
    ['alignHCenter', () => st.align('hcenter'), '左右中央'],
    ['alignRight', () => st.align('right'), '右揃え'],
    ['alignTop', () => st.align('top'), '上揃え'],
    ['alignVCenter', () => st.align('vcenter'), '上下中央'],
    ['alignBottom', () => st.align('bottom'), '下揃え'],
  ];
  return (
    <div className="align-bar">
      {items.map(([ic, fn, t]) => (
        <button key={ic} className="icon-btn" title={count === 1 ? `${t}（ページ基準）` : t} onClick={fn}>
          <Icon name={ic} />
        </button>
      ))}
      <button className="icon-btn" title="左右に均等配置（3つ以上）" disabled={count < 3} onClick={() => st.distribute('h')}>
        <Icon name="distH" />
      </button>
      <button className="icon-btn" title="上下に均等配置（3つ以上）" disabled={count < 3} onClick={() => st.distribute('v')}>
        <Icon name="distV" />
      </button>
    </div>
  );
}

function ElementProps({ el }: { el: El }) {
  const st = useStore.getState();
  const up = (p: Partial<El>, key: string) => st.updateElements([el.id], p as Partial<El>, `${el.id}:${key}`);
  const textRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const f = () => {
      textRef.current?.focus();
      textRef.current?.select();
    };
    window.addEventListener('sc:edit-text', f);
    return () => window.removeEventListener('sc:edit-text', f);
  }, []);

  return (
    <>
      <Section title="配置">
        <div className="grid2">
          <Num label="X" value={el.x} onChange={(v) => up({ x: v }, 'x')} />
          <Num label="Y" value={el.y} onChange={(v) => up({ y: v }, 'y')} />
          <Num label="W" value={el.width} min={1} onChange={(v) => up({ width: v }, 'w')} />
          {el.type !== 'text' && <Num label="H" value={el.height} min={1} onChange={(v) => up({ height: v }, 'h')} />}
          <Num label="回転" value={el.rotation} onChange={(v) => up({ rotation: v }, 'rot')} />
          <Num label="不透明度" value={Math.round(el.opacity * 100)} min={0} max={100} onChange={(v) => up({ opacity: v / 100 }, 'op')} />
        </div>
      </Section>

      {el.type === 'text' && (
        <Section title="テキスト">
          <textarea ref={textRef} className="text-input" rows={3} value={el.text} onChange={(e) => up({ text: e.target.value }, 'text')} />
          <label className="field">
            <span>フォント</span>
            <select value={el.fontFamily} onChange={(e) => up({ fontFamily: e.target.value }, 'ff')}>
              {FONTS.map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </label>
          <div className="grid2">
            <Num label="サイズ" value={el.fontSize} min={1} onChange={(v) => up({ fontSize: v }, 'fs')} />
            <Num label="行間" value={el.lineHeight} step={0.05} min={0.5} onChange={(v) => up({ lineHeight: v }, 'lh')} />
          </div>
          <div className="seg">
            {(['normal', 'bold', '900'] as const).map((s) => (
              <button key={s} className={el.fontStyle === s ? 'on' : ''} onClick={() => up({ fontStyle: s }, 'fst')}>
                {s === 'normal' ? '標準' : s === 'bold' ? '太字' : '極太'}
              </button>
            ))}
          </div>
          <div className="seg">
            {(['left', 'center', 'right'] as const).map((a) => (
              <button key={a} className={el.align === a ? 'on' : ''} onClick={() => up({ align: a }, 'al')}>
                {a === 'left' ? '左' : a === 'center' ? '中央' : '右'}
              </button>
            ))}
          </div>
          <Color label="文字色" value={el.fill} onChange={(v) => up({ fill: v }, 'fill')} />
        </Section>
      )}

      {(el.type === 'rect' || el.type === 'ellipse') && (
        <Section title="図形">
          <Color label="塗り" value={el.fill} onChange={(v) => up({ fill: v }, 'fill')} />
          <Color label="線" value={el.stroke} onChange={(v) => up({ stroke: v }, 'stroke')} />
          <div className="grid2">
            <Num label="線幅" value={el.strokeWidth} min={0} onChange={(v) => up({ strokeWidth: v }, 'sw')} />
            {el.type === 'rect' && <Num label="角丸" value={el.cornerRadius} min={0} onChange={(v) => up({ cornerRadius: v }, 'cr')} />}
          </div>
        </Section>
      )}

      {el.type === 'image' && (
        <Section title="画像">
          <Num label="角丸" value={el.cornerRadius} min={0} onChange={(v) => up({ cornerRadius: v }, 'cr')} />
          <button
            className="btn sm"
            onClick={async () => {
              const [f] = await pickImageFiles(false);
              const r = f && (await importImageFile(f));
              if (r) up({ src: r.src }, 'src');
            }}
          >
            <Icon name="image" /> 画像を差し替え
          </button>
        </Section>
      )}

      {el.type === 'device' && <DeviceProps el={el} up={up} />}
    </>
  );
}

const IPHONE_COLORS: [string, string][] = [
  ['ブラックチタニウム', '#4b4a4c'],
  ['ナチュラルチタニウム', '#bdb7ab'],
  ['ホワイトチタニウム', '#e4e2dd'],
  ['デザートチタニウム', '#c5a487'],
  ['ブルー', '#3d4b63'],
  ['ピンク', '#e8c4c9'],
];

function ScreenDropZone({ el, onSrc }: { el: DeviceEl; onSrc(src: string): void }) {
  const [over, setOver] = useState(false);
  return (
    <div
      className={`drop-zone ${over ? 'over' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={async (e) => {
        e.preventDefault();
        setOver(false);
        const f = Array.from(e.dataTransfer.files).find((x) => x.type.startsWith('image/'));
        const r = f && (await importImageFile(f));
        if (r) onSrc(r.src);
      }}
    >
      {el.screenSrc && <img src={el.screenSrc} alt="" />}
      画面画像をここにドラッグ＆ドロップ
    </div>
  );
}

function DeviceProps({ el, up }: { el: DeviceEl; up(p: Partial<DeviceEl>, k: string): void }) {
  return (
    <Section title="端末モックアップ">
      <label className="field">
        <span>端末</span>
        <select value={el.model} onChange={(e) => up({ model: e.target.value as DeviceModel }, 'model')}>
          {(Object.keys(DEVICE_LABEL) as DeviceModel[]).map((m) => (
            <option key={m} value={m}>
              {DEVICE_LABEL[m]}
            </option>
          ))}
        </select>
      </label>
      {el.model === 'iphone' && (
        <div className="swatches">
          {IPHONE_COLORS.map(([name, c]) => (
            <button key={c} className={`swatch ${el.frameColor === c ? 'on' : ''}`} style={{ background: c }} title={name} onClick={() => up({ frameColor: c }, 'fc')} />
          ))}
        </div>
      )}
      <Color label="フレーム色" value={el.frameColor} onChange={(v) => up({ frameColor: v }, 'fc')} />
      <ScreenDropZone el={el} onSrc={(src) => up({ screenSrc: src, screenScale: 1, screenOffsetX: 0, screenOffsetY: 0 }, 'screen')} />
      <label className="check">
        <input type="checkbox" checked={!!el.glare} onChange={(e) => up({ glare: e.target.checked }, 'glare')} /> 画面の映り込み
      </label>
      <Range label="影" value={el.shadow} min={0} max={el.width * 0.25} step={1} onChange={(v) => up({ shadow: v }, 'shadow')} />
      <div className="row gap8">
        <button
          className="btn sm"
          onClick={async () => {
            const [f] = await pickImageFiles(false);
            const r = f && (await importImageFile(f));
            if (r) up({ screenSrc: r.src, screenScale: 1, screenOffsetX: 0, screenOffsetY: 0 }, 'screen');
          }}
        >
          <Icon name="image" /> {el.screenSrc ? '画面を差し替え' : '画面画像を選択'}
        </button>
        {el.screenSrc && (
          <button className="btn sm ghost" onClick={() => up({ screenSrc: null }, 'screen')}>
            外す
          </button>
        )}
      </div>
      {el.screenSrc && (
        <>
          <Range label="画面の拡大率" value={el.screenScale} min={1} max={3} step={0.01} onChange={(v) => up({ screenScale: v }, 'ss')} />
          <Range label="画面の位置 X" value={el.screenOffsetX} min={-1} max={1} step={0.005} onChange={(v) => up({ screenOffsetX: v }, 'sx')} />
          <Range label="画面の位置 Y" value={el.screenOffsetY} min={-1} max={1} step={0.005} onChange={(v) => up({ screenOffsetY: v }, 'sy')} />
        </>
      )}
      <p className="note">画像ファイルや、キャンバス上の画像を端末の上にドラッグ＆ドロップすると画面にはめ込めます。</p>
    </Section>
  );
}

export function PropertiesPanel() {
  const board = useStore(currentBoard);
  const selected = useStore((s) => s.selected);
  const st = useStore.getState();
  const tool = useStore((x) => x.tool);
  if (tool === 'frame') return <FramePresetsPanel />;
  if (!board) return <aside className="right" />;
  const els = board.elements.filter((e) => selected.includes(e.id));
  const grouped = els.length > 1 && els.every((e) => e.groupId && e.groupId === els[0].groupId);
  return (
    <aside className="right panel">
      {els.length === 0 && <BoardProps board={board} />}
      {els.length > 0 && (
        <>
          <div className="prop-section">
            <h4>
              {els.length === 1 ? els[0].name : grouped ? `グループ（${els.length}）` : `${els.length}個を選択中`}
            </h4>
            <AlignBar count={els.length} />
            <div className="row gap4 wrap">
              <button className="btn xs" title="最前面へ (⌘⇧])" onClick={() => st.reorder('front')}>
                最前面
              </button>
              <button className="btn xs" title="前面へ (⌘])" onClick={() => st.reorder('forward')}>
                前面
              </button>
              <button className="btn xs" title="背面へ (⌘[)" onClick={() => st.reorder('backward')}>
                背面
              </button>
              <button className="btn xs" title="最背面へ (⌘⇧[)" onClick={() => st.reorder('back')}>
                最背面
              </button>
            </div>
            <div className="row gap4 wrap">
              {els.length > 1 && !grouped && (
                <button className="btn xs" onClick={() => st.group()} title="グループ化 (⌘G)">
                  グループ化
                </button>
              )}
              {els.some((e) => e.groupId) && (
                <button className="btn xs" onClick={() => st.ungroup()} title="グループ解除 (⌘⇧G)">
                  グループ解除
                </button>
              )}
              <button className="btn xs" onClick={() => st.duplicateSelected()} title="複製 (⌘D)">
                複製
              </button>
              <button className="btn xs danger" onClick={() => st.deleteSelected()} title="削除 (Delete)">
                削除
              </button>
            </div>
          </div>
          {els.length === 1 && <ElementProps key={els[0].id} el={els[0]} />}
        </>
      )}
    </aside>
  );
}
