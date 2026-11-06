import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { currentProject, useStore } from '../store';
import { presetById, STORE_LABEL } from '../presets';
import type { Board, StoreId } from '../types';
import { renderBoardPages } from '../lib/export';
import { Icon } from './Icon';

type FormFactor = 'phone' | 'tablet';

interface Shot {
  key: string;
  url: string;
  w: number;
  h: number;
}

interface Meta {
  subtitle: string;
  developer: string;
  category: string;
  description: string;
}

const defaultMeta = (name: string): Meta => ({
  subtitle: 'アプリの魅力をひとことで',
  developer: `${name} Inc.`,
  category: '天気',
  description: `${name} は、毎日をもっと便利にするアプリです。\nここにアプリの説明文が入ります。ストアでの見え方を確認するためのサンプルテキストです。`,
});

function useMeta(projectId: string, name: string) {
  const key = `storecanvas:preview-meta:${projectId}`;
  const [meta, setMeta] = useState<Meta>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) return { ...defaultMeta(name), ...(JSON.parse(raw) as Partial<Meta>) };
    } catch {
      /* 読み込めない場合は既定値 */
    }
    return defaultMeta(name);
  });
  const update = (p: Partial<Meta>) =>
    setMeta((m) => {
      const n = { ...m, ...p };
      try {
        localStorage.setItem(key, JSON.stringify(n));
      } catch {
        /* 保存できなくても表示は続ける */
      }
      return n;
    });
  return [meta, update] as const;
}

const formFactorOf = (b: Board): FormFactor | null => {
  const p = presetById(b.presetId);
  if (!p || p.asset !== 'screenshot') return null;
  return p.mockup === 'ipad' || p.mockup === 'tablet' ? 'tablet' : 'phone';
};

export function PreviewView() {
  const project = useStore(currentProject)!;
  const st = useStore.getState();
  const [renders, setRenders] = useState<Record<string, string[]>>({});
  const [meta, setMeta] = useMeta(project.id, project.name);
  const [gapless, setGapless] = useState(false);
  const [showFeature, setShowFeature] = useState(true);

  const stores = useMemo(() => {
    const s = new Set<StoreId>(['appstore', 'googleplay']);
    if (project.boards.some((b) => !presetById(b.presetId) || presetById(b.presetId)?.store === 'other')) s.add('other');
    return [...s];
  }, [project]);
  const [store, setStore] = useState<StoreId>(() =>
    project.boards.some((b) => presetById(b.presetId)?.store === 'appstore') || !project.boards.some((b) => presetById(b.presetId)?.store === 'googleplay') ? 'appstore' : 'googleplay',
  );
  const [ff, setFf] = useState<FormFactor>('phone');

  useEffect(() => {
    let alive = true;
    (async () => {
      for (const b of project.boards) {
        const urls = await renderBoardPages(b, { pixelRatio: Math.min(1, 1100 / Math.max(b.pageHeight, b.pageWidth)) });
        if (!alive) return;
        setRenders((r) => ({ ...r, [b.id]: urls }));
      }
    })();
    return () => {
      alive = false;
    };
  }, [project]);

  const inStore = (b: Board) => presetById(b.presetId)?.store === store;
  const shotsFor = (f: FormFactor): Shot[] =>
    project.boards
      .filter((b) => inStore(b) && formFactorOf(b) === f)
      .flatMap((b) => (renders[b.id] ?? []).map((url, i) => ({ key: `${b.id}:${i}`, url, w: b.pageWidth, h: b.pageHeight })));
  const firstUrl = (pred: (b: Board) => boolean) => {
    const b = project.boards.find(pred);
    return b ? renders[b.id]?.[0] : undefined;
  };
  const icon =
    firstUrl((b) => inStore(b) && presetById(b.presetId)?.asset === 'icon') ?? firstUrl((b) => presetById(b.presetId)?.asset === 'icon');
  const feature = firstUrl((b) => b.presetId === 'gp-feature');
  const shots = shotsFor(ff);
  const hasTablet = shotsFor('tablet').length > 0;
  const loading = project.boards.some((b) => !renders[b.id]);

  return (
    <div className="preview">
      <header className="topbar">
        <button className="btn ghost" onClick={() => st.setView('editor')}>
          <Icon name="back" /> 編集画面へ戻る
        </button>
        <div className="title">
          <b>{project.name}</b>
          <span className="muted">ストア掲載プレビュー{loading ? '（描画中…）' : ''}</span>
        </div>
        <div className="spacer" />
        <button className="btn primary" onClick={() => st.setDialog('export')}>
          <Icon name="download" /> 書き出し
        </button>
      </header>
      <div className="preview-body">
        <aside className="preview-side">
          <div className="seg">
            {stores.map((s) => (
              <button key={s} className={store === s ? 'on' : ''} onClick={() => setStore(s)}>
                {STORE_LABEL[s]}
              </button>
            ))}
          </div>
          {store !== 'other' && (
            <div className="seg">
              <button className={ff === 'phone' ? 'on' : ''} onClick={() => setFf('phone')}>
                {store === 'appstore' ? 'iPhone' : 'スマホ'}
              </button>
              <button className={ff === 'tablet' ? 'on' : ''} onClick={() => setFf('tablet')} disabled={!hasTablet}>
                {store === 'appstore' ? 'iPad' : 'タブレット'}
              </button>
            </div>
          )}
          <label className="check">
            <input type="checkbox" checked={gapless} onChange={(e) => setGapless(e.target.checked)} /> 画像間の余白をなくす（連結の確認用）
          </label>
          {store === 'googleplay' && (
            <label className="check">
              <input type="checkbox" checked={showFeature} onChange={(e) => setShowFeature(e.target.checked)} /> フィーチャーグラフィックを表示
            </label>
          )}
          <h4>表示するテキスト</h4>
          <label className="field stacked">
            <span>サブタイトル</span>
            <input value={meta.subtitle} maxLength={30} onChange={(e) => setMeta({ subtitle: e.target.value })} />
          </label>
          <label className="field stacked">
            <span>デベロッパ名</span>
            <input value={meta.developer} maxLength={60} onChange={(e) => setMeta({ developer: e.target.value })} />
          </label>
          <label className="field stacked">
            <span>カテゴリ</span>
            <input value={meta.category} maxLength={20} onChange={(e) => setMeta({ category: e.target.value })} />
          </label>
          <label className="field stacked">
            <span>説明文</span>
            <textarea className="text-input" rows={4} value={meta.description} maxLength={4000} onChange={(e) => setMeta({ description: e.target.value })} />
          </label>
          <p className="note muted">
            評価やダウンロード数はサンプル表示です。実際のストアでは、画像間の余白・角丸・表示枚数が異なる場合があります。
          </p>
        </aside>
        <main className="preview-stage">
          {store === 'appstore' && (
            <DeviceFrame kind={ff} os="ios">
              <AppStorePage name={project.name} meta={meta} icon={icon} shots={shots} ff={ff} gapless={gapless} />
            </DeviceFrame>
          )}
          {store === 'googleplay' && (
            <DeviceFrame kind={ff} os="android">
              <PlayStorePage name={project.name} meta={meta} icon={icon} feature={showFeature ? feature : undefined} shots={shots} ff={ff} gapless={gapless} />
            </DeviceFrame>
          )}
          {store === 'other' && <OtherGallery boards={project.boards.filter((b) => !presetById(b.presetId) || presetById(b.presetId)?.store === 'other')} renders={renders} />}
        </main>
      </div>
    </div>
  );
}

