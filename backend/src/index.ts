import { Elysia, t } from "elysia";
import { cors } from '@elysiajs/cors';
import { Database } from "bun:sqlite";

// Initialize SQLite with WAL mode
const db = new Database("war_room.sqlite");
db.exec('PRAGMA journal_mode = WAL;');

// Schema definition
db.exec(`
  CREATE TABLE IF NOT EXISTS rooms (
    id TEXT PRIMARY KEY,
    code TEXT DEFAULT '// Write your exploit here...',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_active DATETIME DEFAULT CURRENT_TIMESTAMP,
    purge_timeout INTEGER DEFAULT 0
  );
  
  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT,
    room_id TEXT,
    title TEXT,
    completed BOOLEAN DEFAULT 0,
    PRIMARY KEY (id, room_id)
  );

  CREATE TABLE IF NOT EXISTS payloads (
    id TEXT,
    room_id TEXT,
    filename TEXT,
    data TEXT,
    PRIMARY KEY (id, room_id)
  );
`);

// In-memory active connections
const activeConnections = new Map<any, { roomId: string, userId: string, name: string, role: string, isPendingChalk: boolean }>();
const purgeTimers = new Map<string, Timer>();

// Initialize default tasks for new rooms
const initRoom = (roomId: string) => {
  const room = db.query('SELECT * FROM rooms WHERE id = ?').get(roomId);
  if (!room) {
    db.query('INSERT INTO rooms (id) VALUES (?)').run(roomId);
    
    // Default tasks
    const tasks = [
      { id: 't1', title: 'Find entry point', completed: 0 },
      { id: 't2', title: 'Exploit Buffer Overflow', completed: 0 },
      { id: 't3', title: 'Extract root flag', completed: 0 }
    ];
    
    const insertTask = db.query('INSERT INTO tasks (id, room_id, title, completed) VALUES (?, ?, ?, ?)');
    tasks.forEach(t => insertTask.run(t.id, roomId, t.title, t.completed));
  }
};

const getRoomState = (roomId: string) => {
  initRoom(roomId);
  const room = db.query('SELECT code FROM rooms WHERE id = ?').get(roomId) as any;
  const tasks = db.query('SELECT id, title, completed FROM tasks WHERE room_id = ?').all(roomId).map((t: any) => ({ ...t, completed: Boolean(t.completed) }));
  const payloads = db.query('SELECT id, filename, data FROM payloads WHERE room_id = ?').all(roomId);
  
  // Get participants from memory
  const participants: any[] = [];
  activeConnections.forEach((info, ws) => {
    if (info.roomId === roomId) {
      participants.push({ id: info.userId, name: info.name, role: info.role, isPendingChalk: info.isPendingChalk });
    }
  });
  
  return { code: room.code, tasks, payloads, participants };
};

const broadcastToRoom = (roomId: string, message: any, excludeWs?: any) => {
  const msgStr = JSON.stringify(message);
  activeConnections.forEach((info, ws) => {
    if (info.roomId === roomId && ws !== excludeWs) {
      ws.send(msgStr);
    }
  });
};

