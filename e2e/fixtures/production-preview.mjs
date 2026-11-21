import {preview} from "vite";
import {createPlanetfallServer} from "../../server/dist/app.js";

const origin = new URL(process.env.VITE_SERVER_URL);
if (origin.protocol !== "http:" || origin.hostname !== "127.0.0.1" || !origin.port)
  throw new Error("Production smoke requires a dedicated loopback preview origin.");

const game = await createPlanetfallServer({
  host:"127.0.0.1",
  port:0,
  nodeEnv:"test",
  clientOrigins:[origin.origin],
});

let client;
try {
  const {url} = await game.listen();
  client = await preview({
    root:"client",
    configFile:false,
    preview:{
      host:origin.hostname,
      port:Number(origin.port),
      strictPort:true,
      proxy:{"/health":url,"/socket.io":{target:url,ws:true}},
    },
  });
} catch (error) {
  await game.close();
  throw error;
}

const stop = async () => {
  await game.close();
  await new Promise((resolve, reject) => client.httpServer.close(error => error ? reject(error) : resolve()));
};
process.once("SIGINT", stop);
process.once("SIGTERM", stop);
