import { useState } from 'react';
import { useStore } from '../store';
import { BoardThumb } from './BoardNodes';
import { Icon } from './Icon';
import { presetById, STORE_LABEL } from '../presets';
import type { Project, StoreId } from '../types';

function ago(t: number) {
  const s = (Date.now() - t) / 1000;
  if (s < 60) return 'たった今';
  if (s < 3600) return `${Math.floor(s / 60)}分前`;
  if (s < 86400) return `${Math.floor(s / 3600)}時間前`;
  const d = new Date(t);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

function storesOf(p: Project): StoreId[] {
  return [...new Set(p.boards.map((b) => presetById(b.presetId)?.store ?? 'other'))];
}

function ProjectCard({ p }: { p: Project }) {
  const st = useStore.getState();
  const [menu, setMenu] = useState(false);
  const pages = p.boards.reduce((n, b) => n + b.pageNames.length, 0);
  return (
    <div className="project-card" onClick={() => st.openProject(p.id)}>
      <div className="project-thumb">
        {p.boards.length ? (
          <div className="thumb-strip">
            {p.boards.slice(0, 4).map((b) => (
              <BoardThumb key={b.id} board={b} maxW={b.pageNames.length > 1 ? 240 : 70} maxH={130} />
            ))}
          </div>
        ) : (
          <span className="muted">キャンバスなし</span>
        )}
      </div>
      <div className="project-meta">
        <div className="row between center">
          <b className="ellipsis">{p.name}</b>
          <div className="menu-anchor">
            <button
              className="icon-btn"
              onClick={(e) => {
                e.stopPropagation();
                setMenu((v) => !v);
              }}
            >
              <Icon name="more" />
            </button>
            {menu && (
              <div className="menu right" onClick={(e) => e.stopPropagation()} onMouseLeave={() => setMenu(false)}>
                <button
                  onClick={() => {
                    const n = prompt('プロジェクト名', p.name);
                    if (n?.trim()) st.renameProject(p.id, n.trim());
                    setMenu(false);
                  }}
                >
                  名前を変更
                </button>
                <button
                  onClick={() => {
                    st.duplicateProject(p.id);
                    setMenu(false);
                  }}
                >
                  複製
                </button>
                <button
                  className="danger"
                  onClick={() => {
                    if (confirm(`「${p.name}」を削除しますか？この操作は取り消せません。`)) st.deleteProject(p.id);
                    setMenu(false);
                  }}
                >
                  削除
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="row gap4 wrap">
          {storesOf(p).map((s) => (
            <span key={s} className="badge">
              {STORE_LABEL[s]}
            </span>
          ))}
        </div>
        <small className="muted">
          {pages}枚 · 更新 {ago(p.updatedAt)}
        </small>
      </div>
    </div>
  );
}

export function ProjectList() {
  const projects = useStore((s) => s.projects);
  const st = useStore.getState();
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const list = projects
    .filter((p) => p.name.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.updatedAt - a.updatedAt);
  const create = () => {
    const id = st.createProject(name.trim());
    setCreating(false);
    setName('');
    st.openProject(id);
  };
  return (
    <div className="projects">
      <header className="topbar">
        <div className="brand-mark" />
        <b className="brand">StoreCanvas</b>
        <span className="muted">ストア掲載画像を、サイズを調べずに。</span>
        <div className="spacer" />
        <label className="search">
          <Icon name="search" />
          <input placeholder="プロジェクトを検索" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <button className="btn primary" onClick={() => setCreating(true)}>
          <Icon name="plus" /> 新規プロジェクト
        </button>
      </header>
      <main className="projects-main">
        <h1>プロジェクト</h1>
        <div className="project-grid">
          <button className="project-card new" onClick={() => setCreating(true)}>
            <Icon name="plus" size={28} />
            <span>新規プロジェクト</span>
            <small className="muted">アプリごとにストア素材をまとめて管理</small>
          </button>
          {list.map((p) => (
            <ProjectCard key={p.id} p={p} />
          ))}
        </div>
        {q && !list.length && <p className="hint">「{q}」に一致するプロジェクトはありません</p>}
      </main>
      {creating && (
        <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setCreating(false)}>
          <form
            className="modal small"
            onSubmit={(e) => {
              e.preventDefault();
              create();
            }}
          >
            <header className="modal-head">
              <h2>新規プロジェクト</h2>
            </header>
            <label className="field stacked">
              <span>アプリ名・プロジェクト名</span>
              <input autoFocus placeholder="例: MyWeather" value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <div className="row gap8 end">
              <button type="button" className="btn ghost" onClick={() => setCreating(false)}>
                キャンセル
              </button>
              <button type="submit" className="btn primary">
                作成して掲載先を選ぶ
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
