import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,simulate,solve,dist,damage,height,norm,mul,step,dot} from './simulation';
test('seed reproduces terrain and tank placement',()=>{assert.deepEqual(createWorld(123,'earth'),createWorld(123,'earth'));});
test('gravity accelerates toward centre',()=>{const w=createWorld(123,'earth');w.wind=[0,0,0];const p:[number,number,number]=[20,0,0];assert.ok(dot(step(w,p,[0,0,0],.1).v,p)<0)});
test('blast falls off and stops at radius',()=>{assert.equal(damage(0),220);assert.equal(damage(3.5),0);assert.equal(damage(1.75),110)});
test('craters remove terrain and protect tank footprints',()=>{const w=createWorld(123,'mars');const n=norm(w.tanks[0]);const before=height(w,n);w.craters.push({p:w.tanks[0],r:2,depth:1});assert.equal(height(w,n),before);const other=norm([0,-1,0]);const original=height(w,other);w.craters.push({p:mul(other,w.radius),r:2,depth:1});assert.equal(height(w,other),original-1)});
test('AI finds reachable shots using the shared simulation on both presets',()=>{for(const preset of ['earth','mars'] as const){const w=createWorld(1429,preset);const aim=solve(w,1);const path=simulate(w,1,aim.b,aim.e,aim.p);assert.ok(dist(path.at(-1)!,w.tanks[0])<1.5,`${preset}: ${aim.error}`);assert.ok(path.length>8);}});
