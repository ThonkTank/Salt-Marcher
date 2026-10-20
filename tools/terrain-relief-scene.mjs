// Fixed author gestures, also replayed through the canonical writer in native QA.
const stroke=(mode,radius,strength,points,extra={})=>({mode,radius,strength,feather:.9,roughness:0,seed:87431,samples:points.map(([x,y,t])=>({x,y,t})),...extra});
export const RELIEF_STROKES=[
  stroke('raise',4200,8000,[[-2600,0,0],[2600,0,1200]],{targetM:130,feather:.65}),
  stroke('raise',1500,1700,[[-3800,-900,0],[-2200,-1500,1200],[-500,-700,2400],[1300,-1200,3600],[2900,-600,4800]],{roughness:.9}),
  stroke('raise',1000,1500,[[-2100,-1400,0],[-1100,300,1400],[0,900,2400]],{roughness:.7}),
  stroke('raise',1500,3000,[[2800,1600,0],[3400,1600,1000]],{targetM:650,feather:.5}),
  stroke('lower',700,1800,[[-2600,1000,0],[-1000,1400,1000],[500,700,2000],[2300,400,3000]],{targetM:140}),
  stroke('lower',500,2500,[[-900,-1600,0],[-700,-700,900],[-500,200,1800]],{targetM:310}),
  stroke('smooth',420,600,[[-900,-1500,0],[-700,-700,800],[-500,100,1600]]),
];
export function sculptRelief(applyTerrainBrush){
  let records=[];
  for(const stroke of RELIEF_STROKES){const changed=applyTerrainBrush(records,stroke),ids=new Set(changed.map(r=>r.id));records=[...records.filter(r=>!ids.has(r.id)),...changed];}
  return records;
}
export const RELIEF_VIEWS={
  continent:{x:-16000,y:-11000,width:32000,height:22000},
  region:{x:-7400,y:-4600,width:14800,height:9200},
  place:{x:-2000,y:-2100,width:3000,height:1900},
};
