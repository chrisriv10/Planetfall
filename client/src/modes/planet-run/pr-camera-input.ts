/** Controller look is integrated at the simulation step, independently of RAF. */
export function prControllerCamera(yaw:number,pitch:number,x:number,y:number,step:number,sensitivity:number,invertY:boolean){
  const dead=(value:number)=>Math.abs(value)>.18?value:0;
  return {yaw:yaw-dead(x)*step*2*sensitivity,pitch:Math.max(-.15,Math.min(1.1,pitch+dead(y)*step*sensitivity*(invertY?-1:1)))};
}
