// Convert a standalone app HTML into an artifact body: the publisher supplies
// <!doctype>/<html>/<head>/<body>, so those wrappers must come out while title,
// font links, styles, markup and scripts stay exactly as they are.
const fs=require('fs'), path=require('path');
const APPS='/home/user/Studio/apps';
const OUT='/tmp/claude-0/-home-user-Studio/3cdfb890-6e01-5c82-8912-c7f6ca73d67f/scratchpad/art/live';

const MAP=[
 {app:'kuramoto-assembly.html', slug:'kuramoto-assembly', title:'Clocks and Assemblies', status:null},
 {app:'basal-ganglia.html',     slug:'basal-ganglia',     title:'Goal-Directed Selection', status:null},
 {app:'cerebellum.html',        slug:'cerebellum',        title:'Cerebellar Adaptation', status:null},
 {app:'amygdala.html',          slug:'amygdala',          title:'Threat Conditioning', status:null},
 {app:'thalamocortical-3d.html',slug:'spindles-spike-wave',title:'Spindles and Spike-Wave', status:'record absent'},
 {app:'hippocampus-index-replay.html', slug:'index-and-replay', title:'Index and Replay', status:'record absent'},
 {app:'visual-cortex-streams.html', slug:'two-visual-streams', title:'Two Visual Streams', status:'record absent'},
 {app:'visual-cortex-pulvinar.html', slug:'higher-order-thalamus', title:'Higher-Order Thalamus', status:'negative result'},
 {app:'auditory-cortex.html',   slug:'cochlea-to-belt',   title:'Cochlea to Belt', status:'record absent'},
];

const NAVCSS=`
<style>
.mb-nav{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:11px;letter-spacing:.08em;
 text-transform:uppercase;display:flex;flex-wrap:wrap;gap:10px;align-items:center;
 padding:8px 14px;background:#0a0e17;border-bottom:1px solid rgba(120,150,200,.18);color:#7b8798}
.mb-nav a{color:#4FD1C5;text-decoration:none;border-bottom:1px solid transparent}
.mb-nav a:hover,.mb-nav a:focus-visible{border-bottom-color:#4FD1C5;outline:none}
.mb-nav .s{padding:2px 7px;border:1px solid currentColor;border-radius:2px;font-size:10px}
.mb-nav .s.warn{color:#FBBF24}
.mb-nav .sep{color:#39424f}
</style>`;

function nav(m){
  const badge = m.status ? `<span class="s warn">${m.status}</span>` : '';
  return `<div class="mb-nav"><a href="https://claude.ai/code/artifact/c21266d2-8893-4fa8-8a83-d8e2ffd12c24">&#8592; Metastable Brain</a><span class="sep">/</span><span>${m.title}</span>${badge}<span class="sep">·</span><span>live model — drag the sliders</span></div>`;
}

let report=[];
for(const m of MAP){
  let h=fs.readFileSync(path.join(APPS,m.app),'utf8');
  const before=h.length;
  h=h.replace(/<!DOCTYPE[^>]*>/i,'')
     .replace(/<html[^>]*>/i,'').replace(/<\/html>/i,'')
     .replace(/<head[^>]*>/i,'').replace(/<\/head>/i,'')
     .replace(/<meta[^>]*>/gi,'')
     .replace(/<\/body>/i,'');
  // retitle: a name, not a name plus an explainer
  h=h.replace(/<title>[\s\S]*?<\/title>/i,`<title>${m.title}</title>`);
  // inject nav strip immediately after <body...>
  h=h.replace(/<body[^>]*>/i, NAVCSS+'\n'+nav(m));
  fs.writeFileSync(path.join(OUT,m.slug+'.html'),h.trim()+'\n');
  const leftovers=['<!DOCTYPE','<html','<head','<body','</body>','</html>'].filter(t=>h.includes(t));
  report.push({slug:m.slug, kb:(h.length/1024).toFixed(0), title:(h.match(/<title>(.*?)<\/title>/)||[])[1],
    nav:h.includes('mb-nav')?'y':'n', canvas:(h.match(/<canvas/g)||[]).length, leftovers:leftovers.join(',')||'clean'});
}
console.log('slug'.padEnd(24)+'KB'.padStart(4)+'  nav canvas  wrappers   title');
for(const r of report) console.log(r.slug.padEnd(24)+String(r.kb).padStart(4)+'   '+r.nav+'   '+String(r.canvas).padStart(2)+'    '+r.leftovers.padEnd(10)+' '+r.title);
