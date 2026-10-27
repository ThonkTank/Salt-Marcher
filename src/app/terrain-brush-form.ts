import type {Point} from './contracts';
import {terrainRoughness} from './terrain-relief';
export interface TerrainBrushField {segments:number;amount(p:Point):number;amountSteps(p:Point):Generator<void,number>}
function complete<T>(steps:Generator<void,T>):T{let next=steps.next();while(!next.done)next=steps.next();return next.value;}


function* brushPath(stroke:{radius:number;samples:readonly Point[]}):Generator<void,Point[]>{
  const radius=stroke.radius,points:Point[]=[];
  let visited=0;for(const p of stroke.samples){if((++visited&63)===0)yield;
    const b=points.at(-1);if(b&&b.x===p.x&&b.y===p.y)continue;
    const a=points.at(-2);
    if(a&&b){const ux=b.x-a.x,uy=b.y-a.y,vx=p.x-b.x,vy=p.y-b.y;
      if(ux*vx+uy*vy>=0&&Math.abs(ux*vy-uy*vx)<=1e-10*radius*Math.hypot(ux+vx,uy+vy))points.pop();}
    points.push(p);
  }
  return points;
}

/** One swept field for local image and writer. Time and input density do not
 * create extra mountains. The gesture supplies the backbone; spaced,
 * seeded descending spurs subdivide its slopes. All detail is world anchored.
 * This graph is an internal form description, never an editable author object. */
export function* mountainBrushFieldSteps(stroke:{radius:number;strength:number;seed?:number;samples:readonly Point[]}):Generator<void,TerrainBrushField>{
  const radius=stroke.radius,seed=stroke.seed??0,points=yield* brushPath(stroke);
  const noise=(p:Point,scale:number,salt:number)=>terrainRoughness(p.x/radius*scale,p.y/radius*scale,(seed^salt)>>>0);
  const random=(index:number,salt:number)=>{
    let h=Math.imul(index^seed^salt,374761393);h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967295;
  };
  const distance=(p:Point,a:Point,b:Point)=>{
    const dx=b.x-a.x,dy=b.y-a.y,length=dx*dx+dy*dy;
    const t=length?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/length)):0;
    return {d:Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy),t};
  };
  const path:{a:Point;b:Point;start:number;length:number}[]=[];
  let arc=0;
  for(let i=0;i<points.length;i++){if((i&63)===0)yield;
    const a=points[Math.max(0,i-1)]!,b=points[i]!,length=Math.hypot(b.x-a.x,b.y-a.y);
    path.push({a,b,start:arc,length});arc+=length;
  }
  function* closest(p:Point):Generator<void,number>{
    let d=Infinity,i=0;
    for(const segment of path){if((++i&63)===0)yield;d=Math.min(d,distance(p,segment.a,segment.b).d);}
    return d/radius;
  };
  const peak=(s:number)=>{
    const octave=(s:number,salt:number)=>{const i=Math.floor(s),t=s-i,w=t*t*(3-2*t);return random(i,salt)*(1-w)+random(i+1,salt)*w;};
    return .3+.75*octave(s*.9,719)+.15*octave(s*2.7,1013);
  };
  const spurs:{a:Point;b:Point;start:number;end:number;width:number;height:number}[]=[];
  let traveled=0,next=0,index=0;
  const branch=(a:Point,dx:number,dy:number,along=0)=>{
    for(const side of [-1,1]){
      const salt=index*2+(side+1)/2,length=radius*(.65+.32*random(salt,17)),lean=-.2+.8*random(salt,43);
      const x=(-dy*side+dx*lean),y=(dx*side+dy*lean),n=Math.hypot(x,y);
      const mid={x:a.x+x/n*length*.48,y:a.y+y/n*length*.48};
      const end={x:mid.x+(-dy*side-dx*.2)*length*.52,y:mid.y+(dx*side-dy*.2)*length*.52};
      const height=(.6+.25*random(salt,97))*peak(along/radius),width=radius*(.3+.16*random(salt,139));
      spurs.push({a,b:mid,start:0,end:.48,width,height},{a:mid,b:end,start:.48,end:1,width:width*.75,height});
    }
    index++;
  };
  if(points.length===1){const angle=random(0,211)*2*Math.PI;branch(points[0]!,Math.cos(angle),Math.sin(angle));}
  for(let i=1;i<points.length;i++){if((i&63)===0)yield;
    const a=points[i-1]!,b=points[i]!,length=Math.hypot(b.x-a.x,b.y-a.y);
    if((traveled+length)/radius>2000)throw Error('Höhenzug zu lang. In kürzeren Zügen bearbeiten.');
    while(next<=traveled+length){if((index&63)===0)yield;const t=(next-traveled)/length;branch({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t},(b.x-a.x)/length,(b.y-a.y)/length,next);next+=radius*(.55+.55*random(index,257));}
    traveled+=length;
  }
  function* amount(p:Point):Generator<void,number>{
    let work=0;
    const d=yield* closest(p);if(d>=1)return 0;
    const width=.76+.24*noise(p,.25,13),edge=d/width;if(edge>=1)return 0;
    const rim=(1-edge*edge)**2;
    const warped={x:p.x+radius*.24*(noise(p,.18,31)-.5),y:p.y+radius*.24*(noise(p,.18,71)-.5)};
    const spineWidth=.8+.14*noise(p,.3,317);
    let spine=0;
    // Each segment contributes a continuous modulated ridge. Their upper
    // envelope joins bends, returns and crossings without selecting an
    // unrelated arc position when the closest segment changes.
    for(const segment of path){
      if((++work&63)===0)yield;const q=distance(warped,segment.a,segment.b);
      const profile=Math.max(0,1-q.d/radius/spineWidth)**1.35;
      spine=Math.max(spine,profile*peak((segment.start+q.t*segment.length)/radius));
    }
    let ribs=0;
    for(const spur of spurs){
      if((++work&63)===0)yield;const q=distance(p,spur.a,spur.b),t=spur.start+(spur.end-spur.start)*q.t;
      const width=spur.width*(1-.35*t),profile=Math.max(0,1-q.d/width)**1.4;
      ribs=Math.max(ribs,spur.height*(1-t)**.8*profile);
    }
    const crest=Math.max(spine,ribs)+.18*Math.min(spine,ribs);
    const ridge=(scale:number,salt:number)=>(1-Math.abs(2*noise(p,scale,salt)-1))**3;
    const erosion=.76+.17*ridge(.65,479)+.07*ridge(1.6,887);
    // The soft foundation connects saddles and spurs. Value and slope vanish
    // at the footprint boundary; a second gesture adds one continuous field.
    return stroke.strength*rim*(.055+.945*crest*erosion);
  }
  return{segments:Math.max(1,points.length-1)+spurs.length,amount:(p:Point)=>complete(amount(p)),amountSteps:amount};
}

