/** Versioned cartographic vocabulary shared by city and landscape tools. */
export const lineTypes = [
  {id:'trail',name:'Wanderpfad',kind:'road',width:1.5,rank:0,pattern:'dots',color:'#a37e51'},
  {id:'bridleway',name:'Reitweg',kind:'road',width:2.5,rank:0,pattern:'dashes',color:'#a37e51'},
  {id:'cart-track',name:'Karrenweg',kind:'road',width:3,rank:1,pattern:'tracks',color:'#a37e51'},
  {id:'alley',name:'Gasse',kind:'road',width:3,rank:0,pattern:'plain',color:'#c1ae8b'},
  {id:'side-street',name:'Nebenstraße',kind:'road',width:5,rank:1,pattern:'edge',color:'#c1ae8b'},
  {id:'street',name:'Straße',kind:'road',width:7,rank:2,pattern:'edge',color:'#dfcfad'},
  {id:'avenue',name:'Allee',kind:'road',width:14,rank:2,pattern:'avenue',color:'#dfcfad'},
  {id:'country-road',name:'Landstraße',kind:'road',width:8,rank:2,pattern:'edge',color:'#c6a66c'},
  {id:'trade-road',name:'Handelsstraße',kind:'road',width:10,rank:3,pattern:'double-edge',color:'#dfcfad'},
  {id:'rill',name:'Rinnsal',kind:'river',width:.5,rank:0,pattern:'water',color:'#7fa8bd'},
  {id:'brook',name:'Bach',kind:'river',width:2,rank:1,pattern:'water',color:'#7fa8bd'},
  {id:'river',name:'Fluss',kind:'river',width:12,rank:2,pattern:'bank',color:'#7fa8bd'},
  {id:'large-river',name:'Großer Fluss',kind:'river',width:40,rank:3,pattern:'bank',color:'#7fa8bd'},
  {id:'major-river',name:'Strom',kind:'river',width:150,rank:3,pattern:'bank',color:'#7fa8bd'},
  {id:'canal',name:'Kanal',kind:'river',width:8,rank:2,pattern:'bank',color:'#7fa8bd'},
] as const;
export type LineTypeId = typeof lineTypes[number]['id'];
export type LineType = typeof lineTypes[number];
export const lineType = (id:unknown):LineType|undefined => lineTypes.find(t=>t.id===id);
export const typeFor = (kind:'road'|'river',legacy?:string):LineType => lineType(kind==='road'?(legacy==='path'?'trail':'street'):(legacy==='stream'||legacy==='path'?'brook':'river'))!;
const smooth = (a:number,b:number,v:number) => {const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
export function lineScale(type:LineType,width:number,length:number,mpp:number,selected=false){
  if(!Number.isFinite(mpp)||mpp<0)throw Error('Darstellungsmaßstab prüfen.');
  if(!mpp)return {width,opacity:1,detail:true};
  const minimum=[1,1.25,1.75,2.25][type.rank]!;
  const limit=[4,16,64,Infinity][type.rank]!*Math.max(.5,Math.min(4,Math.sqrt(length/1000)));
  const scaleFade=Number.isFinite(limit)?1-smooth(limit*.75,limit*1.25,mpp):1;
  // The physical footprint smoothly takes precedence over symbol suppression.
  const physical=smooth(1,1.5,width/mpp);
  const opacity=selected?1:smooth(6,14,length/mpp)*Math.max(scaleFade,physical);
  return {width:Math.max(width,mpp*minimum),opacity,detail:width/mpp>=4};
}
