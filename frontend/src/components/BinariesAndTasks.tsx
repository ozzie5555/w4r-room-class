import { useRoomStore } from '../store';
import { CheckSquare, Square, FileTerminal, Download, Trash2, Plus } from 'lucide-react';

export function BinariesAndTasks() {
  const { tasks, toggleTask, role, payloads, addPayload, removePayload, addTask } = useRoomStore();
  const canWrite = role === 'Host' || role === 'Presenter';

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canWrite || !e.target.files || e.target.files.length === 0) return;
    
    const file = e.target.files[0];
    const reader = new FileReader();
    
    reader.onload = (event) => {
      const base64Data = event.target?.result as string;
      addPayload(file.name, base64Data);
    };
    
    reader.readAsDataURL(file);
    
    // Reset input
    e.target.value = '';
  };

  const handleDownload = (filename: string, data: string) => {
    const a = document.createElement('a');
    a.href = data;
    a.download = filename;
    a.click();
  };

  const handleAddTask = () => {
    if (!canWrite) return;
    const title = prompt('Enter flag/task name:', 'Capture Flag #');
    if (title && title.trim()) {
      addTask(title.trim());
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Binaries Panel */}
      <div className="flex-1 flex flex-col border-b border-gray-800">
        <div className="px-4 py-3 border-b border-gray-800 bg-black/20 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-300">
            <FileTerminal className="w-4 h-4 text-accent" />
            Binaries & Payloads
          </div>
          <span className="text-xs text-gray-500 font-mono">{payloads.length} files</span>
        </div>
        <div className="p-3 overflow-y-auto space-y-2 flex-1 relative">
          {payloads.length === 0 && (
            <p className="text-xs text-gray-600 text-center py-4 italic">No payloads uploaded yet</p>
          )}
          {payloads.map((payload) => (
            <div key={payload.id} className="flex items-center justify-between p-2 rounded bg-white/5 border border-white/5 hover:border-white/10 transition-colors group">
              <span className="text-xs font-mono text-gray-300 truncate mr-2">{payload.filename}</span>
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <button onClick={() => handleDownload(payload.filename, payload.data)} className="text-gray-400 hover:text-white cursor-pointer"><Download className="w-3.5 h-3.5" /></button>
                {canWrite && (
                  <button onClick={() => removePayload(payload.id)} className="text-gray-400 hover:text-rose-400 cursor-pointer">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
          {canWrite && (
            <div className="mt-2 flex gap-2 relative">
              <button 
                onClick={() => {
                  const filename = prompt('Enter new filename:', 'script.js');
                  if (filename && filename.trim()) {
                    addPayload(filename.trim(), 'ZGF0YTp0ZXh0L3BsYWluO2Jhc2U2NCw='); // Empty string base64
                  }
                }}
                className="flex-1 py-2 border border-dashed border-gray-700 rounded text-xs text-gray-500 hover:text-gray-300 hover:border-gray-500 transition-colors cursor-pointer flex items-center justify-center gap-1"
              >
                <Plus className="w-3 h-3" /> New
              </button>
              <div className="flex-1 relative">
                <input 
                  type="file" 
                  onChange={handleFileUpload} 
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  title="Upload Payload"
                />
                <button className="w-full py-2 border border-dashed border-gray-700 rounded text-xs text-gray-500 hover:text-gray-300 hover:border-gray-500 transition-colors pointer-events-none flex items-center justify-center gap-1">
                  Upload
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Flag Checklist */}
      <div className="flex-1 flex flex-col bg-black/10">
        <div className="px-4 py-3 border-b border-gray-800 bg-black/20 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-300">
            <CheckSquare className="w-4 h-4 text-emerald-400" />
            Flag Checklist
          </div>
          <span className="text-xs text-emerald-500 font-mono">
            {tasks.filter(t => t.completed).length}/{tasks.length}
          </span>
        </div>
        
        <div className="p-3 overflow-y-auto space-y-2 flex-1">
          {tasks.length === 0 && (
            <p className="text-xs text-gray-600 text-center py-4 italic">No tasks yet</p>
          )}
          {tasks.map(task => (
            <div 
              key={task.id}
              className={`group flex items-center justify-between p-2 rounded transition-colors ${canWrite ? 'hover:bg-white/5' : ''} ${task.completed ? 'opacity-50' : ''}`}
            >
              <div className={`flex items-start gap-3 ${canWrite ? 'cursor-pointer' : ''}`} onClick={() => canWrite && toggleTask(task.id)}>
                <div className="mt-0.5 shrink-0">
                  {task.completed ? (
                    <CheckSquare className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Square className="w-4 h-4 text-gray-500" />
                  )}
                </div>
                <span className={`text-sm ${task.completed ? 'text-gray-500 line-through' : 'text-gray-300'}`}>
                  {task.title}
                </span>
              </div>
              
              {canWrite && (
                <button 
                  onClick={() => useRoomStore.getState().removeTask(task.id)}
                  className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-rose-400 transition-opacity p-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
          {canWrite && (
            <button onClick={handleAddTask} className="w-full mt-2 py-2 border border-dashed border-gray-700 rounded text-xs text-gray-500 hover:text-gray-300 hover:border-gray-500 transition-colors cursor-pointer flex items-center justify-center gap-1">
              <Plus className="w-3 h-3" /> Add Task
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
