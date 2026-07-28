"use strict";
/* =====================================================================
   Visual streams — FAITHFUL headless extraction of apps/visual-cortex-streams.html.

   VENTRAL ("what"):  retina DoG → LGN (surround + gain control) → V1 simple (Gabor
   quadrature) → V1 complex (energy, phase-invariant) → V2 angle/curvature cells.
   Output: four 10×10 maps (D60, D90, CURV, EDGE) = the 400-d shape code.

   DORSAL ("where"):  temporal filtering → V1 direction-selective motion energy
   (Adelson & Bergen 1985) → V3 form×motion conjunction → V5/MT pattern cells.
   Output: P[12] direction vector, population-vector direction + coherence.

   Renderer removed; dynamics verbatim. test/stage6_vision.js re-verifies the documented
   numbers (shape classification, MT direction error ≈1.4°) before anything is built on it.
   ===================================================================== */

// Retina -> LGN -> V1 simple -> V1 complex -> V2 (angle/curvature) -> decision
const N=40;                 // retina grid
const NORI=12;              // 15 deg steps: 60 deg = 4 steps, 90 deg = 6 steps
const ORI=[...Array(NORI).keys()].map(i=>i*Math.PI/NORI);

/* ---------- stimulus ---------- */
function drawShape(kind,{size=0.52,rot=0,cx=0,cy=0,noise=0,thick=0}={}){
  const img=new Float64Array(N*N);
  const R=size*N/2, ox=N/2+cx*N, oy=N/2+cy*N;
  const inside=(x,y)=>{
    let dx=x-ox, dy=y-oy;
    const c=Math.cos(-rot), s=Math.sin(-rot);
    const X=dx*c-dy*s, Y=dx*s+dy*c;
    if(kind==='bar') return Math.abs(Y)<=R*0.22 && Math.abs(X)<=R*1.9;
    if(kind==='circle') return Math.hypot(X,Y)<=R;
    if(kind==='square') return Math.abs(X)<=R*0.88&&Math.abs(Y)<=R*0.88;
    if(kind==='triangle'){
      // true equilateral, apex up: sides at 60 deg from horizontal
      const a=R*1.02, h=a*Math.SQRT2*Math.sqrt(1.5);   // h = a*sqrt(3)
      const yTop=-2*h/3, yBot=h/3;
      if(Y<yTop||Y>yBot) return false;
      const w=a*(Y-yTop)/h;
      return Math.abs(X)<=w;
    }
    return false;
  };
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){
    let v=0;
    for(const [dx,dy] of [[0.25,0.25],[0.75,0.25],[0.25,0.75],[0.75,0.75]])
      v+=inside(x+dx,y+dy)?0.25:0;      // 4x supersample for smooth edges
    img[y*N+x]=v;
  }
  if(thick>0){  // outline mode: subtract an eroded copy
    const er=new Float64Array(N*N);
    for(let y=1;y<N-1;y++)for(let x=1;x<N-1;x++){
      let m=1;
      for(let j=-thick;j<=thick;j++)for(let i=-thick;i<=thick;i++)
        m=Math.min(m,img[(y+j)*N+(x+i)]||0);
      er[y*N+x]=m;
    }
    for(let i=0;i<N*N;i++) img[i]=Math.max(0,img[i]-er[i]);
  }
  if(noise>0) for(let i=0;i<N*N;i++) img[i]=Math.max(0,Math.min(1,img[i]+(Math.random()-0.5)*noise));
  return img;
}

/* ---------- separable gaussian blur ---------- */
function blur(src,sig){
  const k=Math.max(1,Math.ceil(sig*3)), w=[];
  let s=0; for(let i=-k;i<=k;i++){const v=Math.exp(-i*i/(2*sig*sig));w.push(v);s+=v;}
  for(let i=0;i<w.length;i++)w[i]/=s;
  const tmp=new Float64Array(N*N), out=new Float64Array(N*N);
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){
    let a=0;for(let i=-k;i<=k;i++){const xx=Math.min(N-1,Math.max(0,x+i));a+=w[i+k]*src[y*N+xx];}
    tmp[y*N+x]=a;}
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){
    let a=0;for(let i=-k;i<=k;i++){const yy=Math.min(N-1,Math.max(0,y+i));a+=w[i+k]*tmp[yy*N+x];}
    out[y*N+x]=a;}
  return out;
}

