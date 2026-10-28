// After-the-fact check that a paid order still matches the charm designs it claims to contain.
// Pure function: the caller turns a Shopify order into {id,name,lines:[{variantId,quantity,attributes}]}.
import {decodeDesign,encodeDesign,components} from '../dist/js/core.js';
import {PRODUCTS} from '../dist/js/catalog.js';

const attr=(line,key)=>line.attributes?.[key];

// keyByVariant: { 'gid://shopify/ProductVariant/1': 'bead-pink-round', ... }
export function auditOrder(order,keyByVariant){
  const problems=[];
  const add=(group,code,message)=>problems.push({group,code,message});
  const groups=new Map();
  for(const line of order.lines||[]){
    const key=keyByVariant[line.variantId];
    if(!key)continue; // not one of ours (some other product the artist sells)
    const group=attr(line,'Charm group');
    if(!group){add(null,'untracked-line',`${key} was bought outside a charm design.`);continue}
    if(!groups.has(group))groups.set(group,[]);
    groups.get(group).push({...line,key});
  }
  for(const [group,lines] of groups){
    const codes=new Set(lines.map(l=>attr(l,'Design code')));
    const quantities=new Set(lines.map(l=>attr(l,'Charm quantity')));
    if(codes.size!==1||quantities.size!==1){add(group,'inconsistent','Lines of one charm disagree about its design or quantity.');continue}
    const design=decodeDesign([...codes][0]);
    const qty=Number([...quantities][0]);
    if(!design){add(group,'bad-design','The design code is missing or invalid.');continue}
    if(!Number.isInteger(qty)||qty<1||qty>10){add(group,'bad-quantity','The charm quantity is not a whole number from 1 to 10.');continue}
    const ready=lines.length===1&&lines[0].key.startsWith('product-');
    if(ready){
      const product=PRODUCTS.find(p=>'product-'+p.id===lines[0].key);
      if(!product||encodeDesign(product.design)!==[...codes][0])add(group,'ready-mismatch','Ready-made item does not match its design code.');
      else if(lines[0].quantity!==qty)add(group,'ready-quantity','Ready-made quantity does not match the charm quantity.');
      continue;
    }
    const actual=new Map();
    for(const l of lines)actual.set(l.key,(actual.get(l.key)||0)+l.quantity);
    const expected=new Map(components(design).map(c=>[c.key,c.quantity*qty]));
    for(const [key,q] of expected)if(actual.get(key)!==q)add(group,'component-mismatch',`${key}: expected ${q}, order has ${actual.get(key)||0}.`);
    for(const key of actual.keys())if(!expected.has(key))add(group,'unexpected-component',`${key} is not part of this design.`);
  }
  return {ok:problems.length===0,problems};
}
