import { useMemo, useState } from 'react';
import { currentBoard, currentProject, useStore } from '../store';
import { GENRES, MOODS, TEMPLATES } from '../templates';
import { makeBoard } from '../lib/factory';
import { BoardThumb } from './BoardNodes';
import { Icon } from './Icon';
import type { Board, ImageFormat } from '../types';
import { presetById } from '../presets';
import { overflowingElements } from '../lib/geometry';
import { exportZip } from '../lib/export';

export function TemplatesDialog() {
  const st = useStore.getState();
  const cur = useStore(currentBoard);
  const [genre, setGenre] = useState<string>('すべて');
  const [mood, setMood] = useState<string>('すべて');
  const [kind, setKind] = useState<string>('すべて');
  const pw = cur?.pageWidth ?? 1320;
  const ph = cur?.pageHeight ?? 2868;
  const list = TEMPLATES.filter(
    (t) => (genre === 'すべて' || t.genre === genre) && (mood === 'すべて' || t.mood === mood) && (kind === 'すべて' || (kind === '連結' ? t.kind === 'linked' : t.kind === 'single')),
  );
  const previews = useMemo(
    () => Object.fromEntries(TEMPLATES.map((t) => [t.id, makeBoard({ pageWidth: pw, pageHeight: ph, ...t.build(pw, ph) })])) as Record<string, Board>,
    [pw, ph],
  );
  const apply = (id: string) => {
    const t = TEMPLATES.find((x) => x.id === id)!;
    const built = t.build(pw, ph);
    st.addBoards([
      makeBoard({
        pageWidth: pw,
        pageHeight: ph,
        presetId: cur?.presetId ?? 'as-iphone-69',
        exportFormat: cur?.exportFormat ?? 'png',
        name: t.name.replace(/（.*）/, ''),
        ...built,
      }),
    ]);
    st.setDialog(null);
    st.requestFit();
  };
  const Filter = ({ label, value, set, options }: { label: string; value: string; set(v: string): void; options: readonly string[] }) => (
    <div className="filter-row">
      <span>{label}</span>
      <div className="chips">
        {['すべて', ...options].map((o) => (
          <button key={o} className={`chip sm ${value === o ? 'on' : ''}`} onClick={() => set(o)}>
            {o}
          </button>
        ))}
      </div>
    </div>
  );
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && st.setDialog(null)}>
      <div className="modal templates">
        <header className="modal-head">
          <h2>テンプレート</h2>
          <span className="muted">
            {pw}×{ph}px のページとして追加します
          </span>
          <button className="icon-btn" onClick={() => st.setDialog(null)}>
            <Icon name="close" />
          </button>
        </header>
        <div className="filters">
          <Filter label="ジャンル" value={genre} set={setGenre} options={GENRES} />
          <Filter label="雰囲気" value={mood} set={setMood} options={MOODS} />
          <Filter label="種類" value={kind} set={setKind} options={['単体', '連結']} />
        </div>
        <div className="template-grid">
          {list.map((t) => (
            <button key={t.id} className={`template-card ${t.kind}`} onClick={() => apply(t.id)}>
              <div className="template-thumb">
                <BoardThumb board={previews[t.id]} maxW={t.kind === 'linked' ? 420 : 140} maxH={240} />
              </div>
              <div className="template-meta">
                <b>{t.name}</b>
                <small>
                  {t.genre} · {t.mood}
                  {t.kind === 'linked' ? ' · 連結' : ''}
                </small>
              </div>
            </button>
          ))}
          {!list.length && <p className="hint">条件に合うテンプレートがありません</p>}
        </div>
      </div>
    </div>
  );
}

interface Check {
  level: 'ok' | 'warn' | 'info';
  text: string;
}

function checksFor(board: Board, fmt: ImageFormat): Check[] {
  const preset = presetById(board.presetId);
  const out: Check[] = [];
  if (preset) {
    const ok = preset.width === board.pageWidth && preset.height === board.pageHeight;
    out.push({ level: ok ? 'ok' : 'warn', text: `画像サイズ ${board.pageWidth}×${board.pageHeight}px${ok ? `（${preset.device}）` : `：プリセット ${preset.width}×${preset.height} と不一致`}` });
    out.push({
      level: preset.formats.includes(fmt) ? 'ok' : 'warn',
      text: `画像形式 ${fmt.toUpperCase()}${preset.formats.includes(fmt) ? '' : `：このプリセットの対応形式は ${preset.formats.map((f) => f.toUpperCase()).join(' / ')}`}`,
    });
  } else {
    out.push({ level: 'info', text: `カスタムサイズ ${board.pageWidth}×${board.pageHeight}px / ${fmt.toUpperCase()}` });
  }
  if (board.pageNames.length > 1) out.push({ level: 'info', text: `連結グループ：${board.pageNames.length}枚に分割して書き出します` });
  const over = overflowingElements(board);
  if (over.length)
    out.push({
      level: 'warn',
      text: `キャンバス外へのはみ出し：${over
        .slice(0, 3)
        .map((e) => `「${e.name}」`)
        .join('')}${over.length > 3 ? ` ほか${over.length - 3}件` : ''}`,
    });
  else out.push({ level: 'ok', text: 'キャンバス外へのはみ出しなし' });
  if (!board.elements.some((e) => e.visible)) out.push({ level: 'warn', text: '要素が配置されていません' });
  if (fmt === 'png' && board.background.color.length > 7) out.push({ level: 'info', text: '背景に透明度が含まれています' });
  return out;
}

