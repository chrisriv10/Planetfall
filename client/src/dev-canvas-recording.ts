/** Local DEV evidence capture only. Records the real canvas, never game state. */
export function createDevCanvasRecording(canvas:HTMLCanvasElement,label:()=>string):HTMLElement {
 const root=document.createElement("div"),start=document.createElement("button"),stop=document.createElement("button"),status=document.createElement("span");
 start.textContent="Record 15s";stop.textContent="Stop recording";stop.disabled=true;root.append(start,stop,status);
 let recorder:MediaRecorder|null=null,timer:ReturnType<typeof setTimeout>|null=null;
 start.addEventListener("click",()=>{
  if(recorder?.state==="recording")return;
  if(typeof MediaRecorder==="undefined"||!canvas.captureStream){status.textContent="Canvas recording unavailable";return;}
  const mime=["video/webm;codecs=vp9","video/webm;codecs=vp8","video/webm"].find(type=>MediaRecorder.isTypeSupported(type));
  if(!mime){status.textContent="WebM recording unavailable";return;}
  const stream=canvas.captureStream(20),chunks:BlobPart[]=[],name=label().replace(/[^a-zA-Z0-9_-]/g,"-");
  recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:3_000_000});
  recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
  recorder.onstop=()=>{if(timer)clearTimeout(timer);for(const track of stream.getTracks())track.stop();const blob=new Blob(chunks,{type:mime}),url=URL.createObjectURL(blob),link=document.createElement("a");link.href=url;link.download=`${name}-${Date.now()}.webm`;link.click();setTimeout(()=>URL.revokeObjectURL(url),10000);start.disabled=false;stop.disabled=true;status.textContent="Recording saved";recorder=null;};
  recorder.onerror=()=>{status.textContent="Recording failed";if(recorder?.state==="recording")recorder.stop();};
  recorder.start(1000);start.disabled=true;stop.disabled=false;status.textContent="Recording real canvas (20fps)";timer=setTimeout(()=>{if(recorder?.state==="recording")recorder.stop();},15000);
 });
 stop.addEventListener("click",()=>{if(recorder?.state==="recording")recorder.stop();});
 return root;
}
