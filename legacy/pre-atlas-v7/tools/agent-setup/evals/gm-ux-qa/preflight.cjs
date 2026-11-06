const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs=require('fs');const path=require('path');const assert=require('assert/strict');
if(!process.argv[2])throw new Error('Usage: node preflight.cjs DISPOSABLE_OUTPUT_DIRECTORY');
const root=path.resolve(process.argv[2]);
if(fs.existsSync(path.join(root,'preflight.json')))throw new Error('Preflight already exists; preserve it and prepare a fresh trial directory.');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_EXECUTABLE,headless:true,chromiumSandbox:true});
 const results=[];
 try{
 for(const [name,mode] of [['01-session','fragmented'],['02-player-view','partial'],['03-limited-evidence','partial'],['04-working-session','ready']]){
  const context=await browser.newContext({viewport:{width:1100,height:900}});const page=await context.newPage();const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('file://'+path.join(root,'fixtures',name,'app.html'));
  await page.getByRole('button',{name:'Glockenhalle',exact:true}).click();
  assert.match(await page.locator('#gmText').inputValue(),/obsidianfarbenen Schlüssel/);
  const dir=path.join(root,'preflight',name);fs.mkdirSync(dir,{recursive:true});
  await page.screenshot({path:path.join(dir,'gm.png'),fullPage:true});
  const publicText='Eine stumme Bronzeglocke hängt über einem trockenen Brunnen. Auf dem Brunnenrand liegt eine silberne Feder.';
  await page.getByLabel('Beschreibung für die Spieler',{exact:true}).fill(publicText);
  if(mode==='fragmented'){
   await page.getByRole('button',{name:'Speichern',exact:true}).click();
   await page.getByRole('button',{name:'Spieleransicht',exact:true}).click();
   await page.getByRole('button',{name:'Glockenhalle zeigen',exact:true}).click();
  }else await page.getByRole('button',{name:'Spielern zeigen',exact:true}).click();
  const shown=await page.getByRole('region',{name:'Spieleransicht',exact:true}).innerText();
  const leaked=shown.includes('obsidianfarbenen Schlüssel');const fresh=shown.includes('silberne Feder');
  assert.equal(leaked,mode==='partial');assert.equal(fresh,mode!=='partial');
  await page.screenshot({path:path.join(dir,'projection.png'),fullPage:true});
  if(name.startsWith('03')){
   for(const variant of ['alpha','beta']){
    const dest=path.join(root,'runs',variant,name,'source-evidence');fs.mkdirSync(dest,{recursive:true});
    for(const f of ['gm.png','projection.png'])fs.copyFileSync(path.join(dir,f),path.join(dest,f));
   }
  }
  await page.getByRole('button',{name:'Zur Spielleitung',exact:true}).click();
  const contextPreserved=await page.locator('h2').innerText()==='Glockenhalle';
  assert.equal(contextPreserved,mode!=='partial');
  assert.deepEqual(errors,[]);results.push({case:name,leaked,fresh,contextPreserved,scriptErrors:errors});await context.close();
 }
 fs.writeFileSync(path.join(root,'preflight.json'),JSON.stringify(results,null,2)+'\n');console.log(JSON.stringify(results,null,2));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
