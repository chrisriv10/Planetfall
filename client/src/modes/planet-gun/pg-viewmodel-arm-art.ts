import {LatheGeometry,Vector2,type Matrix4,type Vector3} from "three";

function adsBlend(ads:number):number {
  const t=Number.isFinite(ads)?Math.max(0,Math.min(1,ads)):0;
  return t*t*(3-2*t);
}

/** Route each elbow toward its lower screen corner with the wrist fixed.
 * Call on the freshly authored elbow each frame, before extending its rear cap.
 * The forward support hand reaches across from a wider, higher elbow; the
 * trigger arm drops more steeply from the grip. These are shared body poses.
 */
export function routePgAdsElbow(elbow:Vector3,side:-1|1,ads:number):Vector3 {
  const blend=adsBlend(ads);
  elbow.x+=((side<0?-.38:.34)-elbow.x)*blend;
  elbow.y+=((side<0?-.26:-.30)-elbow.y)*blend;
  return elbow;
}

/** A modest ADS sleeve taper; the existing cuff still overlaps its wrist end. */
export function pgSleeveRadius(ads:number):number {return .055-.007*adsBlend(ads);}

/** Shared, unit-length cloth forearm: +Y is the wrist, -Y the camera end.
 * The narrower wrist grows into the rounded forearm belly, then settles toward
 * the elbow. An oval section softens the silhouette without an oversized tube.
 * Construct once per viewmodel and share between both arms; no frame updates.
 * Every radial vertex stays within radius 1 for extendPgSleeveElbow's bound.
 */
export function createPgSleeveGeometry():LatheGeometry {
  const profile=[
    [0,-.5],[.91,-.5],[.94,-.46],[.96,-.30],[.99,-.08],
    [1,.14],[.98,.26],[.92,.35],[.82,.42],[.73,.47],[.70,.5],[0,.5],
  ];
  const geometry=new LatheGeometry(profile.map(([radius,y])=>new Vector2(radius,y)),16);
  geometry.scale(1,1,.84);
  geometry.computeBoundingBox();geometry.computeBoundingSphere();
  return geometry;
}

/**
 * Extend the sleeve's elbow end along its existing axis until its entire rear
 * cap is behind the camera (camera space looks down -Z). Wrist and cuff stay
 * fixed. This avoids FOV-specific pose offsets and preserves the grip angle.
 * rigToCamera must be current and map the arm group's coordinates to camera
 * space; sleeveRadius is the largest unscaled cross-section radius.
 * Mutates only elbow, with no allocations. Requires an axis pointing back
 * toward the camera; degenerate/reversed spans are left unchanged.
 */
export function extendPgSleeveElbow(wrist:Readonly<Vector3>,elbow:Vector3,rigToCamera:Matrix4,sleeveRadius=.055):Vector3 {
  const m=rigToCamera.elements,dx=elbow.x-wrist.x,dy=elbow.y-wrist.y,dz=elbow.z-wrist.z;
  const depthStep=m[2]*dx+m[6]*dy+m[10]*dz;
  const elbowDepth=m[2]*elbow.x+m[6]*elbow.y+m[10]*elbow.z+m[14];
  // Bound the projected cap radius even if the rig carries uniform scaling.
  const rearDepth=Math.max(0,sleeveRadius)*Math.hypot(m[2],m[6],m[10])+.01;
  if(depthStep>1e-6&&Number.isFinite(elbowDepth)&&Number.isFinite(rearDepth)&&elbowDepth<rearDepth){
    const extra=(rearDepth-elbowDepth)/depthStep;
    elbow.set(elbow.x+dx*extra,elbow.y+dy*extra,elbow.z+dz*extra);
  }
  return elbow;
}
