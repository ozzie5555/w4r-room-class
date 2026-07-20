import { useEffect, useRef, useState, useCallback } from 'react';
import { useRoomStore } from '../store';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { oneDark } from '@codemirror/theme-one-dark';
import { undo, redo } from '@codemirror/commands';
import { Maximize2, Move, Type, Trash2, Undo2, Redo2, LayoutDashboard, LayoutTemplate, LayoutGrid } from 'lucide-react';

export function HybridWorkspace() {
  const { code, setCode, role, clearCanvas } = useRoomStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const editorRef = useRef<any>(null);
  
  const [isDrawing, setIsDrawing] = useState(false);
  const [sandboxPos, setSandboxPos] = useState({ x: 50, y: 50 });
  const [sandboxSize, setSandboxSize] = useState({ width: 500, height: 350 });
  
  const [isDraggingSandbox, setIsDraggingSandbox] = useState(false);
  const [isResizingSandbox, setIsResizingSandbox] = useState(false);
  
  // Layout Options: 'split', 'code', 'canvas'
  const [layout, setLayout] = useState<'split' | 'code' | 'canvas'>('split');
  
  const dragStartPos = useRef({ x: 0, y: 0 });
  const resizeStart = useRef({ x: 0, y: 0, width: 0, height: 0 });

  const canWrite = role === 'Host' || role === 'Presenter';

  // Canvas Logic
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.parentElement?.clientWidth || 800;
      canvas.height = canvas.parentElement?.clientHeight || 600;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#3b82f6';
    };

    window.addEventListener('resize', resize);
    resize();

    return () => window.removeEventListener('resize', resize);
  }, []);

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !canWrite) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;

    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    requestAnimationFrame(() => {
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y);
      
      const ws = useRoomStore.getState().ws;
      if (ws) {
        ws.send(JSON.stringify({ type: 'DRAW', x, y, width: canvas.width, height: canvas.height, eventType: 'draw' }));
      }
    });
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (!canWrite) return;
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.beginPath();
        const ws = useRoomStore.getState().ws;
        if (ws) ws.send(JSON.stringify({ type: 'DRAW', eventType: 'start' }));
      }
    }
    draw(e);
  };

  const stopDrawing = () => {
    if (isDrawing) {
      const canvas = canvasRef.current;
      if (canvas) {
        // Broadcast stroke end for undo history sync (simplified)
        useRoomStore.getState().ws?.send(JSON.stringify({ type: 'DRAW', eventType: 'end' }));
      }
    }
    setIsDrawing(false);
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) ctx.beginPath();
  };

  // Remote Drawing & Canvas Events
  useEffect(() => {
    const handleRemoteDraw = (e: any) => {
      const data = e.detail;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      if (data.eventType === 'start') {
        ctx.beginPath();
      } else if (data.eventType === 'draw') {
        ctx.lineTo(data.x, data.y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(data.x, data.y);
      } else if (data.eventType === 'end') {
        ctx.beginPath();
      }
    };
    
    const handleClearCanvas = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };

    window.addEventListener('remote-draw', handleRemoteDraw);
    window.addEventListener('clear-canvas', handleClearCanvas);
    
    return () => {
      window.removeEventListener('remote-draw', handleRemoteDraw);
      window.removeEventListener('clear-canvas', handleClearCanvas);
    };
  }, []);

  const handleClear = () => {
    if (canWrite) {
      clearCanvas();
      window.dispatchEvent(new CustomEvent('clear-canvas'));
    }
  };

  // Canvas Undo/Redo (Simulated for real-time app via WS broadcast)
  const handleCanvasUndo = () => {
    if (!canWrite) return;
    useRoomStore.getState().ws?.send(JSON.stringify({ type: 'UNDO_CANVAS' }));
  };

  const handleCanvasRedo = () => {
    if (!canWrite) return;
    useRoomStore.getState().ws?.send(JSON.stringify({ type: 'REDO_CANVAS' }));
  };

  // Sandbox Dragging
  const startDragSandbox = (e: React.MouseEvent) => {
    if (!canWrite) return;
    setIsDraggingSandbox(true);
    dragStartPos.current = {
      x: e.clientX - sandboxPos.x,
      y: e.clientY - sandboxPos.y
    };
  };

  // Sandbox Resizing
  const startResizeSandbox = (e: React.MouseEvent) => {
    if (!canWrite) return;
    e.stopPropagation();
    setIsResizingSandbox(true);
    resizeStart.current = {
      x: e.clientX,
      y: e.clientY,
      width: sandboxSize.width,
      height: sandboxSize.height
    };
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (isDraggingSandbox) {
      setSandboxPos({
        x: e.clientX - dragStartPos.current.x,
        y: e.clientY - dragStartPos.current.y
      });
    } else if (isResizingSandbox) {
      setSandboxSize({
        width: Math.max(300, resizeStart.current.width + (e.clientX - resizeStart.current.x)),
        height: Math.max(200, resizeStart.current.height + (e.clientY - resizeStart.current.y))
      });
    }
  };

  const onMouseUp = () => {
    setIsDraggingSandbox(false);
    setIsResizingSandbox(false);
  };

  // Editor Undo/Redo commands
  const handleUndo = useCallback(() => {
    if (editorRef.current?.view) {
      undo(editorRef.current.view);
    }
  }, []);

  const handleRedo = useCallback(() => {
    if (editorRef.current?.view) {
      redo(editorRef.current.view);
    }
  }, []);

  return (
    <div 
      className="absolute inset-0 w-full h-full"
      onMouseMove={isDraggingSandbox || isResizingSandbox ? onMouseMove : undefined}
      onMouseUp={isDraggingSandbox || isResizingSandbox ? onMouseUp : undefined}
      onMouseLeave={isDraggingSandbox || isResizingSandbox ? onMouseUp : undefined}
    >
      {/* Layout Controls */}
      <div className="absolute top-4 right-4 z-20 flex bg-black/40 border border-gray-800 rounded-lg overflow-hidden shadow-lg p-1 gap-1">
        <button onClick={() => setLayout('split')} className={`p-1.5 rounded ${layout === 'split' ? 'bg-accent/20 text-accent' : 'text-gray-500 hover:text-white transition-colors'}`} title="Hybrid View">
          <LayoutGrid className="w-4 h-4" />
        </button>
        <button onClick={() => setLayout('code')} className={`p-1.5 rounded ${layout === 'code' ? 'bg-accent/20 text-accent' : 'text-gray-500 hover:text-white transition-colors'}`} title="Code Only">
          <LayoutDashboard className="w-4 h-4" />
        </button>
        <button onClick={() => setLayout('canvas')} className={`p-1.5 rounded ${layout === 'canvas' ? 'bg-accent/20 text-accent' : 'text-gray-500 hover:text-white transition-colors'}`} title="Canvas Only">
          <LayoutTemplate className="w-4 h-4" />
        </button>
      </div>

      {(layout === 'split' || layout === 'canvas') && (
        <>
          <canvas
            ref={canvasRef}
            className={`absolute inset-0 w-full h-full ${!canWrite ? 'pointer-events-none' : 'cursor-crosshair'}`}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseOut={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
          />
          
          {canWrite && (
            <div className="absolute bottom-4 left-4 flex gap-2 z-20">
              <button 
                onClick={handleCanvasUndo}
                className="bg-black/40 text-gray-400 hover:text-white px-3 py-2 rounded-lg flex items-center gap-2 text-sm transition-colors shadow-lg border border-gray-800"
                title="Undo Canvas"
              >
                <Undo2 className="w-4 h-4" /> Undo
              </button>
              <button 
                onClick={handleCanvasRedo}
                className="bg-black/40 text-gray-400 hover:text-white px-3 py-2 rounded-lg flex items-center gap-2 text-sm transition-colors shadow-lg border border-gray-800"
                title="Redo Canvas"
              >
                <Redo2 className="w-4 h-4" /> Redo
              </button>
              <button 
                onClick={handleClear}
                className="bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white px-3 py-2 rounded-lg flex items-center gap-2 text-sm transition-colors shadow-lg border border-rose-500/20"
              >
                <Trash2 className="w-4 h-4" /> Clear
              </button>
            </div>
          )}
        </>
      )}

      {/* Floating Code Sandbox */}
      {(layout === 'split' || layout === 'code') && (
        <div 
          className="absolute rounded-lg border border-gray-800 code-sandbox-overlay shadow-2xl flex flex-col overflow-hidden z-10"
          style={{ 
            transform: layout === 'code' ? 'none' : `translate(${sandboxPos.x}px, ${sandboxPos.y}px)`,
            width: layout === 'code' ? '100%' : sandboxSize.width,
            height: layout === 'code' ? '100%' : sandboxSize.height,
            inset: layout === 'code' ? '0' : 'auto',
            borderRadius: layout === 'code' ? '0' : undefined
          }}
        >
          <div 
            className={`h-10 shrink-0 bg-black/80 border-b border-gray-800 flex items-center justify-between px-3 ${canWrite && layout !== 'code' ? 'cursor-move' : ''}`}
            onMouseDown={layout !== 'code' ? startDragSandbox : undefined}
          >
            <div className="flex items-center gap-2 text-xs font-medium text-gray-400 pointer-events-none">
              <Type className="w-3.5 h-3.5" />
              Sandbox
              
              {/* Fake Tabs for UI */}
              <div className="flex bg-black/40 ml-2 rounded border border-gray-800 pointer-events-auto">
                <div className="px-3 py-1 bg-white/10 text-white rounded-sm border-b border-accent">script.js</div>
                <div className="px-3 py-1 text-gray-500 hover:text-gray-300 cursor-pointer">payload.txt</div>
              </div>
            </div>
            
            <div className="flex gap-1" onMouseDown={(e) => e.stopPropagation()}>
              {canWrite && (
                <>
                  <button onClick={handleUndo} className="p-1 text-gray-500 hover:text-gray-300 hover:bg-white/10 rounded transition-colors" title="Undo Code">
                    <Undo2 className="w-4 h-4" />
                  </button>
                  <button onClick={handleRedo} className="p-1 text-gray-500 hover:text-gray-300 hover:bg-white/10 rounded transition-colors" title="Redo Code">
                    <Redo2 className="w-4 h-4" />
                  </button>
                  {layout !== 'code' && <div className="w-px h-4 bg-gray-700 my-auto mx-1" />}
                </>
              )}
              {layout !== 'code' && (
                <div className="w-3 h-3 my-auto mx-1 rounded-full bg-gray-700 hover:bg-gray-600 transition-colors cursor-pointer flex items-center justify-center">
                  <Maximize2 className="w-2 h-2 text-transparent hover:text-white" />
                </div>
              )}
            </div>
          </div>
          
          <div className={`flex-1 overflow-hidden ${layout === 'code' ? 'bg-[#282c34]' : 'bg-transparent'}`}>
            <CodeMirror
              ref={editorRef}
              value={code}
              height={layout === 'code' ? '100%' : `${sandboxSize.height - 40}px`}
              theme={oneDark}
              extensions={[javascript({ jsx: true })]}
              onChange={(val) => canWrite && setCode(val)}
              readOnly={!canWrite}
              className={`text-sm font-mono h-full ${layout === 'code' ? '' : 'opacity-90 mix-blend-screen'}`}
              basicSetup={{
                lineNumbers: true,
                foldGutter: false,
                highlightActiveLine: false,
              }}
            />
          </div>
          
          {/* Resize Handle */}
          {canWrite && layout !== 'code' && (
            <div 
              className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize z-10"
              onMouseDown={startResizeSandbox}
            >
              <svg viewBox="0 0 24 24" className="w-full h-full text-gray-600 rotate-90 opacity-50 hover:opacity-100 transition-opacity">
                <path fill="currentColor" d="M21 15v4a2 2 0 0 1-2 2h-4v-2h4v-4h2zm-2-6h2v4h-2V9zm0-4h2v2h-2V5zm-4-2v2h-2V3h2zm-4 0v2H9V3h2zM7 3v2H5V3h2zM3 5h2v2H3V5zm0 4h2v2H3V9zm0 4h2v2H3v-2zm0 4h2v2H3v-2zm4 2v2H5v-2h2zm4 0v2H9v-2h2zm4 0v2h-2v-2h2z" />
              </svg>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