export function ExportDialog() {
  const st = useStore.getState();
  const project = useStore(currentProject)!;
  const [sel, setSel] = useState<Set<string>>(() => new Set(project.boards.flatMap((b) => b.pageNames.map((_, i) => `${b.id}:${i}`))));
  const [fmt, setFmt] = useState<'auto' | ImageFormat>('auto');
  const [busy, setBusy] = useState<null | { done: number; total: number }>(null);
  const [error, setError] = useState<string | null>(null);
  const toggle = (k: string) => setSel((s) => {
    const n = new Set(s);
    if (n.has(k)) n.delete(k);
    else n.add(k);
    return n;
  });
  const items = project.boards.map((b) => ({ board: b, pages: b.pageNames.map((_, i) => i).filter((i) => sel.has(`${b.id}:${i}`)) })).filter((i) => i.pages.length);
  const total = items.reduce((n, i) => n + i.pages.length, 0);
  const run = async () => {
    setBusy({ done: 0, total });
    setError(null);
    try {
      await exportZip(project.name, items, fmt === 'auto' ? null : fmt, (done, t) => setBusy({ done, total: t }));
      setBusy(null);
    } catch (e) {
      setBusy(null);
      setError(String(e));
    }
  };
  let order = 0;
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && !busy && st.setDialog(null)}>
      <div className="modal export">
        <header className="modal-head">
          <h2>書き出し</h2>
          <button className="icon-btn" onClick={() => st.setDialog(null)} disabled={!!busy}>
            <Icon name="close" />
          </button>
        </header>
        <div className="export-body">
          <div className="export-list">
            {project.boards.map((b) => {
              const f = fmt === 'auto' ? b.exportFormat : fmt;
              const checks = checksFor(b, f);
              return (
                <div key={b.id} className="export-board">
                  <div className="export-board-head">
                    <b>{b.name}</b>
                    <span className="muted">
                      {presetById(b.presetId)?.device ?? 'カスタム'} · {f.toUpperCase()}
                    </span>
                  </div>
                  <div className="export-pages">
                    {b.pageNames.map((_, i) => {
                      const k = `${b.id}:${i}`;
                      const on = sel.has(k);
                      if (on) order += 1;
                      return (
                        <label key={k} className={`export-page ${on ? 'on' : ''}`}>
                          <input type="checkbox" checked={on} onChange={() => toggle(k)} />
                          <BoardThumb board={b} page={i} maxW={70} maxH={120} />
                          <small>{on ? String(order).padStart(2, '0') : '—'}</small>
                        </label>
                      );
                    })}
                  </div>
                  <ul className="checks">
                    {checks.map((c, i) => (
                      <li key={i} className={c.level}>
                        <Icon name={c.level === 'ok' ? 'check' : c.level === 'warn' ? 'warn' : 'info'} size={14} /> {c.text}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
          <aside className="export-side">
            <label className="field">
              <span>形式</span>
              <select value={fmt} onChange={(e) => setFmt(e.target.value as 'auto' | ImageFormat)}>
                <option value="auto">各ページの設定に従う</option>
                <option value="png">すべて PNG</option>
                <option value="jpeg">すべて JPEG</option>
              </select>
            </label>
            <div className="row gap4">
              <button className="btn xs" onClick={() => setSel(new Set(project.boards.flatMap((b) => b.pageNames.map((_, i) => `${b.id}:${i}`))))}>
                すべて選択
              </button>
              <button className="btn xs" onClick={() => setSel(new Set())}>
                選択解除
              </button>
            </div>
            <p className="note">
              {total}枚の画像を ZIP で書き出します。ファイル名は「01_ページ名.png」のように掲載順の番号が付きます。
            </p>
            <p className="note muted">チェックは制作ミスを減らすためのもので、ストア審査の通過を保証するものではありません。</p>
            {error && <p className="note error">{error}</p>}
            <button className="btn primary block" disabled={!total || !!busy} onClick={run}>
              <Icon name="download" /> {busy ? `書き出し中… ${busy.done}/${busy.total}` : 'ZIPで書き出す'}
            </button>
          </aside>
        </div>
      </div>
    </div>
  );
}
