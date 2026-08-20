const fs=require('fs');
const U='https://claude.ai/code/artifact/';
const M={
 'kuramoto-assembly':'bfe9796f-abc0-445f-850c-47c306577ba6','basal-ganglia':'4b24cadd-8ec0-4bd7-925f-91537f14946a',
 'cerebellum':'4524565d-8cde-4963-838d-391c6af0fd40','amygdala':'7ab7dc71-1ada-4c86-88d8-416c8f22b6c2',
 'olivary-synchrony':'d9db9985-3130-4871-8b26-9046011176d2','integrated-loop':'9b16b078-2ca6-4769-ac2c-8b23e88b35d4',
 'accelerated-forgetting':'46192835-8112-48eb-95c0-ee336c68690b','spindles-spike-wave':'1afa05e3-516a-4579-a07a-6b047cdffe94',
 'index-and-replay':'a6c410e7-d604-46f9-840e-6ebb04f6f1eb','two-visual-streams':'e02207fd-e232-482e-b9dc-498d86823cff',
 'higher-order-thalamus':'d56dd614-32af-4349-8d65-1d8f968ed4a5','cochlea-to-belt':'b3b4f6da-4daa-47a3-9cd6-fa810ae52574'};
const models=[...require('./data1.js'),...require('./data2.js'),...require('./data3.js')];
const by=s=>models.find(m=>m.slug===s);
const LIVE=new Set(['kuramoto-assembly','basal-ganglia','cerebellum','amygdala','olivary-synchrony',
 'spindles-spike-wave','index-and-replay','two-visual-streams','cochlea-to-belt','higher-order-thalamus']);
const GROUPS=[
 {t:'Validated models', n:'Headless, seed-replicated, with a validation record in the repository. All five run live in the browser — open one and drag a slider.',
  s:['kuramoto-assembly','basal-ganglia','cerebellum','amygdala','olivary-synchrony']},
 {t:'Built, but the validation record is missing', n:'These run live too. The figures are the project’s own record: the standalone validation documents are among the files CLAUDE.md flags as absent from the working tree, so nothing here has been re-verified.',
  s:['spindles-spike-wave','index-and-replay','two-visual-streams','cochlea-to-belt']},
 {t:'Negative results, kept deliberately', n:'A negative result with a mechanism is worth more than a positive one without. These are here because the way they failed is the useful part. The pulvinar model runs live; the forgetting line is a record only.',
  s:['higher-order-thalamus','accelerated-forgetting']},
 {t:'Headless only — no interactive version', n:'Multi-night and multi-stage simulations with no single watchable state. These two remain written records rather than simulators.',
  s:['integrated-loop']}];
const {esc}=require('./shell.js');
const badge={validated:'ok',partial:'warn',retracted:'bad',withdrawn:'bad',negative:'warn',undocumented:'warn'};
const label={validated:'validated',partial:'partial',retracted:'retracted',negative:'negative result',undocumented:'record absent'};
const cards=g=>g.s.map(s=>{const m=by(s);return `<a class="card" href="${U}${M[s]}">
  <span class="ic" aria-hidden="true">${m.favicon}</span>
  <span class="cbody"><span class="ct">${esc(m.title)}</span>
  <span class="ck">${esc(m.kicker)}</span>
  <span class="cd">${esc(m.desc)}</span>
  <span class="prow"><span class="pill ${badge[m.status]}">${esc(label[m.status])}</span>${LIVE.has(s)?'<span class="pill live">live model</span>':'<span class="pill plainp">record</span>'}</span></span></a>`}).join('');
const EXTRA=`
.lede{font-size:1.2rem; max-width:66ch; line-height:1.6}
.grp{display:flex; flex-direction:column; gap:14px}
.grp>.n{color:var(--dim); font-size:.94rem; max-width:66ch; margin:-4px 0 2px}
.cards{display:grid; grid-template-columns:repeat(auto-fit,minmax(280px,1fr)); gap:12px}
.card{display:flex; gap:14px; text-decoration:none; color:inherit; background:var(--panel);
  border:1px solid var(--line); padding:16px 17px; box-shadow:var(--shadow); transition:border-color .16s, transform .16s}
.card:hover{border-color:var(--accent); transform:translateY(-2px)}
.card .ic{font-size:1.4rem; line-height:1.2; flex:0 0 auto}
.cbody{display:flex; flex-direction:column; gap:5px; align-items:flex-start; min-width:0}
.ct{font-family:"Space Grotesk",sans-serif; font-weight:600; font-size:1.04rem; color:var(--ink); letter-spacing:-.01em}
.ck{font-family:"IBM Plex Mono",monospace; font-size:.68rem; letter-spacing:.09em; color:var(--faint)}
.cd{font-size:.87rem; color:var(--dim); line-height:1.5}
.prow{display:flex;gap:6px;flex-wrap:wrap;margin-top:5px}
.pill.live{color:var(--accent)}
.pill.plainp{color:var(--faint)}
@media (prefers-reduced-motion:reduce){.card:hover{transform:none}}
`;
let html=require('./shell.js').page({
 title:'Metastable Brain', kicker:'TWELVE CIRCUITS', h1:'Metastable Brain',
 status:'validated', pills:['12 systems','10 live models','5 fully validated','3 negative or retracted'],
 thesis:'Interactive, numerically validated neural circuit simulators. Every model is a real dynamical system rendered as coupled <b>little clocks</b> — nothing here is a scripted animation. <b>Ten of the twelve run live in the browser</b>: open one and drag a slider.',
 circuit:'<b>Simulate first, draw second.</b> &nbsp;·&nbsp; nothing that should be emergent may be scripted &nbsp;·&nbsp; register predictions before running &nbsp;·&nbsp; replicate before believing &nbsp;·&nbsp; report failures with a mechanism',
 footer:'Every figure on these pages is computed. Where a validation record is missing from the repository, the page says so.'
});
html=html.replace('</style>', EXTRA+'</style>');
html=html.replace('<footer>', GROUPS.map(g=>
  `<section class="grp"><h2>${esc(g.t)}</h2><p class="n">${esc(g.n)}</p><div class="cards">${cards(g)}</div></section>`
).join('\n')+'\n<footer>');
fs.writeFileSync('out/metastable-brain.html', html);
console.log('index built, '+(fs.statSync('out/metastable-brain.html').size/1024).toFixed(1)+' KB, links: '+(html.match(/claude\.ai\/code\/artifact/g)||[]).length);
