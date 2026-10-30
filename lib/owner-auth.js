const encoder=new TextEncoder();
export const cookieName='__Host-reed_session';
export const lifetime=7*24*60*60;
export const configured=env=>typeof env.OWNER_LOGIN_SECRET==='string'&&env.OWNER_LOGIN_SECRET.length>=32;
export const reply=(data,status=200,headers={})=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
const b64=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
function unb64(s){return Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(s.length/4)*4,'=')),c=>c.charCodeAt(0))}
async function key(env){return crypto.subtle.importKey('raw',encoder.encode('reed-session-v1:'+env.OWNER_LOGIN_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign','verify'])}
export async function passwordMatches(input,env){if(typeof input!=='string'||input.length>512)return false;const [a,b]=await Promise.all([crypto.subtle.digest('SHA-256',encoder.encode(input)),crypto.subtle.digest('SHA-256',encoder.encode(env.OWNER_LOGIN_SECRET))]);const x=new Uint8Array(a),y=new Uint8Array(b);let diff=0;for(let i=0;i<x.length;i++)diff|=x[i]^y[i];return diff===0}
export async function issueSession(env,host){const now=Math.floor(Date.now()/1000);const payload=b64(encoder.encode(JSON.stringify({iat:now,exp:now+lifetime,host,nonce:crypto.randomUUID()})));return payload+'.'+b64(new Uint8Array(await crypto.subtle.sign('HMAC',await key(env),encoder.encode(payload))))}
export async function validSession(request,env){if(!configured(env))return false;try{const entry=request.headers.get('Cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(cookieName+'='));if(!entry)return false;const token=entry.slice(cookieName.length+1);if(token.length>2048)return false;const [p,s,...more]=token.split('.');if(!p||!s||more.length)return false;if(!await crypto.subtle.verify('HMAC',await key(env),unb64(s),encoder.encode(p)))return false;const data=JSON.parse(new TextDecoder().decode(unb64(p))),now=Math.floor(Date.now()/1000);return Number.isInteger(data.exp)&&Number.isInteger(data.iat)&&data.iat<=now+60&&data.exp>now&&data.exp-data.iat<=lifetime&&data.host===new URL(request.url).host}catch{return false}}
export const sessionCookie=(token,maxAge=lifetime)=>cookieName+'='+token+'; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age='+maxAge;
