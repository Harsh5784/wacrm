import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';

export const setupSocketHandlers = (io: Server) => {
  // Auth middleware for sockets
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) return next(new Error('Authentication required'));

    try {
      const decoded = jwt.verify(token as string, process.env.JWT_SECRET!) as any;
      socket.data.userId = decoded.userId;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    // Join org room
    socket.on('join:org', (orgId: string) => {
      socket.join(`org:${orgId}`);
      console.log(`[Socket] ${socket.id} joined org:${orgId}`);
    });

    // Join scraper job room
    socket.on('join:job', (jobId: string) => {
      socket.join(`job:${jobId}`);
    });

    socket.on('disconnect', () => {
      console.log(`[Socket] Client disconnected: ${socket.id}`);
    });
  });
};
