import { createRoot } from 'react-dom/client';
import { Group, Layer, Stage } from 'react-konva';
import type Konva from 'konva';
import JSZip from 'jszip';
import type { Board, ImageFormat } from '../types';
import { BoardNodes } from '../components/BoardNodes';
import { loadImage } from './image';

function collectSrcs(board: Board): string[] {
  const out: string[] = [];
  for (const el of board.elements) {
    if (el.type === 'image' && el.src) out.push(el.src);
    if (el.type === 'device' && el.screenSrc) out.push(el.screenSrc);
  }
  return out;
}

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r(null)));

/**
 * ボードを1ページずつ描画して dataURL を返す。
 * 連結グループはページ幅ごとに切り出す（分割ガイドや選択枠は描画しない）。
 */
export async function renderBoardPages(
  board: Board,
  opts: { pixelRatio?: number; format?: ImageFormat; pages?: number[] } = {},
): Promise<string[]> {
  const { pixelRatio = 1, format = 'png' } = opts;
  const pages = opts.pages ?? board.pageNames.map((_, i) => i);
  await Promise.all(collectSrcs(board).map((s) => loadImage(s).catch(() => undefined)));
  await document.fonts?.ready;

  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-100000px;top:0;pointer-events:none;';
  document.body.appendChild(host);
  const root = createRoot(host);
  const results: string[] = [];
  try {
    for (const i of pages) {
      const stage = await new Promise<Konva.Stage>((resolve) => {
        root.render(
          <Stage
            width={board.pageWidth}
            height={board.pageHeight}
            ref={(s) => {
              if (s) resolve(s);
            }}
          >
            <Layer>
              <Group x={-i * board.pageWidth}>
                <BoardNodes board={board} />
              </Group>
            </Layer>
          </Stage>,
        );
      });
      await nextFrame();
      results.push(
        stage.toDataURL({
          x: 0,
          y: 0,
          width: board.pageWidth,
          height: board.pageHeight,
          pixelRatio,
          mimeType: format === 'jpeg' ? 'image/jpeg' : 'image/png',
          quality: 0.92,
        }),
      );
      root.render(<></>);
      await nextFrame();
    }
  } finally {
    root.unmount();
    host.remove();
  }
  return results;
}

export const safeName = (s: string) => s.replace(/[\\/:*?"<>|\s]+/g, '_').replace(/^_+|_+$/g, '') || 'page';

export interface ExportItem {
  board: Board;
  pages: number[];
}

export async function exportZip(
  projectName: string,
  items: ExportItem[],
  formatOverride: ImageFormat | null,
  onProgress?: (done: number, total: number) => void,
) {
  const zip = new JSZip();
  const total = items.reduce((n, i) => n + i.pages.length, 0);
  let done = 0;
  let order = 0;
  for (const item of items) {
    const fmt = formatOverride ?? item.board.exportFormat;
    const urls = await renderBoardPages(item.board, { format: fmt, pages: item.pages });
    urls.forEach((url, k) => {
      order += 1;
      const pageIdx = item.pages[k];
      const n = item.board.pageNames.length;
      const suffix = n > 1 ? `_${String(pageIdx + 1).padStart(2, '0')}of${String(n).padStart(2, '0')}` : '';
      const name = `${String(order).padStart(2, '0')}_${safeName(item.board.name)}${suffix}.${fmt === 'jpeg' ? 'jpg' : 'png'}`;
      zip.file(name, url.split(',')[1], { base64: true });
      done += 1;
      onProgress?.(done, total);
    });
  }
  const blob = await zip.generateAsync({ type: 'blob' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${safeName(projectName)}_StoreCanvas.zip`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
