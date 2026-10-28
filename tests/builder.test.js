import test from 'node:test';
import assert from 'node:assert/strict';
import {ARTWORK,defaultDesign,PRODUCTS,bead,TOMATOES,TOMATO_SIZES,CLASPS} from '../dist/js/catalog.js';
import {validDesign,restoreDesign,priceDesign,components,clone,describeDesign} from '../dist/js/core.js';
import {charmSVG} from '../dist/js/art.js';
import {moveBead,randomDesign,createHistory,commit,undo,redo,canUndo,canRedo,encodeDesign,decodeDesign,designHash,designFromHash,replaceCustomDesign} from '../dist/js/builder.js';

// Deterministic generator so failures reproduce.
const seeded=seed=>()=>{seed=(seed*1664525+1013904223)%4294967296;return seed/4294967296};

test('moving a bead reorders one strand, keeps the bill of materials, and never mutates the input',()=>{
 const d=defaultDesign();const before=clone(d);
 const {design,index}=moveBead(d,0,0,2);
 assert.deepEqual(d,before);
 assert.equal(index,2);
 assert.deepEqual(design.strands[0].map(b=>b.color+b.type),['creamflower','greenround','pinkround']);
 const bom=x=>components(x).sort((a,b)=>a.key.localeCompare(b.key));
 assert.deepEqual(bom(design),bom(d));
 assert.equal(priceDesign(design),priceDesign(d));
 assert.deepEqual(design.strands[1],d.strands[1]);
});

test('out-of-range or no-op moves change nothing',()=>{
 const d=defaultDesign();
 for(const [s,f,t] of [[0,-1,1],[0,0,3],[0,0,0],[5,0,1],[0,0.5,1],[0,NaN,1]]){
  const r=moveBead(d,s,f,t);assert.deepEqual(r.design,d);assert.equal(r.index,f);
 }
});

test('shuffled designs are always valid, across the full range of random values',()=>{
 const rand=seeded(7);const seen=new Set();
 for(let i=0;i<300;i++){
  const d=randomDesign(rand),clasp=CLASPS.find(c=>c.id===d.clasp);
  assert.equal(validDesign(d),true);
  assert.equal(d.tomatoSize,clasp.tomatoSize);
  assert.ok(d.strands.every(s=>s.length<=clasp.maxBeads));
  seen.add(d.strands.length);
 }
 assert.deepEqual([...seen].sort(),[1,2,3]);
 for(const edge of [0,0.999999999,1]){assert.equal(validDesign(randomDesign(()=>edge)),true)}
});

test('shuffle honours availability and gives up cleanly when nothing is available',()=>{
 const noStars=d=>!d.strands.flat().some(b=>b.type==='star');
 const rand=seeded(3);
 for(let i=0;i<50;i++)assert.ok(noStars(randomDesign(rand,noStars)));
 assert.equal(randomDesign(seeded(1),()=>false),null);
});

test('undo and redo walk the history; a new edit clears the redo branch; duplicates are ignored',()=>{
 const a=defaultDesign();const b={...clone(a),tomato:'love'};const c={...clone(a),clasp:'dust-usbc'};
 let h=createHistory(a);
 assert.equal(canUndo(h),false);assert.equal(canRedo(h),false);
 assert.equal(commit(h,clone(a)),h);
 h=commit(h,b);h=commit(h,c);
 assert.equal(h.past.length,2);
 h=undo(h);assert.equal(h.present.tomato,'love');assert.equal(canRedo(h),true);
 h=undo(h);assert.equal(h.present.tomato,'serious');assert.equal(undo(h),h);
 h=redo(h);h=redo(h);assert.equal(h.present.clasp,'dust-usbc');assert.equal(redo(h),h);
 h=undo(h);h=commit(h,{...clone(a),tomato:'sleepy'});
 assert.equal(canRedo(h),false);assert.equal(h.present.tomato,'sleepy');
});

test('history is capped and snapshots cannot be changed through the original object',()=>{
 let h=createHistory(defaultDesign(),5);const d=defaultDesign();
 for(let i=0;i<20;i++){d.strands[0][0]=bead('pink',i%2?'round':'star');d.tomato=TOMATOES[i%4].id;d.clasp=CLASPS[(i>>2)%4].id;h=commit(h,d)}
 assert.ok(h.past.length<=5);
 const keep=clone(h.present);d.tomato='sleepy';d.strands.length=1;
 assert.deepEqual(h.present,keep);
});

