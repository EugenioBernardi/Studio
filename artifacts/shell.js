// Shared shell for the instrument-card family. One design system, twelve panels.
const CSS = `
:root{
  --ground:#0B0E13; --panel:#141922; --panel2:#1B212C; --line:#242C3A;
  --ink:#E6EDF3; --dim:#8794A6; --faint:#5C6879;
  --accent:#4FD1C5; --accent-dim:#2A6E68;
  --ok:#4ADE80; --warn:#FBBF24; --bad:#F87171;
  --shadow:0 1px 0 rgba(255,255,255,.03) inset;
}
@media (prefers-color-scheme: light){
  :root:not([data-theme="dark"]){
    --ground:#F2F4F7; --panel:#FFFFFF; --panel2:#F7F9FB; --line:#DCE3EC;
    --ink:#111821; --dim:#556072; --faint:#7C899B;
    --accent:#0E8C82; --accent-dim:#9FDDD7;
    --ok:#177245; --warn:#8A5B00; --bad:#B3261E;
    --shadow:0 1px 0 rgba(0,0,0,.02) inset;
  }
}
:root[data-theme="light"]{
  --ground:#F2F4F7; --panel:#FFFFFF; --panel2:#F7F9FB; --line:#DCE3EC;
  --ink:#111821; --dim:#556072; --faint:#7C899B;
  --accent:#0E8C82; --accent-dim:#9FDDD7;
  --ok:#177245; --warn:#8A5B00; --bad:#B3261E;
  --shadow:0 1px 0 rgba(0,0,0,.02) inset;
}
:root[data-theme="dark"]{
  --ground:#0B0E13; --panel:#141922; --panel2:#1B212C; --line:#242C3A;
  --ink:#E6EDF3; --dim:#8794A6; --faint:#5C6879;
  --accent:#4FD1C5; --accent-dim:#2A6E68;
  --ok:#4ADE80; --warn:#FBBF24; --bad:#F87171;
  --shadow:0 1px 0 rgba(255,255,255,.03) inset;
}
*{box-sizing:border-box}
body{
  margin:0; background:var(--ground); color:var(--ink);
  font-family:"IBM Plex Sans",ui-sans-serif,system-ui,sans-serif;
  font-size:16px; line-height:1.62; -webkit-font-smoothing:antialiased;
}
.wrap{max-width:940px; margin:0 auto; padding:40px 24px 96px; display:flex; flex-direction:column; gap:34px}
a{color:var(--accent); text-decoration-thickness:1px; text-underline-offset:3px}
a:focus-visible,summary:focus-visible{outline:2px solid var(--accent); outline-offset:3px; border-radius:3px}
h1,h2,h3,.lbl{font-family:"Space Grotesk",ui-sans-serif,system-ui,sans-serif; text-wrap:balance}
h1{font-size:clamp(2rem,5vw,2.9rem); line-height:1.08; margin:0; letter-spacing:-.022em; font-weight:600}
h2{font-size:1.06rem; margin:0; letter-spacing:.10em; text-transform:uppercase; color:var(--dim); font-weight:600}
h3{font-size:1.12rem; margin:0 0 6px; letter-spacing:-.01em; font-weight:600}
p{margin:0 0 12px; max-width:68ch}
p:last-child{margin-bottom:0}
.mono,code,td.n,.circuit{font-family:"IBM Plex Mono",ui-monospace,monospace; font-variant-numeric:tabular-nums}
.back{font-family:"IBM Plex Mono",ui-monospace,monospace; font-size:.78rem; letter-spacing:.06em; color:var(--faint)}
header.top{display:flex; flex-direction:column; gap:14px; padding-bottom:6px}
.pillrow{display:flex; flex-wrap:wrap; gap:8px; align-items:center}
.pill{
  font-family:"IBM Plex Mono",ui-monospace,monospace; font-size:.72rem; letter-spacing:.09em;
  text-transform:uppercase; padding:4px 10px; border-radius:2px; border:1px solid currentColor;
}
.pill.ok{color:var(--ok)} .pill.warn{color:var(--warn)} .pill.bad{color:var(--bad)}
.pill.plain{color:var(--faint)}
.thesis{font-size:1.16rem; color:var(--ink); max-width:64ch; line-height:1.55}
.circuit{
  background:var(--panel); border:1px solid var(--line); border-left:2px solid var(--accent);
  padding:14px 16px; font-size:.86rem; color:var(--dim); overflow-x:auto; white-space:nowrap;
  box-shadow:var(--shadow);
}
.circuit b{color:var(--accent); font-weight:500}
section{display:flex; flex-direction:column; gap:14px}
.panel{background:var(--panel); border:1px solid var(--line); padding:20px 22px; box-shadow:var(--shadow)}
.tablewrap{overflow-x:auto; border:1px solid var(--line); background:var(--panel)}
table{border-collapse:collapse; width:100%; font-size:.9rem; min-width:520px}
th{
  font-family:"Space Grotesk",sans-serif; font-size:.72rem; letter-spacing:.09em; text-transform:uppercase;
  color:var(--dim); text-align:left; padding:11px 14px; border-bottom:1px solid var(--line); font-weight:600;
  background:var(--panel2);
}
td{padding:11px 14px; border-bottom:1px solid var(--line); vertical-align:top}
tr:last-child td{border-bottom:none}
td.n{color:var(--accent); white-space:nowrap}
td.n.bad{color:var(--bad)} td.n.warn{color:var(--warn)} td.n.plain{color:var(--ink)}
ul{margin:0; padding-left:1.1rem; display:flex; flex-direction:column; gap:9px}
li{max-width:66ch}
li strong{color:var(--ink)}
.note{border-left:2px solid var(--warn); padding:12px 16px; background:var(--panel); color:var(--dim); font-size:.93rem}
.note.bad{border-left-color:var(--bad)}
.note b{color:var(--ink)}
.grid{display:grid; grid-template-columns:repeat(auto-fit,minmax(230px,1fr)); gap:12px}
.stat{background:var(--panel); border:1px solid var(--line); padding:15px 17px; display:flex; flex-direction:column; gap:3px}
.stat .k{font-family:"IBM Plex Mono",monospace; font-size:1.5rem; color:var(--accent); font-variant-numeric:tabular-nums; line-height:1.15}
.stat .k.bad{color:var(--bad)} .stat .k.warn{color:var(--warn)}
.stat .v{font-size:.83rem; color:var(--dim); line-height:1.45}
footer{border-top:1px solid var(--line); padding-top:18px; color:var(--faint); font-size:.83rem}
@media (prefers-reduced-motion:no-preference){
  .wrap>*{animation:rise .45s cubic-bezier(.2,.7,.3,1) backwards}
  .wrap>*:nth-child(2){animation-delay:.05s} .wrap>*:nth-child(3){animation-delay:.09s}
  .wrap>*:nth-child(4){animation-delay:.13s} .wrap>*:nth-child(n+5){animation-delay:.16s}
  @keyframes rise{from{opacity:0; transform:translateY(7px)}to{opacity:1; transform:none}}
}
`;

