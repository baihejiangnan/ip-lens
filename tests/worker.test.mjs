import test from 'node:test';
import assert from 'node:assert/strict';
import worker, { validIP } from '../worker/index.mjs';

const origin = 'https://baihejiangnan.github.io';
const env = { ALLOWED_ORIGINS: origin, IPINFO_TOKEN: 'test-only-secret' };
const ctx = { waitUntil() {} };
const req = (path, options={}) => new Request(`https://ip-lens.test${path}`, { headers: { Origin: origin }, ...options });

test('accepts IPv4/IPv6 and rejects ambiguous or path-like input', () => {
  for (const ip of ['1.1.1.1','2001:4860:4860::8888','::ffff:192.0.2.1']) assert.equal(validIP(ip),true,ip);
  for (const ip of ['',null,'999.1.1.1','01.1.1.1','https://example.com','1.1.1.1/foo','::1%eth0','[::1]','1:2:3']) assert.equal(validIP(ip),false,String(ip));
});

test('rejects unapproved origins before reading credentials or fetching upstream',async()=>{
  const r=await worker.fetch(req('/api/lookup?ip=1.1.1.1',{headers:{Origin:'https://unrelated.example'}}),env,ctx);
  assert.equal(r.status,403);assert.equal(r.headers.get('Access-Control-Allow-Origin'),null);
});

test('handles CORS preflight and rejects unsupported methods',async()=>{
  const preflight=await worker.fetch(req('/api/lookup',{method:'OPTIONS'}),env,ctx);
  assert.equal(preflight.status,204);assert.equal(preflight.headers.get('Access-Control-Allow-Origin'),origin);
  const post=await worker.fetch(req('/api/lookup?ip=1.1.1.1',{method:'POST'}),env,ctx);assert.equal(post.status,405);
});

test('rejects invalid targets and exposes missing configuration as an explicit failure',async()=>{
  assert.equal((await worker.fetch(req('/api/lookup?ip=https://example.com'),env,ctx)).status,400);
  const r=await worker.fetch(req('/api/lookup?ip=1.1.1.1'),{ALLOWED_ORIGINS:origin},ctx);
  assert.equal(r.status,503);assert.deepEqual(await r.json(),{error:'ipinfo_not_configured'});
});

test('queries the requested IP, keeps token in authorization, and returns only allowed fields',async(t)=>{
  t.mock.method(globalThis,'fetch',async(url,options)=>{
    assert.equal(url,'https://api.ipinfo.io/lite/1.1.1.1');
    assert.equal(options.headers.Authorization,'Bearer test-only-secret');
    return Response.json({ip:'1.1.1.1',asn:'AS13335',as_name:'Cloudflare',as_domain:'cloudflare.com',country:'Australia',country_code:'AU',token:'SHOULD_NOT_LEAK',privacy:{vpn:false}});
  });
  const r=await worker.fetch(req('/api/lookup?ip=1.1.1.1'),env,ctx),body=await r.json();
  assert.equal(r.status,200);assert.equal(body.ip,'1.1.1.1');assert.equal(body.provider,'IPinfo Lite');
  assert.equal(body.token,undefined);assert.equal(body.privacy,undefined);assert.equal(body.as_domain,'cloudflare.com');
  assert.equal(r.headers.get('Access-Control-Allow-Origin'),origin);
});

test('does not mistake upstream auth failures or rate limits for safe IP results',async(t)=>{
  const mock=t.mock.method(globalThis,'fetch',async()=>new Response('upstream error with secret',{status:403}));
  const auth=await worker.fetch(req('/api/lookup?ip=1.1.1.1'),env,ctx);
  assert.equal(auth.status,502);assert.deepEqual(await auth.json(),{error:'ipinfo_token_invalid'});
  mock.mock.mockImplementation(async()=>new Response('',{status:429}));
  const limit=await worker.fetch(req('/api/lookup?ip=1.1.1.1'),env,ctx);assert.equal(limit.status,429);
});

test('rejects a response for another IP',async(t)=>{
  t.mock.method(globalThis,'fetch',async()=>Response.json({ip:'8.8.8.8'}));
  const r=await worker.fetch(req('/api/lookup?ip=1.1.1.1'),env,ctx);assert.equal(r.status,502);
});

test('client-IP endpoint returns the visitor address, not a server egress address',async()=>{
  const r=await worker.fetch(req('/api/ip',{headers:{Origin:origin,'CF-Connecting-IP':'1.1.1.1'}}),env,ctx);
  assert.deepEqual(await r.json(),{ip:'1.1.1.1',provider:'Cloudflare'});
  assert.equal(r.headers.get('Cache-Control'),'no-store');
});
