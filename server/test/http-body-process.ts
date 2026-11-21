import {createPlanetfallServer} from "../src/app.js";

// A real, isolated process: an unhandled decoder error must fail the regression,
// rather than being caught by the test runner. No database or provider is used.
const server=await createPlanetfallServer({
  port:0,host:"127.0.0.1",nodeEnv:"test",clientOrigins:["http://test.local"],
});
process.on("message",message=>{
  if(message!=="close")return;
  void server.close().then(()=>process.disconnect?.(),()=>{
    process.exitCode=1;
    process.disconnect?.();
  });
});
process.send?.(await server.listen());
