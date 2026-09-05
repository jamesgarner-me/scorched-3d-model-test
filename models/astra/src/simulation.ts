export type V = [number,number,number];
export const add=(a:V,b:V):V=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
export const mul=(a:V,s:number):V=>[a[0]*s,a[1]*s,a[2]*s];
export const dot=(a:V,b:V)=>a.reduce((s,v,i)=>s+v*b[i],0);
export const len=(a:V)=>Math.sqrt(dot(a,a));
export const norm=(a:V)=>mul(a,1/(len(a)||1));
export const dist=(a:V,b:V)=>len(add(a,mul(b,-1)));
export const cross=(a:V,b:V):V=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export const rng=(seed:number)=>()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
export interface World {seed:number;radius:number;preset:'earth'|'mars';wind:V;gravity:number;craters:{p:V;r:number;depth:number}[];tanks:V[]}
export function height(w:World,n:V){const s=w.seed%1000;let h=Math.sin(n[0]*7+s)*Math.cos(n[1]*6-s)*1.05+Math.sin(n[2]*12+n[0]*5+s)*.48+Math.cos(n[1]*21+n[2]*16+s)*.17; h+=.25; let r=w.radius+h; for(const c of w.craters){const d=dist(mul(n,w.radius),mul(norm(c.p),w.radius));if(d<c.r&&!w.tanks.some(t=>dist(mul(n,w.radius),mul(norm(t),w.radius))<.72))r-=c.depth*(1-d*d/(c.r*c.r));}return r;}
export function surface(w:World,n:V){return Math.max(w.preset==='earth'?w.radius-.18:0,height(w,n))}
export function createWorld(seed:number,preset:World['preset']):World{const random=rng(seed); const w:World={seed,preset,radius:10+random()*1.5,gravity:preset==='earth'?5.4:3.6,wind:[(random()-.5)*.6,(random()-.5)*.3,(random()-.5)*.6],craters:[],tanks:[]};for(const base of [[-.56,.65,.52],[.65,.55,.48]] as V[]){let n=norm(base);for(let i=0;i<200&&height(w,n)<w.radius+.12;i++)n=norm(add(base,[(random()-.5)*.55,(random()-.5)*.5,(random()-.5)*.5]));w.tanks.push(mul(n,height(w,n)+.25));}return w;}
export function basis(w:World,id:number){const up=norm(w.tanks[id]);const target=norm(w.tanks[1-id]);const forward=norm(add(target,mul(up,-dot(target,up))));return{up,forward,right:norm(cross(forward,up))};}
export function launch(w:World,id:number,bearing:number,elevation:number,power:number){const {up,forward,right}=basis(w,id);const b=bearing*Math.PI/180,e=elevation*Math.PI/180;const dir=add(mul(up,Math.sin(e)),mul(add(mul(forward,Math.cos(b)),mul(right,Math.sin(b))),Math.cos(e)));return{p:add(w.tanks[id],add(mul(up,.38),mul(dir,.7))),v:mul(dir,3+power*.065)};}
export function step(w:World,p:V,v:V,dt:number){const a=add(mul(norm(p),-w.gravity*(w.radius*w.radius)/(len(p)*len(p))),w.wind);const velocity=add(v,mul(a,dt));return{p:add(p,mul(velocity,dt)),v:velocity};}
export function simulate(w:World,id:number,b:number,e:number,power:number){let {p,v}=launch(w,id,b,e,power);const points:V[]=[p];for(let i=0;i<1600;i++){({p,v}=step(w,p,v,.025));points.push(p);if(len(p)<=surface(w,norm(p))||len(p)>w.radius*6)break;}return points;}
export function damage(distance:number,radius=3.5,max=220){return Math.round(max*Math.max(0,1-distance/radius));}
export function solve(w:World,id:number){let best={b:0,e:45,p:50,error:Infinity};for(let b=-30;b<=30;b+=6)for(let e=20;e<=70;e+=5)for(let p=12;p<=95;p+=3){const path=simulate(w,id,b,e,p);const error=dist(path[path.length-1],w.tanks[1-id]);if(error<best.error)best={b,e,p,error};}const coarse={...best};for(let b=coarse.b-6;b<=coarse.b+6;b+=1)for(let e=coarse.e-5;e<=coarse.e+5;e+=2)for(let p=coarse.p-3;p<=coarse.p+3;p+=.5){const path=simulate(w,id,b,e,p);const error=dist(path[path.length-1],w.tanks[1-id]);if(error<best.error)best={b,e,p,error};}return best;}