/* ---------- retina: DoG ganglion cells ---------- */
function retina(img,{sc=0.9,ss=2.2,ws=0.85}={}){
  const c=blur(img,sc), s=blur(img,ss);
  const on=new Float64Array(N*N), off=new Float64Array(N*N), sd=new Float64Array(N*N);
  for(let i=0;i<N*N;i++){
    const d=c[i]-ws*s[i];
    sd[i]=d; on[i]=Math.max(0,d); off[i]=Math.max(0,-d);
  }
  return {on,off,signed:sd};
}

/* ---------- LGN: relay + surround (reticular-like) inhibition + gain control ---------- */
function lgn(R,{kSur=0.55,gain=1.6,sat=0.55}={}){
  const on=new Float64Array(N*N), off=new Float64Array(N*N), sd=new Float64Array(N*N);
  const sOn=blur(R.on,2.6), sOff=blur(R.off,2.6);
  for(let i=0;i<N*N;i++){
    const a=Math.max(0,R.on[i]-kSur*sOn[i]), b=Math.max(0,R.off[i]-kSur*sOff[i]);
    on[i]=gain*a/(sat+gain*a); off[i]=gain*b/(sat+gain*b);
    sd[i]=on[i]-off[i];
  }
  return {on,off,signed:sd};
}

/* ---------- V1 simple: oriented Gabor quadrature pairs ---------- */
// VALIDATED Gabor parameters. The reference app calls rebuildGabors({sigma:3,lambda:4,gamma:0.30})
// at start-up, so the file-level literals below were NEVER the settings the model was validated
// with. Extracting them verbatim silently gave 52% shape classification instead of 100%; with the
// real settings it is 100.0% over 81 conditions. Do not "restore" these to the literals.
let GP={sigma:3.0,lambda:4.0,gamma:0.30};
function gaborKernel(th,phase,o){
  const sigma=(o&&o.sigma)||GP.sigma, lambda=(o&&o.lambda)||GP.lambda, gamma=(o&&o.gamma)||GP.gamma;
  // kernel must cover the ELONGATED axis (sigma/gamma), otherwise the filter is
  // truncated and orientation tuning collapses
  const k=Math.ceil(Math.max(sigma,sigma/gamma)*2.6), K=[];
  const ct=Math.cos(th), st=Math.sin(th);
  let pos=0,neg=0;
  for(let j=-k;j<=k;j++)for(let i=-k;i<=k;i++){
    const X=i*ct+j*st, Y=-i*st+j*ct;
    const g=Math.exp(-(X*X+gamma*gamma*Y*Y)/(2*sigma*sigma))*Math.cos(2*Math.PI*X/lambda+phase);
    K.push({i,j,g}); if(g>0)pos+=g; else neg-=g;
  }
  const m=(pos+neg)/2||1;
  K.forEach(e=>e.g/=m);
  return {K,k};
}
let GK=ORI.map(th=>[gaborKernel(th,0),gaborKernel(th,Math.PI/2)]);
function rebuildGabors(p){Object.assign(GP,p||{});
  GK=ORI.map(th=>[gaborKernel(th,0),gaborKernel(th,Math.PI/2)]);}