const FONTS = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500&family=Space+Grotesk:wght@500;600;700&display=swap">';

const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

function statusPill(s){
  const m={validated:['ok','validated'],partial:['warn','partial'],retracted:['bad','retracted'],
           withdrawn:['bad','withdrawn'],negative:['warn','negative result'],undocumented:['warn','record absent']};
  const [c,t]=m[s]||['plain',s];
  return `<span class="pill ${c}">${esc(t)}</span>`;
}

function page(m){
  const pills = [statusPill(m.status), ...(m.pills||[]).map(p=>`<span class="pill plain">${esc(p)}</span>`)].join('');
  const stats = m.stats ? `<div class="grid">${m.stats.map(s=>
    `<div class="stat"><span class="k${s.tone?' '+s.tone:''}">${esc(s.k)}</span><span class="v">${esc(s.v)}</span></div>`).join('')}</div>` : '';
  const rows = m.rows ? `<section><h2>${esc(m.rowsTitle||'Validated results')}</h2><div class="tablewrap"><table>
    <thead><tr><th>Check</th><th>Result</th></tr></thead><tbody>${m.rows.map(r=>
    `<tr><td>${r.c}</td><td class="n${r.tone?' '+r.tone:''}">${esc(r.r)}</td></tr>`).join('')}</tbody></table></div></section>` : '';
  const keep = m.keep ? `<section><h2>Do not re-derive</h2><div class="panel"><ul>${m.keep.map(k=>`<li>${k}</li>`).join('')}</ul></div></section>` : '';
  const open = m.open ? `<section><h2>${esc(m.openTitle||'Open, or not working')}</h2><div class="panel"><ul>${m.open.map(k=>`<li>${k}</li>`).join('')}</ul></div></section>` : '';
  const notes = (m.notes||[]).map(n=>`<div class="note${n.bad?' bad':''}">${n.t}</div>`).join('');
  return `<title>${esc(m.title)}</title>
${FONTS}
<style>${CSS}</style>
<div class="wrap">
  <header class="top">
    <div class="back">METASTABLE BRAIN · ${esc(m.kicker)}</div>
    <h1>${esc(m.h1)}</h1>
    <div class="pillrow">${pills}</div>
    <p class="thesis">${m.thesis}</p>
  </header>
  ${m.circuit?`<div class="circuit">${m.circuit}</div>`:''}
  ${notes}
  ${stats}
  ${m.body?`<section><h2>${esc(m.bodyTitle||'Mechanism')}</h2><div class="panel">${m.body}</div></section>`:''}
  ${rows}
  ${keep}
  ${open}
  <footer>${m.footer||'Headless simulation, numerically validated. Every figure on this page is computed, not illustrative.'}</footer>
</div>`;
}
module.exports = {page, esc};
