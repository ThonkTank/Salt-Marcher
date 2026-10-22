// Deliberately simple CPU oracle for GPU pixel checks. Never imported by the app.
export function sampleRetainedColor(target,previous){
 for(let y=0;y<target.height;y++)for(let x=0;x<target.width;x++){
  const sx=Math.floor((target.box.x+(x+.5)*target.box.width/target.width-previous.box.x)/previous.box.width*previous.width);
  const sy=Math.floor((target.box.y+(y+.5)*target.box.height/target.height-previous.box.y)/previous.box.height*previous.height);
  if(sx<0||sy<0||sx>=previous.width||sy>=previous.height)continue;
  const a=sy*previous.width+sx,b=y*target.width+x;
  for(let c=0;c<4;c++)target.pixels[b*4+c]=previous.pixels[a*4+c];
  if(target.forest)target.forest[b]=previous.forest?.[a]??0;
 }
}
