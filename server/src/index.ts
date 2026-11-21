import { createPlanetfallServer } from "./app.js";

const planetfall = await createPlanetfallServer();
const { port } = await planetfall.listen();
console.log(`Planetfall server listening on http://0.0.0.0:${port}`);

let stopping=false;
const shutdown = () => {
  if(stopping)return;
  stopping=true;
  void planetfall.close().then(
    () => process.exit(0),
    () => {console.error("Planetfall stopped before all pending progression could be saved.");process.exit(1);},
  );
  setTimeout(() => {
    console.error("Planetfall shutdown timed out before pending progression saves could be confirmed.");
    process.exit(1);
  }, 5000).unref();
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