test('share links round-trip every ready-made and random design',()=>{
 for(const p of PRODUCTS)assert.deepEqual(decodeDesign(encodeDesign(p.design)),p.design);
 const rand=seeded(11);
 for(let i=0;i<100;i++){const d=randomDesign(rand);assert.deepEqual(decodeDesign(encodeDesign(d)),d);assert.deepEqual(designFromHash(designHash(d)),d)}
 assert.ok(encodeDesign(defaultDesign()).length<400);
 assert.throws(()=>encodeDesign({tomato:'x'}));
});

test('clasp determines tomato size and base price; mood options survive share and order serialization',()=>{
 const d=defaultDesign();
 const sizes=['regular','small'];
 const prices=sizes.map(size=>{
  const clasp=CLASPS.find(c=>c.tomatoSize===size);
  const sizeInfo=TOMATO_SIZES.find(item=>item.id===size);
  const design={...clone(d),clasp:clasp.id,tomatoSize:size};
  assert.equal(validDesign(design),true);
  assert.ok(describeDesign(design).includes(`tomato (${sizeInfo.name})`));
  assert.ok(charmSVG(design).includes(`scale(${sizeInfo.scale})`));
  assert.deepEqual(decodeDesign(encodeDesign(design)),design);
  assert.deepEqual(designFromHash(designHash(design)),design);
  return priceDesign(design);
 });
 assert.deepEqual(prices,[2100,2050]);
 assert.deepEqual(TOMATO_SIZES.map(size=>size.cents),[750,650,550]);
 assert.deepEqual(TOMATOES.map(tomato=>tomato.cents),[0,50,100,100,100,100]);
 for(const tomato of TOMATOES){
  const design={...clone(d),tomato:tomato.id};
  assert.equal(priceDesign(design)-priceDesign({...design,tomato:'serious'}),tomato.cents);
 }
 const regularClasps=CLASPS.filter(c=>c.tomatoSize==='regular');
 assert.deepEqual(regularClasps.map(c=>c.id),['ring','lobster','phone']);
 for(const clasp of regularClasps){
  const design={...clone(d),clasp:clasp.id};
  assert.equal(components(design).find(c=>c.key.startsWith('tomato-size-')).key,'tomato-size-regular');
 }
 assert.equal(validDesign({...d,tomatoSize:'mini'}),false);
 assert.equal(validDesign({...d,tomatoSize:'giant'}),false);
 const oldCode='v1.serious.ring.pink-round+cream-flower+green-round~green-round+pink-round+cream-star';
 assert.deepEqual(decodeDesign(oldCode),{...d,tomatoSize:'regular'});
 const oldDustCode='v2.serious.dust-usbc.regular.pink-round+cream-flower+green-round~green-round+pink-round+cream-star';
 const migratedDust=decodeDesign(oldDustCode);
 assert.equal(migratedDust.tomatoSize,'small');
 assert.deepEqual(migratedDust.strands.map(s=>s.length),[3,3]);
 assert.equal(restoreDesign({tomato:'serious',clasp:'ring',strands:d.strands}).tomatoSize,'regular');
});

test('tampered, oversized or malformed share links are rejected, never half-loaded',()=>{
 const good=encodeDesign(defaultDesign());
 const bad=[undefined,null,42,'',good.replace('v2','v3'),good.replace('serious','evil'),good.replace('ring','nope'),good.replace('regular','giant'),good.replace('pink-round','pink-sparkle'),
  good+'.extra',  'v1.sunny.ring.','v1.sunny.ring.pink-round-extra+pink-round+pink-round',
  'v1.sunny.ring.'+Array(4).fill('pink-round+pink-round+pink-round').join('~'),'v1.sunny.ring.'+Array(6).fill('pink-round').join('+'),
  good+'x'.repeat(500),'v1.__proto__.ring.pink-round+pink-round+pink-round'];
 for(const text of bad)assert.equal(decodeDesign(text),null,String(text).slice(0,60));
 for(const hash of ['','#','#design=','#design=<script>','#design=v1.sunny.ring.pink-round+pink-round+pink-round%20','#other='+good,'design='+good])assert.equal(designFromHash(hash),null);
});

test('editing a bag item replaces only that custom design and keeps id and quantity',()=>{
 const next={...defaultDesign(),tomato:'love'};
 const cart=[{id:'a',kind:'custom',quantity:3,design:defaultDesign()},{id:'b',kind:'custom',quantity:1,design:defaultDesign()},{id:'c',kind:'ready',quantity:2,productId:'garden-party'}];
 const out=replaceCustomDesign(cart,'a',next);
 assert.notEqual(out,cart);
 assert.equal(out[0].design.tomato,'love');assert.equal(out[0].quantity,3);assert.equal(out[0].id,'a');
 assert.equal(out[1].design.tomato,'serious');assert.deepEqual(out[2],cart[2]);
 assert.equal(cart[0].design.tomato,'serious');
 next.tomato='grumpy';assert.equal(out[0].design.tomato,'love');
 assert.equal(replaceCustomDesign(cart,'missing',next),cart);
 assert.equal(replaceCustomDesign(cart,'c',next),cart);
 assert.throws(()=>replaceCustomDesign(cart,'a',{tomato:'sunny'}));
});

