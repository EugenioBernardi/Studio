"use strict";
/* Builds a self-contained figure page from the JSON the test suites emit, so the plots can never
   drift from the committed numbers: every value drawn is read from figures/*.json, and regenerating
   requires re-running the suites. Palette is the validated 5-slot categorical set (validator run in
   both light and dark against their own surfaces). */

const fs = require("fs"), path = require("path");
const DIR = __dirname;
const read = n => { try { return JSON.parse(fs.readFileSync(path.join(DIR, n), "utf8")); }
                    catch (e) { return null; } };

const alf = read("alf.json"), dis = read("disease.json"), adc = read("ad-components.json");
if (!alf) { console.error("figures/alf.json missing — run npm run test:alf first"); process.exit(1); }

const S = ["--series-1", "--series-2", "--series-3", "--series-4", "--series-5"];
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const fmt = (x, d = 2) => (x == null || Number.isNaN(x) ? "—" : Number(x).toFixed(d));

/* ---------- generic line chart with crosshair tooltip ---------- */
function lineChart(id, opts) {
  const W = 720, H = 340, m = { t: 18, r: 132, b: 46, l: 54 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const xs = opts.x, series = opts.series;
  const yMax = opts.yMax == null ? 1 : opts.yMax;
  const X = i => m.l + (iw * i) / Math.max(1, xs.length - 1);
  const Y = v => m.t + ih * (1 - v / yMax);
  let g = "";
  for (let t = 0; t <= 5; t++) {
    const v = (yMax * t) / 5, y = Y(v);
    g += `<line class="grid" x1="${m.l}" y1="${y}" x2="${m.l + iw}" y2="${y}"/>` +
         `<text class="axis" x="${m.l - 10}" y="${y + 4}" text-anchor="end">${fmt(v, 1)}</text>`;
  }
  xs.forEach((lab, i) => {
    g += `<text class="axis" x="${X(i)}" y="${m.t + ih + 22}" text-anchor="middle">${esc(lab)}</text>`;
  });
  let paths = "", dots = "", labels = "";
  series.forEach((s, k) => {
    const col = `var(${S[k % S.length]})`;
    const d = s.values.map((v, i) => `${i ? "L" : "M"}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join("");
    paths += `<path class="ln" d="${d}" stroke="${col}"${s.dash ? ' stroke-dasharray="5 4"' : ""}/>`;
    s.values.forEach((v, i) => {
      dots += `<circle class="mk" cx="${X(i).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="4.5" fill="${col}"/>`;
    });
    const ly = Y(s.values[s.values.length - 1]);
    labels += `<text class="slab" x="${m.l + iw + 10}" y="${ly + 4}" fill="${col}">${esc(s.name)}</text>`;
  });
  // hover columns
  let hot = "";
  xs.forEach((lab, i) => {
    const rows = series.map((s, k) =>
      `<span class=\\"tk\\" style=\\"background:var(${S[k % S.length]})\\"></span>${esc(s.name)}<b>${fmt(s.values[i])}</b>`).join("<br>");
    hot += `<rect class="hot" x="${(X(i) - iw / (2 * Math.max(1, xs.length - 1))).toFixed(1)}" y="${m.t}" ` +
           `width="${(iw / Math.max(1, xs.length - 1)).toFixed(1)}" height="${ih}" ` +
           `data-tip="<b>${esc(lab)}</b><br>${rows}"/>`;
  });
  return `<figure><figcaption><h3>${esc(opts.title)}</h3><p>${opts.sub}</p></figcaption>
  <div class="wrap"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.title)}">
    <text class="ylab" x="14" y="${m.t + ih / 2}" transform="rotate(-90 14 ${m.t + ih / 2})" text-anchor="middle">${esc(opts.yLabel || "")}</text>
    ${g}${paths}${dots}${labels}${hot}
  </svg><div class="tip" hidden></div></div></figure>`;
}

