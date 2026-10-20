// The real account is shared; individual Mosaic identities remain in the game feeds/captions.
// Meta credentials and tokens never enter the client bundle.
const ACCOUNT='pymscope', COOKIE='mosaic_ig_owner', enc=new TextEncoder();
const json=(body,status=200,headers={})=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store',...headers}});
const hex=b=>Array.from(new Uint8Array(b),v=>v.toString(16).padStart(2,'0')).join('');
const ready=env=>!!(env.EGG&&env.INSTAGRAM_APP_ID&&env.INSTAGRAM_APP_SECRET&&env.MOSAIC_IG_SESSION_SECRET?.length>=32);
const cookie=(request,name)=>request.headers.get('Cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith(name+'='))?.slice(name.length+1)||'';
async function sign(env,text){const key=await crypto.subtle.importKey('raw',enc.encode(env.MOSAIC_IG_SESSION_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);return hex(await crypto.subtle.sign('HMAC',key,enc.encode(text)));}
async function session(env,request){const raw=cookie(request,COOKIE),parts=raw.split('.');if(parts.length!==3||Number(parts[1])<Date.now())return false;return parts[0]===ACCOUNT&&await sign(env,parts[0]+'.'+parts[1])===parts[2];}
async function crypt(env,text,decode=false){const key=await crypto.subtle.importKey('raw',await crypto.subtle.digest('SHA-256',enc.encode(env.MOSAIC_IG_SESSION_SECRET)),{name:'AES-GCM'},false,['encrypt','decrypt']);if(decode){const data=Uint8Array.from(atob(text),c=>c.charCodeAt(0));return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:data.slice(0,12)},key,data.slice(12)));}const iv=crypto.getRandomValues(new Uint8Array(12)),body=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,enc.encode(text))),data=new Uint8Array(12+body.length);data.set(iv);data.set(body,12);return btoa(String.fromCharCode(...data));}
async function graph(env,connection,path,params,method='POST'){const version=env.INSTAGRAM_API_VERSION||'v25.0',url=new URL(`https://graph.instagram.com/${version}/${path}`);const options={method,headers:{Authorization:`Bearer ${connection.token}`}};if(method==='POST')options.body=new URLSearchParams(params);else for(const [k,v]of Object.entries(params))url.searchParams.set(k,v);const response=await fetch(url,options),body=await response.json();if(!response.ok||body.error)throw Error(body.error?.message||'Instagram request failed');return body;}
export async function onRequestGet({request,env}){
 const url=new URL(request.url),action=url.searchParams.get('action')||'status';
 if(action==='image'){const id=url.searchParams.get('id')||'';if(!/^[a-f0-9-]{36}$/.test(id)||!env.EGG)return new Response(null,{status:404});const data=await env.EGG.get('ig:image:'+id,'arrayBuffer');return data?new Response(data,{headers:{'Content-Type':'image/jpeg','Cache-Control':'private, max-age=300','X-Content-Type-Options':'nosniff'}}):new Response(null,{status:404});}
 if(action==='status')return json({account:ACCOUNT,configured:ready(env),connected:ready(env)&&await session(env,request)&&!!await env.EGG.get('ig:connection'),connect:'/api/mosaic-instagram?action=connect'});
 if(!ready(env))return json({error:'Instagram publishing has not been configured by the site owner.'},503);
 const redirect=new URL('/api/mosaic-instagram?action=callback',url).href;
 if(action==='connect'){const nonce=crypto.randomUUID(),expiry=Date.now()+600000,state=nonce+'.'+expiry+'.'+await sign(env,nonce+'.'+expiry),target=new URL('https://www.instagram.com/oauth/authorize');for(const [k,v]of Object.entries({client_id:env.INSTAGRAM_APP_ID,redirect_uri:redirect,response_type:'code',scope:'instagram_business_basic,instagram_business_content_publish',enable_fb_login:'0',force_authentication:'1',state}))target.searchParams.set(k,v);return new Response(null,{status:302,headers:{Location:target.href,'Set-Cookie':`mosaic_ig_state=${state}; HttpOnly; Secure; SameSite=Lax; Max-Age=600; Path=/api/mosaic-instagram`,'Cache-Control':'no-store'}});}
 if(action==='callback'){
  const state=url.searchParams.get('state')||'',parts=state.split('.');if(state!==cookie(request,'mosaic_ig_state')||parts.length!==3||Number(parts[1])<Date.now()||await sign(env,parts[0]+'.'+parts[1])!==parts[2])return json({error:'Authorization expired. Please reconnect.'},403);
  const code=url.searchParams.get('code');if(!code)return json({error:'Instagram authorization was cancelled.'},400);
  try{const r=await fetch('https://api.instagram.com/oauth/access_token',{method:'POST',body:new URLSearchParams({client_id:env.INSTAGRAM_APP_ID,client_secret:env.INSTAGRAM_APP_SECRET,grant_type:'authorization_code',redirect_uri:redirect,code})}),auth=await r.json();if(!r.ok||!auth.access_token)throw Error('Instagram did not authorize publishing.');
   let connection={token:auth.access_token,id:String(auth.user_id)};const me=await graph(env,connection,'me',{fields:'user_id,username'},'GET');if(String(me.username).toLowerCase()!==ACCOUNT)return json({error:'Connect the designated Mosaics account.'},403);connection.id=String(me.user_id||auth.user_id);
   const longUrl=new URL('https://graph.instagram.com/access_token');longUrl.search=new URLSearchParams({grant_type:'ig_exchange_token',client_secret:env.INSTAGRAM_APP_SECRET,access_token:auth.access_token});const lr=await fetch(longUrl),long=await lr.json();if(lr.ok&&long.access_token)connection.token=long.access_token;
   await env.EGG.put('ig:connection',await crypt(env,JSON.stringify(connection)),{expirationTtl:Math.min(5184000,Number(long.expires_in)||3600)});
   const stamp=ACCOUNT+'.'+(Date.now()+7*86400000),value=stamp+'.'+await sign(env,stamp);return new Response(null,{status:302,headers:{Location:'/world/?instagram=connected','Set-Cookie':`${COOKIE}=${value}; HttpOnly; Secure; SameSite=Lax; Max-Age=604800; Path=/api/mosaic-instagram`,'Cache-Control':'no-store'}});
  }catch{return json({error:'Instagram connection failed. Check app permissions and retry authorization.'},502);}
 }
 return json({error:'Unknown action.'},404);
}
export async function onRequestPost({request,env}){
 const url=new URL(request.url);if(request.headers.get('Origin')!==url.origin)return json({error:'Origin rejected.'},403);
 if(!ready(env))return json({error:'Instagram publishing is not configured yet.'},503);
 if(!await session(env,request))return json({error:'Connect the publishing account before posting.'},401);
 if(Number(request.headers.get('Content-Length'))>1800000)return json({error:'Photo is too large.'},413);
 const text=await request.text();if(text.length>1800000)return json({error:'Photo is too large.'},413);
 let input;try{input=JSON.parse(text);}catch{return json({error:'Invalid photo.'},400);}
 const {id,image,caption,mosaic}=input;if(!/^[a-f0-9-]{36}$/.test(id)||typeof caption!=='string'||caption.length>2000||typeof mosaic!=='string'||mosaic.length>60||typeof image!=='string'||!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(image))return json({error:'Invalid photo, Mosaic or caption.'},400);
 const prior=await env.EGG.get('ig:post:'+id,'json');if(prior)return json(prior,prior.status==='published'?200:202);
 const connectionRaw=await env.EGG.get('ig:connection');if(!connectionRaw)return json({error:'Instagram connection expired. Reconnect the account.'},401);
 const raw=Uint8Array.from(atob(image.split(',')[1]),c=>c.charCodeAt(0));if(raw[0]!==255||raw[1]!==216||raw[2]!==255)return json({error:'A JPEG photo is required.'},400);
 const rateKey='ig:rate:'+cookie(request,COOKIE).slice(-64),last=Number(await env.EGG.get(rateKey)||0);if(Date.now()-last<60000)return json({error:'Please wait a minute before the next Instagram post.'},429);
 await env.EGG.put(rateKey,String(Date.now()),{expirationTtl:120});await env.EGG.put('ig:image:'+id,raw,{expirationTtl:86400});
 await env.EGG.put('ig:post:'+id,JSON.stringify({status:'processing'}),{expirationTtl:86400});
 try{const connection=JSON.parse(await crypt(env,connectionRaw,true)),imageUrl=new URL(`/api/mosaic-instagram?action=image&id=${id}`,url).href;
  const media=await graph(env,connection,connection.id+'/media',{image_url:imageUrl,caption:`${mosaic} · The Mosaics\n${caption}\n#TheMosaics #MosaicScope`});
  const published=await graph(env,connection,connection.id+'/media_publish',{creation_id:media.id});
  let link='https://www.instagram.com/'+ACCOUNT+'/';try{link=(await graph(env,connection,published.id,{fields:'permalink'},'GET')).permalink||link;}catch{/* publishing already succeeded */}
  const result={status:'published',id:published.id,url:link};await env.EGG.put('ig:post:'+id,JSON.stringify(result),{expirationTtl:2592000});return json(result);
 }catch{const result={status:'needs_review',error:'Instagram did not confirm publication. Check the account before retrying this photo.'};await env.EGG.put('ig:post:'+id,JSON.stringify(result),{expirationTtl:86400});return json(result,502);}
}
