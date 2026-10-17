import * as THREE from "three";

export interface BrScanMarker {
  readonly position:Readonly<{x:number;y:number;z:number}>;
  readonly expiresAt:number;
}
export const BR_SCAN_MARKER_MAX_DISTANCE=120;

/** Screen overlay of server-quantized samples, never live enemy transforms.
 * Attach element to a positioned viewport container. No world occlusion test:
 * APPROX explicitly denotes the scanner's temporary information. */
export class BrScanMarkers {
  readonly element:HTMLDivElement;
  private readonly slots:{element:HTMLDivElement;diamond:HTMLSpanElement}[]=[];
  private readonly point=new THREE.Vector3();
  private readonly cameraPosition=new THREE.Vector3();
  private disposed=false;

  constructor(){
    this.element=document.createElement("div");
    this.element.className="br-scan-markers";
    this.element.setAttribute("aria-hidden","true");
    this.element.style.cssText="position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:3;";
    for(let i=0;i<40;i++){
      const element=document.createElement("div"),diamond=document.createElement("span"),label=document.createElement("span");
      element.style.cssText="position:absolute;display:none;transform:translate(-50%,-50%);text-align:center;color:#ffcf86;font:700 11px/1.3 system-ui,sans-serif;letter-spacing:.06em;text-shadow:0 1px 3px #111;";
      diamond.style.cssText="display:block;margin:0 auto 5px;width:13px;height:13px;border:2px solid #ffbf72;background:#25180b80;transform:rotate(45deg);box-shadow:0 0 5px #000;";
      label.textContent="APPROX";label.style.cssText="display:block;padding:2px 4px;border-radius:3px;background:#141b26c9;";
      element.append(diamond,label);this.element.append(element);this.slots.push({element,diamond});
    }
  }

  /** Optional explicit CSS viewport dimensions avoid a layout read. */
  update(markers:readonly BrScanMarker[],camera:THREE.Camera,now:number,width=this.element.clientWidth,height=this.element.clientHeight):void {
    if(this.disposed)return;
    this.clear();
    if(!Number.isFinite(now)||!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)return;
    this.cameraPosition.setFromMatrixPosition(camera.matrixWorld);
    let used=0;
    for(let i=0;i<markers.length&&used<40;i++){
      const marker=markers[i],p=marker.position;
      if(!Number.isFinite(marker.expiresAt)||marker.expiresAt<=now||!Number.isFinite(p.x)||!Number.isFinite(p.y)||!Number.isFinite(p.z))continue;
      this.point.set(p.x,p.y,p.z);
      if(this.point.distanceToSquared(this.cameraPosition)>BR_SCAN_MARKER_MAX_DISTANCE**2)continue;
      this.point.applyMatrix4(camera.matrixWorldInverse);
      if(this.point.z>=0)continue;
      this.point.applyMatrix4(camera.projectionMatrix);
      if(this.point.z< -1||this.point.z>1||Math.abs(this.point.x)>1||Math.abs(this.point.y)>1)continue;
      const slot=this.slots[used++];
      slot.element.style.display="block";
      slot.element.style.left=`${(this.point.x*.5+.5)*width}px`;
      slot.element.style.top=`${(-this.point.y*.5+.5)*height}px`;
      slot.element.style.opacity=String(Math.min(1,(marker.expiresAt-now)/250));
      // Global pulse changes only the glyph, never the sampled world position.
      slot.diamond.style.transform=`rotate(45deg) scale(${1+.12*Math.sin(now*.006)})`;
    }
  }

  clear():void{for(const slot of this.slots)slot.element.style.display="none";}
  dispose():void{if(this.disposed)return;this.clear();this.element.remove();this.disposed=true;}
}