/* ---------- horizontal bar chart ---------- */
function barChart(id, opts) {
  const rows = opts.rows, W = 720, rowH = 34, m = { t: 12, r: 150, b: 34, l: 178 };
  const H = m.t + m.b + rows.length * rowH, iw = W - m.l - m.r;
  const vals = rows.map(r => r.value);
  const lo = Math.min(0, ...vals), hi = Math.max(...vals, opts.min || 0);
  const span = (hi - lo) || 1;
  const X = v => m.l + (iw * (v - lo)) / span;
  let g = "";
  for (let t = 0; t <= 4; t++) {
    const v = lo + (span * t) / 4, x = X(v);
    g += `<line class="grid" x1="${x}" y1="${m.t}" x2="${x}" y2="${m.t + rows.length * rowH}"/>` +
         `<text class="axis" x="${x}" y="${H - 12}" text-anchor="middle">${fmt(v, 2)}</text>`;
  }
  let bars = "";
  rows.forEach((r, i) => {
    const y = m.t + i * rowH + 7, h = rowH - 16;
    const x0 = X(Math.min(0, r.value)), x1 = X(Math.max(0, r.value));
    const col = `var(${S[(r.slot == null ? 0 : r.slot) % S.length]})`;
    bars += `<rect class="bar hot" x="${x0.toFixed(1)}" y="${y}" width="${Math.max(2, x1 - x0).toFixed(1)}" ` +
            `height="${h}" rx="4" fill="${col}" data-tip="<b>${esc(r.label)}</b><br>${esc(opts.unit || "")}<b>${fmt(r.value)}</b>"/>` +
            `<text class="rlab" x="${m.l - 12}" y="${y + h / 2 + 4}" text-anchor="end">${esc(r.label)}</text>` +
            `<text class="vlab" x="${(x1 + 8).toFixed(1)}" y="${y + h / 2 + 4}">${fmt(r.value)}</text>`;
  });
  return `<figure><figcaption><h3>${esc(opts.title)}</h3><p>${opts.sub}</p></figcaption>
  <div class="wrap"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.title)}">${g}${bars}</svg>
  <div class="tip" hidden></div></div></figure>`;
}

