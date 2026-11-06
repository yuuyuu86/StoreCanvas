import { useEffect, useState } from 'react';

const cache = new Map<string, HTMLImageElement>();
const pending = new Map<string, Promise<HTMLImageElement>>();

export function loadImage(src: string): Promise<HTMLImageElement> {
  const hit = cache.get(src);
  if (hit) return Promise.resolve(hit);
  const p = pending.get(src);
  if (p) return p;
  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      cache.set(src, img);
      pending.delete(src);
      resolve(img);
    };
    img.onerror = (e) => {
      pending.delete(src);
      reject(e);
    };
    img.src = src;
  });
  pending.set(src, promise);
  return promise;
}

export function useImageSrc(src: string | null | undefined): HTMLImageElement | undefined {
  const [, force] = useState(0);
  useEffect(() => {
    if (!src || cache.has(src)) return;
    let alive = true;
    loadImage(src)
      .then(() => alive && force((n) => n + 1))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [src]);
  return src ? cache.get(src) : undefined;
}

export function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export function pickImageFiles(multiple = true): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/webp,image/gif,image/avif,image/bmp';
    input.multiple = multiple;
    input.onchange = () => resolve(Array.from(input.files ?? []));
    input.click();
  });
}

/** 受け付ける画像形式（SVG はスクリプトや外部参照を含み得るため、またキャンバスを汚染し得るため除外） */
export const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif', 'image/bmp'];
export const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
export const MAX_IMAGE_SIDE = 8192;

export const isAllowedImage = (f: File) => ALLOWED_IMAGE_TYPES.includes(f.type);

/**
 * 画像ファイルを検証して読み込む。形式・サイズ・デコード失敗をチェックし、
 * 問題があればユーザーに知らせて null を返す。
 */
export async function importImageFile(file: File): Promise<{ src: string; img: HTMLImageElement } | null> {
  if (!isAllowedImage(file)) {
    alert(`「${file.name}」は対応していない形式です。PNG / JPEG / WebP / GIF / AVIF / BMP を使用してください。`);
    return null;
  }
  if (file.size > MAX_IMAGE_BYTES) {
    alert(`「${file.name}」は大きすぎます（上限 ${MAX_IMAGE_BYTES / 1024 / 1024}MB）。`);
    return null;
  }
  try {
    const src = await readFileAsDataURL(file);
    if (!src.startsWith('data:image/')) throw new Error('not an image');
    const img = await loadImage(src);
    if (!img.width || !img.height) throw new Error('empty image');
    if (img.width > MAX_IMAGE_SIDE || img.height > MAX_IMAGE_SIDE) {
      alert(`「${file.name}」の解像度が大きすぎます（上限 ${MAX_IMAGE_SIDE}px）。`);
      return null;
    }
    return { src, img };
  } catch {
    alert(`「${file.name}」を画像として読み込めませんでした。`);
    return null;
  }
}
