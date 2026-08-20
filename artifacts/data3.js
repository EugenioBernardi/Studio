const PROV = {t:'<b>Validation record not in the repository.</b> The app runs and the numbers below are the project’s own record of it, but the standalone validation document is one of the files CLAUDE.md flags as absent from the working tree. Treat these figures as reported rather than re-verified here.'};
module.exports = [
{
 slug:'spindles-spike-wave', title:'Spindles and Spike-Wave', favicon:'🧠',
 kicker:'THALAMOCORTICAL · EPILEPSY', h1:'Spindles and Spike-Wave',
 status:'undocumented', pills:['171 populations','1359 connections','apps/thalamocortical-3d.html'],
 desc:'A nineteen-column thalamocortical sheet in which sleep spindles and absence-seizure spike-wave turn out to be the same circuit at different GABA-B.',
 thesis:'The largest model in the project, and its central result is a single dissociation: <b>spindles and spike-wave are the same circuit.</b> In the isolated thalamocortical–reticular loop, thalamic GABA-B alone flips one into the other.',
 circuit:'19 columns × nine cell classes — E2/3 · E4 · E5 · PV · SOM · VIP · NGF — plus <b>TC</b> and <b>RTN</b> per thalamic sector &nbsp;·&nbsp; second-order PSP kernels, dt 0.5 ms',
 notes:[PROV],
 stats:[
  {k:'15.7 Hz',v:'Burst rate at GABA-B 0–8 — a sleep spindle'},
  {k:'1.8 – 2.5 Hz',v:'Burst rate at GABA-B 12–34 — spike-wave. The transition between them is abrupt, not graded.'},
  {k:'×15.7',v:'LFP amplitude of ictal discharges under KCC2 loss (depolarising GABA)'}],
 body:'<p>Conductances are explicit: T-type calcium with a de-inactivation variable, I<sub>h</sub> with a calcium-dependent activation shift, a burst-gated GABA-B cascade, spike-frequency adaptation, synaptic depression and NMDA voltage dependence. The local field potential is synaptic current onto pyramidal dendrites.</p><p><strong>The wake/sleep switch is mechanistic, not a mode flag.</strong> Acetylcholine blocks spike-frequency adaptation, which is exactly why cortex cannot slow-oscillate during waking. A single Down→Up transition <em>is</em> a K-complex.</p><p>GABA-B release requires burst-level presynaptic firing, which is what makes the spindle/spike-wave switch burst-dependent rather than tonic — and reproduces Destexhe’s account of absence seizures.</p>',
 rows:[
  {c:'Wake — persistent Up state with gamma',r:'peak 16–32 Hz'},
  {c:'NREM 2/3 — slow oscillation',r:'delta 92–97%'},
  {c:'Down-state occupancy in NREM',r:'~73%'},
  {c:'Focal seizure with intact surround',r:'focus 0.99 vs ring 0.18'},
  {c:'VIP→SOM→pyramidal disinhibition',r:'SOM 0.50→0.21, E2/3 0.60→0.83'},
  {c:'Lateral weight normalisation edge effect',r:'0.004 – 0.013'}],
 keep:[
  '<strong>E→SOM synapses facilitate, they do not depress.</strong> Uniform depression left SOM, VIP and NGF silent at ~0.07 while PV sat at 0.19.',
  'VIP needs cholinergic drive; NGF needs layer-1 matrix input. Without them the disinhibitory motif does nothing.',
  'Lateral weights must be <strong>normalised by neighbour count</strong>, or the outer ring is systematically hypoexcitable.'],
 openTitle:'Not working, with diagnosis',
 open:[
  '<strong>Propagation.</strong> The focus enters tonic depolarising block and constant drive is absorbed by neighbouring feedforward inhibition. Real recruitment needs paroxysmal <em>bursting</em> — give the focus adaptation so it cycles rather than latching.',
  'Discrete waxing and waning spindle events do not form.',
  '<strong>In-network spike-wave.</strong> The reticular nucleus never reaches GABA-B release threshold at the corticothalamic gain that keeps waking desynchronised. It needs state-dependent gain.']
},
{
 slug:'index-and-replay', title:'Index and Replay', favicon:'🗂️',
 kicker:'HIPPOCAMPUS', h1:'Index and Replay',
 status:'undocumented', pills:['full trisynaptic circuit','apps/hippocampus-index-replay.html'],
 desc:'The trisynaptic circuit with interneuron classes and septal theta, where the sparsity knob turns orthogonal indices into a seizure.',
 thesis:'A complete trisynaptic circuit — entorhinal, dentate, CA3, CA2, CA1, subiculum — with PV and SOM interneurons per field, hilar mossy cells and a medial septum. <b>Turning one inhibitory knob walks it from sparse coding into seizure.</b>',
 circuit:'EC 14 → <b>DG 20</b> → CA3 18 ⇄ CA2 6 → CA1 16 → Sub 8 &nbsp;·&nbsp; PV / SOM per field &nbsp;·&nbsp; hilar mossy cells &nbsp;·&nbsp; medial septum / DBB',
 notes:[PROV],
 stats:[
  {k:'0.93 / 0.13 / 0.94',v:'Theta power: intact, septal lesion, restored'},
  {k:'17% → 100%',v:'CA3 active fraction as PV inhibition falls from 100% to 30% of normal'},
  {k:'R 0.98',v:'CA3 coherence at 30% PV — the whole field firing together. That is a seizure.'}],
 body:'<p>The dentate mossy-fibre detonator synapse selects the index: a few granule cells drive a sparse, near-orthogonal CA3 ensemble. Six bound indices came out <strong>fully orthogonal</strong>, sharing no cells at all.</p><p>Replay walks the encoded route across successive ripples, with within-ripple chaining carried by asymmetric weights.</p><p>The PV titration is the reason the model is worth having. It is a continuous knob, and the pathology at one end is not a bolted-on seizure mode — it is what the same circuit does when sparsity fails.</p>',
 rows:[
  {c:'PV at 100% — normal sparsity',r:'17% CA3 active, R 0.94'},
  {c:'PV at 60%',r:'50% active'},
  {c:'PV at 30%',r:'100% active, R 0.98'},
  {c:'Six bound indices',r:'no shared cells'}],
 keep:[
  'The <strong>diffuse recurrent collateral substrate</strong>. Without it seizure is structurally impossible rather than merely absent — and a model that cannot seize is not a model of this circuit.',
  '<strong>Mossy-fibre detonator index selection.</strong>',
  'The <strong>acetylcholine-dependent encode/retrieve switch</strong>.'],
 open:[
  '<strong>No theta phase precession.</strong> This is the substantive gap: precession is how a behavioural sequence is compressed into one theta cycle so that STDP can write the asymmetric weights replay later reads out.',
  'CA3 sparsity floors at 17% for an arithmetic reason — three cells of eighteen <em>is</em> 17%. It needs CA3 ≥ 60 and DG ≥ 120, then re-tuning.']
},
{
 slug:'two-visual-streams', title:'Two Visual Streams', favicon:'👀',
 kicker:'VENTRAL AND DORSAL VISION', h1:'Two Visual Streams',
 status:'undocumented', pills:['216 conditions','MT error 1.4°','apps/visual-cortex-streams.html'],
 desc:'Retina through V1 to shape and to motion, with the aperture problem emerging rather than being scripted.',
 thesis:'Retina → LGN → V1 → V2 → shape on one path, and Adelson–Bergen motion energy → V3 → V5/MT on the other. Both run from the same front end.',
 circuit:'retina → LGN → <b>V1 oriented filters</b> → V2 angle cells → shape &nbsp;·&nbsp; V1 <b>direction energy</b> → V3 → V5/MT → direction',
 notes:[PROV],
 stats:[
  {k:'100%',v:'Shape classification across 216 conditions, degrading gracefully to chance at noise 1.2'},
  {k:'1.4°',v:'Mean MT direction error'},
  {k:'≈1.0',v:'Orientation entropy for a circle, against corner-angle discrimination at 90° and 60°'}],
 body:'<p>The ventral stream is scale- and rotation-invariant. V2 angle cells discriminate by corner angle — 90° for a square, 60° for a triangle — and a circle is identified by having no corner at all, which shows up as high orientation entropy.</p><p><strong>The aperture problem is emergent.</strong> A drifting bar locks to the direction perpendicular to its own orientation; close the shape and the true direction is recovered. Nothing scripts that — it falls out of pooling local motion energy.</p>',
 rows:[
  {c:'Shape classification, 216 conditions',r:'100%'},
  {c:'Noise degradation',r:'chance at noise 1.2'},
  {c:'MT direction error',r:'1.4° mean'},
  {c:'Aperture problem, open bar',r:'locks perpendicular'},
  {c:'Aperture problem, closed shape',r:'true direction'}],
 keep:[
  'The Gabor kernel must cover <strong>max(σ, σ/γ)</strong>, not σ. A truncated kernel made every shape produce identical features; fixing it moved selectivity from 2.06× to 10.5×.',
  'A <strong>uniform 180° error</strong> in every direction estimate is a sign convention, not a broken computation. The temporal filter was past-minus-future.'],
 open:['No speed tuning.','No MST, no optic flow.','Synchrony here is <strong>depiction only</strong> — the clocks are drawn but do not gate anything. That is a known gap against the project’s own standard.']
},
{
 slug:'higher-order-thalamus', title:'Higher-Order Thalamus', favicon:'🔦',
 kicker:'PULVINAR', h1:'Higher-Order Thalamus',
 status:'negative', pills:['4 experiments, all negative','2 working demonstrations','apps/visual-cortex-pulvinar.html'],
 desc:'Four negative results on pulvinar gating, and the two transthalamic routes that do work.',
 thesis:'Four experiments on transthalamic gating, <b>all negative</b>. The failure modes are characterised, which is the only reason the record is worth keeping.',
 circuit:'V1 ⇄ <b>pulvinar</b> ⇄ V2 &nbsp;·&nbsp; gain gate <code>J<sub>eff</sub>(x) = J<sub>direct</sub> + δJ·λ(x)</code> &nbsp;·&nbsp; retina → <b>superior colliculus</b> → pulvinar → MT',
 notes:[PROV, {t:'<b>Read the failure record before touching this.</b> Spatial gating has a resolution floor at object size — verified, and no gate size helps with overlapping figures.'}],
 stats:[
  {k:'4 / 4',v:'Experiments returning negative results'},
  {k:'2',v:'Transthalamic routes that do work as demonstrations'},
  {k:'0',v:'Predicted benefit of a feature-specific gate for separated figures'}],
 body:'<p>The ventral gain gate follows the Jaramillo–Mejias–Wang formulation and works as a demonstration of transthalamic modulation. The dorsal route — retina to superior colliculus to pulvinar to MT — recovers motion direction with V1 lesioned, which is a working model of <strong>blindsight</strong>.</p><p>What does not work is the thing the experiments were for: using a spatial pulvinar gate to improve segmentation of overlapping figures. The gate cannot resolve below object size, and no gate size rescues it.</p>',
 openTitle:'The open thread, with its prediction stated in advance',
 open:[
  'A <strong>feature-specific</strong> gate — λ(x,θ) instead of λ(x). Predicted: <strong>zero</strong> benefit for separated figures, and <strong>positive</strong> benefit only in the partial-to-full overlap range where spatial gating failed.',
  'That prediction is registered here so it cannot be reinterpreted afterwards.']
},
{
 slug:'cochlea-to-belt', title:'Cochlea to Belt', favicon:'🔊',
 kicker:'AUDITORY CORTEX', h1:'Cochlea to Belt',
 status:'undocumented', pills:['12/12 in stage 19','apps/auditory-cortex.html'],
 desc:'The visual receptive-field machinery re-cast onto frequency and time, where an oriented filter becomes a frequency sweep.',
 thesis:'The same oriented-filter machinery as the visual model, re-cast onto a frequency × time cochleagram. <b>Orientation becomes FM sweep direction.</b> Same clocks, different axes.',
 circuit:'ERB-spaced constant-Q <b>cochlea</b> → lateral suppression → MGv → <b>A1 oriented Gabors</b> = FM sweeps → belt harmonic-template pitch',
 notes:[PROV],
 stats:[
  {k:'12 / 12',v:'Stage 19 checks in the integrated loop'},
  {k:'6',v:'Classes resolved: tone, harmonic, noise, up-sweep, down-sweep, AM'},
  {k:'40',v:'Cochlear channels — and the reason tone versus harmonic is not resolved'}],
 body:'<p>The point of this model is economy rather than novelty: a Gabor oriented in the frequency–time plane <em>is</em> a frequency sweep detector, so the visual front end transfers directly with its axes relabelled. Shamma’s ripple and modulation framework says this is the right analogy, and the model is a test of how far it carries.</p><p>The belt stage does harmonic-template pitch extraction on top.</p>',
 rows:[
  {c:'Tone / harmonic / noise / sweeps / AM',r:'classified'},
  {c:'FM sweep direction from Gabor orientation',r:'up and down separable'},
  {c:'Cross-modal binding through the same index',r:'8/8 (stage 20)'},
  {c:'Tone versus harmonic complex at 40 channels',r:'not resolved',tone:'bad'}],
 keep:['An oriented filter in frequency × time <strong>is</strong> a sweep detector. The visual machinery transfers with nothing more than an axis relabel.'],
 open:['Tone versus harmonic complex is unresolved at 40 channels. This is a stated resolution limit, not a tuning failure — it needs more channels.']
}];
