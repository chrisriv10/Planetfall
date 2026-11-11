import type {HomePreviewRegion} from "./home-preview-framing";

/** Available presentation space comes from the actual panel, never a viewport-wide center. */
export function homePreviewRegion(width:number,height:number,panel:{left:number;top:number;right:number},lobby=false,footerTop=height):HomePreviewRegion|null{
 if(!Number.isFinite(width+height+panel.left+panel.top+panel.right+footerTop)||width<=0||height<=0)return null;
 const margin=Math.max(16,Math.min(32,width*.02));
 let left=margin,top=margin,right=width-margin,bottom=Math.min(height-margin,footerTop-margin);
 if(lobby){
  if(panel.left>width*.3){right=panel.left-margin;top=Math.min(170,height*.2);}
  else bottom=Math.min(bottom,panel.top-margin);
 }else if(width>=760){left=panel.right+margin;}
 else bottom=panel.top-margin;
 if(right-left<140||bottom-top<90)return null;
 return {viewportWidth:width,viewportHeight:height,left,top,width:right-left,height:bottom-top};
}
