const P: Record<string, string> = {
  plus: 'M12 5v14M5 12h14',
  resize: 'M4 9V4h5M20 15v5h-5M4 4l6 6M20 20l-6-6',
  copy: 'M9 9h10v10H9zM5 15V5h10',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  unlink: 'M15.7 14l3-3a4 4 0 0 0-5.7-5.7l-1 1M8.3 10l-3 3a4 4 0 0 0 5.7 5.7l1-1M4 4l16 16',
  text: 'M5 6V4h14v2M12 4v16M9 20h6',
  image: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15 9.5a1.5 1.5 0 1 0 0-.01',
  rect: 'M4 6h16v12H4z',
  ellipse: 'M12 5c4.4 0 8 3.1 8 7s-3.6 7-8 7-8-3.1-8-7 3.6-7 8-7z',
  phone: 'M8 3h8a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM11 18h2',
  lock: 'M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3',
  unlock: 'M6 11h12v9H6zM8 11V8a4 4 0 0 1 7.5-2',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  eyeOff: 'M3 3l18 18M10.6 6.1A10 10 0 0 1 12 6c6.5 0 10 6 10 6a17 17 0 0 1-3 3.6M6.6 6.6A17 17 0 0 0 2 12s3.5 6 10 6a9.6 9.6 0 0 0 4.4-1',
  undo: 'M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
  redo: 'M15 14l5-5-5-5M20 9H10a6 6 0 0 0 0 12h3',
  back: 'M15 18l-6-6 6-6',
  play: 'M7 4l13 8-13 8z',
  download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  template: 'M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z',
  guides: 'M8 3v18M16 3v18',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  alignLeft: 'M4 3v18M8 7h10v4H8zM8 14h6v4H8z',
  alignHCenter: 'M12 3v18M6 7h12v4H6zM8 14h8v4H8z',
  alignRight: 'M20 3v18M6 7h10v4H6zM10 14h6v4h-6z',
  alignTop: 'M3 4h18M7 8h4v10H7zM14 8h4v6h-4z',
  alignVCenter: 'M3 12h18M7 6h4v12H7zM14 8h4v8h-4z',
  alignBottom: 'M3 20h18M7 6h4v10H7zM14 10h4v6h-4z',
  distH: 'M4 4v16M20 4v16M10 8h4v8h-4z',
  distV: 'M4 4h16M4 20h16M8 10h8v4H8z',
  front: 'M8 8h12v12H8zM4 4h12v2M4 4v12h2',
  back2: 'M4 4h12v12H4zM8 18v2h12V8h-2',
  group: 'M4 4h6v6H4zM14 14h6v6h-6zM3 3h18v18H3z',
  check: 'M5 12l5 5 9-10',
  warn: 'M12 4l9 16H3zM12 10v4M12 17h.01',
  info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v6M12 7.5h.01',
  close: 'M6 6l12 12M18 6L6 18',
  frame: 'M7 3v18M17 3v18M3 7h18M3 17h18',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  fit: 'M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5',
};

export function Icon({ name, size = 16 }: { name: string; size?: number }) {
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={P[name] ?? ''} />
    </svg>
  );
}