function DeviceFrame({ kind, os, children }: { kind: FormFactor; os: 'ios' | 'android'; children: ReactNode }) {
  // 表示領域の高さに収まるよう端末全体を縮小
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const el = ref.current;
    const parent = el?.parentElement;
    if (!el || !parent) return;
    const fit = () => {
      // 端末の本来の大きさ（CSS の画面サイズ + 枠）
      const w = kind === 'phone' ? 414 : 796;
      const h = kind === 'phone' ? 868 : 1056;
      setScale(Math.min(1, (parent.clientHeight - 48) / h, (parent.clientWidth - 48) / w));
    };
    const ro = new ResizeObserver(fit);
    ro.observe(parent);
    fit();
    return () => ro.disconnect();
  }, [kind]);
  return (
    <div ref={ref} className={`pv-device ${kind} ${os}`} style={{ zoom: scale }}>
      <div className="pv-screen">
        <div className="pv-status">
          <b>9:41</b>
          {os === 'ios' && kind === 'phone' && <span className="pv-island" />}
          <span className="pv-status-icons">
            <i />
            <i />
            <i className="bat" />
          </span>
        </div>
        <div className="pv-scroll">{children}</div>
      </div>
    </div>
  );
}

const Stars = ({ n = 5 }: { n?: number }) => <span className="pv-stars">{'★★★★★'.slice(0, n)}</span>;

function ShotRow({ shots, ff, os, gapless }: { shots: Shot[]; ff: FormFactor; os: 'ios' | 'android'; gapless: boolean }) {
  // 実際のストアでのおおよその表示幅（画面幅に対する割合）
  const frameW = ff === 'phone' ? 390 : 760;
  const ratio = (s: Shot) => {
    const portrait = s.h >= s.w;
    if (os === 'ios') return ff === 'phone' ? (portrait ? 0.56 : 0.9) : portrait ? 0.4 : 0.75;
    return ff === 'phone' ? (portrait ? 0.38 : 0.78) : portrait ? 0.26 : 0.55;
  };
  if (!shots.length) return <div className="pv-empty">この掲載先・端末用のスクリーンショットはまだありません</div>;
  return (
    <div className={`pv-shots ${os} ${gapless ? 'gapless' : ''}`}>
      {shots.map((s) => {
        const w = frameW * ratio(s);
        return <img key={s.key} src={s.url} alt="" style={{ width: w, height: (w * s.h) / s.w }} draggable={false} />;
      })}
    </div>
  );
}

