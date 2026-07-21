import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRoomStore, type Payload } from '../store';
import CodeMirror, { type ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { oneDark } from '@codemirror/theme-one-dark';
import { undo, redo } from '@codemirror/commands';
import {
  FileCode2,
  Grip,
  LayoutDashboard,
  LayoutGrid,
  LayoutTemplate,
  Maximize2,
  Plus,
  Redo2,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';

type Layout = 'split' | 'code' | 'canvas';
type ActiveSurface = 'canvas' | 'editor';

interface EditorTab {
  id: string;
  filename: string;
  content: string;
  source: 'shared' | 'payload';
  payloadId?: string;
}

interface DrawEvent {
  eventType: 'start' | 'draw' | 'end';
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

const MAX_CANVAS_HISTORY = 40;

const decodePayload = (data: string) => {
  try {
    if (!data.startsWith('data:')) {
      return data;
    }

    const separator = data.indexOf(',');
    if (separator === -1) return data;

    const metadata = data.slice(0, separator);
    const body = data.slice(separator + 1);

    if (!metadata.includes(';base64')) {
      return decodeURIComponent(body);
    }

    const binary = atob(body);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return '// Payload ini tidak dapat ditampilkan sebagai teks.';
  }
};

const encodePayload = (content: string) =>
  `data:text/plain;charset=utf-8,${encodeURIComponent(content)}`;

export function HybridWorkspace() {
  const {
    code,
    setCode,
    role,
    clearCanvas,
    payloads,
    addPayload,
    updatePayload,
  } = useRoomStore();

  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const editorRef = useRef<ReactCodeMirrorRef>(null);
  const canvasUndoStack = useRef<ImageData[]>([]);
  const canvasRedoStack = useRef<ImageData[]>([]);

  const [isDrawing, setIsDrawing] = useState(false);
  const [sandboxPos, setSandboxPos] = useState({ x: 50, y: 50 });
  const [sandboxSize, setSandboxSize] = useState({ width: 560, height: 380 });
  const [isDraggingSandbox, setIsDraggingSandbox] = useState(false);
  const [isResizingSandbox, setIsResizingSandbox] = useState(false);
  const [layout, setLayout] = useState<Layout>('split');
  const [activeSurface, setActiveSurface] = useState<ActiveSurface>('canvas');
  const [tabs, setTabs] = useState<EditorTab[]>([
    {
      id: 'shared-code',
      filename: 'script.js',
      content: code,
      source: 'shared',
    },
  ]);
  const [activeTabId, setActiveTabId] = useState('shared-code');

  const dragStart = useRef({ pointerX: 0, pointerY: 0, x: 0, y: 0 });
  const resizeStart = useRef({ pointerX: 0, pointerY: 0, width: 0, height: 0 });

  const canWrite = role === 'Host' || role === 'Presenter';
  const activeTab = useMemo(
    () => tabs.find((tab) => tab.id === activeTabId) ?? tabs[0],
    [activeTabId, tabs],
  );

  const configureCanvasContext = useCallback((context: CanvasRenderingContext2D) => {
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.lineWidth = 3;
    context.strokeStyle = '#3b82f6';
  }, []);

  const captureCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context || canvas.width === 0 || canvas.height === 0) return null;
    return context.getImageData(0, 0, canvas.width, canvas.height);
  }, []);

  const restoreCanvas = useCallback((snapshot: ImageData) => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.putImageData(snapshot, 0, 0);
    configureCanvasContext(context);
  }, [configureCanvasContext]);

  const pushCanvasHistory = useCallback(() => {
    const snapshot = captureCanvas();
    if (!snapshot) return;

    canvasUndoStack.current = [
      ...canvasUndoStack.current.slice(-(MAX_CANVAS_HISTORY - 1)),
      snapshot,
    ];
    canvasRedoStack.current = [];
  }, [captureCanvas]);

  const applyCanvasUndo = useCallback(() => {
    const previous = canvasUndoStack.current.pop();
    const current = captureCanvas();
    if (!previous || !current) return;

    canvasRedoStack.current.push(current);
    restoreCanvas(previous);
  }, [captureCanvas, restoreCanvas]);

  const applyCanvasRedo = useCallback(() => {
    const next = canvasRedoStack.current.pop();
    const current = captureCanvas();
    if (!next || !current) return;

    canvasUndoStack.current.push(current);
    restoreCanvas(next);
  }, [captureCanvas, restoreCanvas]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;

      const nextWidth = Math.max(1, parent.clientWidth);
      const nextHeight = Math.max(1, parent.clientHeight);
      if (canvas.width === nextWidth && canvas.height === nextHeight) return;

      const preserved = document.createElement('canvas');
      preserved.width = canvas.width;
      preserved.height = canvas.height;
      preserved.getContext('2d')?.drawImage(canvas, 0, 0);

      canvas.width = nextWidth;
      canvas.height = nextHeight;

      const context = canvas.getContext('2d');
      if (!context) return;
      context.drawImage(preserved, 0, 0);
      configureCanvasContext(context);
    };

    const observer = new ResizeObserver(resize);
    if (canvas.parentElement) observer.observe(canvas.parentElement);
    resize();

    return () => observer.disconnect();
  }, [configureCanvasContext]);

  useEffect(() => {
    setTabs((currentTabs) =>
      currentTabs.map((tab) =>
        tab.source === 'shared' ? { ...tab, content: code } : tab,
      ),
    );
  }, [code]);

  useEffect(() => {
    setTabs((currentTabs) =>
      currentTabs.map((tab) => {
        if (tab.source !== 'payload' || !tab.payloadId) return tab;
        const payload = payloads.find((item) => item.id === tab.payloadId);
        return payload ? { ...tab, filename: payload.filename, content: decodePayload(payload.data) } : tab;
      }),
    );
  }, [payloads]);

  const openPayload = useCallback((payload: Payload) => {
    const tabId = `payload-${payload.id}`;
    setTabs((currentTabs) => {
      const existing = currentTabs.some((tab) => tab.id === tabId);
      if (existing) {
        return currentTabs.map((tab) =>
          tab.id === tabId
            ? { ...tab, filename: payload.filename, content: decodePayload(payload.data) }
            : tab,
        );
      }

      return [
        ...currentTabs,
        {
          id: tabId,
          filename: payload.filename,
          content: decodePayload(payload.data),
          source: 'payload',
          payloadId: payload.id,
        },
      ];
    });
    setActiveTabId(tabId);
    setActiveSurface('editor');
    setLayout((currentLayout) => currentLayout === 'canvas' ? 'split' : currentLayout);
  }, []);

  useEffect(() => {
    const handleOpenPayload = (event: Event) => {
      openPayload((event as CustomEvent<Payload>).detail);
    };

    window.addEventListener('open-payload-in-editor', handleOpenPayload);
    return () => window.removeEventListener('open-payload-in-editor', handleOpenPayload);
  }, [openPayload]);

  const getCanvasPoint = (event: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const pointer = 'touches' in event ? event.touches[0] : event;
    if (!pointer) return null;

    return {
      x: pointer.clientX - rect.left,
      y: pointer.clientY - rect.top,
    };
  };

  const startDrawing = (event: React.MouseEvent | React.TouchEvent) => {
    if (!canWrite) return;

    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    const point = getCanvasPoint(event);
    if (!canvas || !context || !point) return;

    event.preventDefault();
    pushCanvasHistory();
    setActiveSurface('canvas');
    setIsDrawing(true);
    context.beginPath();
    context.moveTo(point.x, point.y);

    useRoomStore.getState().ws?.send(JSON.stringify({
      type: 'DRAW',
      eventType: 'start',
      x: point.x,
      y: point.y,
      width: canvas.width,
      height: canvas.height,
    }));
  };

  const draw = (event: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !canWrite) return;

    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    const point = getCanvasPoint(event);
    if (!canvas || !context || !point) return;

    event.preventDefault();
    context.lineTo(point.x, point.y);
    context.stroke();
    context.beginPath();
    context.moveTo(point.x, point.y);

    useRoomStore.getState().ws?.send(JSON.stringify({
      type: 'DRAW',
      eventType: 'draw',
      x: point.x,
      y: point.y,
      width: canvas.width,
      height: canvas.height,
    }));
  };

  const stopDrawing = () => {
    if (isDrawing) {
      useRoomStore.getState().ws?.send(JSON.stringify({ type: 'DRAW', eventType: 'end' }));
    }
    setIsDrawing(false);
    canvasRef.current?.getContext('2d')?.beginPath();
  };

  useEffect(() => {
    const handleRemoteDraw = (event: Event) => {
      const data = (event as CustomEvent<DrawEvent>).detail;
      const canvas = canvasRef.current;
      const context = canvas?.getContext('2d');
      if (!canvas || !context) return;

      const scaleX = data.width ? canvas.width / data.width : 1;
      const scaleY = data.height ? canvas.height / data.height : 1;
      const x = (data.x ?? 0) * scaleX;
      const y = (data.y ?? 0) * scaleY;

      if (data.eventType === 'start') {
        pushCanvasHistory();
        context.beginPath();
        context.moveTo(x, y);
      } else if (data.eventType === 'draw') {
        context.lineTo(x, y);
        context.stroke();
        context.beginPath();
        context.moveTo(x, y);
      } else {
        context.beginPath();
      }
    };

    const handleClearCanvas = () => {
      const canvas = canvasRef.current;
      const context = canvas?.getContext('2d');
      if (!canvas || !context) return;

      pushCanvasHistory();
      context.clearRect(0, 0, canvas.width, canvas.height);
    };

    window.addEventListener('remote-draw', handleRemoteDraw);
    window.addEventListener('clear-canvas', handleClearCanvas);
    window.addEventListener('undo-canvas', applyCanvasUndo);
    window.addEventListener('redo-canvas', applyCanvasRedo);

    return () => {
      window.removeEventListener('remote-draw', handleRemoteDraw);
      window.removeEventListener('clear-canvas', handleClearCanvas);
      window.removeEventListener('undo-canvas', applyCanvasUndo);
      window.removeEventListener('redo-canvas', applyCanvasRedo);
    };
  }, [applyCanvasRedo, applyCanvasUndo, pushCanvasHistory]);

  useEffect(() => {
    if (layout === 'code') setActiveSurface('editor');
    if (layout === 'canvas') setActiveSurface('canvas');
  }, [layout]);

  const runCanvasCommand = (type: 'UNDO_CANVAS' | 'REDO_CANVAS') => {
    const socket = useRoomStore.getState().ws;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type }));
      return;
    }

    if (type === 'UNDO_CANVAS') applyCanvasUndo();
    else applyCanvasRedo();
  };

  const handleUnifiedUndo = () => {
    if (!canWrite) return;
    if (activeSurface === 'editor' && layout !== 'canvas') {
      if (editorRef.current?.view) undo(editorRef.current.view);
      return;
    }
    runCanvasCommand('UNDO_CANVAS');
  };

  const handleUnifiedRedo = () => {
    if (!canWrite) return;
    if (activeSurface === 'editor' && layout !== 'canvas') {
      if (editorRef.current?.view) redo(editorRef.current.view);
      return;
    }
    runCanvasCommand('REDO_CANVAS');
  };

  const handleClear = () => {
    if (!canWrite) return;
    const socket = useRoomStore.getState().ws;
    if (socket?.readyState === WebSocket.OPEN) {
      clearCanvas();
      return;
    }

    window.dispatchEvent(new CustomEvent('clear-canvas'));
  };

  const startDragSandbox = (event: React.MouseEvent) => {
    if (layout === 'code') return;
    event.preventDefault();
    setIsDraggingSandbox(true);
    dragStart.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      x: sandboxPos.x,
      y: sandboxPos.y,
    };
  };

  const startResizeSandbox = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsResizingSandbox(true);
    resizeStart.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      width: sandboxSize.width,
      height: sandboxSize.height,
    };
  };

  useEffect(() => {
    if (!isDraggingSandbox && !isResizingSandbox) return;

    const handlePointerMove = (event: MouseEvent) => {
      const bounds = rootRef.current?.getBoundingClientRect();
      if (!bounds) return;

      if (isDraggingSandbox) {
        const nextX = dragStart.current.x + event.clientX - dragStart.current.pointerX;
        const nextY = dragStart.current.y + event.clientY - dragStart.current.pointerY;
        setSandboxPos({
          x: Math.min(Math.max(0, nextX), Math.max(0, bounds.width - 120)),
          y: Math.min(Math.max(0, nextY), Math.max(0, bounds.height - 56)),
        });
      }

      if (isResizingSandbox) {
        const requestedWidth = resizeStart.current.width + event.clientX - resizeStart.current.pointerX;
        const requestedHeight = resizeStart.current.height + event.clientY - resizeStart.current.pointerY;
        setSandboxSize({
          width: Math.min(Math.max(340, requestedWidth), Math.max(340, bounds.width - sandboxPos.x)),
          height: Math.min(Math.max(240, requestedHeight), Math.max(240, bounds.height - sandboxPos.y)),
        });
      }
    };

    const stopInteraction = () => {
      setIsDraggingSandbox(false);
      setIsResizingSandbox(false);
    };

    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', stopInteraction);
    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', stopInteraction);
    };
  }, [isDraggingSandbox, isResizingSandbox, sandboxPos.x, sandboxPos.y]);

  const createCodeBoard = () => {
    if (!canWrite) return;
    const defaultName = `untitled-${payloads.length + 1}.js`;
    const filename = prompt('Nama papan kode baru:', defaultName)?.trim();
    if (!filename) return;

    const payload = addPayload(filename, 'data:text/plain;charset=utf-8,');
    openPayload(payload);
  };

  const closeTab = (tabId: string) => {
    if (tabId === 'shared-code') return;

    setTabs((currentTabs) => {
      const closingIndex = currentTabs.findIndex((tab) => tab.id === tabId);
      const remaining = currentTabs.filter((tab) => tab.id !== tabId);
      if (activeTabId === tabId) {
        const fallback = remaining[Math.max(0, closingIndex - 1)] ?? remaining[0];
        setActiveTabId(fallback.id);
      }
      return remaining;
    });
  };

  const handleCodeChange = (value: string) => {
    if (!canWrite || !activeTab) return;

    setTabs((currentTabs) =>
      currentTabs.map((tab) => tab.id === activeTab.id ? { ...tab, content: value } : tab),
    );

    if (activeTab.source === 'shared') {
      setCode(value);
    } else if (activeTab.payloadId) {
      updatePayload(activeTab.payloadId, encodePayload(value));
    }
  };

  const toolbarTarget = activeSurface === 'editor' && layout !== 'canvas'
    ? activeTab?.filename ?? 'Editor'
    : 'Canvas';

  return (
    <div ref={rootRef} className="absolute inset-0 w-full h-full select-none">
      <div className="absolute top-4 right-4 z-30 flex bg-black/60 border border-gray-700 rounded-lg overflow-hidden shadow-lg p-1 gap-1">
        <button
          onClick={() => setLayout('split')}
          className={`p-1.5 rounded ${layout === 'split' ? 'bg-accent/20 text-accent' : 'text-gray-500 hover:text-white transition-colors'}`}
          title="Canvas + code"
        >
          <LayoutGrid className="w-4 h-4" />
        </button>
        <button
          onClick={() => setLayout('code')}
          className={`p-1.5 rounded ${layout === 'code' ? 'bg-accent/20 text-accent' : 'text-gray-500 hover:text-white transition-colors'}`}
          title="Perbesar code editor"
        >
          <LayoutDashboard className="w-4 h-4" />
        </button>
        <button
          onClick={() => setLayout('canvas')}
          className={`p-1.5 rounded ${layout === 'canvas' ? 'bg-accent/20 text-accent' : 'text-gray-500 hover:text-white transition-colors'}`}
          title="Perbesar canvas"
        >
          <LayoutTemplate className="w-4 h-4" />
        </button>
      </div>

        <canvas
          ref={canvasRef}
          className={`absolute inset-0 w-full h-full touch-none ${layout === "code" ? "invisible pointer-events-none" : !canWrite ? "pointer-events-none" : "cursor-crosshair"}`}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseOut={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />

      {(layout === 'split' || layout === 'code') && (
        <div
          className="absolute rounded-lg border border-gray-700 code-sandbox-overlay shadow-2xl flex flex-col overflow-hidden z-10 min-w-0"
          style={{
            transform: layout === 'code' ? 'none' : `translate(${sandboxPos.x}px, ${sandboxPos.y}px)`,
            width: layout === 'code' ? '100%' : sandboxSize.width,
            height: layout === 'code' ? '100%' : sandboxSize.height,
            inset: layout === 'code' ? '0' : 'auto',
            borderRadius: layout === 'code' ? '0' : undefined,
          }}
          onMouseDown={() => setActiveSurface('editor')}
        >
          <div
            className={`h-11 shrink-0 bg-black/85 border-b border-gray-800 flex items-center px-2 ${layout !== 'code' ? 'cursor-move' : ''}`}
            onMouseDown={startDragSandbox}
          >
            {layout !== 'code' && (
              <Grip className="w-4 h-4 text-gray-600 mr-1 shrink-0" aria-hidden="true" />
            )}

            <div
              className="flex min-w-0 flex-1 items-end self-stretch overflow-x-auto"
              onMouseDown={(event) => event.stopPropagation()}
            >
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTabId(tab.id);
                    setActiveSurface('editor');
                  }}
                  className={`group/tab h-full max-w-44 min-w-28 px-3 flex items-center gap-2 border-r border-gray-800 text-xs font-mono transition-colors ${activeTabId === tab.id ? 'bg-white/10 text-white border-b-2 border-b-accent' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}
                  title={tab.filename}
                >
                  <FileCode2 className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate flex-1 text-left">{tab.filename}</span>
                  {tab.id !== 'shared-code' && (
                    <span
                      role="button"
                      tabIndex={0}
                      className="opacity-0 group-hover/tab:opacity-100 hover:text-rose-400"
                      onClick={(event) => {
                        event.stopPropagation();
                        closeTab(tab.id);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') closeTab(tab.id);
                      }}
                      aria-label={`Tutup ${tab.filename}`}
                    >
                      <X className="w-3 h-3" />
                    </span>
                  )}
                </button>
              ))}

              {canWrite && (
                <button
                  onClick={createCodeBoard}
                  className="h-full px-3 text-gray-500 hover:text-white hover:bg-white/5 shrink-0"
                  title="Tambah papan kode"
                >
                  <Plus className="w-4 h-4" />
                </button>
              )}
            </div>

            <div
              className="flex items-center gap-1 pl-2"
              onMouseDown={(event) => event.stopPropagation()}
            >
              {layout !== 'code' && (
                <button
                  onClick={() => setLayout('code')}
                  className="p-1.5 text-gray-500 hover:text-white hover:bg-white/10 rounded"
                  title="Perbesar editor"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <div className={`flex-1 overflow-hidden select-text ${layout === 'code' ? 'bg-[#282c34]' : 'bg-transparent'}`}>
            <CodeMirror
              ref={editorRef}
              value={activeTab?.content ?? ''}
              height={layout === 'code' ? '100%' : `${sandboxSize.height - 44}px`}
              theme={oneDark}
              extensions={[javascript({ jsx: true })]}
              onFocus={() => setActiveSurface('editor')}
              onChange={handleCodeChange}
              readOnly={!canWrite}
              className={`text-sm font-mono h-full ${layout === 'code' ? '' : 'opacity-95'}`}
              basicSetup={{
                lineNumbers: true,
                foldGutter: false,
                highlightActiveLine: false,
              }}
            />
          </div>

          {layout !== 'code' && (
            <button
              className="absolute bottom-0 right-0 w-8 h-8 cursor-nwse-resize z-20 text-gray-400 hover:text-white bg-gradient-to-tl from-accent/30 to-transparent flex items-end justify-end p-1"
              onMouseDown={startResizeSandbox}
              title="Tarik untuk mengubah ukuran editor"
              aria-label="Ubah ukuran editor"
            >
              <span className="block w-3 h-3 border-r-2 border-b-2 border-current" />
            </button>
          )}
        </div>
      )}

      {canWrite && (
        <div className="absolute bottom-4 left-4 z-30 flex items-center bg-black/70 border border-gray-700 rounded-lg shadow-xl overflow-hidden">
          <span className="max-w-36 truncate px-3 text-[11px] font-mono text-gray-500 border-r border-gray-700">
            {toolbarTarget}
          </span>
          <button
            onClick={handleUnifiedUndo}
            className="text-gray-400 hover:text-white hover:bg-white/10 px-3 py-2 flex items-center gap-2 text-sm transition-colors"
            title={`Undo ${toolbarTarget}`}
          >
            <Undo2 className="w-4 h-4" />
            Undo
          </button>
          <button
            onClick={handleUnifiedRedo}
            className="text-gray-400 hover:text-white hover:bg-white/10 px-3 py-2 flex items-center gap-2 text-sm transition-colors border-l border-gray-800"
            title={`Redo ${toolbarTarget}`}
          >
            <Redo2 className="w-4 h-4" />
            Redo
          </button>
          {(activeSurface === 'canvas' || layout === 'canvas') && layout !== 'code' && (
            <button
              onClick={handleClear}
              className="text-rose-400 hover:bg-rose-500 hover:text-white px-3 py-2 flex items-center gap-2 text-sm transition-colors border-l border-gray-800"
              title="Bersihkan canvas"
            >
              <Trash2 className="w-4 h-4" />
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  );
}
