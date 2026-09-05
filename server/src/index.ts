import { createPlanetfallServer } from "./app.js";

const planetfall = await createPlanetfallServer();
const { port } = await planetfall.listen();
console.log(`Planetfall server listening on http://0.0.0.0:${port}`);

const shutdown = () => {
  void planetfall.close().then(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
