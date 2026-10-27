import {atlasCameraEye,type AtlasCameraPose} from './atlas-camera';
import type {CanvasBox} from './passive-map-canvas';
import type {Point} from './contracts';

export type AtlasNavigationAnchor = Point & {heightM?:number};
/** Physical metres; numerical and near-volume bounds are added by Surface. */
export function atlasCameraClearanceMargin(width:number){return Math.max(.05,width*1e-6);}
const basis=(rotation:number,tilt:number)=>{
  const a=rotation*Math.PI/180,t=tilt*Math.PI/180,s=Math.sin(a),c=Math.cos(a),st=Math.sin(t),ct=Math.cos(t);
  return [[c,-s,0],[s*ct,c*ct,-st],[s*st,c*st,ct]];
};
/** Rotate the whole camera about a fixed physical point, retaining its screen position. */
export function orbitAtlasCamera(pose:AtlasCameraPose,anchor:AtlasNavigationAnchor,dx:number,dy:number):AtlasCameraPose {
  const rotation=((pose.rotation+dx*.3+180)%360+360)%360-180,tilt=Math.max(0,Math.min(75,pose.tilt+dy*.3));
  const before=basis(pose.rotation,pose.tilt),after=basis(rotation,tilt);
  const v=[pose.frame.x+pose.frame.width/2-anchor.x,pose.frame.y+pose.frame.height/2-anchor.y,(pose.focusM-(anchor.heightM??pose.focusM))*pose.exaggeration];
  const local=before.map(axis=>axis.reduce((sum,n,i)=>sum+n*v[i]!,0));
  const moved=[0,1,2].map(i=>after.reduce((sum,axis,j)=>sum+axis[i]!*local[j]!,0));
  return {...pose,rotation,tilt,focusM:(anchor.heightM??pose.focusM)+moved[2]!/pose.exaggeration,frame:{...pose.frame,x:anchor.x+moved[0]!-pose.frame.width/2,y:anchor.y+moved[1]!-pose.frame.height/2}};
}
export function zoomAtlasCamera(pose:AtlasCameraPose,width:number,anchor:AtlasNavigationAnchor):AtlasCameraPose {
  const factor=width/pose.frame.width,heightM=anchor.heightM??pose.focusM;
  return {...pose,focusM:heightM+(pose.focusM-heightM)*factor,frame:{x:anchor.x+(pose.frame.x-anchor.x)*factor,y:anchor.y+(pose.frame.y-anchor.y)*factor,width,height:pose.frame.height*factor}};
}
/** Ground-relative translation follows the current bearing, with no roll. */
export function shiftAtlasCamera(box:CanvasBox,rotation:number,dx:number,dy:number):CanvasBox {
  const a=rotation*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
  return {...box,x:box.x+c*dx+s*dy,y:box.y-s*dx+c*dy};
}
/** Keep the physical eye above sampled terrain, including small-scale steep slopes. */
export function clearAtlasCamera(pose:AtlasCameraPose,height:(p:Point)=>number):AtlasCameraPose {
  const eye=atlasCameraEye(pose),p={x:pose.frame.x+pose.frame.width/2+eye.x,y:pose.frame.y+pose.frame.height/2+eye.y};
  const minimum=height(p)+atlasCameraClearanceMargin(pose.frame.width)-eye.z/pose.exaggeration;
  return minimum>pose.focusM?{...pose,focusM:minimum}:pose;
}
