import {test} from 'node:test';
import {deflateSync,inflateSync} from 'fflate';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
import {createRequire} from 'node:module';
buildSync({stdin:{resolveDir:process.cwd(),contents:"export * from './src/app/vegetation-projection';export * from './src/app/atlas-spatial-vegetation';export * from './src/app/vegetation';export * from './src/app/vegetation-view';export * from './src/app/atlas-paint';export * as THREE from 'three';"},outfile:'.build/vegetation-projection-test.cjs',bundle:true,platform:'node',format:'cjs'});
const {compactVegetation,vegetationInstances,AtlasSpatialVegetation,vegetationSpec,drawVegetation,atlasPaint,THREE}=createRequire(import.meta.url)('../.build/vegetation-projection-test.cjs');
const plant=(n=0)=>({id:'tree:'+n,asset:['oak','pine','rock','shrub','grass'][n%5],x:n*11.625,y:n*12.1875,z:50.123456789,size:14.123456789,angle:n/11,normal:{x:.123456789,y:-.0623456789,z:.9987654321}});
const view=()=>({mode:'individual',instances:Array.from({length:100},(_,n)=>plant(n))});
test('JSON transport preserves distant doubles, order, protected metadata and decode identity',()=>{
 const v=view();for(const [n,i]of v.instances.entries()){i.x+=1e12;i.y-=1e12;if(n===0)i.angle=-0;}
 v.instances.push({...plant(100),protected:true,conflict:false,locationId:'örtlicher-baum',removed:false});
 const before=structuredClone(v),packed=compactVegetation(v);assert(packed.packed);
 const received=JSON.parse(JSON.stringify(packed)),decoded=vegetationInstances(received);
 assert.deepEqual(decoded,v.instances);assert.strictEqual(vegetationInstances(received),decoded);assert.deepEqual(v,before);
 assert(Buffer.byteLength(JSON.stringify(packed))<Buffer.byteLength(JSON.stringify(v))*.65);
});
test('small previews and extension fields keep their original representation',()=>{
 const small={mode:'surface',instances:[{...plant(),protected:true}]};assert.strictEqual(compactVegetation(small),small);assert.strictEqual(vegetationInstances(small),small.instances);
 const v=view();v.instances[40].custom='retained';const packed=compactVegetation(v);assert.equal(packed.packed.ids.length,40);assert.deepEqual(vegetationInstances(JSON.parse(JSON.stringify(packed))),v.instances);
 assert.deepEqual(vegetationInstances(undefined),[]);
});
test('invalid compact payloads fail instead of publishing displaced or missing geometry',()=>{
 const good=compactVegetation(view());
 for(const mutate of [p=>p.packed.version=2,p=>p.packed.ids.pop(),p=>p.packed.ids[0]=7,p=>p.packed.data=p.packed.data.slice(1),p=>p.packed.data='!'.repeat(p.packed.data.length),p=>p.tail=null,p=>{const b=inflateSync(Buffer.from(p.packed.data,'base64'));p.packed.data=Buffer.from(deflateSync(new Uint8Array(b.length+1000))).toString('base64');},
 p=>{const b=inflateSync(Buffer.from(p.packed.data,'base64'));b[0]=255;p.packed.data=Buffer.from(deflateSync(b)).toString('base64');},
 p=>{const b=Buffer.from(inflateSync(Buffer.from(p.packed.data,'base64')));b.writeDoubleLE(NaN,1);p.packed.data=Buffer.from(deflateSync(b)).toString('base64');}]){
  const bad=structuredClone(good);mutate(bad);assert.throws(()=>vegetationInstances(bad),/Bewuchsdarstellung/);
 }
 const v=view();v.instances[0].x=Infinity;assert.throws(()=>compactVegetation(v),/Bewuchsdarstellung/);
});
test('compact projections produce the same instance matrices, selection IDs and flat scene',()=>{
 const v=view(),spec=vegetationSpec(),record={id:'wood',vegetation:spec,polygons:[],vegetationView:v},packed={...record,vegetationView:JSON.parse(JSON.stringify(compactVegetation(v)))};
 const surface={origin:{x:0,y:0},focusM:50,exaggeration:1},a=new AtlasSpatialVegetation([record],surface),b=new AtlasSpatialVegetation([packed],surface);
 try{
  assert.deepEqual(b.group.children.map(m=>Array.from(m.instanceMatrix.array)),a.group.children.map(m=>Array.from(m.instanceMatrix.array)));
  const camera=new THREE.PerspectiveCamera(45,1,.01,10000);camera.position.set(0,0,100);camera.lookAt(0,0,0);camera.updateMatrixWorld(true);
  const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2(0,0),camera);
  for(const g of [a,b]){g.group.updateMatrixWorld(true);for(const m of g.group.children)m.onBeforeRender({getSize:v=>v.set(1000,1000)});}
  assert.equal(a.hit(ray,['vegetation-trees'])?.data.vegetationInstance,'tree:0');assert.deepEqual(b.hit(ray,['vegetation-trees']),a.hit(ray,['vegetation-trees']));
  const box={x:0,y:0,width:1000,height:1000},x=atlasPaint('group'),y=atlasPaint('group');drawVegetation(x,record,box,.3);drawVegetation(y,packed,box,.3);assert.equal(JSON.stringify(y),JSON.stringify(x));
 }finally{a.dispose();b.dispose();}
});
