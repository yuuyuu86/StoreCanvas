import { useEffect, useMemo, useState } from 'react';
import { currentProject, useStore } from '../store';
import { presetById, STORE_LABEL } from '../presets';
import type { StoreId } from '../types';
import { renderBoardPages } from '../lib/export';
import { Icon } from './Icon';

interface Shot {
  key: string;
  url: string;
  w: number;
  h: number;
  linked: boolean;
  boardName: string;
}

export function PreviewView() {
  const project = useStore(currentProject)!;
  const st = useStore.getState();
  const [renders, setRenders] = useState<Record<string, string[]>>({});
  const [gap, setGap] = useState(true);

  const stores = useMemo(() => {
    const s = new Set<StoreId>();
    project.boards.forEach((b) => s.add(presetById(b.presetId)?.store ?? 'other'));
    return [...s];
  }, [project]);
  const [store, setStore] = useState<StoreId>(stores[0] ?? 'appstore');
  const devices = useMemo(
    () => [...new Set(project.boards.filter((b) => (presetById(b.presetId)?.store ?? 'other') === store).map((b) => presetById(b.presetId)?.device ?? 'カスタム'))],
    [project, store],
  );
  const [device, setDevice] = useState<string>('');
  const effDevice = devices.includes(device) ? device : devices[0];

  useEffect(() => {
    let alive = true;
    (async () => {
      for (const b of project.boards) {
        const urls = await renderBoardPages(b, { pixelRatio: Math.min(1, 900 / b.pageHeight) });
        if (!alive) return;
        setRenders((r) => ({ ...r, [b.id]: urls }));
      }
    })();
    return () => {
      alive = false;
    };
  }, [project]);

  const boards = project.boards.filter(
    (b) => (presetById(b.presetId)?.store ?? 'other') === store && (presetById(b.presetId)?.device ?? 'カスタム') === effDevice,
  );
  const shots: Shot[] = boards.flatMap((b) =>
    (renders[b.id] ?? []).map((url, i) => ({ key: `${b.id}:${i}`, url, w: b.pageWidth, h: b.pageHeight, linked: b.pageNames.length > 1, boardName: b.name })),
  );
  const landscape = shots[0] && shots[0].w > shots[0].h;
  const H = landscape ? 260 : 460;
  const gapPx = store === 'appstore' ? 10 : 8;
  const loading = boards.some((b) => !renders[b.id]);

  return (
    <div className="preview">
      <header className="topbar">
        <button className="btn ghost" onClick={() => st.setView('editor')}>
          <Icon name="back" /> 編集画面へ戻る
        </button>
        <div className="title">
          <b>{project.name}</b>
          <span className="muted">ストア掲載プレビュー</span>
        </div>
        <div className="spacer" />
        <button className="btn primary" onClick={() => st.setDialog('export')}>
          <Icon name="download" /> 書き出し
        </button>
      </header>
      <div className="preview-controls">
        <div className="seg">
          {stores.map((s) => (
            <button key={s} className={store === s ? 'on' : ''} onClick={() => setStore(s)}>
              {STORE_LABEL[s]}
            </button>
          ))}
        </div>
        <select value={effDevice} onChange={(e) => setDevice(e.target.value)}>
          {devices.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
        <label className="check">
          <input type="checkbox" checked={gap} onChange={(e) => setGap(e.target.checked)} /> ストア上の画像間の余白を表示
        </label>
      </div>
      <div className="preview-stage">
        <div className={`store-sheet ${store}`}>
          <div className="store-app-head">
            <div className="store-icon" />
            <div>
              <b>{project.name}</b>
              <small>{STORE_LABEL[store]} 掲載イメージ</small>
            </div>
            <span className="store-get">{store === 'googleplay' ? 'インストール' : '入手'}</span>
          </div>
          <div className="shot-row" style={{ gap: gap ? gapPx : 0 }}>
            {shots.map((s) => (
              <img
                key={s.key}
                src={s.url}
                alt={s.boardName}
                style={{ height: H, width: (H * s.w) / s.h, borderRadius: gap ? (store === 'appstore' ? 14 : 8) : 0 }}
              />
            ))}
            {!shots.length && <p className="hint">{loading ? '描画中…' : 'この掲載先の画像はありません'}</p>}
          </div>
        </div>
        <p className="note muted center">
          プレビューは掲載イメージの確認用です。実際のストア画面では、画像間の余白や角丸、表示枚数が異なる場合があります。
          連結スクリーンショットは正確に分割されても、余白のため完全につながって見えない場合があります。
        </p>
      </div>
    </div>
  );
}
