import type {GameSocket} from "./network";

export function createHomePresence(socket:GameSocket,count:HTMLElement){
  let visible=false;
  const format=new Intl.NumberFormat();
  const indicator=count.parentElement;
  const disconnected=()=>{count.textContent="Unavailable";if(indicator)indicator.dataset.state="unavailable";};
  const read=(value:number)=>{
    if(!Number.isSafeInteger(value)||value<0){disconnected();return;}
    count.textContent=format.format(value);
    if(indicator)indicator.dataset.state="available";
  };
  const subscribe=()=>socket.emit("presence:menu",true);
  function setVisible(next:boolean):void{
    if(next===visible)return;
    visible=next;
    disconnected();
    if(next){
      socket.on("presence:count",read);
      socket.on("connect",subscribe);
      socket.on("disconnect",disconnected);
      if(socket.connected)subscribe();
    }else{
      socket.off("presence:count",read);
      socket.off("connect",subscribe);
      socket.off("disconnect",disconnected);
      if(socket.connected)socket.emit("presence:menu",false);
    }
  }
  return {setVisible};
}
