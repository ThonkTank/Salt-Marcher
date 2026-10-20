// R0's finite analytic landscape. Metres throughout; no campaign or product storage.
export const LANDMARKS = [
  {id:'range',name:'Die Graukämme',x:-31000,y:-47000,scale:'wide'},
  {id:'pass',name:'Sattelpass',x:-16800,y:10400,scale:'all'},
  {id:'plateau',name:'Hochweide',x:63000,y:-46000,scale:'wide'},
  {id:'village',name:'Steinwacht',x:5000,y:13500,scale:'all'},
  {id:'sea',name:'Westmeer',x:-126000,y:33000,scale:'wide'},
];
export const VIEWS = {
  continent:{name:'Kontinent',x:0,y:0,span:520000},
  region:{name:'Region',x:-11000,y:5000,span:145000},
  place:{name:'Ort',x:5000,y:13500,span:6500},
};
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
const gauss=(x,s)=>Math.exp(-x*x/(s*s));
function hash(x,y){const n=Math.sin(x*127.1+y*311.7)*43758.5453;return n-Math.floor(n);}
function noise(x,y){const ix=Math.floor(x),iy=Math.floor(y),fx=smooth(0,1,x-ix),fy=smooth(0,1,y-iy);return (hash(ix,iy)*(1-fx)+hash(ix+1,iy)*fx)*(1-fy)+(hash(ix,iy+1)*(1-fx)+hash(ix+1,iy+1)*fx)*fy;}
export function riverY(x){return 11200+Math.sin(x/23000)*2200;}
export function baseHeight(x,y){
  // Curving western shoreline; finite island ends make the overview meaningful.
  const coast=-84000+17000*Math.sin(y/42000)+6000*Math.sin(y/12000);
  const land=Math.min((x-coast)/16000,(154000-Math.abs(y))/16000,(160000-x)/16000);
  const ground=-230+(440+60*noise(x/9000,y/9000))*smooth(-.3,1,land);
  const mainX=-22000+20000*Math.sin(y/62000);
  const end=1-smooth(85000,139000,Math.abs(y));
  const spine=gauss(x-mainX,14000)*end;
  const eastSpur=gauss(x-(mainX+Math.max(0,-y-15000)*.7),8500)*gauss(y+43000,48000);
  const westSpur=gauss(x-(mainX-Math.max(0,y-25000)*.55),9500)*gauss(y-64000,42000);
  const folds=.68+.22*noise(x/15500,y/12000)+.10*noise(x/3600,y/3700);
  const gullies=1-.24*Math.abs(2*noise((y+Math.abs(x-mainX)*.7)/4100,x/7300)-1);
  const mountains=(3100*spine+1600*eastSpur+1350*westSpur)*folds*gullies;
  const valley=gauss(y-riverY(x),8500);
  const saddle=1-.83*valley;
  const plateau=1000*(1-smooth(.65,1,Math.hypot((x-63000)/27000,(y+46000)/33000)));
  const micro=(noise(x/420,y/420)-.5)*12;
  return ground+smooth(0,.7,land)*(mountains*saddle+plateau+micro);
}

export class Terrain {
  constructor(){this.strokes=[];this.redoStack=[];this.draft=null;this.revision=0;}
  height(x,y){let h=baseHeight(x,y);for(const s of this.strokes)h+=this.contribution(s,x,y);if(this.draft)h+=this.contribution(this.draft,x,y);return h;}
  contribution(stroke,x,y){
    // Distance to the complete pointer polyline, rather than isolated stamps.
    // Sparse events and retraced sections must have the same bounded strength.
    let nearestSquared=stroke.radius*stroke.radius;
    for(let i=0;i<stroke.points.length;i++){
      const b=stroke.points[i],a=stroke.points[Math.max(0,i-1)];
      const dx=b.x-a.x,dy=b.y-a.y,lengthSquared=dx*dx+dy*dy;
      const t=lengthSquared?clamp(((x-a.x)*dx+(y-a.y)*dy)/lengthSquared):0;
      const ex=x-a.x-t*dx,ey=y-a.y-t*dy;
      nearestSquared=Math.min(nearestSquared,ex*ex+ey*ey);
      if(nearestSquared===0)break;
    }
    return stroke.amount*(1-nearestSquared/(stroke.radius*stroke.radius))**2;
  }
  begin(radius,amount){if(!Number.isFinite(radius)||radius<=0||!Number.isFinite(amount))throw Error('Ungültiger Höhenpinsel');if(this.draft)throw Error('Zug bereits aktiv');this.draft={radius,amount,points:[]};}
  add(x,y){if(!this.draft||!Number.isFinite(x)||!Number.isFinite(y))return false;const p=this.draft.points.at(-1);if(p&&Math.hypot(x-p.x,y-p.y)<=this.draft.radius*.06)return false;this.draft.points.push({x,y});return true;}
  commit(){if(this.draft?.points.length){this.strokes.push(this.draft);this.redoStack=[];this.revision++;}this.draft=null;}
  cancel(){this.draft=null;}
  undo(){this.cancel();if(this.strokes.length){this.redoStack.push(this.strokes.pop());this.revision++;}}
  redo(){this.cancel();if(this.redoStack.length){this.strokes.push(this.redoStack.pop());this.revision++;}}
  reset(){this.strokes=[];this.redoStack=[];this.cancel();this.revision++;}
  gradient(x,y,step=100){return{x:(this.height(x+step,y)-this.height(x-step,y))/(2*step),y:(this.height(x,y+step)-this.height(x,y-step))/(2*step)};}
}

