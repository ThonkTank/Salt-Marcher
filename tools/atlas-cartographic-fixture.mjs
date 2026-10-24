import {buildSync} from 'esbuild';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';

/** One authored landscape, refined locally without camera-dependent generation. */
export function createCartographicFixture(profile,{bridge=false}={}){
 const require=createRequire(import.meta.url);
 buildSync({stdin:{resolveDir:process.cwd(),contents:"export {CampaignStore} from './src/app/storage/store';export {heightRecord} from './src/app/terrain-height';export {vegetationSpec} from './src/app/vegetation';export {routeSpec} from './src/app/terrain-route';"},outfile:'.build/cartographic-fixture.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
 const {CampaignStore,heightRecord,vegetationSpec,routeSpec}=require('../.build/cartographic-fixture.cjs');
 const store=new CampaignStore(profile+'/workbench.sqlite'),campaign=store.create('Waldpass und Brückendorf'),token=store.activate(campaign.id).token;
 const write=action=>store.executeAtlasCommit({commandId:randomUUID(),campaignId:campaign.id,token,action});
 const polygon=points=>({outer:points.map(([x,y])=>({x,y})),holes:[]});
 const rect=(x,y,w,h)=>polygon([[x,y],[x+w,y],[x+w,y+h],[x,y+h]]);
 const shape=(id,kind,polygons,extra={})=>({id,kind,revision:0,name:id,points:[],polygons,resolution:1,width:0,values:{},...extra});
 const height=(x,y)=>{
  const land=180*(1-(x/380000)**2-(y/270000)**2);
  const ridge=2100*Math.exp(-1*((y+52000+18000*Math.sin(x/45000))/16000)**2-(x/170000)**2);
  const pass=1-.82*Math.exp(-1*((x+18000)/14000)**2);
  const island=500*Math.exp(-1*((x-410000)/16000)**2-((y-70000)/26000)**2);
  return Math.max(-120,land+ridge*pass+island)+12*Math.exp(-1*((x+200)/160)**2-((y+180)/180)**2);
 };
 try{
  const records=[];
  for(const pixel of [16384,1024,64,4])for(let ty=-2;ty<2;ty++)for(let tx=-2;tx<2;tx++){
   const x=tx*64*pixel,y=ty*64*pixel;
   records.push(heightRecord(x,y,pixel,Float32Array.from({length:4096},(_,i)=>height(x+i%64*pixel,y+Math.floor(i/64)*pixel))));
  }
  const wood=polygon([[-160000,-22000],[-50000,-40000],[90000,-12000],[150000,58000],[20000,105000],[-120000,75000]]);
  wood.holes=[rect(-1200,-800,2400,1600).outer];
  records.push(shape('Großer Wald','vegetation',[wood],{resolution:256,values:{terrain:'forest'},vegetation:vegetationSpec('conifer',74)}));
  const local=polygon([[-1000,-650],[900,-550],[1100,300],[600,800],[-800,650]]);
  local.holes=[rect(-90,-65,210,130).outer,rect(-470,-250,160,110).outer];
  records.push(shape('Dorfwald','vegetation',[local],{values:{terrain:'forest'},vegetation:vegetationSpec('deciduous',31)}));
  records.push(shape('Schmaler Waldsaum','vegetation',[rect(-500,900,1500,12)],{values:{terrain:'forest'},vegetation:{...vegetationSpec('deciduous',9),preset:{...vegetationSpec().preset,edge:0}}}));
  for(const [id,kind,width,points] of [
   ['Talfluss','river',24,[[70,-300000],[130,-70000],[70,-600],[95,0],[150,650],[50000,230000]]],
   ['Passstraße','road',8,[[-18000,-75000],[-12000,-40000],[-400,-300],[0,0],[400,0],[12000,6000]]],
   ['Dorfpfad','road',2,[[-200,-250],[-100,-80],[0,0],[-60,100]]]
  ])records.push(shape(id,kind,[],{width,points:points.map(([x,y])=>({x,y})),style:width===2?'path':kind}));
  write({kind:'landscape-batch',records:records.map(record=>({record,expectedRevision:null}))});
  if(bridge){
   const anchors=[{x:40,y:0},{x:150,y:0}],route={...routeSpec('road',anchors),sections:['bridge']};
   write({kind:'landscape-route',record:shape('Dorfbrücke','road',[],{width:10,points:anchors,route}),expectedRevision:null});
   const planned=store.atlasLandscapeObject(token,'Dorfbrücke');
   if(!planned.route.nodes.some(n=>n.structure==='bridge'))throw Error('Reference bridge was not planned');
  }
  const cityId=write({kind:'city-create',name:'Brückendorf',x:-100,y:-80,width:240,height:160}).result.id;
  const units=Array.from({length:8},(_,i)=>({id:'cartographic-house-'+i,kind:'building',name:i===0?'Taverne':'Haus '+i,protected:true,position:{x:-60+(i%4)*35,y:i<4?-30:35},angle:0,outline:[{x:-7,y:-5},{x:7,y:-5},{x:7,y:5},{x:-7,y:5}],notes:'',residentIds:[],workerIds:[],terrain:{mode:'ground',offsetM:0,wallM:4,roofM:2}}));
  const command={commandId:randomUUID(),campaignId:campaign.id,token,cityId,expectedRevision:store.city(token,cityId).header.revision,action:{kind:'change',upsert:units,remove:[],label:'Vergleichsdorf'}};
  store.executeAtlasCommit({commandId:command.commandId,campaignId:campaign.id,token,action:{kind:'city',command}});
  store.tutorial('skipped');return {campaignId:campaign.id,name:campaign.name,records:records.length,cityId,bridge};
 }finally{store.close();}
}
