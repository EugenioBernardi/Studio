// Re-verify the shipped page actually runs. CLAUDE.md section 1 step 3: this has caught
// real divergence before, so it is not optional.
const {chromium}=require('playwright'); const fs=require('fs'),path=require('path');
const DIR='live', SHOT='shots'; fs.mkdirSync(SHOT,{recursive:true});
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const files=fs.readdirSync(DIR).filter(f=>f.endsWith('.html'));
 console.log('page'.padEnd(24)+'errs  canvas-ink  controls  verify-line');
 let bad=0;
 for(const f of files){
  const pg=await b.newPage({viewport:{width:1280,height:900}});
  const errs=[],logs=[];
  const netfail=[];
  pg.on('requestfailed',r=>netfail.push(r.url()));
  // Font-host requests cannot resolve in this sandbox. That is an environment fact, not a model
  // fault, so it is excluded — but the excluded URLs are printed so the exclusion stays honest.
  pg.on('console',m=>{ const t=m.text();
    if(m.type()==='error' && !/Failed to load resource/.test(t)) errs.push(t.slice(0,120)); logs.push(t); });
  pg.on('pageerror',e=>errs.push('PAGEERROR '+String(e).slice(0,120)));
  // the artifact publisher wraps the body; emulate that exactly
  const body=fs.readFileSync(path.join(DIR,f),'utf8');
  await pg.setContent('<!doctype html><html><head><meta charset="utf-8"></head><body>'+body+'</body></html>',{waitUntil:'load'});
  await pg.waitForTimeout(3500);
  // does any canvas actually have non-uniform pixels? a blank canvas means the model never drew.
  const ink=await pg.evaluate(()=>{
    const cs=[...document.querySelectorAll('canvas')]; let best=0;
    for(const c of cs){ try{
      const g=c.getContext('2d'); if(!g||!c.width||!c.height) continue;
      const d=g.getImageData(0,0,c.width,c.height).data; const seen=new Set();
      for(let i=0;i<d.length;i+=4*97) seen.add(d[i]+','+d[i+1]+','+d[i+2]);
      best=Math.max(best,seen.size);
    }catch(e){} }
    return best;});
  const ctrls=await pg.evaluate(()=>document.querySelectorAll('input,button,select').length);
  const vline=(logs.find(l=>/verify|PASS|FAIL/i.test(l))||'').slice(0,58);
  const nonFont=netfail.filter(u=>!/fonts\.(googleapis|gstatic)\.com/.test(u));
  const ok=errs.length===0 && ink>3 && nonFont.length===0;
  if(!ok) bad++;
  console.log(f.replace('.html','').padEnd(24)+String(errs.length).padStart(4)+String(ink).padStart(11)+String(ctrls).padStart(10)+'  '+vline+(ok?'':'   <-- PROBLEM'));
  for(const e of errs.slice(0,2)) console.log('      ! '+e);
  for(const u of nonFont.slice(0,2)) console.log('      ! non-font request failed: '+u);
  if(netfail.length) console.log('      (excluded '+netfail.length+' font-host request(s): '+[...new Set(netfail.map(u=>u.split('/')[2]))].join(', ')+')');
  await pg.screenshot({path:path.join(SHOT,f.replace('.html','.png'))});
  await pg.close();
 }
 await b.close();
 console.log(bad?('\n'+bad+' page(s) failed verification'):'\nall pages render and draw');
 process.exit(bad?1:0);
})();
