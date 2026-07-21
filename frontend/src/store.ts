import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'

export type Role = 'Host' | 'Presenter' | 'Viewer'

export interface Participant {
  id: string
  name: string
  role: Role
  isPendingChalk: boolean
}

export interface Task {
  id: string
  title: string
  completed: boolean
}

export interface Payload {
  id: string
  filename: string
  data: string
}

interface RoomState {
  userId: string
  userName: string
  role: Role
  participants: Participant[]
  tasks: Task[]
  payloads: Payload[]
  code: string
  isConnected: boolean
  ws: WebSocket | null
  
  // Actions
  setWs: (ws: WebSocket | null) => void
  setCode: (code: string) => void
  setRole: (role: Role) => void
  toggleTask: (taskId: string) => void
  requestChalk: () => void
  grantChalk: (userId: string) => void
  revokeAllChalk: () => void
  addPayload: (filename: string, data: string) => Payload
  updatePayload: (payloadId: string, data: string) => void
  removePayload: (payloadId: string) => void
  addTask: (title: string) => void
  removeTask: (taskId: string) => void
  clearCanvas: () => void
  
  // Real-time synchronization hooks
  setParticipants: (participants: Participant[]) => void
  setTasks: (tasks: Task[]) => void
  setPayloads: (payloads: Payload[]) => void
  setConnected: (status: boolean) => void
  syncState: (state: any) => void
}

const getOrCreateUserId = () => {
  let id = sessionStorage.getItem('ctf_war_room_userId')
  if (!id) {
    id = uuidv4()
    sessionStorage.setItem('ctf_war_room_userId', id)
  }
  return id
}

const getOrCreateUserName = () => {
  let name = sessionStorage.getItem('ctf_war_room_userName')
  if (!name) {
    name = `Agent_${Math.floor(Math.random() * 1000)}`
    sessionStorage.setItem('ctf_war_room_userName', name)
  }
  return name
}

export const useRoomStore = create<RoomState>((set, get) => ({
  userId: getOrCreateUserId(),
  userName: getOrCreateUserName(),
  role: 'Viewer', // Default, but if they create they become host (handled by backend basically, or we should force Host on room creation. For now demo switch is in UI)
  participants: [],
  tasks: [],
  payloads: [],
  code: '// Connecting to War Room...',
  isConnected: false,
  ws: null,

  setWs: (ws) => set({ ws }),

  setCode: (code) => {
    set({ code })
    get().ws?.send(JSON.stringify({ type: 'UPDATE_CODE', code }))
  },
  
  setRole: (role) => set({ role }), // Debug local change
  
  toggleTask: (taskId) => {
    // Optimistic local update
    set((state) => ({
      tasks: state.tasks.map(t => t.id === taskId ? { ...t, completed: !t.completed } : t)
    }))
    get().ws?.send(JSON.stringify({ type: 'TOGGLE_TASK', taskId }))
  },

  addTask: (title) => {
    get().ws?.send(JSON.stringify({ type: 'ADD_TASK', title }))
  },

  removeTask: (taskId) => {
    set((state) => ({ tasks: state.tasks.filter(t => t.id !== taskId) }))
    get().ws?.send(JSON.stringify({ type: 'REMOVE_TASK', taskId }))
  },

  addPayload: (filename, data) => {
    const newPayload = { id: uuidv4(), filename, data }
    // Optimistic local update
    set((state) => ({ payloads: [...state.payloads, newPayload] }))
    get().ws?.send(JSON.stringify({ type: 'ADD_PAYLOAD', payload: newPayload }))
    return newPayload
  },

  updatePayload: (payloadId, data) => {
    set((state) => ({
      payloads: state.payloads.map((payload) => payload.id === payloadId ? { ...payload, data } : payload),
    }))
    get().ws?.send(JSON.stringify({ type: 'UPDATE_PAYLOAD', payloadId, data }))
  },

  removePayload: (payloadId) => {
    set((state) => ({ payloads: state.payloads.filter(p => p.id !== payloadId) }))
    get().ws?.send(JSON.stringify({ type: 'REMOVE_PAYLOAD', payloadId }))
  },

  clearCanvas: () => {
    if (get().role === 'Viewer') return;
    get().ws?.send(JSON.stringify({ type: 'CLEAR_CANVAS' }))
  },

  requestChalk: () => {
    set((state) => ({
      participants: state.participants.map(p => 
        p.id === state.userId ? { ...p, isPendingChalk: true } : p
      )
    }))
    get().ws?.send(JSON.stringify({ type: 'REQUEST_CHALK' }))
  },
  
  grantChalk: (targetId) => {
    if (get().role !== 'Host') return;
    get().ws?.send(JSON.stringify({ type: 'GRANT_CHALK', targetId }))
  },
  
  revokeAllChalk: () => {
    if (get().role !== 'Host') return;
    get().ws?.send(JSON.stringify({ type: 'REVOKE_ALL_CHALK' }))
  },

  setParticipants: (participants) => {
    // If our role changed in the backend, update local state
    const me = participants.find(p => p.id === get().userId);
    if (me && me.role !== get().role) {
      set({ role: me.role, participants });
    } else {
      set({ participants });
    }
  },
  
  setTasks: (tasks) => set({ tasks }),
  setPayloads: (payloads) => set({ payloads }),
  setConnected: (status) => set({ isConnected: status }),
  
  syncState: (state) => {
    // Set all initial data
    set({ 
      code: state.code,
      tasks: state.tasks,
      payloads: state.payloads,
    });
    get().setParticipants(state.participants);
  }
}))