export function mountainBrushField(stroke:Parameters<typeof mountainBrushFieldSteps>[0]):TerrainBrushField{return complete(mountainBrushFieldSteps(stroke));}

/** Rounded, irregularly distributed world-space hills. Ellipses overlap with
 * zero value and slope at their edges. The swept mask blends them into the
 * existing terrain, independently of time, dabs and collinear subdivisions. */
export function* hillsBrushFieldSteps(stroke:{radius:number;strength:number;seed?:number;samples:readonly Point[]}):Generator<void,TerrainBrushField>{
  const radius=stroke.radius,seed=stroke.seed??0,points=yield* brushPath(stroke);
  const random=(x:number,y:number,salt:number)=>{
    let h=Math.imul(x^seed^salt,374761393)^Math.imul(y,668265263);
    h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967295;
  };
  const cells=new Map<string,{x:number;y:number;cos:number;sin:number;rx:number;ry:number;height:number}>();
  const hill=(x:number,y:number)=>{
    const key=x+','+y;let h=cells.get(key);if(h)return h;
    const angle=random(x,y,23)*Math.PI*2;
    h={x:(x+.1+.8*random(x,y,71))*.7,y:(y+.1+.8*random(x,y,139))*.7,
      cos:Math.cos(angle),sin:Math.sin(angle),rx:.43+.36*random(x,y,211),ry:.36+.30*random(x,y,317),height:.45+.65*random(x,y,479)};
    cells.set(key,h);return h;
  };
  function* amount(p:Point):Generator<void,number>{
    let work=0;
    let distance=Infinity;
    for(let i=0;i<points.length;i++){if((++work&63)===0)yield;
      const a=points[Math.max(0,i-1)]!,b=points[i]!,dx=b.x-a.x,dy=b.y-a.y,length=dx*dx+dy*dy;
      const t=length?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/length)):0;
      distance=Math.min(distance,Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy)/radius);
    }
    if(distance>=1)return 0;
    // Keep a broad interior for several lateral hills; only the outside fades.
    const edge=Math.min(1,(1-distance)/.42),mask=edge*edge*(3-2*edge);
    const x=p.x/radius,y=p.y/radius,cx=Math.floor(x/.7),cy=Math.floor(y/.7);
    let relief=0;
    for(let j=cy-2;j<=cy+2;j++)for(let i=cx-2;i<=cx+2;i++){
      const h=hill(i,j),dx=x-h.x,dy=y-h.y;
      const q=((dx*h.cos+dy*h.sin)/h.rx)**2+((-dx*h.sin+dy*h.cos)/h.ry)**2;
      if(q<1)relief+=h.height*(1-q)**3;
    }
    const rolling=.055+.045*terrainRoughness(x*.7,y*.7,(seed^887)>>>0);
    return stroke.strength*mask*(rolling+relief);
  }
  return{segments:Math.max(1,points.length-1),amount:(p:Point)=>complete(amount(p)),amountSteps:amount};
}