const app = new Elysia()
  .use(cors())
  .get("/", () => "War Room Server Running")
  .ws('/ws', {
    message(ws, message: any) {
      const type = message.type;
      
      if (type === 'JOIN') {
        const roomId = message.roomId;
        // First joiner in a room becomes Host
        let isFirstInRoom = true;
        activeConnections.forEach((info) => {
          if (info.roomId === roomId) isFirstInRoom = false;
        });

        activeConnections.set(ws, {
          roomId,
          userId: message.userId,
          name: message.userName || `Agent_${message.userId.substring(0, 4)}`,
          role: isFirstInRoom ? 'Host' : 'Viewer',
          isPendingChalk: false
        });
        
        // Cancel purge timer if someone joins
        if (purgeTimers.has(roomId)) {
          clearTimeout(purgeTimers.get(roomId)!);
          purgeTimers.delete(roomId);
          db.query('UPDATE rooms SET purge_timeout = 0 WHERE id = ?').run(roomId);
        }

        // Send full state to joiner (includes their assigned role)
        const state = getRoomState(roomId);
        ws.send(JSON.stringify({ type: 'SYNC_STATE', state }));

        // Also tell them their assigned role explicitly
        const myInfo = activeConnections.get(ws)!;
        ws.send(JSON.stringify({ type: 'ROLE_ASSIGNED', role: myInfo.role }));
        
        // Notify others
        broadcastToRoom(roomId, { type: 'SYNC_PARTICIPANTS', participants: state.participants });
        return;
      }
      
      // All other messages: get roomId from connection state
      const connInfo = activeConnections.get(ws);
      if (!connInfo) return;
      const roomId = connInfo.roomId;
      
      if (type === 'UPDATE_CODE') {
        db.query('UPDATE rooms SET code = ?, last_active = CURRENT_TIMESTAMP WHERE id = ?').run(message.code, roomId);
        broadcastToRoom(roomId, { type: 'CODE_CHANGED', code: message.code }, ws);
      }
      
      else if (type === 'TOGGLE_TASK') {
        db.query('UPDATE tasks SET completed = NOT completed WHERE id = ? AND room_id = ?').run(message.taskId, roomId);
        broadcastToRoom(roomId, { type: 'SYNC_TASKS', tasks: getRoomState(roomId).tasks });
      }

      else if (type === 'ADD_TASK') {
        const taskId = `t${Date.now()}`;
        db.query('INSERT INTO tasks (id, room_id, title, completed) VALUES (?, ?, ?, 0)').run(taskId, roomId, message.title);
        broadcastToRoom(roomId, { type: 'SYNC_TASKS', tasks: getRoomState(roomId).tasks });
      }

      else if (type === 'REMOVE_TASK') {
        db.query('DELETE FROM tasks WHERE id = ? AND room_id = ?').run(message.taskId, roomId);
        broadcastToRoom(roomId, { type: 'SYNC_TASKS', tasks: getRoomState(roomId).tasks });
      }

      else if (type === 'ADD_PAYLOAD') {
        db.query('INSERT INTO payloads (id, room_id, filename, data) VALUES (?, ?, ?, ?)').run(message.payload.id, roomId, message.payload.filename, message.payload.data);
        broadcastToRoom(roomId, { type: 'SYNC_PAYLOADS', payloads: getRoomState(roomId).payloads });
      }
      
      else if (type === 'REMOVE_PAYLOAD') {
        db.query('DELETE FROM payloads WHERE id = ? AND room_id = ?').run(message.payloadId, roomId);
        broadcastToRoom(roomId, { type: 'SYNC_PAYLOADS', payloads: getRoomState(roomId).payloads });
      }

      else if (type === 'REQUEST_CHALK') {
        connInfo.isPendingChalk = true;
        broadcastToRoom(roomId, { type: 'SYNC_PARTICIPANTS', participants: getRoomState(roomId).participants });
      }

      else if (type === 'GRANT_CHALK') {
        if (connInfo.role !== 'Host') return;
        const targetId = message.targetId;
        activeConnections.forEach((info) => {
          if (info.roomId === roomId && info.userId === targetId) {
            info.role = 'Presenter';
            info.isPendingChalk = false;
          }
        });
        broadcastToRoom(roomId, { type: 'SYNC_PARTICIPANTS', participants: getRoomState(roomId).participants });
      }
      
      else if (type === 'REVOKE_ALL_CHALK') {
        if (connInfo.role !== 'Host') return;
        activeConnections.forEach((info) => {
          if (info.roomId === roomId && info.role === 'Presenter' && info.userId !== connInfo.userId) {
            info.role = 'Viewer';
          }
        });
        broadcastToRoom(roomId, { type: 'SYNC_PARTICIPANTS', participants: getRoomState(roomId).participants });
      }
      
      else if (type === 'DRAW') {
        broadcastToRoom(roomId, message, ws);
      }
      
      else if (type === 'CLEAR_CANVAS') {
        broadcastToRoom(roomId, { type: 'CLEAR_CANVAS' });
      }

      else if (type === 'UNDO_CANVAS') {
        broadcastToRoom(roomId, { type: 'UNDO_CANVAS' });
      }

      else if (type === 'REDO_CANVAS') {
        broadcastToRoom(roomId, { type: 'REDO_CANVAS' });
      }
    },
    
    close(ws) {
      const info = activeConnections.get(ws);
      if (info) {
        const { roomId } = info;
        activeConnections.delete(ws);
        
        // Check if room is empty
        let isEmpty = true;
        activeConnections.forEach((v) => { if (v.roomId === roomId) isEmpty = false; });
        
        if (isEmpty) {
          // Grace period of 60s
          const timer = setTimeout(() => {
            console.log(`Purging room ${roomId} (60s inactivity)`);
            db.query('DELETE FROM tasks WHERE room_id = ?').run(roomId);
            db.query('DELETE FROM payloads WHERE room_id = ?').run(roomId);
            db.query('DELETE FROM rooms WHERE id = ?').run(roomId);
            purgeTimers.delete(roomId);
          }, 60000);
          purgeTimers.set(roomId, timer);
        } else {
          broadcastToRoom(roomId, { type: 'SYNC_PARTICIPANTS', participants: getRoomState(roomId).participants });
        }
      }
    }
  })
  .listen(3001);

console.log(
  `🦊 War Room Backend is running at ${app.server?.hostname}:${app.server?.port}`
);