export function reliefColor(h,gx,gy,x,y){
  if(h<=0){const t=clamp(-h/350);return [170-30*t,199-24*t,204-21*t];}
  const rock=smooth(650,2300,h),meadow=[191,198,166],stone=[187,182,165];
  const slope=Math.hypot(gx,gy);
  const light=clamp(.91+(-gx*.8-gy*.6)*2.2,.45,1.18);
  const grain=(noise(x/180,y/180)-.5)*3;
  const coast=1-smooth(0,55,h);
  return meadow.map((v,i)=>clamp((v*(1-rock)+stone[i]*rock)*light+grain+coast*18,0,255));
}

// A compact source-bound surface used by both renders; bilinear values are also
// used for labels and mesh targets. Detailed field queries remain distinct.
const baseGrids=new Map();
export function sampleGrid(terrain,box,n=180){
  const heights=new Float32Array((n+1)**2),colors=new Uint8Array((n+1)**2*3);
  const dx=box.width/n,dy=box.height/n;
  const key=JSON.stringify([box.x,box.y,box.width,box.height,n]);
  let base=baseGrids.get(key);
  if(!base){base=new Float32Array(heights.length);for(let j=0;j<=n;j++)for(let i=0;i<=n;i++)base[j*(n+1)+i]=baseHeight(box.x+i*dx,box.y+j*dy);baseGrids.set(key,base);if(baseGrids.size>3)baseGrids.delete(baseGrids.keys().next().value);}
  heights.set(base);
  const strokes=terrain.draft?[...terrain.strokes,terrain.draft]:terrain.strokes;
  for(const stroke of strokes)for(let j=0;j<=n;j++)for(let i=0;i<=n;i++)heights[j*(n+1)+i]+=terrain.contribution(stroke,box.x+i*dx,box.y+j*dy);
  for(let j=0;j<=n;j++)for(let i=0;i<=n;i++){
    const k=j*(n+1)+i,left=Math.max(0,i-1),right=Math.min(n,i+1),up=Math.max(0,j-1),down=Math.min(n,j+1);
    const gx=(heights[j*(n+1)+right]-heights[j*(n+1)+left])/((right-left)*dx),gy=(heights[down*(n+1)+i]-heights[up*(n+1)+i])/((down-up)*dy);
    colors.set(reliefColor(heights[k],gx,gy,box.x+i*dx,box.y+j*dy),k*3);
  }
  return {box,n,heights,colors,spacing:Math.max(dx,dy)};
}
export function gridHeight(g,x,y){
  const u=clamp((x-g.box.x)/g.box.width)*g.n,v=clamp((y-g.box.y)/g.box.height)*g.n,i=Math.min(g.n-1,Math.floor(u)),j=Math.min(g.n-1,Math.floor(v)),a=u-i,b=v-j,k=j*(g.n+1)+i;
  // Match PlaneGeometry's two triangles, not a second bilinear surface.
  const h00=g.heights[k],h10=g.heights[k+1],h01=g.heights[k+g.n+1],h11=g.heights[k+g.n+2];
  return a+b<=1?h00+(h10-h00)*a+(h01-h00)*b:h11+(h01-h11)*(1-a)+(h10-h11)*(1-b);
}
