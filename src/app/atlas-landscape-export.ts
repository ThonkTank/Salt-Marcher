import type { LandscapeBox } from './atlas-landscape';
import type { LandscapeRaster } from './landscape-raster';
import type { Result } from './contracts';

/** Assemble bounded display tiles at the requested GM export resolution. */
export async function landscapeExportTiles(
  box: LandscapeBox, width: number, height: number,
  campaignId: string, revision: number,
  read: (box: LandscapeBox, width: number, height: number) => Promise<Result<LandscapeRaster>>,
  current: () => boolean,
  progress: (done: number, total: number) => void = () => {},
  tileSize=1024,
): Promise<LandscapeRaster[]> {
  if(!box||![box.x,box.y,box.width,box.height,box.x+box.width,box.y+box.height].every(Number.isFinite)||box.width<=0||box.height<=0||
    !Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1||width>8192||height>8192)
    throw new Error('Atlas-Ausgabebereich prüfen.');
  if(!Number.isSafeInteger(tileSize)||tileSize<1||tileSize>1024)throw new Error('Atlas-Ausgabekachel prüfen.');
  const tiles: LandscapeRaster[]=[], total=Math.ceil(width/tileSize)*Math.ceil(height/tileSize);
  let bytes=0;
  for(let y=0;y<height;y+=tileSize)for(let x=0;x<width;x+=tileSize){
    if(!current())throw new Error('Atlas-Ausgabe abgebrochen.');
    const w=Math.min(tileSize,width-x),h=Math.min(tileSize,height-y),part={x:box.x+box.width*x/width,y:box.y+box.height*y/height,width:box.width*w/width,height:box.height*h/height};
    const result=await read(part,w,h);
    if(!current())throw new Error('Atlas-Ausgabe abgebrochen.');
    if(!result.ok)throw new Error(result.error);
    const tile=result.value;
    if(tile.campaignId!==campaignId||tile.revision!==revision||tile.width!==w||tile.height!==h||['x','y','width','height'].some(k=>tile.box[k as keyof LandscapeBox]!==part[k as keyof LandscapeBox]))
      throw new Error('Atlas wurde während der Ausgabe geändert. Erneut ausgeben.');
    bytes+=tile.data.length*2;
    if(bytes>256*1024*1024)throw new Error('Atlas-Ausgabe benötigt zu viel Bildspeicher. Kleineren Ausschnitt oder kleinere Ausgabegröße wählen.');
    tiles.push(tile);progress(tiles.length,total);
  }
  return tiles;
}