export function hillsBrushField(stroke:Parameters<typeof hillsBrushFieldSteps>[0]):TerrainBrushField{return complete(hillsBrushFieldSteps(stroke));}

/** A swept incision with a narrow continuous bed, steep uneven walls and a
 * soft outer shoulder. Only negative relative height is authored: the existing
 * sea plane reveals the cut without a river object or a second water model.
 * World-space variation shapes the walls rather than repeating event stamps. */
export function* canyonBrushFieldSteps(stroke:{radius:number;strength:number;seed?:number;samples:readonly Point[]}):Generator<void,TerrainBrushField>{
  const radius=stroke.radius,seed=stroke.seed??0,points=yield* brushPath(stroke),blend=.4;
  const erf=(x:number)=>{const t=1/(1+.3275911*Math.abs(x));return Math.sign(x)*(1-(((((1.061405429*t-1.453152027)*t+1.421413741)*t-.284496736)*t+.254829592)*t)*Math.exp(-x*x));};
  const noise=(p:Point,scale:number,salt:number)=>terrainRoughness(p.x/radius*scale,p.y/radius*scale,(seed^salt)>>>0);
  const smooth=(v:number)=>{const t=Math.max(0,Math.min(1,v));return t*t*(3-2*t);};
  function* amount(p:Point):Generator<void,number>{
    let work=0;
    const warped={x:p.x+radius*.45*(noise(p,.19,31)-.5),y:p.y+radius*.45*(noise(p,.19,71)-.5)};
    let weight=0,footprint=Infinity;
    for(let i=points.length===1?0:1;i<points.length;i++){if((++work&63)===0)yield;
      const a=points[Math.max(0,i-1)]!,b=points[i]!,dx=b.x-a.x,dy=b.y-a.y,length=dx*dx+dy*dy;
      const t=length?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/length)):0;
      footprint=Math.min(footprint,Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy)/radius);
      if(length){
        const span=Math.sqrt(length),along=((warped.x-a.x)*dx+(warped.y-a.y)*dy)/(span*radius);
        const across=((warped.x-a.x)*dy-(warped.y-a.y)*dx)/(span*radius),unit=1/(Math.SQRT2*blend);
        // Analytic Gaussian line integral: overlap widens the incision, while
        // adding shorter curved input segments cannot add another full field.
        weight+=Math.max(0,.5*Math.exp(-across*across/(2*blend*blend))*(erf((span/radius-along)*unit)-erf(-along*unit)));
      }
    }
    if(footprint>=1)return 0;
    const first=points[0]!,last=points.at(-1)!;
    if(points.length<3||first.x!==last.x||first.y!==last.y)for(const end of [first,last]){
      const d=Math.hypot(warped.x-end.x,warped.y-end.y)/radius;weight+=.5*Math.exp(-d*d/(2*blend*blend));
    }
    const distance=blend*Math.sqrt(Math.max(0,-2*Math.log(Math.max(1e-300,weight))));
    const width=.46+.44*smooth((noise(p,.24,139)-.25)/.5)+.04*noise(p,1.7,317),q=distance/width;
    const bed=.075+.055*noise(p,.5,479),wallEnd=.55+.2*noise(p,1.1,887);
    // A connected floor survives bends, crossings and wide back-and-forth
    // painting. Broad shoulders meet the source with zero value and slope.
    const shoulderWidth=.7+.24*smooth((noise(p,.24,197)-.25)/.5);
    const shoulder=Math.max(0,1-(distance/shoulderWidth)**2)**2,wall=1-smooth((q-bed)/(wallEnd-bed));
    const depth=.72+.28*smooth((noise(p,.16,1013)-.25)/.5);
    return -stroke.strength*depth*(.3*shoulder+.7*wall)*(1-smooth((footprint-.88)/.12));
  }
  return{segments:Math.max(1,points.length-1),amount:(p:Point)=>complete(amount(p)),amountSteps:amount};
}

export function canyonBrushField(stroke:Parameters<typeof canyonBrushFieldSteps>[0]):TerrainBrushField{return complete(canyonBrushFieldSteps(stroke));}

/** The only form dispatch, shared by the local image and canonical writer. */
export function terrainBrushForm(stroke:{form?:'mountain'|'hills'|'canyon';radius:number;strength:number;seed?:number;samples:readonly Point[]}){
  return complete(terrainBrushFormSteps(stroke));
}

export function* terrainBrushFormSteps(stroke:Parameters<typeof terrainBrushForm>[0]):Generator<void,TerrainBrushField>{
 return yield* (stroke.form==='canyon'?canyonBrushFieldSteps(stroke):stroke.form==='hills'?hillsBrushFieldSteps(stroke):mountainBrushFieldSteps(stroke));
}