function v1simple(L){
  const out=[];
  for(let o=0;o<NORI;o++){
    const ph=[];
    for(let p=0;p<2;p++){
      const {K}=GK[o][p], m=new Float64Array(N*N);
      for(let y=0;y<N;y++)for(let x=0;x<N;x++){
        let a=0;
        for(const e of K){
          const xx=x+e.i, yy=y+e.j;
          if(xx<0||yy<0||xx>=N||yy>=N) continue;
          a+=e.g*L.signed[yy*N+xx];
        }
        m[y*N+x]=a;
      }
      ph.push(m);
    }
    out.push(ph);
  }
  return out;   // [ori][phase] -> map ; simple cell rate = relu(+/-)
}
/* ---------- V1 complex: energy model (phase invariant) ---------- */
const NC=20;                                  // complex-cell grid
function v1complex(S,{pool=1.4,norm=0.35,pw=1}={}){
  const step=N/NC;
  const C=[];
  for(let o=0;o<NORI;o++) C.push(new Float64Array(NC*NC));
  for(let cy=0;cy<NC;cy++)for(let cx=0;cx<NC;cx++){
    const x0=Math.round((cx+0.5)*step), y0=Math.round((cy+0.5)*step);
    const rad=Math.max(1,Math.round(pool));
    for(let o=0;o<NORI;o++){
      let e=0,n=0;
      for(let j=-rad;j<=rad;j++)for(let i=-rad;i<=rad;i++){
        const xx=x0+i, yy=y0+j;
        if(xx<0||yy<0||xx>=N||yy>=N) continue;
        const a=S[o][0][yy*N+xx], b=S[o][1][yy*N+xx];
        e+=a*a+b*b; n++;
      }
      C[o][cy*NC+cx]=Math.pow(Math.sqrt(e/Math.max(1,n)),pw);
    }
    // divisive normalisation across orientations
    let tot=0; for(let o=0;o<NORI;o++) tot+=C[o][cy*NC+cx];
    for(let o=0;o<NORI;o++) C[o][cy*NC+cx]=C[o][cy*NC+cx]/(norm+tot);
  }
  return C;
}

/* ---------- V2: angle-selective (corner) cells + curvature ---------- */
// At a corner two edge orientations coexist inside one RF; along a straight edge only
// one does; on a smooth curve the dominant orientation rotates between neighbours.
const V2N=10;
function v2(C,{thr=0.02}={}){
  const step=NC/V2N;
  const D60=new Float64Array(V2N*V2N), D90=new Float64Array(V2N*V2N),
        CURV=new Float64Array(V2N*V2N), EDGE=new Float64Array(V2N*V2N);
  const d60=Math.round(60/(180/NORI)), d90=Math.round(90/(180/NORI));
  for(let vy=0;vy<V2N;vy++)for(let vx=0;vx<V2N;vx++){
    const x0=Math.floor(vx*step), y0=Math.floor(vy*step);
    const H=new Float64Array(NORI);
    let tot=0;
    for(let j=0;j<step;j++)for(let i=0;i<step;i++){
      const xx=x0+i,yy=y0+j; if(xx>=NC||yy>=NC)continue;
      for(let o=0;o<NORI;o++){const v=C[o][yy*NC+xx];H[o]+=v;tot+=v;}
    }
    EDGE[vy*V2N+vx]=tot;
    if(tot<thr) continue;
    for(let o=0;o<NORI;o++) H[o]/=tot;
    let a60=0,a90=0;
    for(let o=0;o<NORI;o++){
      a60+=H[o]*H[(o+d60)%NORI];
      a90+=H[o]*H[(o+d90)%NORI];
    }
    D60[vy*V2N+vx]=a60*tot; D90[vy*V2N+vx]=a90*tot;
    // curvature: single dominant orientation locally (low entropy) but non-zero energy
    let mx=0;for(let o=0;o<NORI;o++)mx=Math.max(mx,H[o]);
    CURV[vy*V2N+vx]=mx*tot;
  }
  return {D60,D90,CURV,EDGE};
}
function features(V){
  const sum=a=>a.reduce((x,y)=>x+y,0);
  const e=sum(Array.from(V.EDGE))||1e-9;
  return {corner60:sum(Array.from(V.D60))/e, corner90:sum(Array.from(V.D90))/e,
          curv:sum(Array.from(V.CURV))/e, edge:e};
}

/* ---------- global orientation statistics ---------- */
function oriStats(C){
  const H=new Float64Array(NORI); let tot=0;
  for(let o=0;o<NORI;o++){let s=0;for(let i=0;i<NC*NC;i++)s+=C[o][i];H[o]=s;tot+=s;}
  if(tot<=0) return {H,entropy:0,peaks:0};
  for(let o=0;o<NORI;o++)H[o]/=tot;
  let e=0;for(let o=0;o<NORI;o++) if(H[o]>0) e-=H[o]*Math.log(H[o]);
  e/=Math.log(NORI);                       // 0 = one orientation, 1 = uniform
  let peaks=0;
  for(let o=0;o<NORI;o++){
    const a=H[(o-1+NORI)%NORI],b=H[o],c=H[(o+1)%NORI];
    if(b>a&&b>=c&&b>1.25/NORI) peaks++;
  }
  return {H,entropy:e,peaks};
}

