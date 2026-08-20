module.exports = [
{
 slug:'kuramoto-assembly', title:'Clocks and Assemblies', favicon:'🕰️',
 kicker:'CORTICAL ASSEMBLIES', h1:'Clocks and Assemblies',
 status:'validated', pills:['14/14 checks','10 seeds','models/kuramoto-assembly.js'],
 desc:'The project thesis as a runnable model: an assembly is a set of phase-clocks locked in synchrony, and learning is a change in the coupling that carries it.',
 thesis:'The canonical statement of the project thesis, and the first model here where <b>synchrony does work</b>: the coupling that carries the synchrony is the same quantity the plasticity reads and writes.',
 circuit:'24 phase-clocks &nbsp;·&nbsp; <b>dK<sub>ij</sub> ∝ cos(θ<sub>j</sub>−θ<sub>i</sub>) − c₀</b> &nbsp;→&nbsp; co-phase = LTP, anti-phase = LTD &nbsp;·&nbsp; subtractive competition &nbsp;·&nbsp; repulsive feedback inhibition',
 stats:[
  {k:'0.996 ± 0.002',v:'Assembly coherence R after encoding, against a background at 0.097 ± 0.072'},
  {k:'0.997 ± 0.002',v:'Recall from a partial cue — 2 clocks of 6, weights frozen'},
  {k:'≈179°',v:'Phase separation between two coexisting assemblies, cross-coupling 0.00'}],
 body:'<p>An assembly is not a box of cells. It is a coalition of oscillators that have fallen into phase, and membership is graded by how tightly each clock locks. The plasticity rule reads the phase difference directly: clocks that fire together strengthen their coupling, clocks in anti-phase weaken it.</p><p>Because the learned quantity <em>is</em> the coupling, synchrony is not a readout of the memory — it is the memory. Encoding and retrieval are gated separately, as acetylcholine gates the hippocampus.</p>',
 rows:[
  {c:'Bare Kuramoto transition (plasticity off)',r:'R 0.39 → 0.996'},
  {c:'LTP writes a synchronous assembly',r:'R 0.999 vs background 0.054'},
  {c:'Pattern completion from 2 of 6 clocks',r:'R 0.996, global 0.001'},
  {c:'LTD/LTP rule in isolation',r:'co-phase K 2.60 · anti 0.00'},
  {c:'Two assemblies coexist, mutually decoupled',r:'R 0.998 / 0.998, cross-K 0.00'},
  {c:'Retention across 15 s of disuse',r:'R 0.996, global 0.002'}],
 keep:[
  '<strong>Subtractive</strong> synaptic normalisation, not multiplicative — it is what makes membership crisp rather than graded into mush.',
  '<strong>Repulsive</strong> feedback inhibition. The sign matters: <code>+</code> desynchronises, and that repulsion is what makes assemblies selective instead of merging into one global lock.',
  'A <strong>rotating</strong> stimulus. A static phase cannot entrain a rotating clock — this is not a detail, it is why the drive works at all.'],
 open:[
  'Retroactive interference is real: a new engram measurably weakens an older one.',
  'Assembly size is fixed rather than emergent.',
  'No asymmetric STDP rule yet. A β-offset would write <em>directed</em> assemblies — sequences — which is the bridge to replay and to timing.']
},
{
 slug:'basal-ganglia', title:'Goal-Directed Selection', favicon:'🎯',
 kicker:'ACTION SELECTION', h1:'Goal-Directed Selection',
 status:'validated', pills:['20/20 checks','12/12 seeds','models/basal-ganglia.js'],
 desc:'A mean-field oscillator basal ganglia in which selection is learned, and akinesia, chorea and parkinsonian beta all emerge from the same circuit.',
 thesis:'Motor plans idle as competing cortical assemblies. A goal makes them compete, dopamine <b>tags</b> the plan whose learned corticostriatal weight wins, and reward shapes those weights so each goal evokes its own plan.',
 circuit:'cortex ⇄ <b>D1 / D2</b> → GPe ⇄ STN → GPi ⊣ thalamus → cortex &nbsp;·&nbsp; striosome → SNc &nbsp;·&nbsp; <b>assemblies carry synchrony, relays carry rate</b>',
 stats:[
  {k:'0.99',v:'Coherence of the winning plan when a learned goal selects it'},
  {k:'1.0 → 0.05',v:'Dopamine burst shrinking as a cue is learned — an emergent reward-prediction error'},
  {k:'−1.0',v:'Dopamine dip on an omitted but expected reward'}],
 body:'<p><strong>The dual code is the design.</strong> Assembly populations — cortex and thalamus — carry selection as synchrony, transmitting <code>act·(0.5+0.5R)</code> so the loop closes only when coherent. Relay populations — D1, D2, GPe, STN, GPi, FSI, TRN — are pure rate, because pallidal gating is disinhibition rather than synchrony and a healthy striatum is decorrelated. The one functional relay synchrony is pathological beta.</p><p>The earlier version got stuck: once a plan locked, only a hypodopaminergic state could switch it, which is biologically wrong. The fix was making D1 goal-driven with no term from its own cortex. Removing the goal now releases the plan and changing the goal switches it, with no dopamine change required.</p>',
 rows:[
  {c:'Rest, no goal — nothing escapes cortex',r:'sel = −1'},
  {c:'A learned goal selects its plan',r:'sel = 2, R = 0.99'},
  {c:'Release: remove the goal',r:'sel = −1, not stuck'},
  {c:'Switch: change the goal, no DA change',r:'goal0→0, goal1→3'},
  {c:'Hypodopaminergic (DA 0.05) — akinesia',r:'no plan tagged'},
  {c:'D2-MSN degeneration 0.9 — chorea',r:'≥2 plans escape'},
  {c:'Beta at low dopamine',r:'Δ 0.34 vs healthy'},
  {c:'STN-DBS in moderate PD',r:'selection restored'},
  {c:'Striosome critic learns cue value',r:'V → 0.97'}],
 keep:[
  'The <strong>dual code</strong>. Pure-synchrony transmission on relay nuclei deadlocks the bootstrap; pure rate on assemblies loses selection.',
  '<strong>D1 goal-driven, not cortex-driven</strong> — the single change that unsticks selection.',
  'The <strong>desync repulsion sign</strong>: <code>+</code> pushes apart, <code>−</code> silently synchronises and akinesia disappears.',
  'Beta <strong>clamps the thalamus, not the surround</strong>. It sits downstream of GPi, which is why D1-Go cannot bypass it and why DBS rescues by desynchronising rather than by restoring dopamine.',
  'Dopamine is the <strong>prediction error, not the reward</strong> — otherwise there is no Schultz transfer and no omission dip.'],
 open:['Cholinergic TANs: the pause would gate <em>when</em> the prediction error is written, and modulate the acetylcholine–dopamine balance relevant to Parkinson’s and dystonia.']
},
{
 slug:'cerebellum', title:'Cerebellar Adaptation', favicon:'👁️',
 kicker:'SUPERVISED MOTOR LEARNING', h1:'Cerebellar Adaptation',
 status:'validated', pills:['10/10 VOR','7/7 timing','12/12 seeds','models/cerebellum.js'],
 desc:'Vestibulo-ocular reflex gain adaptation and timed saccades as an adaptive filter, with a gap-junction-coupled inferior olive as the teaching clock.',
 thesis:'Supervised motor learning as an <b>adaptive filter</b>. The head rotates, the eyes must counter-rotate, and retinal slip is the error the inferior olive reports as climbing-fibre complex spikes driving parallel-fibre LTD.',
 circuit:'mossy → <b>granule basis</b> (Golgi-sparsified) → Purkinje <code>Σ w<sub>k</sub>·PF<sub>k</sub></code> ⊣ DCN → motoneuron → eye &nbsp;·&nbsp; <b>inferior olive</b> (gap-junction oscillators) → climbing fibre',
 stats:[
  {k:'1.0 → 1.45',v:'VOR gain adapting up at demand 1.6; residual slip halves from 0.44 to 0.15'},
  {k:'0.23 → 0.86',v:'Olivary coherence R, uncoupled versus gap-junction coupled'},
  {k:'0.435 – 0.458',v:'Learned saccade peak times for a target interval of 0.45 s'}],
 body:'<p>Granule cells expand the mossy input into a sparse phase basis. One Purkinje cell reads a weighted sum of it, and the covariance rule <code>Δw ∝ −(CF−cf₀)·PF</code> decorrelates the error from the basis until slip goes to zero and gain matches demand.</p><p><strong>Dual code again.</strong> The inferior olive is a genuine gap-junction-coupled oscillator population whose synchrony organises complex-spike timing — the one functional synchrony. The cortical microcircuit is rate plus plastic weights.</p><p>The second task is where the nucleo-olivary loop finally stars: granule time cells tile the interval after a cue, a climbing-fibre pulse carves a timed Purkinje pause, and the learned response cancels the teaching pulse so timing self-stabilises.</p>',
 rows:[
  {c:'Baseline at demand 1',r:'gain ≈ 1.0, ~40% granule active'},
  {c:'VOR gain-up (demand 1.6)',r:'1.34 – 1.70 across seeds'},
  {c:'VOR gain-down (demand 0.5)',r:'0.53 – 0.75 across seeds'},
  {c:'Inferior-olive lesion',r:'Δgain ≈ 0 — no learning'},
  {c:'Savings on re-adaptation',r:'re-adapts in ¼ the trials'},
  {c:'Timed saccade re-times when T* moves',r:'7/7'}],
 keep:[
  'The teaching signal reads the <strong>graded complex-spike probability, not the bursty sample</strong>. Otherwise weights random-walk on baseline noise — the sampled spikes are display only.',
  '<strong>Auto-calibrate cf₀</strong>, the drive-free baseline the error is signed against.',
  'Centre the olivary membrane at <strong>zero</strong> so slip is a <em>signed</em> teaching signal and one microzone can learn both directions.',
  'A CF lesion must remove the <strong>whole olive</strong> — slip drive and nucleo-olivary feedback together — or the loop learns on noise.',
  'Nucleo-olivary feedback <strong>gates, it does not sharpen</strong>. It is a population-level effect, small per seed; do not claim it lowers slip in the VOR task.'],
 open:['The temporal basis built for timed saccades is the bridge to the timing work, and has not yet been connected to it.']
},
{
 slug:'amygdala', title:'Threat Conditioning', favicon:'⚡',
 kicker:'ASSOCIATIVE THREAT LEARNING', h1:'Threat Conditioning',
 status:'validated', pills:['12/12 checks','12/12 seeds','models/amygdala.js'],
 desc:'Pavlovian fear learning under an aversive prediction error, with extinction as separate context-gated safety learning layered on an intact engram.',
 thesis:'The third member of the learning trio — basal ganglia for appetitive prediction error, cerebellum for supervised error, amygdala for <b>associative threat learning under an aversive prediction error</b>.',
 circuit:'CS + US → <b>lateral amygdala</b> (Hebbian, PE-gated) → CeL-on ⊣ CeL-off → <b>disinhibits CeM</b> → freezing &nbsp;·&nbsp; infralimbic mPFC → intercalated cells ⊣ CeM &nbsp;·&nbsp; <b>LA⟷PL theta</b>',
 stats:[
  {k:'0.00 → 0.60',v:'CS+ freezing across acquisition, while CS− stays at 0.001'},
  {k:'0.91 vs 0.56',v:'LA–prelimbic theta coherence in fear versus safety — synchrony amplifying transmission'},
  {k:'0.88',v:'Lateral-amygdala engram weight, unchanged by complete extinction of behaviour'}],
 body:'<p>Learning is gated by an aversive prediction error in the Rescorla–Wagner sense, so a fully predicted shock teaches nothing and blocking falls out for free.</p><p><strong>Extinction is not unlearning.</strong> It is separate, context-gated safety learning routed through the intercalated cells onto CeM, layered on top of an engram that stays intact. That is why renewal comes free: shift the context and the fear returns at 0.62 with the engram untouched.</p><p>The functional synchrony is theta coherence between lateral amygdala and prelimbic cortex, which amplifies transmission — fear raises the coupling, safety lowers it.</p>',
 rows:[
  {c:'Acquisition and CS− discrimination',r:'0.60 vs 0.001'},
  {c:'US prediction error falls as CS predicts',r:'0.88 → 0.35'},
  {c:'CeL-on ⊣ CeL-off gating of CeM',r:'fear 0.61 / rest 0'},
  {c:'Extinction of behaviour',r:'0.60 → 0'},
  {c:'Engram survives extinction',r:'w 0.88 unchanged'},
  {c:'Renewal on context shift',r:'freezing 0.62 returns'}],
 keep:[
  'Learn on the <strong>aversive prediction error, not the raw US</strong>, or there is no blocking.',
  'The <strong>US must unwrite safety</strong>. Otherwise acquisition builds extinction as it goes and fear can never be expressed.',
  'Extinction as <strong>new learning on an intact engram</strong> — the precondition for renewal.',
  'Keep the <strong>intercalated baseline near zero</strong>, or tonic inhibition eats CeM before anything happens.',
  '<strong>Measure fear with learning frozen.</strong> Within-session extinction is fast enough to corrupt the measurement otherwise.'],
 open:['Reinstatement and spontaneous recovery are not modelled.','Context is a bare parameter; it should come from the hippocampus.']
}];
