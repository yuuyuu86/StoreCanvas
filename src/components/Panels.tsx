import { useState } from 'react';
import { currentBoard, currentProject, useStore } from '../store';
import { BoardThumb } from './BoardNodes';
import { presetById } from '../presets';
import { makeBoard } from '../lib/factory';
import { Icon } from './Icon';

function InlineName({ value, onSave, className }: { value: string; onSave(v: string): void; className?: string }) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(value);
  if (editing)
    return (
      <input
        className={`inline-input ${className ?? ''}`}
        autoFocus
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => {
          setEditing(false);
          if (v.trim() && v !== value) onSave(v.trim());
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          if (e.key === 'Escape') {
            setV(value);
            setEditing(false);
          }
        }}
        onClick={(e) => e.stopPropagation()}
      />
    );
  return (
    <span
      className={className}
      title="ダブルクリックで名前を変更"
      onDoubleClick={(e) => {
        e.stopPropagation();
        setV(value);
        setEditing(true);
      }}
    >
      {value}
    </span>
  );
}

export function PagesPanel() {
  const project = useStore(currentProject);
  const boardId = useStore((s) => s.boardId);
  const selectedBoards = useStore((s) => s.selectedBoards);
  const st = useStore.getState();
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dropAt, setDropAt] = useState<number | null>(null);
  if (!project) return null;
  const boards = project.boards;
  const cur = boards.find((b) => b.id === boardId);
  const sel = boards.filter((b) => selectedBoards.includes(b.id));
  const canLink = sel.length >= 2 && sel.every((b) => b.pageWidth === sel[0].pageWidth && b.pageHeight === sel[0].pageHeight);

  const addSameSize = () => {
    if (!cur) return st.setDialog('newCanvas');
    st.addBoards([
      makeBoard({
        pageWidth: cur.pageWidth,
        pageHeight: cur.pageHeight,
        presetId: cur.presetId,
        exportFormat: cur.exportFormat,
        background: { ...cur.background },
        name: `ページ ${boards.length + 1}`,
      }),
    ]);
  };

  return (
    <section className="panel pages-panel">
      <header className="panel-head">
        <span>ページ</span>
        <div className="row gap4">
          <button className="icon-btn" title="同じサイズのページを追加" onClick={addSameSize}>
            <Icon name="plus" />
          </button>
          <button className="icon-btn" title="フレームを一列に整列" onClick={() => st.arrangeBoards()}>
            <Icon name="grid" />
          </button>
          <button className="icon-btn" title="サイズを選んでページを追加" onClick={() => st.setDialog('newCanvas')}>
            <Icon name="resize" />
          </button>
        </div>
      </header>
      <div className="page-list">
        {boards.map((b, i) => {
          const preset = presetById(b.presetId);
          const active = b.id === boardId;
          const isSel = selectedBoards.includes(b.id);
          return (
            <div
              key={b.id}
              className={`page-item ${active ? 'active' : ''} ${isSel ? 'selected' : ''} ${dropAt === i ? 'drop-before' : ''}`}
              draggable
              onDragStart={() => setDragFrom(i)}
              onDragOver={(e) => {
                e.preventDefault();
                setDropAt(i);
              }}
              onDragLeave={() => setDropAt(null)}
              onDrop={() => {
                if (dragFrom !== null && dragFrom !== i) st.moveBoard(dragFrom, i);
                setDragFrom(null);
                setDropAt(null);
              }}
              onClick={(e) => (e.shiftKey ? st.selectBoard(b.id, 'range') : e.metaKey || e.ctrlKey ? st.selectBoard(b.id, 'toggle') : st.focusBoard(b.id))}
            >
              <div className="page-thumb" style={{ aspectRatio: `${b.pageWidth * b.pageNames.length} / ${b.pageHeight}` }}>
                <BoardThumb board={b} maxW={b.pageNames.length > 1 ? 196 : 92} maxH={110} />
                {b.pageNames.length > 1 && (
                  <div className="split-marks">
                    {b.pageNames.slice(1).map((_, k) => (
                      <i key={k} style={{ left: `${((k + 1) / b.pageNames.length) * 100}%` }} />
                    ))}
                  </div>
                )}
              </div>
              <div className="page-meta">
                <span className="idx">{i + 1}</span>
                <InlineName value={b.name} onSave={(v) => st.renameBoard(b.id, v)} className="page-name" />
                {b.pageNames.length > 1 && <span className="badge accent">連結 ×{b.pageNames.length}</span>}
              </div>
              <div className="page-sub">
                {preset?.device ?? 'カスタム'} · {b.pageWidth}×{b.pageHeight}
              </div>
            </div>
          );
        })}
      </div>
      <footer className="panel-foot">
        <button className="btn sm" disabled={!cur} onClick={() => cur && st.duplicateBoard(cur.id)} title="複製">
          <Icon name="copy" /> 複製
        </button>
        <button
          className="btn sm"
          disabled={!sel.length}
          onClick={() => confirm(`${sel.length}ページを削除しますか？`) && st.deleteBoards(sel.map((b) => b.id))}
          title="削除"
        >
          <Icon name="trash" /> 削除
        </button>
        {cur && cur.pageNames.length > 1 ? (
          <button className="btn sm" onClick={() => st.unlinkBoard(cur.id)} title="連結グループを解除して個別ページに戻す">
            <Icon name="unlink" /> 連結解除
          </button>
        ) : (
          <button
            className="btn sm primary"
            disabled={!canLink}
            onClick={() => st.linkBoards(sel.map((b) => b.id))}
            title="⌘/Shift+クリックで同じサイズのページを複数選択して連結"
          >
            <Icon name="link" /> 連結
          </button>
        )}
      </footer>
      {sel.length < 2 && (!cur || cur.pageNames.length < 2) && (
        <p className="hint">⌘ / Shift + クリックで複数ページを選ぶと連結できます</p>
      )}
    </section>
  );
}

