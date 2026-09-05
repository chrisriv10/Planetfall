import http from "node:http";
import cors from "cors";
import express from "express";
import { Server } from "socket.io";
import RAPIER from "@dimforge/rapier3d-compat";
import type { ClientToServerEvents, ServerToClientEvents } from "@planetfall/shared";
import { RoomManager } from "./room-manager.js";

export interface ServerOptions {
  port?: number;
  host?: string;
  nodeEnv?: string;
  clientOrigins?: string[];
}

export async function createPlanetfallServer(options: ServerOptions = {}) {
  await RAPIER.init();
  const port = options.port ?? Number(process.env.PORT ?? 3000);
  const host = options.host ?? "0.0.0.0";
  const isProduction = (options.nodeEnv ?? process.env.NODE_ENV) === "production";
  const configuredOrigins = options.clientOrigins ?? (process.env.CLIENT_ORIGIN ?? "").split(",").map((v) => v.trim()).filter(Boolean);
  const localOrigins = ["http://localhost:5173", "http://127.0.0.1:5173"];
  const allowedOrigins = isProduction ? configuredOrigins : [...new Set([...configuredOrigins, ...localOrigins])];
  const originAllowed = (origin?: string) => !origin || allowedOrigins.includes(origin);

  const app = express();
  app.disable("x-powered-by");
  app.use(cors({ origin: (origin, callback) => callback(originAllowed(origin) ? null : new Error("Origin not allowed"), true) }));
  app.use(express.json({ limit: "16kb" }));
  const server = http.createServer(app);
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
    cors: { origin: allowedOrigins, methods: ["GET", "POST"] },
    allowRequest: (request, callback) => callback(null, originAllowed(request.headers.origin)),
    transports: ["websocket", "polling"], pingInterval: 10000, pingTimeout: 20000, maxHttpBufferSize: 32_000
  });
  const manager = new RoomManager(io);
  app.get("/health", (_request, response) => response.json({ ok: true, rooms: manager.rooms.size, uptime: process.uptime() }));
  app.use((error: unknown, _request: express.Request, response: express.Response, next: express.NextFunction) => {
    if (error instanceof Error && error.message === "Origin not allowed") return response.status(403).json({ error: "Origin not allowed" });
    next(error);
  });
  io.on("connection", (socket) => manager.bind(socket));

  return {
    app, io, manager, server,
    async listen(): Promise<{ port: number; url: string }> {
      manager.start();
      await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, host, () => { server.off("error", reject); resolve(); });
      });
      const address = server.address();
      const activePort = typeof address === "object" && address ? address.port : port;
      return { port: activePort, url: `http://127.0.0.1:${activePort}` };
    },
    async close(): Promise<void> {
      manager.stop();
      await new Promise<void>((resolve) => io.close(() => resolve()));
    }
  };
}