/* ---------- decision layer: 3 units, mutual inhibition ---------- */
const DEC=['square','triangle','circle'];
function drives(f){
  return [ f.corner90*5.0,
           f.corner60*5.0,
           Math.max(0,(f.entropy-0.88)/0.12)*0.75 ];
}
function classify(f){
  const d=drives(f);
  let st=[0,0,0];
  for(let t=0;t<400;t++){          // settle the competition
    const nx=[0,0,0];
    for(let i=0;i<3;i++){
      let inh=0; for(let j=0;j<3;j++) if(j!==i) inh+=st[j];
      nx[i]=Math.max(0,Math.min(1,d[i]-0.85*inh));
    }
    for(let i=0;i<3;i++) st[i]+=(nx[i]-st[i])*0.08;
  }
  let mi=0; for(let i=1;i<3;i++) if(st[i]>st[mi]) mi=i;
  const sorted=[...st].sort((a,b)=>b-a);
  return {label:DEC[mi],state:st,drives:d,margin:sorted[0]-sorted[1]};
}
function pipeline(kind,opt){
  const img=drawShape(kind,opt||{});
  const R=retina(img), L=lgn(R), S=v1simple(L), C=v1complex(S,{pw:2});
  const V=v2(C), f=features(V), st=oriStats(C);
  const ff={...f,entropy:st.entropy,peaks:st.peaks};
  return {img,R,L,S,C,V,f:ff,ori:st,dec:classify(ff)};
}


// Motion pathway: temporal filtering -> V1 direction-selective motion energy
// (Adelson & Bergen 1985) -> V3 form/motion conjunction -> V5/MT pattern cells.

const NM=24;                 // motion pathway runs at coarser resolution (MT has big RFs)
const NDIR=12;               // MT directions over full 360 deg
const NPH=10;                // precomputed motion phases

/* small Gabors for the motion pathway (less elongated: speed over orientation precision) */
function mGabor(th,phase,{sigma=2.0,lambda=4.0,gamma=0.55}={}){
  const k=Math.ceil(Math.max(sigma,sigma/gamma)*2.2),K=[];
  const ct=Math.cos(th),st=Math.sin(th);let pos=0,neg=0;
  for(let j=-k;j<=k;j++)for(let i=-k;i<=k;i++){
    const X=i*ct+j*st,Y=-i*st+j*ct;
    const g=Math.exp(-(X*X+gamma*gamma*Y*Y)/(2*sigma*sigma))*Math.cos(2*Math.PI*X/lambda+phase);
    K.push({i,j,g});if(g>0)pos+=g;else neg-=g;}
  const m=(pos+neg)/2||1;K.forEach(e=>e.g/=m);
  return K;
}
const MGK=ORI.map(th=>[mGabor(th,0),mGabor(th,Math.PI/2)]);

function downsample(map,from,to){
  const out=new Float64Array(to*to),st=from/to;
  for(let y=0;y<to;y++)for(let x=0;x<to;x++){
    let s=0,c=0;
    for(let b=0;b<st;b++)for(let a=0;a<st;a++){
      const xx=Math.floor(x*st+a),yy=Math.floor(y*st+b);
      if(xx<from&&yy<from){s+=map[yy*from+xx];c++;}}
    out[y*to+x]=c?s/c:0;}
  return out;
}
function conv(map,K){
  const out=new Float64Array(NM*NM);
  for(let y=0;y<NM;y++)for(let x=0;x<NM;x++){
    let a=0;
    for(const e of K){const xx=x+e.i,yy=y+e.j;
      if(xx<0||yy<0||xx>=NM||yy>=NM)continue;a+=e.g*map[yy*NM+xx];}
    out[y*NM+x]=a;}
  return out;
}

