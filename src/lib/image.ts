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
    input.accept = 'image/*';
    input.multiple = multiple;
    input.onchange = () => resolve(Array.from(input.files ?? []));
    input.click();
  });
}
