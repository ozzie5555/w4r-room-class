<div align="center">
  <img src="https://img.shields.io/badge/STATUS-ACTIVE-success?style=for-the-badge" alt="Status" />
  <h1>WAR ROOM: CTF & Engineering Collaboration Platform</h1>
  <p>A zero-auth, high-performance, real-time ephemeral collaboration workspace engineered for Capture The Flag (CTF) teams and rapid prototyping.</p>
</div>

<hr />

## Table of Contents

- [Problem Statement & Analysis](#problem-statement--analysis)
- [Architecture & Tech Stack](#architecture--tech-stack)
- [Core Features](#core-features)
- [System Requirements](#system-requirements)
- [Quick Start Guide](#quick-start-guide)
- [Data Privacy & Ephemerality](#data-privacy--ephemerality)

## Problem Statement & Analysis

During intensive Capture The Flag (CTF) competitions or high-stakes engineering war rooms, teams frequently face critical communication and collaboration bottlenecks:

1. **Context Switching Overhead:** Engineers are forced to switch between multiple specialized tools—a messaging app for communication, a whiteboard tool (like Miro) for architectural visualization, a collaborative code editor (like VSCode Live Share) for exploit development, and a shared drive for binary/payload distribution.
2. **Setup Friction & Authentication:** Existing platforms require account creation, workspace provisioning, and explicit invitation links. In a timed competition, every second spent on logistics is a tactical disadvantage.
3. **Data Security & Stale State:** Post-competition, sensitive exploit code and organizational payloads are often left scattered across multiple third-party SaaS platforms, creating lingering data privacy risks.

**The Solution:** 
*WAR ROOM* resolves these bottlenecks by unifying the three core pillars of technical collaboration—**visual mapping (Canvas)**, **scripting (Code Sandbox)**, and **payload management**—into a single, zero-friction interface. By implementing a strict ephemeral data model via SQLite WAL and in-memory WebSockets, rooms exist solely for the duration of the engagement and self-destruct upon team dispersion.

## Architecture & Tech Stack

The platform is designed as a decoupled client-server architecture prioritizing low-latency real-time synchronization over persistent storage.

### Frontend (Client)
<p>
  <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Vite-B73BFE?style=for-the-badge&logo=vite&logoColor=FFD62E" alt="Vite" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/Zustand-4A4A55?style=for-the-badge" alt="Zustand" />
</p>

### Backend (Server)
<p>
  <img src="https://img.shields.io/badge/Bun-000000?style=for-the-badge&logo=bun&logoColor=white" alt="Bun" />
  <img src="https://img.shields.io/badge/Elysia.js-FFC0CB?style=for-the-badge" alt="Elysia.js" />
  <img src="https://img.shields.io/badge/SQLite-07405E?style=for-the-badge&logo=sqlite&logoColor=white" alt="SQLite" />
  <img src="https://img.shields.io/badge/WebSocket-010101?style=for-the-badge&logo=socket.io&logoColor=white" alt="WebSocket" />
</p>

## Core Features

*   **Hybrid Workspace Interface**
    *   **Dynamic Layouts:** Toggle seamlessly between Split-View, Fullscreen Canvas, and Fullscreen IDE.
    *   **HTML5 Canvas Whiteboarding:** Real-time synchronized drawing with hardware-accelerated rendering.
    *   **Draggable Code Sandbox:** Powered by CodeMirror 6, featuring syntax highlighting, undo/redo history, and zero-latency collaborative typing.
*   **Role-Based Access Control (RBAC)**
    *   **Host:** Full control over the room. Can revoke privileges and grant writing rights.
    *   **Presenter:** Granted write access to the Canvas, IDE, and Payloads.
    *   **Viewer:** Read-only access. Can dynamically request "Chalk" (write permissions) from the Host.
*   **Binary & Payload Management**
    *   Upload, distribute, and download binaries or exploit scripts instantly via Base64 serialization over WebSockets.
*   **Synchronized Flag Checklist**
    *   Centralized task tracking for flag progression and objective completion.

## System Requirements

*   **Node.js** (v18.0.0 or higher) - *For frontend package management*
*   **Bun** (v1.0.0 or higher) - *For backend execution and SQLite driver*
*   **Modern Web Browser** (Chrome 100+, Firefox 100+, Safari 15+)

## Quick Start Guide

### 1. Initialize the Backend
The backend runs on port `3001` and manages the SQLite database and WebSocket server.

```bash
cd backend
bun install
bun run src/index.ts
```

### 2. Initialize the Frontend
The frontend runs on port `5173` via Vite.

```bash
cd frontend
npm install
npm run dev
```

### 3. Usage
Navigate to `http://localhost:5173`. You can instantly initialize a new War Room or join an existing session by entering the Room ID. No authentication is required.

## Data Privacy & Ephemerality

Security and cleanliness are built into the core lifecycle of every War Room:
1. **Zero-Auth Identification:** Users are identified via localized UUIDv4 tokens stored in `sessionStorage`.
2. **Automated Purge:** When the last participant disconnects from a room, a strict 60-second heartbeat timer initiates. If no reconnections occur within this window, the backend executes a cascading `DELETE` query, permanently wiping all associated payloads, tasks, and codebase data from the SQLite WAL instance.
