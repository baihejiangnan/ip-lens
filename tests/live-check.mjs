import assert from 'node:assert/strict';
const base='https://ip-lens-api.ip-lens.workers.dev';
const origin='https://baihejiangnan.github.io';
let lastError;
for(let attempt=0;attempt<6;attempt++){
  try{
    const health=await fetch(`${base}/health`,{signal:AbortSignal.timeout(10000)});
    assert.equal(health.status,200);assert.equal((await health.json()).ready,true);
    const lookup=await fetch(`${base}/api/lookup?ip=1.1.1.1`,{headers:{Origin:origin},signal:AbortSignal.timeout(15000)});
    assert.equal(lookup.status,200,await lookup.clone().text());
    const result=await lookup.json();
    assert.equal(result.ip,'1.1.1.1');assert.equal(result.provider,'IPinfo Lite');
    assert.equal(result.asn,'AS13335');assert.equal(result.token,undefined);
    assert.equal(lookup.headers.get('Access-Control-Allow-Origin'),origin);
    console.log(JSON.stringify({status:'ok',provider:result.provider,ip:result.ip,asn:result.asn,country:result.country}));
    process.exit(0);
  }catch(error){lastError=error;console.log(`Attempt ${attempt+1}: ${error.message}`);if(attempt<5)await new Promise(r=>setTimeout(r,10000));}
}
throw lastError;
