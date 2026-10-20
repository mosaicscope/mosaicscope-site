import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequestGet,onRequestPost} from '../../functions/api/mosaic-instagram.js';
const origin='https://mosaics.example',secret='test-session-key-'.repeat(4);
function environment(){const values=new Map();return {INSTAGRAM_APP_ID:'test-app',INSTAGRAM_APP_SECRET:'test-secret',MOSAIC_IG_SESSION_SECRET:secret,EGG:{async put(k,v){values.set(k,v);},async get(k,type){const v=values.get(k);return type==='json'&&v?JSON.parse(v):type==='arrayBuffer'&&v?v.buffer.slice(v.byteOffset,v.byteOffset+v.byteLength):v??null;}}};}
const request=(path,options)=>new Request(origin+'/api/mosaic-instagram'+path,options);
test('unconfigured Instagram is explicit, not falsely connected',async()=>{const r=await onRequestGet({request:request(''),env:{}}),v=await r.json();assert.equal(v.configured,false);assert.equal(v.connected,false);assert.equal(v.account,'pymscope');});
test('publishing rejects cross-origin and anonymous callers before touching Instagram',async()=>{const env=environment();let r=await onRequestPost({request:request('',{method:'POST',headers:{Origin:'https://other.example'}}),env});assert.equal(r.status,403);r=await onRequestPost({request:request('',{method:'POST',headers:{Origin:origin}}),env});assert.equal(r.status,401);});
test('OAuth rejects mismatched state',async()=>{const r=await onRequestGet({request:request('?action=callback&state=bad&code=sample'),env:environment()});assert.equal(r.status,403);});
async function connect(env,username='pymscope'){
 const auth=await onRequestGet({request:request('?action=connect'),env}),url=new URL(auth.headers.get('Location')),state=url.searchParams.get('state');assert.equal(url.origin,'https://www.instagram.com');assert(!url.searchParams.has('client_secret'));
 const old=globalThis.fetch;globalThis.fetch=async input=>{const u=String(input);return Response.json(u.includes('oauth/access_token')?{access_token:'short-test-token',user_id:'123'}:u.includes('/me?')?{user_id:'123',username}:{access_token:'long-test-token',expires_in:5000000});};
 try{return await onRequestGet({request:request('?action=callback&state='+encodeURIComponent(state)+'&code=sample',{headers:{Cookie:'mosaic_ig_state='+state}}),env});}finally{globalThis.fetch=old;}
}
test('only the designated Instagram account may connect',async()=>{const r=await connect(environment(),'someone-else');assert.equal(r.status,403);assert(!(await r.text()).includes('test-token'));});
test('an authorized photo publishes once with the Mosaic caption and a public JPEG URL',async()=>{
 const env=environment(),connected=await connect(env);assert.equal(connected.status,302);const owner=connected.headers.get('Set-Cookie').split(';')[0];
 const status=await onRequestGet({request:request('?action=status',{headers:{Cookie:owner}}),env});assert.equal((await status.json()).connected,true);
 const id=crypto.randomUUID(),body={id,image:'data:image/jpeg;base64,'+btoa(String.fromCharCode(255,216,255,0)),mosaic:'Tiles',caption:'A night on Cashel Street.'},calls=[];
 const old=globalThis.fetch;globalThis.fetch=async(input,opts)=>{const u=String(input);calls.push({url:u,params:new URLSearchParams(opts?.body)});if(u.includes('media_publish'))return Response.json({id:'published-123'});if(u.includes('/published-123'))return Response.json({permalink:'https://www.instagram.com/p/sample/'});return Response.json({id:'container-123'});};
 try{
  const post=()=>onRequestPost({request:request('',{method:'POST',headers:{Origin:origin,Cookie:owner,'Content-Type':'application/json'},body:JSON.stringify(body)}),env});
  const first=await post(),result=await first.json();assert.equal(first.status,200);assert.equal(result.status,'published');assert.equal(result.url,'https://www.instagram.com/p/sample/');
  assert(calls[0].params.get('caption').startsWith('Tiles · The Mosaics'));const imageUrl=new URL(calls[0].params.get('image_url'));assert.equal(imageUrl.origin,origin);assert(!imageUrl.searchParams.has('access_token'));
  const image=await onRequestGet({request:new Request(imageUrl),env});assert.equal(image.headers.get('Content-Type'),'image/jpeg');assert.equal((await image.arrayBuffer()).byteLength,4);
  const count=calls.length;assert.equal((await(await post()).json()).status,'published');assert.equal(calls.length,count);
 }finally{globalThis.fetch=old;}
});