function AppStorePage({ name, meta, icon, shots, ff, gapless }: { name: string; meta: Meta; icon?: string; shots: Shot[]; ff: FormFactor; gapless: boolean }) {
  return (
    <div className="as-page">
      <div className="as-nav">
        <span className="as-back">‹ 検索</span>
      </div>
      <div className="as-head">
        {icon ? <img className="as-icon" src={icon} alt="" /> : <div className="as-icon placeholder" />}
        <div className="as-head-main">
          <h1>{name}</h1>
          <p>{meta.subtitle}</p>
          <div className="as-actions">
            <span className="as-get">入手</span>
            <small>App内課金</small>
            <span className="as-share">⇪</span>
          </div>
        </div>
      </div>
      <div className="as-info">
        <div>
          <small>2.4万件の評価</small>
          <b>4.8</b>
          <Stars />
        </div>
        <div>
          <small>年齢</small>
          <b>4+</b>
          <small>歳</small>
        </div>
        <div>
          <small>ランキング</small>
          <b>#3</b>
          <small>{meta.category}</small>
        </div>
        <div>
          <small>デベロッパ</small>
          <b className="as-dev-ic">◉</b>
          <small className="ellipsis">{meta.developer}</small>
        </div>
        <div>
          <small>言語</small>
          <b>JA</b>
          <small>+ 他 1 件</small>
        </div>
      </div>
      <ShotRow shots={shots} ff={ff} os="ios" gapless={gapless} />
      <div className="as-compat">{ff === 'phone' ? '📱 iPhone' : '▭ iPad'}</div>
      <div className="as-section as-desc">
        <p>{meta.description}</p>
        <span className="as-link">さらに表示</span>
        <div className="as-devrow">
          <span className="as-link">{meta.developer}</span>
          <small>デベロッパ</small>
        </div>
      </div>
      <div className="as-section">
        <div className="as-sec-head">
          <h2>評価とレビュー</h2>
          <span className="as-link">すべて表示</span>
        </div>
        <div className="as-rating">
          <b>4.8</b>
          <div className="as-bars">
            {[92, 6, 1, 0.5, 0.5].map((v, i) => (
              <div key={i}>
                <small>{'★'.repeat(5 - i)}</small>
                <i>
                  <em style={{ width: `${v}%` }} />
                </i>
              </div>
            ))}
          </div>
        </div>
        <small className="as-muted">5段階評価中</small>
      </div>
      <div className="as-tabbar">
        {['Today', 'ゲーム', 'App', 'Arcade', '検索'].map((t) => (
          <span key={t} className={t === 'App' ? 'on' : ''}>
            <i />
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

function PlayStorePage({
  name,
  meta,
  icon,
  feature,
  shots,
  ff,
  gapless,
}: {
  name: string;
  meta: Meta;
  icon?: string;
  feature?: string;
  shots: Shot[];
  ff: FormFactor;
  gapless: boolean;
}) {
  return (
    <div className="gp-page">
      <div className="gp-bar">
        <span>←</span>
        <span className="gp-bar-right">
          <span>⌕</span>
          <span>⋮</span>
        </span>
      </div>
      {feature && (
        <div className="gp-feature">
          <img src={feature} alt="" />
          <span className="gp-play">▶</span>
        </div>
      )}
      <div className="gp-head">
        {icon ? <img className="gp-icon" src={icon} alt="" /> : <div className="gp-icon placeholder" />}
        <div>
          <h1>{name}</h1>
          <span className="gp-dev">{meta.developer}</span>
          <small>広告を含む・アプリ内購入あり</small>
        </div>
      </div>
      <div className="gp-stats">
        <div>
          <b>4.6 ★</b>
          <small>1.2万件のレビュー</small>
        </div>
        <div>
          <b>100万+</b>
          <small>ダウンロード</small>
        </div>
        <div>
          <b className="gp-iarc">3+</b>
          <small>3 歳以上</small>
        </div>
      </div>
      <div className="gp-install">インストール</div>
      <ShotRow shots={shots} ff={ff} os="android" gapless={gapless} />
      <div className="gp-section">
        <div className="gp-sec-head">
          <h2>このアプリについて</h2>
          <span>→</span>
        </div>
        <p>{meta.description.split('\n')[0]}</p>
        <span className="gp-chip">{meta.category}</span>
      </div>
      <div className="gp-section">
        <div className="gp-sec-head">
          <h2>評価とレビュー</h2>
          <span>→</span>
        </div>
        <div className="gp-rating">
          <b>4.6</b>
          <div className="as-bars gp">
            {[80, 12, 4, 2, 2].map((v, i) => (
              <div key={i}>
                <small>{5 - i}</small>
                <i>
                  <em style={{ width: `${v}%` }} />
                </i>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function OtherGallery({ boards, renders }: { boards: Board[]; renders: Record<string, string[]> }) {
  if (!boards.length) return <div className="pv-empty">その他の画像はありません</div>;
  return (
    <div className="pv-gallery">
      {boards.map((b) => (
        <figure key={b.id}>
          <div className="pv-gallery-row">
            {(renders[b.id] ?? []).map((u, i) => (
              <img key={i} src={u} alt="" style={{ maxHeight: 360 }} />
            ))}
          </div>
          <figcaption>
            {presetById(b.presetId)?.device ?? b.name} · {b.pageWidth}×{b.pageHeight}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
