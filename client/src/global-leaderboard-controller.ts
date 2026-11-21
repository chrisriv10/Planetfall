import {createGlobalLeaderboardView} from "./global-leaderboard-view";
import type {GameSocket} from "./network";

const REFRESH_MS=30_000;

export function createGlobalLeaderboardController(socket:GameSocket,capture:(open:boolean)=>void){
  let timer:number|undefined, generation=0, request=0, reading=false, saving=false;
  const view=createGlobalLeaderboardView({
    onRetry:()=>void refresh(true),
    onSubmit:name=>void setVisibility(name),
    onRemove:()=>void setVisibility(null),
    onClose:close,
  });

  async function refresh(showLoading=false):Promise<void>{
    if(view.root.hidden||reading||saving)return;
    if(!socket.connected){view.error("Connect to Planetfall to view the leaderboard.");return;}
    const token=++request;
    reading=true;
    if(showLoading)view.loading();
    try{
      const result=await socket.timeout(5000).emitWithAck("leaderboard:read");
      if(token!==request)return;
      if(result.ok)view.render(result.data);else view.error(result.error);
    }catch{
      if(token===request)view.error("The leaderboard could not be loaded. Try again.");
    }finally{
      if(token===request)reading=false;
    }
  }
  async function setVisibility(name:string|null):Promise<void>{
    if(view.root.hidden||saving)return;
    if(!socket.connected){view.error("Reconnect to change leaderboard visibility.");return;}
    const token=++generation;
    request++;reading=false;saving=true;view.saving(true);
    let reload=false,error:string|undefined;
    try{
      const result=await socket.timeout(8000).emitWithAck("leaderboard:visibility",name);
      if(token!==generation)return;
      if(result.ok)reload=true;else error=result.error;
    }catch{
      error="Could not confirm the change. Try again.";
    }finally{
      if(token===generation){saving=false;view.saving(false);if(error)view.saveError(error);}
    }
    if(reload)void refresh();
  }
  function disconnected():void{
    generation++;request++;reading=false;saving=false;view.saving(false);
    view.error("Connect to Planetfall to view the leaderboard.");
  }
  const reconnect=()=>void refresh(true);
  function open(defaultName:string,invoker:HTMLElement):void{
    if(!view.root.hidden)return;
    view.open(defaultName,invoker);capture(true);
    socket.on("connect",reconnect);socket.on("disconnect",disconnected);
    timer=window.setInterval(()=>void refresh(),REFRESH_MS);
    void refresh(true);
  }
  function close():void{
    if(view.root.hidden)return;
    window.clearInterval(timer);timer=undefined;
    socket.off("connect",reconnect);socket.off("disconnect",disconnected);
    generation++;request++;reading=false;saving=false;
    view.saving(false);view.close();capture(false);
  }
  return {root:view.root,open,close};
}
