import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { validateSource, validateCatalog, mergePreferences, githubDraftURL } from '../site/source-model.mjs';

const example={id:'example-ip',name:'Example IP',url:'https://example.com/check',description:'查询 IP 信誉',initial:'EX',hint:'结合来源明细查看风险信号。',type:'原站查询',order:100};

test('catalog files have unique safe identifiers and HTTPS links',async()=>{
  const directory=new URL('../sources/',import.meta.url),files=(await readdir(directory)).filter(name=>name.endsWith('.json'));
  const values=await Promise.all(files.map(async name=>{const value=JSON.parse(await readFile(new URL(name,directory),'utf8'));assert.equal(name,`${value.id}.json`);return value;}));
  const sources=validateCatalog(values);assert.ok(sources.length>=4);
  assert.equal(sources.find(s=>s.id==='leaks').url,'https://browserleaks.com/dns');
});

test('rejects unsafe links, path identifiers and malformed catalog fields',()=>{
  for(const url of ['javascript:alert(1)','http://example.com','https://user:secret@example.com','data:text/html,test'])assert.throws(()=>validateSource({...example,url}));
  for(const id of ['../example','ipinfo','scam','UPPER','a/b'])assert.throws(()=>validateSource({...example,id}));
  assert.throws(()=>validateSource({...example,hint:''}));
  assert.throws(()=>validateSource({...example,type:'unknown'}));
  assert.throws(()=>validateSource({...example,order:-1}));
  assert.throws(()=>validateSource({...example,token:'must-not-be-stored'}));
  assert.throws(()=>validateCatalog([example,{...example,id:'another'}]));
  assert.throws(()=>validateCatalog([example,{...example,url:'https://different.example/'}]));
});

test('new sources append without resetting disabled sources or saved ordering',()=>{
  const defaults=['ipinfo','scam','ipok','new-source'].map(id=>({id,name:id,enabled:true}));
  const saved=[{id:'ipok',enabled:false},{id:'removed',enabled:true},{id:'ipinfo',enabled:true},{id:'ipok',enabled:true}];
  const merged=mergePreferences(defaults,saved);
  assert.deepEqual(merged.map(s=>s.id),['ipok','ipinfo','scam','new-source']);
  assert.equal(merged[0].enabled,false);assert.equal(merged.at(-1).enabled,true);
  assert.deepEqual(mergePreferences(defaults,null),defaults);
});

test('GitHub handoff only prepares a new JSON file on the fixed repository',()=>{
  const source={...example,name:'Example & IP',hint:'较低风险 ≠ 保证；核对 "来源"。'};
  const url=new URL(githubDraftURL(source));
  assert.equal(url.origin,'https://github.com');
  assert.equal(url.pathname,'/baihejiangnan/ip-lens/new/main/sources');
  assert.equal(url.searchParams.get('filename'),'example-ip.json');
  assert.deepEqual(JSON.parse(url.searchParams.get('value')),validateSource(source));
});
