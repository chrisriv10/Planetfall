/** Fit the preview to the actual space beside the home card. Dimensions are
 * presentation-only; the playable island is never rescaled. */
export function homeIslandLayout(width:number, height:number, cardRight:number):{centerX:number;centerY:number;radiusFraction:number} {
  const margin=Math.max(20,width*.025), left=Math.min(width-180,cardRight+margin);
  const available=Math.max(180,width-left-margin);
  return {centerX:(left+available*.52)/width*2-1,centerY:.04,radiusFraction:Math.min(available*.59/width,height*.43/width)};
}