test('the illustration marks the selected bead and exposes one tap target per bead only when interactive',()=>{
 const d=defaultDesign();const beads=d.strands.flat().length;
 const plain=charmSVG(d);
 assert.ok(!plain.includes('bead-ring')&&!plain.includes('bead-hit'));
 const live=charmSVG(d,{selected:[1,2],interactive:true});
 assert.equal((live.match(/class="bead-hit"/g)||[]).length,beads);
 assert.equal((live.match(/class="bead-ring"/g)||[]).length,1);
 assert.ok(live.includes('data-bead="1,2"')&&live.includes('data-bead="0,0"'));
 assert.equal((charmSVG(d,{selected:[9,9]}).match(/bead-ring/g)||[]).length,0);
 assert.ok(live.includes('aria-label="'),'illustration keeps its text description');
});

test('uploaded tomato and bead images can replace the built-in SVG placeholders',()=>{
 const d=defaultDesign();
 assert.equal(ARTWORK.tomatoes[d.tomato],'./assets/test.png');
 assert.equal(ARTWORK.beads['pink-round'],'');
 const art=charmSVG(d,{artwork:{
  tomatoes:{serious:'./assets/artwork/tomatoes/serious.webp'},
  beads:{'pink-round':'./assets/artwork/beads/pink-round.webp'}
 }});
 assert.match(art,/href="\.\/assets\/artwork\/tomatoes\/serious\.webp"/);
 assert.match(art,/href="\.\/assets\/artwork\/beads\/pink-round\.webp"/);
 assert.match(charmSVG(d),/href="\.\/assets\/test\.png"/);
 assert.doesNotMatch(charmSVG(d,{artwork:{tomatoes:{serious:''},beads:{}}}),/<image\b/);
});

test('dust plugs use the Small tomato and each has its own priced component; the old 3.5 mm id is gone',()=>{
 const usbc={...defaultDesign(),clasp:'dust-usbc',tomatoSize:'small'},lightning={...defaultDesign(),clasp:'dust-lightning',tomatoSize:'small'};
 assert.ok(validDesign(usbc)&&validDesign(lightning));
 assert.ok(components(usbc).some(c=>c.key==='clasp-dust-usbc')&&!components(usbc).some(c=>c.key==='clasp-dust-lightning'));
 assert.ok(components(lightning).some(c=>c.key==='clasp-dust-lightning'));
 assert.equal(validDesign({...defaultDesign(),clasp:'dust'}),false);
 const norm=x=>x.replace(/art-\d+/g,'x');
 assert.notEqual(norm(charmSVG(usbc)),norm(charmSVG(lightning)));
 assert.equal(norm(charmSVG(usbc)),norm(charmSVG(usbc)));
 for(const d of [usbc,lightning])assert.deepEqual(decodeDesign(encodeDesign(d)),d);
 assert.equal(decodeDesign(encodeDesign(usbc).replace('dust-usbc','dust')),null);
});

test('clasp sets the tomato base and dust plugs enforce a three-bead maximum without reducing strands',()=>{
 const base=defaultDesign();
 const phone={...clone(base),clasp:'phone'};
 const lobster={...clone(base),clasp:'lobster'};
 const dust={...clone(base),clasp:'dust-usbc',tomatoSize:'small'};
 assert.equal(phone.tomatoSize,'regular');
 assert.equal(lobster.tomatoSize,'regular');
 assert.equal(priceDesign(phone)-priceDesign(base),50);
 assert.equal(priceDesign(lobster)-priceDesign(base),100);
 assert.equal(components(dust).find(c=>c.key==='tomato-size-small').quantity,1);
 assert.equal(validDesign({...dust,strands:[Array(4).fill(bead('pink'))]}),false);
 assert.equal(validDesign({...dust,strands:[Array(3).fill(bead('pink'))]}),true);
 assert.equal(validDesign({...dust,strands:Array.from({length:3},()=>[bead('pink')])}),true);
 assert.equal(validDesign({...dust,tomatoSize:undefined}),false);
 const oldDust={...clone(base),clasp:'dust-usbc',strands:base.strands.map(()=>Array(5).fill(bead('pink')))};
 const restored=restoreDesign(oldDust);
 assert.equal(restored.tomatoSize,'small');
 assert.deepEqual(restored.strands.map(s=>s.length),[3,3]);
 assert.equal(validDesign(restored),true);
});
