import {atlasPaint,type AtlasPaint} from './atlas-paint';
import type {PlayerFrame} from './player-contracts';
import {hexPoint,terrainColors} from './world-model';
import type {Terrain} from './world-contracts';
import type {Point} from './contracts';

/** Build only from the main process's public projection. No campaign/GM reader is available here. */
export function playerAtlas(frame:PlayerFrame):{scene:AtlasPaint;box:{x:number;y:number;width:number;height:number}}|null {
  if(frame.mode!=='map'&&frame.mode!=='dungeon')return null;
  const scene=atlasPaint('group'),add=(...args:Parameters<typeof atlasPaint>)=>{const node=atlasPaint(...args);scene.append(node);return node;};
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  const include=(p:Point)=>{minX=Math.min(minX,p.x);minY=Math.min(minY,p.y);maxX=Math.max(maxX,p.x);maxY=Math.max(maxY,p.y);};
  let padding:number;
  if(frame.mode==='dungeon'&&frame.dungeon){
    const d=frame.dungeon;include(d.position);padding=2;
    for(const polygon of d.known)for(const p of polygon.outer)include(p);
    add('polygons',{polygons:d.known,style:{fill:'#555d60',fillRule:'evenodd',stroke:'#8e9695',lineWidth:.08}});
    add('polygons',{polygons:d.visible,style:{fill:'#c7c6ab',fillRule:'evenodd',stroke:'#ede8cf',lineWidth:.06}});
    for(const t of d.tracks??[])add('polyline',{points:[t.from,t.to],style:{stroke:'#ad7149',lineWidth:.1,lineDash:[.12,.16]}});
    for(const m of d.markers)add('circle',{...m.point,radius:.18,style:{fill:m.kind==='npc'?'#a26caa':m.kind==='stairs'?'#a6bce4':m.open?'#4f8866':'#ac7251'}});
    for(const l of d.labels)add('text',{...l.point,style:{fontSize:.65,textAlign:'center',fill:'#fff'}},l.text);
    add('circle',{...d.position,radius:.28,style:{fill:'#edcb6c',stroke:'#fff',lineWidth:.1}});
  }else if(frame.mode==='map'&&frame.map){
    const map=frame.map,center=hexPoint(map.position,100);include(center);padding=75;
    for(const cell of map.cells){
      const p=hexPoint(cell,100);include(p);
      const points=Array.from({length:6},(_,i)=>{const a=(i*60+30)*Math.PI/180;return{x:p.x+57*Math.cos(a),y:p.y+57*Math.sin(a)};});
      add('polygon',{points,opacity:cell.visible?1:.5,style:{fill:terrainColors[cell.terrain as Terrain]??'#8e9c8b',stroke:'#15232b',lineWidth:1.5}});
      if(cell.road)add('path',{path:`M${p.x-38},${p.y+8} Q${p.x},${p.y-12} ${p.x+38},${p.y-8}`,opacity:cell.visible?1:.4,style:{stroke:'#d1b684',lineWidth:5}});
      if(cell.river)add('path',{path:`M${p.x-12},${p.y-45} Q${p.x+25},${p.y} ${p.x-5},${p.y+45}`,opacity:cell.visible?1:.4,style:{stroke:'#559dc7',lineWidth:5}});
      if(cell.label)add('text',{x:p.x,y:p.y+34,style:{textAlign:'center',fontSize:10,fill:'#fff4d4',stroke:'#080c10',lineWidth:.7}},cell.label);
    }
    for(const m of map.markers){const p=hexPoint(m,100);add('circle',{...p,radius:7,style:{fill:m.visible?'#f5dc93':'#af9d69',stroke:'#18252b',lineWidth:2}});if(m.label)add('text',{x:p.x,y:p.y-12,style:{fontSize:12,textAlign:'center',fill:'#fff4d4'}},m.label);}
    add('circle',{...center,radius:12,style:{fill:null,stroke:'#fff',lineWidth:4}});
  }else return null;
  const box={x:minX-padding,y:minY-padding,width:maxX-minX+2*padding,height:maxY-minY+2*padding};
  return {scene,box};
}