export function LayersPanel() {
  const board = useStore(currentBoard);
  const selected = useStore((s) => s.selected);
  const st = useStore.getState();
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  if (!board) return null;
  const els = board.elements;
  const typeIcon = { text: 'text', image: 'image', rect: 'rect', ellipse: 'ellipse', device: 'phone' } as const;
  return (
    <section className="panel layers-panel">
      <header className="panel-head">
        <span>レイヤー</span>
        <span className="muted">{els.length}</span>
      </header>
      <div className="layer-list">
        {els.length === 0 && <p className="hint">要素はまだありません。上部のツールから追加できます。</p>}
        {[...els].reverse().map((el, ri) => {
          const i = els.length - 1 - ri;
          return (
            <div
              key={el.id}
              className={`layer-item ${selected.includes(el.id) ? 'selected' : ''} ${el.visible ? '' : 'hidden'}`}
              draggable
              onDragStart={() => setDragFrom(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragFrom !== null && dragFrom !== i) st.moveElement(dragFrom, i);
                setDragFrom(null);
              }}
              onClick={(e) => {
                if (e.shiftKey || e.metaKey) {
                  st.setSelected(selected.includes(el.id) ? selected.filter((x) => x !== el.id) : [...selected, el.id]);
                } else st.setSelected([el.id]);
              }}
            >
              {el.groupId && <span className="group-bar" style={{ background: `hsl(${hash(el.groupId) % 360} 45% 55%)` }} />}
              <Icon name={typeIcon[el.type]} />
              <InlineName value={el.name} onSave={(v) => st.updateElements([el.id], { name: v })} className="layer-name" />
              <button
                className={`icon-btn xs ${el.locked ? 'on' : 'ghost'}`}
                title={el.locked ? 'ロック解除' : 'ロック'}
                onClick={(e) => {
                  e.stopPropagation();
                  st.updateElements([el.id], { locked: !el.locked });
                }}
              >
                <Icon name={el.locked ? 'lock' : 'unlock'} />
              </button>
              <button
                className={`icon-btn xs ${el.visible ? 'ghost' : 'on'}`}
                title={el.visible ? '非表示' : '表示'}
                onClick={(e) => {
                  e.stopPropagation();
                  st.updateElements([el.id], { visible: !el.visible });
                }}
              >
                <Icon name={el.visible ? 'eye' : 'eyeOff'} />
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function hash(s: string) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0;
  return Math.abs(h);
}