/* ---- build the motion sequence and extract direction-selective energy ---- */
function motionSequence(kind,opt,mot){
  // mot: {type:'translate'|'rotate', dir, speed, spin}
  const frames=[];
  for(let p=0;p<NPH;p++){
    const t=p/NPH;
    let o={...opt};
    if(mot.type==='rotate') o.rot=(opt.rot||0)+mot.spin*t*Math.PI*2;
    else{
      const d=mot.dir, amp=mot.speed;
      o.cx=(opt.cx||0)+Math.cos(d)*amp*(t-0.5);
      o.cy=(opt.cy||0)+Math.sin(d)*amp*(t-0.5);
    }
    const img=drawShape(kind,o);
    const L=lgn(retina(img));
    frames.push(downsample(L.signed,N,NM));
  }
  return frames;
}
function motionEnergy(frames){
  // spatial quadrature per frame
  const Se=[],So=[];
  for(let p=0;p<NPH;p++){
    Se.push(ORI.map((_,o)=>conv(frames[p],MGK[o][0])));
    So.push(ORI.map((_,o)=>conv(frames[p],MGK[o][1])));
  }
  // temporal filters across phases: slow (lowpass) and fast (biphasic)
  const Ts=[0.25,0.50,0.25], Tf=[-0.5,0.0,0.5];   // proper dS/dt (was time-reversed)
  // energy[o][dir 0=+theta,1=-theta] summed over space and phase
  const E=[];for(let o=0;o<NORI;o++)E.push([0,0]);
  const Emap=[];for(let o=0;o<NORI;o++)Emap.push([new Float64Array(NM*NM),new Float64Array(NM*NM)]);
  for(let p=1;p<NPH-1;p++){
    for(let o=0;o<NORI;o++){
      for(let i=0;i<NM*NM;i++){
        let se_s=0,se_f=0,so_s=0,so_f=0;
        for(let k=-1;k<=1;k++){
          se_s+=Ts[k+1]*Se[p+k][o][i]; se_f+=Tf[k+1]*Se[p+k][o][i];
          so_s+=Ts[k+1]*So[p+k][o][i]; so_f+=Tf[k+1]*So[p+k][o][i];
        }
        const R1=se_f+so_s, R2=so_f-se_s;
        const L1=se_f-so_s, L2=so_f+se_s;
        const er=R1*R1+R2*R2, el=L1*L1+L2*L2;
        const opp=er-el;
        if(opp>0){E[o][0]+=opp;Emap[o][0][i]+=opp;} else {E[o][1]-=opp;Emap[o][1][i]-=opp;}
      }
    }
  }
  return {E,Emap};
}
/* ---- V5 / MT pattern cells: integrate components over orientation ---- */
function mt(E,{q=1.6}={}){
  const P=new Float64Array(NDIR);
  for(let d=0;d<NDIR;d++){
    const phi=d*2*Math.PI/NDIR;
    let s=0;
    for(let o=0;o<NORI;o++){
      const th=o*Math.PI/NORI;
      for(const [k,dirAng] of [[0,th],[1,th+Math.PI]]){
        const w=Math.cos(phi-dirAng);
        if(w>0) s+=E[o][k]*Math.pow(w,q);
      }
    }
    P[d]=s;
  }
  let tot=0;for(let d=0;d<NDIR;d++)tot+=P[d];
  // population vector = MT's estimate of true direction
  let vx=0,vy=0;
  for(let d=0;d<NDIR;d++){const phi=d*2*Math.PI/NDIR;vx+=P[d]*Math.cos(phi);vy+=P[d]*Math.sin(phi);}
  const dir=Math.atan2(vy,vx), coh=tot>0?Math.hypot(vx,vy)/tot:0;
  return {P,dir:(dir+2*Math.PI)%(2*Math.PI),coherence:coh,total:tot};
}
/* ---- V3: form x motion conjunction; how consistent are components with one velocity ---- */
function v3(E,M){
  let agree=0,tot=0;
  for(let o=0;o<NORI;o++){
    const th=o*Math.PI/NORI;
    for(const [k,dirAng] of [[0,th],[1,th+Math.PI]]){
      const w=Math.cos(M.dir-dirAng);
      tot+=E[o][k];
      if(w>0) agree+=E[o][k]*w;
    }
  }
  const nOri=E.filter(e=>(e[0]+e[1])>0.05*tot/NORI).length;
  return {consistency:tot>0?agree/tot:0, activeOri:nOri, total:tot};
}

module.exports = {
  N, NORI, ORI, NC, V2N, NM, NDIR, NPH,
  drawShape, blur, retina, lgn, v1simple, v1complex, v2, rebuildGabors,
  mGabor, downsample, conv, motionSequence, motionEnergy, mt, v3,
  features, oriStats, drives, classify, pipeline, DEC,
};
