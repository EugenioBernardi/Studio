const fs=require('fs');
// inline the REAL model source; strip only the CommonJS export so the same code runs in the page.
let src=fs.readFileSync('/home/user/Studio/models/olive-v2.js','utf8')
  .replace(/^module\.exports.*$/m,'')
  .replace(/^"use strict";$/m,'');

const HTML=`<title>Olivary Synchrony</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500&family=Space+Grotesk:wght@500;600;700&display=swap">
<style>
:root{--bg:#060911;--panel:rgba(13,19,33,.74);--line:rgba(120,150,200,.16);--ink:#e4ebf7;
 --dim:#8a97ad;--faint:#5d6a7e;--accent:#4FD1C5;--null:#7b6bd6;--bad:#F87171;--warn:#FBBF24;--ok:#4ADE80}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font-family:"IBM Plex Sans",system-ui,sans-serif;font-size:15px}
.mb-nav{font-family:"IBM Plex Mono",monospace;font-size:11px;letter-spacing:.08em;text-transform:uppercase;
 display:flex;flex-wrap:wrap;gap:10px;align-items:center;padding:8px 14px;background:#0a0e17;
 border-bottom:1px solid var(--line);color:var(--faint)}
.mb-nav a{color:var(--accent);text-decoration:none} .mb-nav a:hover{text-decoration:underline}
.mb-nav .sep{color:#39424f}
.shell{display:grid;grid-template-columns:minmax(0,1fr) 380px;gap:18px;padding:20px;align-items:start}
@media(max-width:900px){.shell{grid-template-columns:minmax(0,1fr)}}
h1{font-family:"Space Grotesk",sans-serif;font-size:1.5rem;margin:0 0 6px;letter-spacing:-.02em;font-weight:600}
.sub{color:var(--dim);font-size:.92rem;max-width:62ch;margin:0 0 14px;line-height:1.55}
.sub b{color:var(--accent);font-weight:500}
.card{background:var(--panel);border:1px solid var(--line);border-radius:3px;padding:14px 16px;margin-bottom:12px}
.card h2{font-family:"Space Grotesk",sans-serif;font-size:.72rem;letter-spacing:.12em;text-transform:uppercase;
 color:var(--dim);margin:0 0 10px;font-weight:600;display:flex;align-items:center;gap:7px}
.dot{width:6px;height:6px;border-radius:50%;background:var(--accent);display:inline-block}
canvas{display:block;width:100%;border-radius:3px;background:#070b13;border:1px solid var(--line)}
.row{display:flex;align-items:center;gap:10px;margin:9px 0;font-size:.83rem}
.row label{flex:0 0 118px;color:var(--dim);font-family:"IBM Plex Mono",monospace;font-size:.74rem;letter-spacing:.04em}
.row input[type=range]{flex:1;accent-color:var(--accent);min-width:0}
.row .v{flex:0 0 62px;text-align:right;font-family:"IBM Plex Mono",monospace;color:var(--accent);font-variant-numeric:tabular-nums}
.seg{display:flex;gap:6px;flex-wrap:wrap}
.seg button{flex:1;min-width:88px;background:#101725;color:var(--dim);border:1px solid var(--line);
 padding:7px 8px;border-radius:3px;font-family:"IBM Plex Mono",monospace;font-size:.72rem;cursor:pointer;letter-spacing:.04em}
.seg button[aria-pressed=true]{background:rgba(79,209,197,.14);color:var(--accent);border-color:var(--accent)}
.seg button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
table{width:100%;border-collapse:collapse;font-size:.82rem}
td{padding:5px 0;border-bottom:1px solid rgba(120,150,200,.09)}
td:last-child{text-align:right;font-family:"IBM Plex Mono",monospace;font-variant-numeric:tabular-nums;color:var(--accent)}
td:first-child{color:var(--dim)}
tr:last-child td{border-bottom:none}
.verdict{font-family:"IBM Plex Mono",monospace;font-size:.76rem;padding:9px 11px;border-radius:3px;
 border-left:2px solid var(--faint);background:#0b1120;color:var(--dim);line-height:1.55}
.verdict.quiet{border-left-color:var(--ok);color:var(--ok)}
.verdict.rhythm{border-left-color:var(--warn);color:var(--warn)}
.legend{display:flex;gap:14px;font-family:"IBM Plex Mono",monospace;font-size:.7rem;color:var(--faint);margin-top:7px}
.legend i{width:16px;height:2px;display:inline-block;vertical-align:middle;margin-right:5px}
.note{font-size:.78rem;color:var(--faint);line-height:1.5;margin-top:9px}
</style>
<div class="mb-nav"><a href="https://claude.ai/code/artifact/c21266d2-8893-4fa8-8a83-d8e2ffd12c24">&#8592; Metastable Brain</a><span class="sep">/</span><span>Olivary Synchrony</span><span class="sep">·</span><span>live model — drag the sliders</span></div>
<div class="shell">
 <div>
  <h1>Olivary Synchrony</h1>
  <p class="sub">Sixty inferior-olive cells, each a clock. The subthreshold oscillation <b>gates</b> spiking — it opens a window, and a spike happens only if synaptic input arrives inside it. Raise the gap-junction coupling and the windows align: the <b>same</b> aperiodic input becomes a rhythm, with the per-cell spike rate unchanged. The dashed violet trace is the no-oscillation null running live alongside, because a filtered spike train looks peaky even with no rhythm at all.</p>
  <canvas id="ring" width="900" height="470"></canvas>
  <div class="legend"><span><i style="background:var(--accent)"></i>nuclear output</span><span><i style="background:var(--null);opacity:.8"></i>no-oscillation null</span><span>disc brightness = sin(phase) · green rim = gate open</span></div>
  <div class="card" style="margin-top:12px"><h2><span class="dot"></span>Nuclear output spectrum, 1–20 Hz</h2>
   <canvas id="spec" width="900" height="200"></canvas>
   <p class="note">Sharpness is peak power divided by median power. The null sits near 90 with no rhythm present, so anything below that is not a rhythm — it is a filtered point process.</p>
  </div>
 </div>
 <div>
  <div class="card"><h2><span class="dot"></span>Lesion</h2>
   <div class="seg">
     <button data-les="none" aria-pressed="true">healthy</button>
     <button data-les="cf">CF&#8594;PC &#215;6</button>
     <button data-les="no">dentato-olivary</button>
   </div>
   <p class="note" id="lesnote">The healthy circuit. Complex spikes near 1 Hz, and no rhythm above the null.</p>
  </div>
  <div class="card"><h2><span class="dot"></span>Controls</h2>
   <div class="row"><label>gap coupling</label><input id="gGap" type="range" min="0" max="30" step="0.5" value="8"><span class="v" id="vgGap">8.0</span></div>
   <div class="row"><label>olivary Hz</label><input id="fIO" type="range" min="2" max="10" step="0.5" value="6"><span class="v" id="vfIO">6.0</span></div>
   <div class="row"><label>tonic shunt</label><input id="shuntTonic" type="range" min="0" max="8" step="0.5" value="2"><span class="v" id="vshuntTonic">2.0</span></div>
   <div class="row"><label>input Hz</label><input id="inRate" type="range" min="1" max="10" step="0.5" value="4"><span class="v" id="vinRate">4.0</span></div>
  </div>
  <div class="card"><h2><span class="dot"></span>Live measurement</h2>
   <table>
    <tr><td>olivary coherence R</td><td id="mR">—</td></tr>
    <tr><td>complex spikes / cell</td><td id="mCS">—</td></tr>
    <tr><td>effective coupling</td><td id="mG">—</td></tr>
    <tr><td>spectral sharpness</td><td id="mSh">—</td></tr>
    <tr><td>peak frequency</td><td id="mF">—</td></tr>
    <tr><td>null sharpness</td><td id="mNull">—</td></tr>
   </table>
   <div class="verdict" id="verdict" style="margin-top:11px">warming up…</div>
  </div>
  <div class="card"><h2><span class="dot"></span>What to try</h2>
   <p class="note" style="margin-top:0">Drag <b style="color:var(--accent)">gap coupling</b> from 8 to 24 and watch R cross about 0.4. A peak appears at the olivary frequency — and the complex-spike rate does not move. That is synchrony doing work.<br><br>
   Then move <b style="color:var(--accent)">olivary Hz</b>: the peak follows it, so the rhythm is the olive's and not the filter's.<br><br>
   Now pick <b style="color:var(--accent)">CF&#8594;PC &#215;6</b>, the essential-tremor lesion. Coherence <em>falls</em> — every cortical lesion raises nucleo-olivary drive and de-couples the olive. Only the dentato-olivary lesion couples it.</p>
  </div>
 </div>
</div>
<script>
(function(){
"use strict";
${src}

/* ---- two models run side by side: the circuit, and the no-oscillation NULL at matched rate.
   The null is not decoration — a filtered point process scores ~90 on sharpness with no rhythm
   present, so without it every spectral number on this page would be unreadable. ---- */
var P={gGap:8,fIO:6,shuntTonic:2,inRate:4,cfGain:1,noLesion:0,loopOn:true,seed:1,nIO:60};
var S,N;
function rebuild(){
  S=create(Object.assign({},P));            S.noTonic=0;
  N=create(Object.assign({},P,{noOsc:true})); N.noTonic=0;
  buf.fill(0); nbuf.fill(0); bi=0; spikes=0; simT=0; filled=0; rAcc=0; rN=0;
}
var LEN=12288, buf=new Float64Array(LEN), nbuf=new Float64Array(LEN), bi=0, spikes=0, simT=0, filled=0;
var rAcc=0, rN=0;

function spectrum(a,lo,hi,df){
  var mu=0,i; for(i=0;i<LEN;i++)mu+=a[i]; mu/=LEN;
  var out=[],fs=1000;
  for(var f=lo;f<=hi+1e-9;f+=df){
    var k=2*Math.PI*f/fs,c=2*Math.cos(k),s0=0,s1=0,s2=0;
    for(i=0;i<LEN;i++){s0=(a[i]-mu)+c*s1-s2;s2=s1;s1=s0;}
    out.push([f,(s1*s1+s2*s2-c*s1*s2)/(LEN*LEN)]);
  }
  return out;
}
function stats(sp){
  var v=sp.map(function(p){return p[1];}).slice().sort(function(x,y){return x-y;});
  var med=v[v.length>>1]||1e-30, best=sp[0];
  for(var i=0;i<sp.length;i++) if(sp[i][1]>best[1]) best=sp[i];
  return {sh:best[1]/med, f:best[0], peak:best[1], med:med};
}

var ring=document.getElementById('ring'), rx=ring.getContext('2d');
var spec=document.getElementById('spec'), sx=spec.getContext('2d');
function fit(c){var r=c.getBoundingClientRect(),d=Math.min(2,devicePixelRatio||1);
  if(c.width!==Math.round(r.width*d)){c.width=Math.round(r.width*d);c.height=Math.round(parseInt(getComputedStyle(c).height)*d);}
  return d;}

function drawRing(){
  var d=fit(ring),W=ring.width,H=ring.height;
  rx.clearRect(0,0,W,H); rx.fillStyle='#070b13'; rx.fillRect(0,0,W,H);
  var cx=W*0.5,cy=H*0.52,R=Math.min(W,H)*0.34;
  // coherence halo — the population vector, drawn as what it is
  var sxs=0,sys=0; for(var i=0;i<S.P.nIO;i++){sxs+=Math.cos(S.th[i]);sys+=Math.sin(S.th[i]);}
  sxs/=S.P.nIO;sys/=S.P.nIO;
  var Rr=Math.hypot(sxs,sys), psi=Math.atan2(sys,sxs);
  var g=rx.createRadialGradient(cx,cy,R*0.15,cx,cy,R*1.16);
  g.addColorStop(0,'rgba(79,209,197,'+(0.05+0.42*Rr).toFixed(3)+')');
  g.addColorStop(1,'rgba(79,209,197,0)');
  rx.fillStyle=g; rx.beginPath(); rx.arc(cx,cy,R*1.16,0,7); rx.fill();
  // mean-field hand
  rx.strokeStyle='rgba(79,209,197,'+(0.25+0.6*Rr).toFixed(3)+')'; rx.lineWidth=2*d;
  rx.beginPath(); rx.moveTo(cx,cy); rx.lineTo(cx+Math.cos(psi)*R*Rr, cy+Math.sin(psi)*R*Rr); rx.stroke();
  var gw=S.P.gateWidth*2*Math.PI;
  for(var i=0;i<S.P.nIO;i++){
    var a=i/S.P.nIO*2*Math.PI-Math.PI/2, px=cx+Math.cos(a)*R, py=cy+Math.sin(a)*R;
    var ph=((S.th[i]%(2*Math.PI))+2*Math.PI)%(2*Math.PI);
    var lum=0.5+0.5*Math.sin(ph);           // disc brightness = sin(phase)
    var open=ph<gw;                          // the gating window: when a spike CAN happen
    var rad=(3.4+3.4*lum)*d;
    rx.beginPath(); rx.arc(px,py,rad,0,7);
    rx.fillStyle='rgba(79,209,197,'+(0.16+0.72*lum).toFixed(3)+')'; rx.fill();
    if(open){ rx.strokeStyle='rgba(74,222,128,.95)'; rx.lineWidth=1.5*d; rx.stroke(); }
    // phase hand
    rx.strokeStyle='rgba(228,235,247,.5)'; rx.lineWidth=1*d;
    rx.beginPath(); rx.moveTo(px,py); rx.lineTo(px+Math.cos(ph)*rad*1.7,py+Math.sin(ph)*rad*1.7); rx.stroke();
  }
  rx.font=(11*d)+'px "IBM Plex Mono",monospace'; rx.textAlign='center';
  rx.fillStyle='rgba(138,151,173,.9)'; rx.fillText('R = '+Rr.toFixed(3),cx,cy+4*d);
  rx.fillStyle='rgba(93,106,126,.9)'; rx.fillText('60 olivary clocks · green rim = gate open',cx,H-12*d);
}

var lastSpec=null,lastNull=null;
function drawSpec(){
  var d=fit(spec),W=spec.width,H=spec.height;
  sx.clearRect(0,0,W,H); sx.fillStyle='#070b13'; sx.fillRect(0,0,W,H);
  if(!lastSpec) return;
  var pad=26*d, mx=0;
  for(var i=0;i<lastSpec.length;i++) mx=Math.max(mx,lastSpec[i][1],lastNull[i][1]);
  if(mx<=0) return;
  sx.strokeStyle='rgba(120,150,200,.13)'; sx.lineWidth=1*d;
  sx.font=(9.5*d)+'px "IBM Plex Mono",monospace'; sx.fillStyle='rgba(93,106,126,.95)'; sx.textAlign='center';
  for(var f=4;f<=20;f+=4){
    var X=pad+(f-1)/19*(W-pad*1.4);
    sx.beginPath(); sx.moveTo(X,6*d); sx.lineTo(X,H-pad*0.72); sx.stroke();
    sx.fillText(f+' Hz',X,H-7*d);
  }
  // 4-12 Hz clinical tremor band
  var b0=pad+(4-1)/19*(W-pad*1.4), b1=pad+(12-1)/19*(W-pad*1.4);
  sx.fillStyle='rgba(251,191,36,.05)'; sx.fillRect(b0,6*d,b1-b0,H-pad*0.72-6*d);
  function trace(sp,col,dash){
    sx.setLineDash(dash?[4*d,4*d]:[]); sx.strokeStyle=col; sx.lineWidth=2*d; sx.beginPath();
    for(var i=0;i<sp.length;i++){
      var X=pad+(sp[i][0]-1)/19*(W-pad*1.4), Y=(H-pad*0.72)-(sp[i][1]/mx)*(H-pad*1.2);
      i?sx.lineTo(X,Y):sx.moveTo(X,Y);
    } sx.stroke(); sx.setLineDash([]);
  }
  trace(lastNull,'rgba(123,107,214,.85)',true);
  trace(lastSpec,'#4FD1C5',false);
}

function setLes(k){
  P.cfGain = k==='cf'?6:1;
  P.noLesion = k==='no'?0.95:0;
  document.querySelectorAll('[data-les]').forEach(function(b){b.setAttribute('aria-pressed',String(b.dataset.les===k));});
  document.getElementById('lesnote').innerHTML = k==='cf'
    ? 'Raised climbing-fibre gain onto Purkinje cells — the pathology found in essential-tremor brains. Watch coherence <em>fall</em>.'
    : k==='no' ? 'Dentato-olivary interruption, the Guillain&#8211;Mollaret lesion of oculopalatal tremor. This is the one lesion that de-shunts the olive.'
    : 'The healthy circuit. Complex spikes near 1 Hz, and no rhythm above the null.';
  rebuild();
}
document.querySelectorAll('[data-les]').forEach(function(b){b.addEventListener('click',function(){setLes(b.dataset.les);});});
['gGap','fIO','shuntTonic','inRate'].forEach(function(id){
  var el=document.getElementById(id);
  el.addEventListener('input',function(){
    P[id]=parseFloat(el.value);
    document.getElementById('v'+id).textContent=P[id].toFixed(1);
    rebuild();
  });
});

rebuild();
var acc=0, last=performance.now(), reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
function frame(now){
  var dtms=Math.min(60,now-last); last=now;
  var steps=Math.round(dtms*1.2);                 // ~1.2x real time — the 6 Hz rhythm stays watchable
  for(var k=0;k<steps;k++){
    var o=step(S), n=step(N);
    spikes+=o.volley*S.P.nIO; simT+=0.001; rAcc+=o.R; rN++;
    buf[bi]=o.dcn; nbuf[bi]=n.dcn; bi=(bi+1)%LEN; if(filled<LEN)filled++;
  }
  drawRing();
  acc+=dtms;
  if(acc>420 && filled<LEN){
    acc=0;
    var v0=document.getElementById('verdict');
    v0.className='verdict';
    v0.textContent='settling — '+Math.round(100*filled/LEN)+'% of the '+(LEN/1000).toFixed(1)+' s measurement window';
  }
  if(acc>420 && filled>=LEN){
    acc=0;
    lastSpec=spectrum(buf,1,20,0.25); lastNull=spectrum(nbuf,1,20,0.25);
    var st=stats(lastSpec), ns=stats(lastNull);
    document.getElementById('mR').textContent=(rN?rAcc/rN:0).toFixed(3);
    document.getElementById('mCS').textContent=(simT>0?(spikes/(S.P.nIO*simT)):0).toFixed(3)+' Hz';
    document.getElementById('mG').textContent=(S.gEff||S.P.gGap).toFixed(2);
    document.getElementById('mSh').textContent=st.sh.toFixed(0);
    document.getElementById('mF').textContent=st.f.toFixed(1)+' Hz';
    document.getElementById('mNull').textContent=ns.sh.toFixed(0);
    var v=document.getElementById('verdict');
    if(st.sh>3*ns.sh){ v.className='verdict rhythm';
      v.innerHTML='RHYTHM at '+st.f.toFixed(1)+' Hz &mdash; '+(st.sh/ns.sh).toFixed(1)+'&#215; the null. Spike rate is still '+(spikes/(S.P.nIO*simT)).toFixed(2)+' Hz/cell.'; }
    else { v.className='verdict quiet';
      v.innerHTML='QUIET &mdash; sharpness '+st.sh.toFixed(0)+' against a null of '+ns.sh.toFixed(0)+'. No rhythm above a filtered spike train.'; }
    drawSpec();
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
})();
</script>`;
fs.writeFileSync('live/olivary-synchrony.html',HTML);
console.log('built olivary-synchrony.html, '+(HTML.length/1024).toFixed(1)+' KB (model inlined: '+(src.length/1024).toFixed(1)+' KB)');
