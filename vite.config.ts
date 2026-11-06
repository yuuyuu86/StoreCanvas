import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * 本番ビルドにだけ Content-Security-Policy を付与する。
 * （開発サーバーは HMR のためにインラインスクリプトを使うので対象外）
 * スクリプトは自サイトのみ、画像は埋め込み（data:/blob:）のみ、外部への通信は Google Fonts のみ許可。
 */
const csp = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob:",
  "connect-src 'self' data: blob:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

function cspPlugin(): Plugin {
  return {
    name: 'storecanvas-csp',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${csp}" />\n    <meta name="referrer" content="no-referrer" />`);
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), cspPlugin()],
});
