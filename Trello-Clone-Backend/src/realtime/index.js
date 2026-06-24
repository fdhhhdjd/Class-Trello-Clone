import { Server } from "socket.io";
import { verifyAccessToken } from "../modules/auth/tokens.js";

let io = null;

// userId -> active socket count (a user may have multiple connections).
const onlineUsers = new Map();

export function getOnlineCount() {
  return onlineUsers.size;
}

export function getOnlineUserIds() {
  return [...onlineUsers.keys()];
}

function extractToken(socket) {
  const auth = socket.handshake.auth?.token;
  if (auth) return auth.startsWith("Bearer ") ? auth.slice(7) : auth;
  const q = socket.handshake.query?.token;
  if (typeof q === "string" && q) return q;
  const header = socket.handshake.headers?.authorization;
  if (header?.startsWith("Bearer ")) return header.slice(7);
  return null;
}

export function initRealtime(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: true, credentials: true },
  });

  io.use((socket, next) => {
    const token = extractToken(socket);
    if (!token) return next(new Error("UNAUTHORIZED"));
    try {
      const decoded = verifyAccessToken(token);
      socket.data.userId = decoded.user_id;
      next();
    } catch {
      next(new Error("UNAUTHORIZED"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.data.userId;
    if (userId) {
      socket.join(`user:${userId}`);
      onlineUsers.set(userId, (onlineUsers.get(userId) ?? 0) + 1);
      socket.on("disconnect", () => {
        const n = (onlineUsers.get(userId) ?? 1) - 1;
        if (n <= 0) onlineUsers.delete(userId);
        else onlineUsers.set(userId, n);
      });
    }

    socket.on("board:join", (payload) => {
      const boardId = typeof payload === "string" ? payload : payload?.boardId;
      if (boardId) socket.join(`board:${boardId}`);
    });
    socket.on("board:leave", (payload) => {
      const boardId = typeof payload === "string" ? payload : payload?.boardId;
      if (boardId) socket.leave(`board:${boardId}`);
    });
  });

  return io;
}

// Used by card/list/comment services. No-op if realtime not initialized (e.g. tests).
export function emitToBoard(boardId, event, payload) {
  if (!io || !boardId) return;
  io.to(`board:${boardId}`).emit(event, payload);
}

// Emit to a single user's room (joined as user:<id> on connect).
export function emitToUser(userId, event, payload) {
  if (!io || !userId) return;
  io.to(`user:${userId}`).emit(event, payload);
}
