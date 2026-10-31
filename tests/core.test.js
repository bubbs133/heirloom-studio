import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultDesign,catalogEntries,PRODUCTS,CLASPS,TOMATOES,bead} from '../dist/js/catalog.js';
import {validDesign,restoreDesign,priceDesign,priceSummary,components,makeCartLines,sanitizeCart,clone,describeDesign} from '../dist/js/core.js';
const variants=Object.fromEntries(catalogEntries().map(([k],i)=>[k,'gid://shopify/ProductVariant/'+(i+1)]));
test('every clasp includes one three-bead strand and base charm prices match the advertised starts',()=>{
 for(const clasp of CLASPS.filter(c=>c.includedStrands)){
  const d={...defaultDesign(),clasp:clasp.id,tomatoSize:clasp.tomatoSize};assert.equal(validDesign(d),true);
  const cs=components(d);
  assert.equal(cs.some(c=>c.key==='strand'),false);
  assert.equal(cs.some(c=>c.key.startsWith('bead-')),false);
  assert.equal(priceDesign(d),300+(clasp.tomatoSize==='regular'?1049:399)+clasp.cents);
  assert.equal(d.strands.length,1);
 }
 assert.equal(priceDesign(defaultDesign()),1599);
 for(const clasp of CLASPS.filter(c=>c.id.startsWith('dust-'))){
  assert.equal(priceDesign({...defaultDesign(),clasp:clasp.id,tomatoSize:'small'}),849);
 }
});
test('reject limits, malformed beads, unknown tomato sizes, and unknown catalog IDs',()=>{
 for(const n of [0,4]){const d=defaultDesign();d.strands=Array.from({length:n},()=>[bead('pink'),bead('pink'),bead('pink')]);assert.equal(validDesign(d),false)}
 for(const n of [0,6,50]){const d=defaultDesign();d.strands[0]=Array.from({length:n},()=>bead('pink'));assert.equal(validDesign(d),false)}
 for(const key of ['tomato','tomatoSize','clasp']){const d=defaultDesign();d[key]='unknown';assert.equal(validDesign(d),false)}
 const d=defaultDesign();d.strands[0][0].type='evil';assert.equal(validDesign(d),false);
 assert.deepEqual(restoreDesign(null),defaultDesign());assert.throws(()=>priceDesign(d));
});
test('old pearl beads migrate to the new round bead without invalidating saved designs',()=>{
 const legacy={...defaultDesign(),strands:[[bead('pink','pearl'),bead('cream','star'),bead('green'),bead('pink','pearl')]]};
 assert.equal(validDesign(legacy),true);
 assert.deepEqual(restoreDesign(legacy).strands[0][0],bead('pink','round'));
 assert.equal(components(legacy).find(c=>c.key==='bead-pink-round').quantity,1);
});
test('removed Sweetheart and Cheeky options migrate saved designs to Serious',()=>{
 for(const tomato of ['love','wink']){
  const legacy={...defaultDesign(),tomato};
  assert.equal(restoreDesign(legacy).tomato,'serious');
  assert.equal(validDesign(legacy),false);
 }
 assert.deepEqual(TOMATOES.map(t=>t.id),['serious','grumpy','formal','bday']);
 assert.equal(TOMATOES.find(t=>t.id==='serious').cents,0);
 assert.equal(TOMATOES.find(t=>t.id==='grumpy').cents,0);
 assert.ok(TOMATOES.filter(t=>!['serious','grumpy'].includes(t.id)).every(t=>t.cents>0));
});
test('one bead per strand is valid, priced, and preserved in the Shopify order details',()=>{
 const d=defaultDesign();d.strands=d.strands.map(s=>[s[0]]);
 assert.equal(validDesign(d),true);
 assert.equal(priceDesign(d),priceDesign(defaultDesign()));
 assert.equal(components(d).some(c=>c.key==='strand'||c.key.startsWith('bead-')),false);
 const lines=makeCartLines([{id:'one-bead',kind:'custom',design:d,quantity:1}],variants);
 assert.ok(lines.every(line=>line.attributes.find(a=>a.key==='Design').value.includes('Round')));
});
test('extra strands and beads are charged for keychains and phone charms',()=>{
 const base=defaultDesign();
 const extra={...base,strands:[
  [...base.strands[0],bead('pink','star')],
  ...base.strands.slice(1),
  [bead('pink'),bead('cream','flower'),bead('green','pearl')]
 ]};
 const extraComponents=components(extra);
 assert.equal(extraComponents.find(c=>c.key==='strand').quantity,1);
 assert.equal(extraComponents.find(c=>c.key==='bead-pink-star').quantity,1);
 assert.equal(extraComponents.find(c=>c.key==='bead-pink-round').quantity,1);
 assert.equal(priceDesign(extra)-priceDesign(base),550);
 const oneStrand={...base,strands:[base.strands[0]]};
 assert.equal(priceDesign(oneStrand),priceDesign(base));
 const dust={...base,clasp:'dust-usbc',tomatoSize:'small'};
 const dustComponents=components(dust);
 assert.equal(dustComponents.some(c=>c.key==='strand'||c.key.startsWith('bead-')),false);
 const dustExtra={...dust,strands:[...dust.strands,[bead('pink'),bead('cream'),bead('green')]]};
 assert.equal(components(dustExtra).find(c=>c.key==='strand').quantity,1);
 assert.equal(components(dustExtra).filter(c=>c.key.startsWith('bead-')).reduce((n,c)=>n+c.quantity,0),3);
});
test('builder price summary shows only the starting base and selected paid extras',()=>{
 const base=defaultDesign();
 assert.deepEqual(priceSummary(base),[{label:'Starting base',amount:1599}]);
 const extra={...base,tomato:'formal',strands:[
  [...base.strands[0],bead('pink')],
  [bead('blue'),bead('blue','pearl')]
 ]};
 assert.deepEqual(priceSummary(extra),[
  {label:'Starting base',amount:1599},
  {label:'Mood extra',amount:100},
  {label:'Extra strands × 1',amount:150},
  {label:'Extra beads × 3',amount:225}
 ]);
});
test('every preset and maximum-size configuration renders valid component bills',()=>{
 for(const p of PRODUCTS){assert.ok(validDesign(p.design));assert.ok(priceDesign(p.design)>0)}
 const max=defaultDesign();max.strands=Array.from({length:3},()=>Array.from({length:5},()=>bead('green','star')));
 assert.ok(validDesign(max));assert.equal(components(max).find(c=>c.key==='bead-green-star').quantity,12);
});
test('price changes are applied per component and missing prices cannot silently become free',()=>{
 const d=defaultDesign();d.strands[0].push(bead('pink'));
 const prices=Object.fromEntries(catalogEntries().map(([k,v])=>[k,v.cents]));
 prices['bead-pink-round']+=50;assert.equal(priceDesign(d,prices),1724);
 delete prices['assembly'];assert.throws(()=>priceDesign(d,prices),/Pricing unavailable/);
});
test('cart restoration drops invalid and duplicate entries, ignores saved totals',()=>{
 const item={id:'test-1',kind:'custom',design:defaultDesign(),quantity:2,total:-999};
 const restored=sanitizeCart([item,{...item},{...item,id:'x',quantity:0},{...item,id:'z',quantity:11}]);
 assert.equal(restored.length,1);assert.equal(restored[0].total,undefined);
 item.design.tomato='evil';assert.equal(restored[0].design.tomato,'serious');
 assert.deepEqual(sanitizeCart({}),[]);
});
test('checkout sanitization rejects clasp constraints instead of migrating malformed designs',()=>{
 const item={id:'dust',kind:'custom',design:{
  ...defaultDesign(),clasp:'dust-usbc',tomatoSize:'small',
  strands:[Array.from({length:4},()=>bead('pink'))]
 },quantity:1};
 assert.equal(sanitizeCart([item],{normalizeDesigns:false}).length,0);
 assert.equal(sanitizeCart([item]).length,1);
});
test('old saved custom designs are migrated to Regular tomato size',()=>{
 const oldDesign={tomato:'serious',clasp:'ring',strands:defaultDesign().strands};
 assert.equal(validDesign(oldDesign),true);
 assert.equal(restoreDesign(oldDesign).tomatoSize,'regular');
 const restored=sanitizeCart([{id:'legacy',kind:'custom',design:oldDesign,quantity:1}]);
 assert.equal(restored[0].design.tomatoSize,'regular');
});
test('clasp-selected tomato size is retained in order line details and design codes',()=>{
 const design={...defaultDesign(),clasp:'dust-usbc',tomatoSize:'small'};
 const variants=Object.fromEntries(catalogEntries().map(([key],i)=>[key,'gid://shopify/ProductVariant/'+(i+1)]));
 const lines=makeCartLines([{id:'small-tomato',kind:'custom',design,quantity:1}],variants);
 assert.ok(lines.every(line=>line.attributes.find(a=>a.key==='Design').value.includes('tomato (Small)')));
 assert.ok(lines.every(line=>line.attributes.find(a=>a.key==='Design code').value.startsWith('v2.serious.dust-usbc.small.')));
 assert.ok(lines.some(line=>line.attributes.find(a=>a.key==='Component').value==='tomato-size-small'));
 assert.ok(lines.some(line=>line.attributes.find(a=>a.key==='Component').value==='tomato-serious'));
 assert.equal(catalogEntries().some(([key])=>key==='tomato-size-mini'),false);
});
test('Shopify lines multiply materials by charm quantity and preserve ordered design instructions',()=>{
 const d=defaultDesign();const lines=makeCartLines([{id:'group-one',kind:'custom',design:d,quantity:2}],variants);
 assert.equal(lines.some(l=>l.merchandiseId===variants['strand']),false);
 assert.equal(lines.some(l=>l.merchandiseId===variants['bead-pink-round']),false);
 assert.ok(lines.every(l=>l.attributes.find(a=>a.key==='Charm group').value==='group-one'));
 assert.ok(lines.every(l=>l.attributes.find(a=>a.key==='Design').value.includes('strand 1 (top to bottom)')));
 assert.ok(lines.every(l=>l.attributes.find(a=>a.key==='Design').value.includes('one included cream star bead on the side')));
 assert.ok(describeDesign(d).includes('Key ring'));
});
test('ready-made prices use whole-product SKUs and missing component mappings block checkout',()=>{
 const lines=makeCartLines([{id:'ready-one',kind:'ready',productId:'garden-party',quantity:3}],variants);
 assert.equal(lines.length,1);assert.equal(lines[0].quantity,3);assert.equal(lines[0].merchandiseId,variants['product-garden-party']);
 const incomplete=clone(variants);delete incomplete['assembly'];
 assert.throws(()=>makeCartLines([{id:'custom-one',kind:'custom',quantity:1,design:defaultDesign()}],incomplete),/not connected/);
 assert.throws(()=>makeCartLines([],variants));
});