/* ---------- scatter with correlation annotation ---------- */
function scatter(id, opts) {
  const W = 350, H = 300, m = { t: 16, r: 16, b: 46, l: 50 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const xs = opts.points.map(p => p.x), ys = opts.points.map(p => p.y);
  const xlo = Math.min(...xs), xhi = Math.max(...xs);
  const X = v => m.l + (iw * (v - xlo)) / ((xhi - xlo) || 1);
  const Y = v => m.t + ih * (1 - v);
  let g = "";
  for (let t = 0; t <= 4; t++) {
    const v = t / 4, y = Y(v);
    g += `<line class="grid" x1="${m.l}" y1="${y}" x2="${m.l + iw}" y2="${y}"/>` +
         `<text class="axis" x="${m.l - 9}" y="${y + 4}" text-anchor="end">${fmt(v, 1)}</text>`;
  }
  for (let t = 0; t <= 3; t++) {
    const v = xlo + ((xhi - xlo) * t) / 3, x = X(v);
    g += `<text class="axis" x="${x}" y="${m.t + ih + 22}" text-anchor="middle">${fmt(v, opts.xd == null ? 0 : opts.xd)}</text>`;
  }
  const col = `var(${S[opts.slot % S.length]})`;
  const pts = opts.points.map(p =>
    `<circle class="mk hot" cx="${X(p.x).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="4.5" fill="${col}" ` +
    `data-tip="${esc(opts.xLabel)} <b>${fmt(p.x, 2)}</b><br>1-week recall <b>${fmt(p.y)}</b>"/>`).join("");
  return `<div class="panel"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.title)}">
    ${g}${pts}
    <text class="axttl" x="${m.l + iw / 2}" y="${H - 6}" text-anchor="middle">${esc(opts.xLabel)}</text>
  </svg><p class="rho">Spearman &rho; = <b>${fmt(opts.rho)}</b></p><div class="tip" hidden></div></div>`;
}

/* ================= assemble ================= */
const cv = alf.curves;
const DL = ["30 min", "6 h", "1 day", "1 week", "1 mo"];
const pick = ["healthy", "IED 15/min, coupled", "IED 30/min, coupled", "IED 60/min, coupled",
              "IED 60/min, UNCOUPLED"];
const fig1 = lineChart("f1", {
  title: "Figure 1 — Accelerated long-term forgetting emerges from slot capture",
  sub: "Fraction of a 15-item list recalled, mean of 8 simulated subjects. All conditions are " +
       "indistinguishable at 30&nbsp;minutes and separate only later. The dashed series is the " +
       "control: the <em>same</em> discharge rate that is uncoupled from the consolidation channel.",
  yLabel: "list fraction recalled", x: DL,
  series: pick.filter(t => cv[t]).map((t, i) => ({
    name: t.replace("IED ", "").replace(", coupled", "").replace(", UNCOUPLED", " uncoupled"),
    values: cv[t].recall, dash: /UNCOUPLED/.test(t) })),
});

const co = alf.cohort;
let fig2 = "";
if (co && co.rows) {
  fig2 = `<figure><figcaption><h3>Figure 2 — Spike burden does not predict forgetting; captured fraction does</h3>
  <p>${co.n} simulated patients in whom discharge rate and coupling vary independently — the realistic
  case, since two patients with the same spike count can differ in how much of it lands on the
  consolidation channel.</p></figcaption><div class="panels">
  ${scatter("s1", { title: "rate", xLabel: "discharges / min", slot: 1,
      rho: co.rhoRate, points: co.rows.map(r => ({ x: r.iedRate, y: r.week })) })}
  ${scatter("s2", { title: "density", xLabel: "spindle density / min", slot: 3, xd: 1,
      rho: co.rhoDens, points: co.rows.map(r => ({ x: r.density, y: r.week })) })}
  ${scatter("s3", { title: "frac", xLabel: "replay fraction", slot: 2, xd: 2,
      rho: co.rhoFrac, points: co.rows.map(r => ({ x: r.replayFrac, y: r.week })) })}
  </div></figure>`;
}

let fig3 = "";
if (dis && dis.conditions) {
  const C = dis.conditions, names = ["healthy", "TEA", "TLE-HS", "AD"];
  const nice = { healthy: "healthy", TEA: "transient epileptic amnesia", "TLE-HS": "TLE + sclerosis", AD: "Alzheimer's" };
  fig3 = lineChart("f3", {
    title: "Figure 3 — Two diseases, one channel",
    sub: "Epilepsy hijacks a channel of normal supply; Alzheimer's undersupplies it. Adding " +
         "hippocampal sclerosis to epilepsy damages the route that was covering the early delay, " +
         "which is why TEA looks normal at 30&nbsp;minutes and TLE&nbsp;+&nbsp;sclerosis does not.",
    yLabel: "list fraction recalled", x: ["30 min", "1 day", "1 week"],
    series: names.filter(n => C[n]).map(n => ({ name: nice[n], values: C[n].recall })),
  }) + barChart("f3b", {
    title: "Figure 3b — The sleep study separates them, and inverts for epilepsy",
    sub: "Spindle density per minute. The behavioural phenotype is shared; the EEG signature is " +
         "opposite. A hijacked channel runs <em>hot</em>, an undersupplied one runs <em>cold</em> — " +
         "so reading density as a proxy for consolidation ranks the epilepsy patient as healthiest.",
    unit: "spindles/min ", min: 0,
    rows: names.filter(n => C[n]).map((n, i) => ({ label: nice[n], value: C[n].density, slot: i })),
  });
}

let fig4 = "";
if (adc && adc.leaveOneOut && adc.alone) {
  const F = adc.alone.full;
  const rows = Object.entries(adc.leaveOneOut).map(([k, r], i) =>
    ({ label: k, value: r.recall[2] - F.recall[2], slot: i }));
  fig4 = barChart("f4", {
    title: "Figure 4 — Which part of “Alzheimer's” carries the late deficit?",
    sub: "Leave-one-out: 1-week recall recovered when each component is reverted to healthy, from " +
         "the full four-deficit profile. Discharge capture — the mechanism this model was built on — " +
         "is a minor term in Alzheimer's. It belongs to epilepsy.",
    unit: "recovery at 1 week ", rows,
  });
}

const html = `<title>Accelerated long-term forgetting — figures</title>
<style>
:root{color-scheme:light dark}
.viz-root{
  --surface-1:#fcfcfb; --surface-2:#f4f3ef; --line:#dedcd4;
  --text-primary:#0b0b0b; --text-secondary:#52514e; --text-muted:#79776f;
  --series-1:#2a78d6; --series-2:#eb6834; --series-3:#1baf7a; --series-4:#eda100; --series-5:#e87ba4;
}
@media (prefers-color-scheme:dark){:root:where(:not([data-theme="light"])) .viz-root{
  --surface-1:#1a1a19; --surface-2:#232322; --line:#3a3a37;
  --text-primary:#fff; --text-secondary:#c3c2b7; --text-muted:#96958c;
  --series-1:#3987e5; --series-2:#d95926; --series-3:#199e70; --series-4:#c98500; --series-5:#d55181;
}}
:root[data-theme="dark"] .viz-root{
  --surface-1:#1a1a19; --surface-2:#232322; --line:#3a3a37;
  --text-primary:#fff; --text-secondary:#c3c2b7; --text-muted:#96958c;
  --series-1:#3987e5; --series-2:#d95926; --series-3:#199e70; --series-4:#c98500; --series-5:#d55181;
}
*{box-sizing:border-box}
body{margin:0;background:var(--surface-1);color:var(--text-primary);
  font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;line-height:1.55}
.viz-root{max-width:860px;margin:0 auto;padding:48px 20px 80px}
h1{font-size:1.75rem;line-height:1.2;margin:0 0 .4em;text-wrap:balance;letter-spacing:-.01em}
.lede{color:var(--text-secondary);margin:0 0 8px;max-width:64ch}
.meta{color:var(--text-muted);font-size:.8rem;margin:0 0 40px;
  font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
figure{margin:0 0 52px}
figcaption h3{font-size:1.02rem;margin:0 0 .3em;letter-spacing:-.005em}
figcaption p{margin:0 0 14px;color:var(--text-secondary);font-size:.88rem;max-width:70ch}
.wrap,.panel{position:relative}
.wrap{overflow-x:auto;background:var(--surface-2);border:1px solid var(--line);border-radius:10px;padding:8px}
svg{display:block;width:100%;height:auto;overflow:visible}
.grid{stroke:var(--line);stroke-width:1}
.ln{fill:none;stroke-width:2;stroke-linejoin:round;stroke-linecap:round}
.mk{stroke:var(--surface-2);stroke-width:2}
.axis{fill:var(--text-muted);font-size:11px;font-family:ui-monospace,Menlo,monospace;
  font-variant-numeric:tabular-nums}
.ylab,.axttl{fill:var(--text-secondary);font-size:11px}
.slab{font-size:11.5px;font-weight:600}
.rlab{fill:var(--text-secondary);font-size:12px}
.vlab{fill:var(--text-primary);font-size:11.5px;font-weight:600;
  font-family:ui-monospace,Menlo,monospace;font-variant-numeric:tabular-nums}
.hot{fill:transparent;cursor:crosshair}
.bar.hot{cursor:pointer}
.panels{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px;
  background:var(--surface-2);border:1px solid var(--line);border-radius:10px;padding:8px}
.rho{margin:2px 0 6px;text-align:center;font-size:.8rem;color:var(--text-secondary);
  font-family:ui-monospace,Menlo,monospace;font-variant-numeric:tabular-nums}
.tip{position:absolute;pointer-events:none;z-index:9;background:var(--surface-1);
  border:1px solid var(--line);border-radius:8px;padding:8px 10px;font-size:12px;
  box-shadow:0 6px 20px rgb(0 0 0 /.18);max-width:260px;
  font-variant-numeric:tabular-nums}
.tip b{font-family:ui-monospace,Menlo,monospace;margin-left:6px}
.tk{display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:6px;vertical-align:baseline}
table{border-collapse:collapse;width:100%;font-size:.82rem;
  font-family:ui-monospace,Menlo,monospace;font-variant-numeric:tabular-nums}
th,td{border-bottom:1px solid var(--line);padding:6px 8px;text-align:right}
th:first-child,td:first-child{text-align:left;font-family:ui-sans-serif,system-ui,sans-serif}
thead th{color:var(--text-muted);font-weight:600}
details{margin:0 0 52px}
summary{cursor:pointer;color:var(--text-secondary);font-size:.86rem}
.note{border-left:2px solid var(--series-2);padding:2px 0 2px 14px;margin:0 0 52px;
  color:var(--text-secondary);font-size:.88rem;max-width:70ch}
@media (prefers-reduced-motion:no-preference){.mk,.bar{transition:opacity .12s}}
</style>
<div class="viz-root">
<h1>Accelerated long-term forgetting as hijacked consolidation</h1>
<p class="lede">Interictal discharges capture hippocampo-cortical coupling slots. The captured events
are structurally intact and semantically empty, so the hippocampal trace decays on schedule while
the cortical trace is never written — normal at half an hour, gone in a week.</p>
<p class="meta">integrated-loop · stages 43–45 · every value below is read from figures/*.json,
emitted by the test suites</p>

${fig1}
${fig2}
${fig3}
${fig4}

<p class="note"><strong>What is assumed rather than derived.</strong> That IED-coupled spindles show
higher phase consistency than physiological ones (Uehara 2026); that a hippocampal trace decays over
days while a cortical one accrues; that replay is salience-biased; and a calibration anchored to
~0.85 normal 1-week list retention. Each is a published regularity and each is a place the model
could be wrong. The registered prediction that spindle density rises monotonically with discharge
burden <em>failed</em> — density is non-monotone, which makes it a worse biomarker than predicted,
not a better one.</p>

<details><summary>Table view — all plotted values</summary>
<table><thead><tr><th>condition</th>${DL.map(d => `<th>${d}</th>`).join("")}<th>density</th><th>coupling</th><th>replay frac</th></tr></thead><tbody>
${Object.entries(cv).map(([k, v]) => `<tr><td>${esc(k)}</td>${v.recall.map(x => `<td>${fmt(x)}</td>`).join("")}<td>${fmt(v.density, 1)}</td><td>${fmt(v.couplingStrength)}</td><td>${fmt(v.replayFrac)}</td></tr>`).join("\n")}
</tbody></table></details>
</div>
<script>
document.querySelectorAll('.wrap,.panel').forEach(function(box){
  var tip=box.querySelector('.tip'); if(!tip) return;
  box.addEventListener('pointermove',function(e){
    var t=e.target.closest('[data-tip]');
    if(!t){tip.hidden=true;return;}
    tip.hidden=false; tip.innerHTML=t.getAttribute('data-tip');
    var r=box.getBoundingClientRect();
    var x=e.clientX-r.left+14, y=e.clientY-r.top+12;
    if(x+tip.offsetWidth>r.width) x=e.clientX-r.left-tip.offsetWidth-14;
    tip.style.left=Math.max(0,x)+'px'; tip.style.top=Math.max(0,y)+'px';
  });
  box.addEventListener('pointerleave',function(){tip.hidden=true;});
});
</script>`;

fs.writeFileSync(path.join(DIR, "alf-figures.html"), html);
console.log("wrote figures/alf-figures.html  (" + (html.length / 1024).toFixed(1) + " kB)");
