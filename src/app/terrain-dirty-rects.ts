import type {TerrainRect} from './terrain-frame';

/** Join adjacent dirty cells before reading their shared source neighbourhood.
 * Clean cells stay untouched; every rectangle remains within the sample budget. */
export function terrainDirtyRects(dirty:Uint8Array,columns:number,rows:number,edge:number,maxSamples=65536):TerrainRect[]{
 const across=Math.ceil(columns/edge),down=Math.ceil(rows/edge),rects:TerrainRect[]=[];
 let previous=new Map<string,TerrainRect>();
 for(let row=0;row<down;row++){
  const next=new Map<string,TerrainRect>(),y=row*edge,height=Math.min(edge,rows-y);
  for(let column=0;column<across;){
   if(!dirty[row*across+column]){column++;continue;}
   const first=column++;
   while(column<across&&dirty[row*across+column])column++;
   const x=first*edge,width=Math.min(columns,column*edge)-x,key=x+':'+width,old=previous.get(key);
   if(old&&width*(old.height+height)<=maxSamples){old.height+=height;next.set(key,old);}
   else {const rect={x,y,width,height};rects.push(rect);next.set(key,rect);}
  }
  previous=next;
 }
 return rects;
}
