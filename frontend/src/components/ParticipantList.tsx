import { useRoomStore } from '../store';
import { Users, Hand, Shield, Edit2, Eye, Ban } from 'lucide-react';

export function ParticipantList() {
  const { participants, userId, role, requestChalk, grantChalk, revokeAllChalk } = useRoomStore();

  const getRoleIcon = (roleName: string) => {
    switch (roleName) {
      case 'Host': return <Shield className="w-3 h-3 text-emerald-400" />;
      case 'Presenter': return <Edit2 className="w-3 h-3 text-accent" />;
      default: return <Eye className="w-3 h-3 text-gray-500" />;
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-300">
          <Users className="w-4 h-4" />
          Roster
        </div>
        <span className="text-xs text-gray-500">{participants.length} online</span>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {participants.map(p => (
          <div key={p.id} className="flex items-center justify-between p-2 rounded hover:bg-white/5 group">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-gray-800 flex items-center justify-center shrink-0">
                {getRoleIcon(p.role)}
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-gray-300 font-medium">
                  {p.name} {p.id === userId && <span className="text-gray-500">(You)</span>}
                </span>
                <span className="text-[10px] text-gray-500">{p.role}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center">
              {p.isPendingChalk && role === 'Host' && (
                <button 
                  onClick={() => grantChalk(p.id)}
                  className="text-xs bg-accent/20 text-accent hover:bg-accent hover:text-white px-2 py-1 rounded transition-colors animate-pulse"
                >
                  Grant
                </button>
              )}
              {p.isPendingChalk && role !== 'Host' && (
                <Hand className="w-4 h-4 text-amber-500 animate-bounce" />
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-gray-800 flex flex-col gap-2">
        {role === 'Viewer' && (
          <button 
            onClick={requestChalk}
            className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded text-sm font-medium bg-white/5 text-gray-300 hover:bg-white/10 transition-colors"
          >
            <Hand className="w-4 h-4" />
            Request Chalk
          </button>
        )}
        
        {role === 'Host' && (
          <button 
            onClick={revokeAllChalk}
            className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded text-sm font-medium bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-colors"
          >
            <Ban className="w-4 h-4" />
            Revoke All Chalk
          </button>
        )}
      </div>
    </div>
  );
}
