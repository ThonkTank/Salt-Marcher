import type {LandscapeBox} from './atlas-landscape';
export const terrainBoxesOverlap=(a:LandscapeBox,b:LandscapeBox)=>a.x<=b.x+b.width&&a.x+a.width>=b.x&&a.y<=b.y+b.height&&a.y+a.height>=b.y;
/** Derived data only. Consumers share explicit quotas; author data never enters this LRU. */
export class TerrainCache<T> {
  private entries=new Map<string,{value:T;bytes:number;box:LandscapeBox}>();
  bytes=0;hits=0;misses=0;evictions=0;
  constructor(readonly limit:number){}
  get(key:string):T|undefined{
    const entry=this.entries.get(key);
    if(!entry){this.misses++;return;}
    this.entries.delete(key);this.entries.set(key,entry);this.hits++;return entry.value;
  }
  put(key:string,box:LandscapeBox,value:T,bytes:number){
    const previous=this.entries.get(key);
    if(previous){this.entries.delete(key);this.bytes-=previous.bytes;}
    if(bytes>this.limit)return;
    while(this.bytes+bytes>this.limit&&this.entries.size){
      const [old,entry]=this.entries.entries().next().value!;
      this.entries.delete(old);this.bytes-=entry.bytes;this.evictions++;
    }
    this.entries.set(key,{value,bytes,box});this.bytes+=bytes;
  }
  /** A consumer may retain a partly dirty derived entry; retained storage keeps its quota and LRU age. */
  invalidate(boxes:LandscapeBox[],retain?:(value:T,boxes:LandscapeBox[])=>boolean){
    for(const [key,entry] of this.entries)if(boxes.some(b=>terrainBoxesOverlap(entry.box,b))){
      if(retain?.(entry.value,boxes))continue;
      this.entries.delete(key);this.bytes-=entry.bytes;
    }
  }
  clear(){this.entries.clear();this.bytes=0;}
}
