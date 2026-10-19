const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1180,height:800},deviceScaleFactor:1});
 const errors=[];
 page.on('pageerror',err=>errors.push(err.message));
 page.on('console',msg=>{if(msg.type()==='error')console.log('BROWSER_CONSOLE',msg.text())});
 await page.goto('http://localhost:8765',{waitUntil:'domcontentloaded',timeout:45000});
 await page.waitForFunction(()=>!!(window.mineralAppState&&window.MineralMorphology&&window.COD_CRYSTALS),{timeout:45000});
 const count=await page.evaluate(()=>Object.keys(window.COD_CRYSTALS).length);
 if(count!==22)throw Error('CIF verification count '+count+' (expected 22)');
 await page.locator('#compareTab').waitFor({timeout:40000});
 await page.locator('#compareTab').click();
 await page.waitForTimeout(1200);
 const state=await page.evaluate(()=>({
  mode:window.mineralAppState.get().mode,
  canvas:!!document.querySelector('#compareMount canvas'),
  display:getComputedStyle(document.getElementById('compareMount')).display,
  text:document.getElementById('structureProof').textContent
 }));
 console.log('MINERAL_LAB_SMOKE',JSON.stringify({count,...state,errors}));
 if(state.mode!=='compare'||!state.canvas||state.display==='none')throw Error('Compare mode failed');
 if(errors.length)throw Error('Browser JavaScript errors: '+errors.join(' ; '));
 await page.screenshot({path:'/tmp/mineral_lab_5_smoke.png'});
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
