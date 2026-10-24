// Correlation-safe bounds for the mean of normalized material channels over
// one arrangement face. Ranges bound point values; means bound face averages.
const BASE=0, FOREST=4, PIGMENT=5, ALPHA=8, FINAL=9, SCRATCH=13;
const pad=(lo,hi)=>[Math.max(0,lo-32*Number.EPSILON),Math.min(1,hi+32*Number.EPSILON)];
const singleton=x=>[x,x];
const validPair=p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&p[0]<=p[1]&&p[0]>=0&&p[1]<=1;
const validState=s=>s&&Array.isArray(s.range)&&Array.isArray(s.mean)&&s.range.length===14&&s.mean.length===14&&s.range.every(validPair)&&s.mean.every(validPair);
const exact=(s,i,x)=>{if(!Number.isFinite(x)||x<0||x>1)return false;s.range[i]=singleton(x);s.mean[i]=singleton(x);return true;};
export function makeMeanState(background){
 if(!Array.isArray(background)||background.length!==14||background.some(x=>!Number.isFinite(x)||x<0||x>1))throw Error('Invalid mean material background');
 return {range:background.map(singleton),mean:background.map(singleton)};
}
function intersect(a,b){const lo=Math.max(a[0],b[0]),hi=Math.min(a[1],b[1]);return lo<=hi?[lo,hi]:undefined;}
function linearExtrema(cx,ca,c){
 const all=[];for(const x of cx)for(const a of ca)all.push(c[0]*x+c[1]*a+c[2]);return [Math.min(...all),Math.max(...all)];}
