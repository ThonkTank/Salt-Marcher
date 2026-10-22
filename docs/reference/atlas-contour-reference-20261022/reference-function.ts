export function terrainContourSlope(grid:TerrainGrid){
  const mode=__MODE__,v=grid.view,l=terrainGridLayout(v),b=v.refinement??v.box,h=grid.heights;
  const values:{slope:number;area:number}[]=[];let weighted=0,total=0,energy=0;
  for(let y=0;y<v.rows-1;y++)for(let x=0;x<v.columns-1;x++){
    const dx=l.x.values[x+1]!-l.x.values[x]!,dy=l.y.values[y+1]!-l.y.values[y]!;
    const area=Math.max(0,Math.min(l.x.values[x+1]!,b.x+b.width)-Math.max(l.x.values[x]!,b.x))*Math.max(0,Math.min(l.y.values[y+1]!,b.y+b.height)-Math.max(l.y.values[y]!,b.y));
    if(!area)continue;
    const i=y*v.columns+x,slope=Math.max(Math.hypot((h[i+1]!-h[i]!)/dx,(h[i+v.columns]!-h[i]!)/dy),Math.hypot((h[i+v.columns+1]!-h[i+v.columns]!)/dx,(h[i+v.columns+1]!-h[i+1]!)/dy));
    if(slope<=0)continue;
    total+=area;weighted+=area*slope;energy+=area*slope*slope;
    if(mode==='median')values.push({slope,area});
  }
  if(!total)return 0;
  if(mode==='mean')return weighted/total;
  if(mode==='variation')return energy/weighted;
  if(mode==='rms')return Math.sqrt(energy/total);
  values.sort((a,b)=>a.slope-b.slope);let sum=0;
  for(const v of values){sum+=v.area;if(sum>=total/2)return v.slope;}
  return 0;
}
