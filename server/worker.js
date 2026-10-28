// Cloudflare Worker entry. Configuration comes from wrangler.toml [vars] and `wrangler secret put` secrets.
// Fail closed: if anything is missing or malformed, every route answers 503 and no draft order is created.
import {createAdmin} from './admin.js';
import {createApi} from './api.js';

let cached=null;
function build(env){
  const variants=JSON.parse(env.VARIANTS_JSON||'{}');
  const admin=createAdmin({shop:env.SHOPIFY_SHOP,clientId:env.SHOPIFY_CLIENT_ID,clientSecret:env.SHOPIFY_CLIENT_SECRET,apiVersion:env.SHOPIFY_API_VERSION||'2026-10'});
  return createApi({
    admin,variants,currency:env.CURRENCY||'USD',
    allowedOrigins:(env.ALLOWED_ORIGINS||'').split(',').map(s=>s.trim()).filter(Boolean),
    turnstileSecret:env.TURNSTILE_SECRET||'',
    webhookSecret:env.ORDER_WEBHOOKS==='on'?env.SHOPIFY_CLIENT_SECRET:'',
    draftMaxAgeHours:Number(env.DRAFT_MAX_AGE_HOURS)||72
  });
}
const api=env=>cached??=build(env);

export default {
  async fetch(request,env){
    try{return await api(env).handle(request)}
    catch(e){
      console.error('checkout api not configured:',e.message);
      return new Response(JSON.stringify({error:'not-configured',message:'Checkout is unavailable right now. No payment was taken.'}),{status:503,headers:{'content-type':'application/json','cache-control':'no-store'}});
    }
  },
  async scheduled(_event,env,ctx){ctx.waitUntil(api(env).cleanup().then(n=>console.log('removed abandoned drafts:',n)))}
};
