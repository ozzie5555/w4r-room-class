import { useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useRoomStore } from '../store';
import { ParticipantList } from '../components/ParticipantList';
import { HybridWorkspace } from '../components/HybridWorkspace';
import { BinariesAndTasks } from '../components/BinariesAndTasks';
import { ShieldAlert, Signal, SignalZero, LogOut, Shield, Edit2, Eye } from 'lucide-react';

export function Room() {
  const { id: roomId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isConnected, role, userId, setConnected } = useRoomStore();
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:3001/ws');
    wsRef.current = ws;
    useRoomStore.getState().setWs(ws);

    ws.onopen = () => {
      setConnected(true);
      ws.send(JSON.stringify({ type: 'JOIN', roomId: roomId || 'global', userId, userName: useRoomStore.getState().userName }));
    };

    ws.onclose = () => {
      setConnected(false);
      useRoomStore.getState().setWs(null);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const store = useRoomStore.getState();
        
        switch (data.type) {
          case 'SYNC_STATE':
            store.syncState(data.state);
            break;
          case 'ROLE_ASSIGNED':
            useRoomStore.setState({ role: data.role });
            break;
          case 'SYNC_PARTICIPANTS':
            store.setParticipants(data.participants);
            break;
          case 'CODE_CHANGED':
            useRoomStore.setState({ code: data.code });
            break;
          case 'SYNC_TASKS':
            store.setTasks(data.tasks);
            break;
          case 'SYNC_PAYLOADS':
            store.setPayloads(data.payloads);
            break;
          case 'DRAW':
            window.dispatchEvent(new CustomEvent('remote-draw', { detail: data }));
            break;
        }
      } catch (e) {
        console.error(e);
      }
    };

    return () => {
      ws.close();
    };
  }, [roomId, userId]);

  const getRoleBadge = () => {
    switch (role) {
      case 'Host':
        return (
          <div className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded text-xs font-medium">
            <Shield className="w-3 h-3" /> Host
          </div>
        );
      case 'Presenter':
        return (
          <div className="flex items-center gap-1.5 bg-blue-500/10 text-blue-400 px-2.5 py-1 rounded text-xs font-medium">
            <Edit2 className="w-3 h-3" /> Presenter
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-1.5 bg-gray-500/10 text-gray-400 px-2.5 py-1 rounded text-xs font-medium">
            <Eye className="w-3 h-3" /> Viewer
          </div>
        );
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-deep-charcoal text-gray-200 overflow-hidden font-sans">
      {/* Top Navbar */}
      <header className="h-14 bg-panel border-b border-gray-800 flex items-center justify-between px-6 shrink-0 z-10">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/')} className="text-gray-500 hover:text-white transition-colors" title="Leave Room">
            <LogOut className="w-4 h-4 rotate-180" />
          </button>
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-5 h-5 text-accent" />
            <h1 className="text-sm font-semibold tracking-wide text-gray-100">WAR ROOM <span className="text-gray-500 font-normal ml-2 uppercase">{roomId}</span></h1>
          </div>
        </div>
        
        <div className="flex items-center gap-4 text-xs font-medium">
          {getRoleBadge()}
          
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded ${isConnected ? 'text-emerald-400 bg-emerald-400/10' : 'text-rose-400 bg-rose-400/10'}`}>
            {isConnected ? <Signal className="w-4 h-4" /> : <SignalZero className="w-4 h-4" />}
            <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
          </div>
        </div>
      </header>

      {/* Main 3-Column Workspace */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left Column: Participants */}
        <aside className="w-[250px] bg-panel/50 border-r border-gray-800 shrink-0 flex flex-col">
          <ParticipantList />
        </aside>

        {/* Middle Column: Hybrid Workspace */}
        <section className="flex-1 relative bg-workspace-grid canvas-grid overflow-hidden">
          <HybridWorkspace />
        </section>

        {/* Right Column: Binaries & Tasks */}
        <aside className="w-[300px] bg-panel/50 border-l border-gray-800 shrink-0 flex flex-col">
          <BinariesAndTasks />
        </aside>
      </main>
    </div>
  );
}
