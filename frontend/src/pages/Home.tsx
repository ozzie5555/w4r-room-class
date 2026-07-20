import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, TerminalSquare, ArrowRight, Plus } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

export function Home() {
  const [roomId, setRoomId] = useState('');
  const navigate = useNavigate();

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomId.trim()) {
      navigate(`/room/${roomId.trim()}`);
    }
  };

  const handleCreateNew = () => {
    // Generate a short ID for the room
    const newRoomId = uuidv4().substring(0, 8);
    navigate(`/room/ctf-${newRoomId}`);
  };

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-deep-charcoal text-gray-200 overflow-hidden font-sans relative">
      {/* Background Decor */}
      <div className="absolute inset-0 canvas-grid opacity-20 pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-accent/5 rounded-full blur-3xl pointer-events-none" />

      <div className="z-10 w-full max-w-md flex flex-col items-center">
        <div className="flex items-center justify-center gap-4 mb-8 animate-pulse">
          <ShieldAlert className="w-12 h-12 text-accent" />
          <h1 className="text-4xl font-bold tracking-tight text-white">WAR ROOM</h1>
        </div>

        <p className="text-gray-400 text-center mb-10 text-sm max-w-sm">
          A zero-auth, ephemeral collaboration space for CTF teams and Engineers. 
          Rooms self-destruct after 60s of inactivity.
        </p>

        <div className="w-full bg-panel/80 backdrop-blur-md border border-gray-800 rounded-xl p-6 shadow-2xl">
          <form onSubmit={handleJoin} className="flex flex-col gap-4">
            <div>
              <label htmlFor="roomId" className="block text-xs font-medium text-gray-400 mb-2">
                JOIN EXISTING ROOM
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <TerminalSquare className="w-4 h-4 text-gray-500" />
                </div>
                <input
                  type="text"
                  id="roomId"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  placeholder="e.g. ctf-8924"
                  className="w-full bg-black/40 border border-gray-700 rounded-lg py-2.5 pl-10 pr-4 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={!roomId.trim()}
              className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-blue-400 text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Join Room
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="flex items-center gap-4 my-6">
            <div className="h-px bg-gray-800 flex-1" />
            <span className="text-xs text-gray-600 font-medium">OR</span>
            <div className="h-px bg-gray-800 flex-1" />
          </div>

          <button
            onClick={handleCreateNew}
            className="w-full flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-gray-300 font-medium py-2.5 rounded-lg border border-gray-700 hover:border-gray-500 transition-all"
          >
            <Plus className="w-4 h-4" />
            Initialize New War Room
          </button>
        </div>
      </div>
    </div>
  );
}
