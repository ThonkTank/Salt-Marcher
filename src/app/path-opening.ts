import type {BoundaryFace,PathPoint} from './path-contracts';
import {VOXEL_METERS as U} from './volume-contracts';

/** Match buildPath's voxel footprint: even widths occupy the extra positive-axis cell. */
export function passageCenter(point:PathPoint,face:BoundaryFace,widthSteps:number):PathPoint{
 const shift=widthSteps%2===0?U/2:0;
 return{x:point.x+(['east','west'].includes(face)?0:shift),y:point.y+(['north','south'].includes(face)?0:shift),z:point.z};
}
