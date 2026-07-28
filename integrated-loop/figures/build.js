"use strict";
/* Assemble figures/report.html from report.template.html + the JSON each test writes.

   Every stage test dumps its own numbers next to this file; the build merges them into one
   `D` object and substitutes it for the __DATA__ placeholder in the template. Re-running a
   test therefore updates the report on the next build — the page cannot drift away from the
   models the way a hand-edited HTML would.

   report-data.json is the accumulated base: it carries the blocks that were collated by hand
   from test stdout before those tests wrote JSON (`pathology`, `mnist`). Every key listed in
   SOURCES below overwrites it from a live file.                                             */

const fs = require("fs"), path = require("path");
const dir = __dirname;
const read = f => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
const has = f => fs.existsSync(path.join(dir, f));

const SOURCES = [
  // [file, how its contents fold into D]
  ["data.json",        d => d],                 // vision · mt · fields · replay · consolidation
  ["visual_path.json", d => ({ visual: d })],   // perimetry · Mach bands · tilt · Charles Bonnet
  ["chiasm.json",      d => ({ chiasm: d })],   // bilateral pathway, per-eye field charts
  ["mst.json",         d => ({ mst: d })],      // mnemonic similarity task
  ["bilateral.json",   d => ({ bilateral: d })],// two hippocampi: material specificity, H.M., Wada
  ["neglect.json",     d => ({ neglect: d })],  // two parietal cortices: extinction, bisection, the paradox
  ["hmax.json",        d => ({ hmax: d })],
];

const D = has("report-data.json") ? read("report-data.json") : {};
for (const [file, fold] of SOURCES) {
  if (!has(file)) { console.log("  (skipped, absent) " + file); continue; }
  Object.assign(D, fold(read(file)));
  console.log("  merged " + file);
}

const tpl = fs.readFileSync(path.join(dir, "report.template.html"), "utf8");
if (!tpl.includes("__DATA__")) throw new Error("template has no __DATA__ placeholder");
fs.writeFileSync(path.join(dir, "report.html"),
  tpl.replace("__DATA__", JSON.stringify(D).replace(/<\//g, "<\\/")));
console.log("wrote figures/report.html  (" + Object.keys(D).join(" · ") + ")");