// McCormick envelopes retain the shared EX and EA terms in E[X(1-A)+yA].
function constantBlend(xr,xm,ar,am,y){
 if(xr[0]===xr[1]&&xm[0]===xm[1]&&ar[0]===ar[1]&&am[0]===am[1]){const v=xr[0]*(1-ar[0])+y*ar[0];return {range:singleton(v),mean:singleton(v)};}
 const [lx,ux]=xr,[la,ua]=ar;
 const lower1=linearExtrema(xm,am,[1-la,y-ux,ux*la])[0];
 const lower2=linearExtrema(xm,am,[1-ua,y-lx,lx*ua])[0];
 const upper1=linearExtrema(xm,am,[1-la,y-lx,lx*la])[1];
 const upper2=linearExtrema(xm,am,[1-ua,y-ux,ux*ua])[1];
 const values=[];for(const x of xr)for(const a of ar)values.push(x*(1-a)+y*a);
 const point=pad(Math.min(...values),Math.max(...values));
 const mean=intersect(pad(Math.max(lower1,lower2),Math.min(upper1,upper2)),point);
 return mean&&{range:point,mean};
}
// Bound E[X A] from pointwise intervals and intervals for both first moments.
function productMean(xr,xm,ar,am){
 const [lx,ux]=xr,[la,ua]=ar;
 const lower1=linearExtrema(xm,am,[la,lx,-lx*la])[0];
 const lower2=linearExtrema(xm,am,[ua,ux,-ux*ua])[0];
 const upper1=linearExtrema(xm,am,[la,ux,-ux*la])[1];
 const upper2=linearExtrema(xm,am,[ua,lx,-lx*ua])[1];
 return [Math.max(lower1,lower2),Math.min(upper1,upper2)];
}
// Independent envelopes for XA and YA conservatively bound E[X]-E[XA]+E[YA].
function variableBlend(xr,xm,yr,ym,ar,am){
 if(xr[0]===xr[1]&&xm[0]===xm[1]&&yr[0]===yr[1]&&ym[0]===ym[1]&&ar[0]===ar[1]&&am[0]===am[1]){const v=xr[0]*(1-ar[0])+yr[0]*ar[0];return {range:singleton(v),mean:singleton(v)};}
 if(yr[0]===yr[1]&&ym[0]===ym[1])return constantBlend(xr,xm,ar,am,yr[0]);
 const p1=productMean(xr,xm,ar,am),p2=productMean(yr,ym,ar,am);
 const mean=pad(xm[0]-p1[1]+p2[0],xm[1]-p1[0]+p2[1]);
 const vals=[];for(const x of xr)for(const y of yr)for(const a of ar)vals.push(x*(1-a)+y*a);
 const range=pad(Math.min(...vals),Math.max(...vals));return {range,mean:intersect(mean,range)};
}
export function baseMean(color,forest){if(!Array.isArray(color)||color.length<3||color.slice(0,3).some(x=>!Number.isFinite(x)||x<0||x>1)||!Number.isFinite(forest)||forest<0||forest>1)throw Error('Invalid mean base');return s=>{if(!validState(s))return false;for(let c=0;c<3;c++){exact(s,BASE+c,color[c]);exact(s,FINAL+c,color[c]);}exact(s,3,1);return exact(s,FOREST,forest);};}
export function scratchMean(value){if(!Number.isFinite(value)||value<0||value>1)throw Error('Invalid mean scratch');return s=>validState(s)&&exact(s,SCRATCH,value);}
export function editMean(mode){if(!['clear','thin','dense'].includes(mode))throw Error('Unknown density edit');return s=>{if(!validState(s)||s.range[SCRATCH][0]!==s.range[SCRATCH][1])return false;const f=mode==='clear'?x=>0:mode==='thin'?x=>x*.3:x=>Math.min(1,x+.5);return exact(s,SCRATCH,f(s.range[SCRATCH][0]));};}
export function legacyPartMean(opacity){if(!Number.isFinite(opacity)||opacity<0||opacity>1)throw Error('Invalid legacy opacity');return s=>{if(!validState(s)||s.range[SCRATCH][0]!==s.range[SCRATCH][1])return false;return exact(s,SCRATCH,Math.round((opacity+s.range[SCRATCH][0]*(1-opacity))*255)/255);};}
function featureFor(region,triangle){if(!region?.varying)return {kind:'constant'};const f=region.featureOnTriangle?.(triangle);if(f&&['constant','affine','point'].includes(f.kind))return f;if(region.polynomialDegreeOnTriangle?.(triangle)===1||region.polynomialDegree===1)return {kind:'affine'};return undefined;}
function boundsAt(center,hessian,reach,extra=0){const e=hessian*reach*reach/2+extra+64*Number.EPSILON;return [Math.max(0,center-e),Math.min(1,center+e)];}
export function coverMean(color,region,radius){if(!Array.isArray(color)||color.length<3||color.slice(0,3).some(x=>!Number.isFinite(x)||x<0||x>1)||!region||!Number.isFinite(radius)||radius<0||(region.varying&&radius===0))throw Error('Invalid mean cover');return (s,triangle,point)=>{
 if(!validState(s)||!Array.isArray(triangle)||triangle.length!==3||triangle.some(p=>!Number.isFinite(p?.x)||!Number.isFinite(p?.y))||!point||!Number.isFinite(point.x)||!Number.isFinite(point.y)||typeof region.fade!=='function')return false;
 const feature=featureFor(region,triangle)??{kind:'unknown'};
 const reach=Math.max(...triangle.map(p=>Math.hypot(p.x-point.x,p.y-point.y)));
 const guard=feature.kind==='constant'?0:64*Number.EPSILON*Math.max(1,...triangle.flatMap(p=>[Math.abs(p.x),Math.abs(p.y)]),Math.abs(point.x),Math.abs(point.y))/radius;
 const t=region.fade(point);if(!Number.isFinite(t)||t<0||t>1)return false;
 let tr,tm;if(feature.kind==='constant'){tr=tm=singleton(t);}else {tr=[Math.max(0,t-reach/radius-guard),Math.min(1,t+reach/radius+guard)];tm=feature.kind==='affine'?boundsAt(t,0,reach,guard):feature.kind==='unknown'?tr:boundsAt(t,1/(radius*Math.max(feature.minDistance,Number.MIN_VALUE)),reach,guard);}
 const alpha=x=>.78*x*x*(3-2*x), ar=pad(alpha(tr[0]),alpha(tr[1]));
 const ah=feature.kind==='constant'?0:4.68/(radius*radius);const av=alpha(t),ag=feature.kind==='constant'?0:1.17*guard,am=feature.kind==='affine'?boundsAt(av,ah,reach,ag):feature.kind==='point'?boundsAt(av,ah+1/(radius*Math.max(feature.minDistance,Number.MIN_VALUE)),reach,ag):feature.kind==='unknown'?ar:singleton(av);
 for(let c=0;c<3;c++){const z=constantBlend(s.range[BASE+c],s.mean[BASE+c],ar,am,color[c]);if(!z)return false;s.range[BASE+c]=z.range;s.mean[BASE+c]=z.mean;s.range[FINAL+c]=z.range;s.mean[FINAL+c]=z.mean;}
 // Density edits are partitioned into constant arrangement faces. A varying
 // scratch channel has no supported mean through the nonlinear density clamp.
 if(s.range[SCRATCH][0]!==s.range[SCRATCH][1])return false;
 const target=Math.min(1,s.range[SCRATCH][0]/.8);
 const forest=constantBlend(s.range[FOREST],s.mean[FOREST],tr,tm,target);
 if(!forest?.mean)return false;s.range[FOREST]=forest.range;s.mean[FOREST]=forest.mean;return true;
};}
export function pigmentMean(color,operation,getAlpha){if(!Array.isArray(color)||color.length<3||color.slice(0,3).some(x=>!Number.isFinite(x)||x<0||x>1)||!['paint','erase'].includes(operation)||typeof getAlpha!=='function')throw Error('Invalid mean pigment');return (s,triangle,point)=>{
 if(!validState(s))return false;const a=getAlpha(s,triangle,point);if(!a||!validPair(a.range)||!validPair(a.mean))return false;const ar=a.range,am=a.mean,updates=[];
 for(let c=0;c<3;c++){const targets=operation==='paint'?[[PIGMENT+c,color[c]],[FINAL+c,color[c]]]:[[PIGMENT+c,0]];for(const [i,y] of targets){const z=constantBlend(s.range[i],s.mean[i],ar,am,y);if(!z)return false;updates.push([i,z]);}
 if(operation==='erase'){const z=variableBlend(s.range[FINAL+c],s.mean[FINAL+c],s.range[BASE+c],s.mean[BASE+c],ar,am);if(!z?.mean)return false;updates.push([FINAL+c,z]);}}
 const az=constantBlend(s.range[ALPHA],s.mean[ALPHA],ar,am,operation==='paint'?1:0);if(!az)return false;updates.push([ALPHA,az]);for(const [i,z] of updates){s.range[i]=z.range;s.mean[i]=z.mean;}return true;
};}
