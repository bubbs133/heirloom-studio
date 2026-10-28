import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SHOP} from '../dist/js/config.js';
const html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
const studio=readFileSync(new URL('../dist/studio.html',import.meta.url),'utf8');
const ideas=readFileSync(new URL('../dist/ideas.html',import.meta.url),'utf8');

test('every data-brand hook resolves to a SHOP.brand string and the static HTML default matches it',()=>{
 const hooks=[...html.matchAll(/<\w+[^>]*\sdata-brand="(\w+)"[^>]*>([^<]*)</g)];
 assert.ok(hooks.length>=4,'expected the brand hooks to be present');
 for(const [,key,text] of hooks){
  assert.equal(typeof SHOP.brand[key],'string','SHOP.brand.'+key);
  assert.equal(text.replace(/\s+/g,' ').trim(),SHOP.brand[key],'static default for '+key+' differs from config');
 }
 const leads=[...html.matchAll(/data-brand-lead="(\w+)"[^>]*>([^<]*)</g)];
 assert.ok(leads.length>=2);
 for(const [,key,text] of leads){assert.equal(typeof SHOP.brand[key],'string');assert.equal(text,SHOP.brand[key])}
 assert.ok(html.includes('data-brand-home')&&html.includes('data-brand-working'));
 assert.ok(html.includes('<title>'+SHOP.brand.title+' — '+SHOP.brand.tagline+'</title>'),'static <title> matches config');
});

test('the patch links to a dedicated predesigned ideas page that can render the full catalog',()=>{
 const app=readFileSync(new URL('../dist/js/app.js',import.meta.url),'utf8');
 assert.match(html,/<a class="button secondary" href="ideas\.html"[^>]*>[\s\S]*?See all predesigned ideas/);
 assert.match(html,/<div class="product-grid" id="products" data-limit="3"><\/div>/);
 assert.match(ideas,/<div class="product-grid ideas-product-grid" id="products"><\/div>/);
 assert.match(ideas,/<script type="module" src="\.\/js\/app\.js"><\/script>/);
 assert.doesNotMatch(ideas,/id="products"[^>]*data-limit=/);
 assert.match(app,/PRODUCTS\.slice\(0,\s*limit\)\.map/);
});

test('studio has three builder steps and a predesigned inspiration listing with a see-more link',()=>{
 const app=readFileSync(new URL('../dist/js/app.js',import.meta.url),'utf8');
 assert.deepEqual([...studio.matchAll(/data-step="(\d+)"/g)].map(([,step])=>step),['0','1','2']);
 assert.doesNotMatch(studio,/data-step="3"|04<\/span>\s*Finish/);
 assert.match(app,/\$\(["']#next-step["']\)\.hidden\s*=\s*step\s*===\s*2/);
 assert.match(app,/\$\(["']#add-custom["']\)\.hidden\s*=\s*step\s*!==\s*2/);
 assert.match(studio,/<h2 id="inspiration-heading">[\s\S]*?Need a little[\s\S]*?inspo\?/);
 assert.match(studio,/<div\s+class="product-grid"\s+id="inspiration-products"\s+data-limit="3"\s*><\/div>/);
 assert.match(studio,/<a class="button secondary" href="ideas\.html"[^>]*>[\s\S]*?See more/);
 assert.match(app,/const container = \$\("#products"\) \|\| \$\("#inspiration-products"\)/);
});

test('the phone preview carries a running total that app.js keeps in step with the builder price',()=>{
 const app=readFileSync(new URL('../dist/js/app.js',import.meta.url),'utf8');
 assert.match(studio,/<output\b(?=[^>]*\bclass="tool-total")(?=[^>]*\bid="preview-total")(?=[^>]*\baria-hidden="true")[^>]*>/);
 assert.match(app,/\$\(["']#builder-price["']\)\.textContent\s*=\s*total;\s*\$\(["']#preview-total["']\)\.textContent\s*=\s*total/);
});
