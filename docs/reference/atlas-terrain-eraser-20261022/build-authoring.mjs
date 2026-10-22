import {build} from 'esbuild';import {readFileSync} from 'node:fs';
await build({entryPoints:['tools/test-desktop-world-authoring.mjs'],bundle:true,packages:'external',platform:'node',format:'esm',outfile:'.build/world-authoring-eraser-study.mjs',plugins:[{name:'coast-composition',setup(b){b.onLoad({filter:/test-desktop-world-authoring\.mjs$/},args=>{
 let source=readFileSync(args.path,'utf8');
 source=source.replace('  await land(420000, 1500);',`  await page.locator('#atlas-view').click();
  await page.locator('#land-grid').uncheck();
  await page.locator('#atlas-view').click();
  // Deliberate bays and offshore islets on the existing western continent.
  await land(220000,2500,'lower');
  for(const points of [[[.12,.22],[.26,.25]],[[.12,.59],[.26,.56]],[[.83,.42],[.72,.44]],[[.77,.73],[.67,.69]]])await stroke(points,300);
  await land(95000,950);
  for(const point of [[.10,.34],[.14,.39],[.11,.46],[.83,.59]])await stroke([point,point],280);
  await land(90000,6500);`);
 source=source.replace('  await record("04-continental-forest");',`  await setBrushWorldRadius(page,'land-radius',260000);
  await stroke([[.57,.39],[.63,.36]],350);
  await stroke([[.57,.56],[.63,.61]],350);
  await page.locator('[data-tool-select="land-tool"][data-tool-value="vegetation-erase"]').first().click();
  await setBrushWorldRadius(page,'land-radius',160000);
  await stroke([[.50,.47],[.56,.48]],300);
  await record("04-continental-forest");`);
 source=source.replace('  await native.fail(error);', `  await writeFile(out+'/failure-status.json',JSON.stringify(await page.evaluate(()=>Array.from(document.querySelectorAll('#atlas-save-status,#land-status,#territory-status,.atlas-workspace-status,[data-error]')).map(n=>({id:n.id,text:n.textContent,title:n.title,html:n.outerHTML}))),null,2));
  await native.fail(error);`);
 return{contents:source,loader:'js'};
});}}]});
