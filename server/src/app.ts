import http from "node:http";
import cors from "cors";
import express from "express";
import { Server } from "socket.io";
import RAPIER from "@dimforge/rapier3d-compat";
import {resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {PlayerProfiles} from "./player-profiles.js";
import {ProfileDatabase} from "./profile-database.js";
import type { ClientToServerEvents, ServerToClientEvents } from "@planetfall/shared";
import {installAccounts} from "./accounts.js";
import type {AccountProvider} from "./account-provider.js";
import type {ProfileDatabaseConnection} from "./profile-database.js";
import { RoomManager } from "./room-manager.js";

export interface ServerOptions {
  port?: number;
  host?: string;
  nodeEnv?: string;
  clientOrigins?: string[];
  /** Tests may use an isolated file; undefined test servers stay in memory. */
  profileFile?: string;
  profileDatabaseUrl?:string;
  testAccounts?:{provider:AccountProvider;connection:ProfileDatabaseConnection;origin:string};
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
  // Browser APIs use plain JSON; reject encoded bodies before creating a decoder.
  app.use(express.json({ limit: "16kb", inflate: false }));
  const server = http.createServer(app);
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
    cors: { origin: allowedOrigins, methods: ["GET", "POST"] },
    allowRequest: (request, callback) => callback(null, originAllowed(request.headers.origin)),
    transports: ["websocket", "polling"], pingInterval: 10000, pingTimeout: 20000, maxHttpBufferSize: 32_000
  });
  const testEnvironment=(options.nodeEnv??process.env.NODE_ENV)==="test";
  const profileFile=options.profileFile??(testEnvironment?undefined:process.env.PLANETFALL_DATA_DIR?resolve(process.env.PLANETFALL_DATA_DIR,"player-profiles.json"):fileURLToPath(new URL("../data/player-profiles.json",import.meta.url)));
  const databaseUrl=options.profileDatabaseUrl??(!testEnvironment?process.env.DATABASE_URL:undefined);
  if(options.testAccounts&&(!testEnvironment||process.env.NODE_ENV==="production"))throw new Error("Test accounts require test mode");
  const baseUrl = testEnvironment ? undefined : process.env.NEON_AUTH_BASE_URL;
  const cookieSecret = process.env.NEON_AUTH_COOKIE_SECRET;
  const gatewaySecret = options.testAccounts ? undefined : process.env.PLANETFALL_ACCOUNT_GATEWAY_SECRET;
  const accountOrigin = options.testAccounts?.origin ?? process.env.PLANETFALL_ACCOUNT_ORIGIN;
  let provider = options.testAccounts?.provider;
  if(baseUrl) {
    const upstream = new URL(baseUrl);
    if(upstream.protocol!=="https:"||upstream.username||upstream.password||upstream.search||upstream.hash||
      !accountOrigin||new URL(accountOrigin).origin!==accountOrigin||!allowedOrigins.includes(accountOrigin)||
      accountOrigin.startsWith("http:")&&!localOrigins.includes(accountOrigin)||
      !cookieSecret||cookieSecret.length<32||!databaseUrl||
      isProduction&&(!accountOrigin.startsWith("https://")||!gatewaySecret||gatewaySecret.length<32))
      throw new Error("Incomplete account configuration");
    const {createNeonAccountProvider}=await import("./account-provider.js");
    provider=createNeonAccountProvider(upstream.href.replace(/\/$/,""),cookieSecret,accountOrigin);
  }
  const persisted=options.testAccounts?await ProfileDatabase.open(options.testAccounts.connection):
    databaseUrl?await ProfileDatabase.connect(databaseUrl):undefined;
  let profiles:PlayerProfiles;
  let claimed:string[];
  try{
    profiles=new PlayerProfiles(persisted?undefined:profileFile,persisted?.document,persisted?.database);
    claimed=await persisted?.database.accountKeys()??[];
  }catch(error){await persisted?.database.close().catch(()=>{});throw error;}
  const manager = new RoomManager(io,profiles,!isProduction&&process.env.PLANETFALL_PR_REVIEW==="1");
  let stopAccounts:(()=>void)|undefined;
  try {
    for(const key of claimed)profiles.holdGuest(key);
    if(provider&&accountOrigin&&persisted) {
      stopAccounts=installAccounts({app,io,manager,profiles,database:persisted.database,provider,origin:accountOrigin,gatewaySecret});
    } else {
      app.post("/api/account/session",(_request,response)=>response.set("Cache-Control","private, no-store").json({state:"disabled"}));
      io.use((socket,next)=>next(socket.handshake.auth?.accountTicket===undefined?undefined:new Error("Planetfall accounts unavailable")));
    }
  } catch(error) {
    await profiles.close();
    throw error;
  }
  // Storage mode is safe to expose for release checks; never expose paths,
  // connection strings, profile tokens or balances through health responses.
  const profileStorage=persisted?"postgresql":profileFile?"file":"memory";
  app.get("/health", (_request, response) => response.json({ ok: true, rooms: manager.rooms.size, uptime: process.uptime(), profileStorage }));
  app.use((error: unknown, request: express.Request, response: express.Response, next: express.NextFunction) => {
    if (error instanceof Error && error.message === "Origin not allowed") return response.status(403).json({ error: "Origin not allowed" });
    if(request.path.startsWith("/api/account/"))return response.status(400).set("Cache-Control","private, no-store").end();
    next(error);
  });
  io.use((socket,next)=>{
    if(!profiles.usesDatabase){next();return;}
    void manager.prepareProfile(socket).then(()=>next(),()=>next(new Error("Your saved profile is temporarily unavailable. Please reconnect.")));
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
      stopAccounts?.();
      manager.stop();
      io.disconnectSockets(true);
      try {
        await profiles.close();
      } finally {
        await new Promise<void>((resolve) => io.close(() => resolve()));
      }
    }
  };
}
