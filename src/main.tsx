import { createRoot } from 'react-dom/client';
import { startAutosave, useStore } from './store';
import { ProjectList } from './components/ProjectList';
import { Editor } from './components/Editor';
import { PreviewView } from './components/PreviewView';
import { NewCanvasDialog } from './components/NewCanvasDialog';
import { ExportDialog, TemplatesDialog } from './components/Dialogs';
import './styles.css';

function App() {
  const loaded = useStore((s) => s.loaded);
  const view = useStore((s) => s.view);
  const dialog = useStore((s) => s.dialog);
  const hasProject = useStore((s) => !!s.projects.find((p) => p.id === s.projectId));
  if (!loaded) return <div className="boot">読み込み中…</div>;
  const v = hasProject ? view : 'list';
  return (
    <>
      {v === 'list' && <ProjectList />}
      {v === 'editor' && <Editor />}
      {v === 'preview' && <PreviewView />}
      {hasProject && dialog === 'newCanvas' && <NewCanvasDialog />}
      {hasProject && dialog === 'templates' && <TemplatesDialog />}
      {hasProject && dialog === 'export' && <ExportDialog />}
    </>
  );
}

async function loadFonts() {
  const specs = ['400 20px "Noto Sans JP"', '700 20px "Noto Sans JP"', '900 20px "Noto Sans JP"', '400 20px "M PLUS Rounded 1c"', '800 20px "M PLUS Rounded 1c"', '400 20px "Dela Gothic One"', '400 20px Inter', '700 20px Inter'];
  await Promise.race([Promise.all(specs.map((s) => document.fonts.load(s, 'あA'))), new Promise((r) => setTimeout(r, 2500))]).catch(() => undefined);
}

(async () => {
  await Promise.all([loadFonts(), useStore.getState().load()]);
  startAutosave();
  createRoot(document.getElementById('root')!).render(<App />);
})();
