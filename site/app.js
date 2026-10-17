'use strict';
const $ = (s) => document.querySelector(s);
const escapeHTML = (v) => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const terms = {
  dns: {title:'DNS 检测提示', text:'重点留意：DNS 结果中是否出现中国（CN）地区。地区仅供参考；若非预期，请检查 DNS 与代理分流。', url:'https://browserleaks.com/dns'},
  type: {title:'AS Type · 网络类型', text:'ASN 所属组织的类型。isp 表示互联网服务提供商，hosting 表示托管或机房网络，business 表示企业网络。运营商网络也可能用于代理或商业服务，不能仅凭 isp 认定为家庭住宅 IP。', url:'https://ipinfo.io/developers/asn'},
  privacy: {title:'Privacy · 匿名服务标记', text:'表示数据源是否将该 IP 关联到 VPN、代理、Tor 或中继等匿名服务。false 只表示未被该数据源识别；不保证没有使用代理。true 也不等于发生了恶意行为。', url:'https://ipinfo.io/developers/data-types'},
  vpn: {title:'VPN · 虚拟专用网络', text:'表示该数据源是否将 IP 识别为 VPN 出口。不同数据库可能得出不同结论；“未识别”不是对没有使用 VPN 的保证。', url:'https://ipinfo.io/developers/data-types'},
  residential: {title:'住宅 IP · 需要额外证据', text:'通常指与家庭宽带接入有关的 IP。AS Type 为 isp 只能支持“运营商网络”的判断，不能确认住宅属性；住宅代理标记也不等同于住宅 IP 身份。缺少对应数据时显示“待确认”。', url:'https://ipinfo.io/developers/data-types'},
  asn: {title:'ASN · 自治系统编号', text:'可以理解为互联网中一张网络的编号。名称显示该网络的所属组织，可辅助判断网络背景。ASN 的规模或排名不能直接衡量某个 IP 的风险。', url:'https://ipinfo.io/developers/asn'},
  company: {title:'Company · IP 关联公司', text:'表示数据源识别到的 IP 关联组织，可能与 ASN 所属组织不同。它提供网络使用背景，单独看公司名称不能判断是否为住宅 IP 或是否安全。', url:'https://ipinfo.io/developers/ip-to-company'},
  domains: {title:'Hosted domains · 关联域名数', text:'数据源观察到解析至该 IP 的域名数量。0 表示该数据源未列出关联域名，不表示完全没有网站，也不能单独证明这是住宅 IP 或低风险 IP。', url:'https://ipinfo.io/developers/hosted-domains'},
  anycast: {title:'Anycast · 多地点共享地址', text:'同一个 IP 可由多个地点对外提供服务，常见于 DNS、CDN 等基础设施。true 与 false 描述网络部署方式，本身不是风险或纯净度结论。', url:'https://ipinfo.io/developers/data-types'},
  score: {title:'Fraud score · 欺诈风险评分', text:'Scamalytics 对 IP 风险的独立评估，范围为 0–100，分数越高表示该来源评估的风险越高。0–19 为低风险，20–59 为中风险，60–89 为高风险，90–100 为极高风险。评分不保证某个网站会允许或拒绝访问。', url:'https://docs.scamalytics.com/ip-fraud-risk-api/v3/'},
  proxy: {title:'Proxy · 代理标记', text:'表示该来源是否检测到相应代理类别。检测结果可能包含公开代理、VPN、Tor、机房等信号；不同类型有不同含义，不宜把它们全部等同于欺诈。', url:'https://docs.scamalytics.com/ip-fraud-risk-api/v3/'}
};
const defaults = [
  {id:'ipinfo',name:'IPinfo',kind:'IP 基础信息 · 实时查询',enabled:true},
  {id:'scam',name:'Scamalytics',kind:'IP 风险评估 · 快捷跳转',enabled:true},
  {id:'ipok',name:'IPOK',kind:'IP 纯净度与风险查询 · 快捷入口',enabled:true},
  {id:'coffee',name:'Net.Coffee',kind:'IP 查询与分流测试 · 快捷入口',enabled:true},
  {id:'ipip',name:'IPIP.la',kind:'伪装与环境检测 · 快捷入口',enabled:true},
  {id:'leaks',name:'BrowserLeaks',kind:'DNS 泄漏检测 · 打开自动检测',enabled:true}
];
const shortcuts = {
  ipok:{initial:'OK',name:'IPOK',desc:'IP 纯净度与风险查询',type:'原站查询',url:'https://ipok.io/'},
  coffee:{initial:'nc',name:'Net.Coffee',desc:'查看 IP 与代理分流情况',type:'检测当前连接',url:'https://ip.net.coffee/'},
  ipip:{initial:'la',name:'IPIP.la',desc:'伪装程度与浏览器环境',type:'检测当前连接',url:'https://ipip.la/disguise.html'},
  leaks:{initial:'bl',name:'BrowserLeaks',desc:'DNS 泄漏检测 · 当前浏览器连接',type:'打开自动检测',url:'https://browserleaks.com/dns',help:'dns'}
};
const config=window.IP_LENS_CONFIG||{};
const apiBase=String(config.apiBase||'').replace(/\/$/,'');
let sources = defaults.map(s=>({...s}));
try {const saved=JSON.parse(localStorage.getItem('ip-lens-sources')); if(Array.isArray(saved)&&saved.length===defaults.length&&new Set(saved.map(s=>s.id)).size===defaults.length&&saved.every(s=>defaults.some(d=>d.id===s.id))) sources=saved.map(s=>({...defaults.find(d=>d.id===s.id),enabled:s.enabled!==false}));} catch {}
const state={mode:'current',ip:'',completedIP:'',status:{ipinfo:'idle'},busy:false,run:0,time:null,raw:false,info:null,error:'',ipSource:''};
const help=(key)=>`<button type="button" class="help" data-term="${key}" aria-label="解释 ${escapeHTML(terms[key].title)}" aria-expanded="false">?</button>`;
function persist(){try{localStorage.setItem('ip-lens-sources',JSON.stringify(sources.map(({id,enabled})=>({id,enabled}))));}catch{toast('浏览器未允许保存偏好，本次设置仍有效。');}}
let toastTimer;
function toast(text){$('#toast').textContent=text;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').hidden=true,3000);}
function active(id){return sources.some(s=>s.id===id&&s.enabled);}
function syncLinks(){const ip=encodeURIComponent(state.completedIP);$('#ipinfo-link').href=ip?`https://ipinfo.io/${ip}`:'https://ipinfo.io/what-is-my-ip';$('#scam-link').href=ip?`https://scamalytics.com/ip/${ip}`:'https://scamalytics.com/';}
function loading(){return '<div class="loading-state"><p class="loading-label">正在查询真实 IP 信息…</p><div class="skeleton big"></div><div class="skeleton"></div><div class="skeleton short"></div><div class="skeleton"></div><div class="skeleton short"></div></div>';}
function unavailable(id){return `<div class="empty-state"><strong>已关闭此检测源</strong><p>在“管理检测源”中开启后，即可${id==='scam'?'使用风险评估跳转入口':'查看 IP 基础信息'}。</p><button class="button secondary" data-action="manage">管理检测源</button></div>`;}
function renderInfo(){
  const el=$('#info-result'),d=state.info;
  if(!active('ipinfo')){el.innerHTML=unavailable('ipinfo');return;}
  if(state.busy){el.innerHTML=loading();return;}
  if(state.status.ipinfo==='error'){el.innerHTML=`<div class="error-state"><span class="summary-symbol warn">!</span><strong>暂未拿到 IP 信息</strong><p>${escapeHTML(state.error)}</p><button class="button secondary" id="retry-info">重新尝试</button></div><div class="panel-foot"><span>查询失败</span><span>没有数据不代表安全</span></div>`;return;}
  if(!d){el.innerHTML='<div class="empty-state"><strong>等待查询</strong><p>点击重新检测，获取当前网络出口和基础信息。</p></div>';return;}
  const unknown='未提供';
  const rows=[
    ['网络归属','ASN',d.asn?`${d.asn}\n${d.as_name||''}`:unknown,'asn','网络所属组织，不是住宅或风险证明'],
    ['网络域名','AS Domain',d.as_domain||unknown,'asn','与 ASN 所属组织关联的域名'],
    ['网络类型','AS Type',unknown,'type','当前免费接口不提供网络类型'],
    ['匿名标记','Privacy',unknown,'privacy','没有检测数据，无法判断是否为代理'],
    ['关联公司','Company',unknown,'company','ASN 组织名不等于 IP 关联公司'],
    ['关联域名','Hosted domains',unknown,'domains','免费基础查询未提供域名统计'],
    ['多地广播','Anycast',unknown,'anycast','当前基础查询不作 Anycast 判断']
  ];
  el.innerHTML=`<div class="tag-row"><span class="tag neutral">VPN 信息未提供 ${help('vpn')}</span><span class="tag neutral">住宅属性待确认 ${help('residential')}</span></div><div class="interpretation">已获取这个 IP 的<strong>位置与网络归属基础信息</strong>。免费基础查询不提供 VPN、住宅身份或欺诈风险结论。${d.provider==='IPinfo Public'?' 当前使用公开查询，同一出口每日共享 1,000 次额度。':''}</div><div class="data-table"><div class="data-head"><span>检测项</span><span>原始结果</span><span>怎么理解</span></div>${rows.map(([name,english,value,key,explain])=>`<div class="data-row"><div class="field-name">${name} ${help(key)}<span>${english}</span></div><div class="field-value">${escapeHTML(value).replace(/\n/g,'<br>')}</div><div class="field-explain">${explain}</div></div>`).join('')}</div><div class="panel-foot"><span>${escapeHTML(d.provider)} · ${escapeHTML(state.completedIP)}</span><button id="raw-toggle" aria-expanded="${state.raw}">${state.raw?'收起':'查看'}原始数据 ${state.raw?'−':'+'}</button></div>${state.raw?`<pre class="raw-data">${escapeHTML(JSON.stringify(d,null,2))}</pre>`:''}`;
}
function renderRisk(){
  const el=$('#risk-result');
  if(!active('scam')){el.innerHTML=unavailable('scam');return;}
  const ip=escapeHTML(state.completedIP||'等待获取'),url=state.completedIP?`https://scamalytics.com/ip/${encodeURIComponent(state.completedIP)}`:'https://scamalytics.com/';
  el.innerHTML=`<div class="risk-jump"><span class="tag neutral risk-jump-tag">结果在原站查看</span><h3>了解这个 IP 的欺诈风险</h3><p class="risk-jump-description">Scamalytics 提供 0–100 的风险评分。<strong>分数越低，评估的欺诈风险越低。</strong></p><div class="risk-scale-guide" aria-label="评分范围说明，不是当前 IP 的评分"><span>评分范围</span><div><span><b>0</b> 较低风险</span><span><b>100</b> 较高风险</span></div></div><div class="risk-target"><span>本次查询 IP</span><code>${ip}</code></div><a class="button primary risk-jump-button" id="scam-jump" href="${url}" target="_blank" rel="noopener noreferrer">前往 Scamalytics 评估 <span aria-hidden="true">↗</span></a><p class="risk-jump-hint">${state.completedIP?'在新标签页打开，已自动带入上方 IP。':'在新标签页打开；获取 IP 后会自动带入。'}</p></div><div class="risk-note">评分是该来源的风险判断，不能保证其他网站是否接受这个 IP。具体分数与详细信息请以原站结果为准。</div><div class="panel-foot"><span>快捷跳转 · ${ip}</span><span>Scamalytics</span></div>`;
}
function renderSummary(){
  const done=active('ipinfo')&&state.status.ipinfo==='done',error=state.status.ipinfo==='error';
  const text=state.busy?'正在获取当前 IP 与基础信息…':error?'IP 信息查询失败，仍可使用原站入口':done?'已获取基础信息 · VPN 与住宅属性尚无检测数据':'选择查询 IP，或重新检测当前出口';
  $('#summary').innerHTML=`<div class="summary-left"><span class="summary-symbol ${error?'warn':''}" aria-hidden="true">${state.busy?'…':error?'!':done?'✓':'ⓘ'}</span><span>${text}</span></div><span class="muted">Scamalytics 风险评分需在原站查看</span>`;
}
function renderShortcuts(){
  const items=sources.filter(s=>s.enabled&&shortcuts[s.id]);$('#shortcut-count').textContent=`${items.length} 个快捷入口`;
  $('#shortcuts').innerHTML=items.length?items.map(s=>{const c=shortcuts[s.id];return `<div class="shortcut-shell"><a class="shortcut" href="${c.url}" target="_blank" rel="noopener noreferrer" aria-label="在新标签页打开 ${c.name}，${c.type}"><div class="shortcut-top"><span class="shortcut-monogram" aria-hidden="true">${c.initial}</span><span class="shortcut-arrow" aria-hidden="true">↗</span></div><h3>${c.name}</h3><p>${c.desc}</p><span class="shortcut-type">${c.type} · 快捷跳转</span></a>${c.help?`<button type="button" class="shortcut-help" data-term="${c.help}" aria-label="${terms[c.help].title}" aria-expanded="false"><span class="help" aria-hidden="true">?</span></button>`:''}</div>`;}).join(''):'<div class="all-empty">快捷入口已全部关闭。可在“管理检测源”中重新开启。</div>';
}
function render(){hideTooltip();renderInfo();renderRisk();renderSummary();renderShortcuts();syncLinks();const order=sources.filter(s=>s.id==='ipinfo'||s.id==='scam');$('.info-panel').style.order=order.findIndex(s=>s.id==='ipinfo');$('.risk-panel').style.order=order.findIndex(s=>s.id==='scam');}
function updateQueryMeta(){
  const d=state.info;
  const location=d?[d.country,d.city].filter(Boolean).join(' · '):'';
  $('#query-context').textContent=[location,d?.as_name,state.completedIP?(state.completedIP.includes(':')?'IPv6':'IPv4'):'',state.mode==='current'?state.ipSource:'手动指定 IP'].filter(Boolean).join(' / ')||'等待获取当前网络出口';
  $('#query-time').textContent=state.busy?'正在查询…':state.time?`本次查询于 ${state.time}`:'尚未查询';
  $('#service-note').textContent=state.info?.provider==='IPinfo Lite'?'IPinfo Lite 免费基础查询；风险评分请前往原站查看。':'IPinfo 免费基础查询；VPN 与住宅属性数据未提供。';
}
function validIP(v){
  if(/^\d{1,3}(\.\d{1,3}){3}$/.test(v))return v.split('.').every(s=>+s<=255&&(s==='0'||!s.startsWith('0')));
  if(!v.includes(':')||/[\s/%\[\]]/.test(v))return false;
  try{const u=new URL(`http://[${v}]/`);return u.hostname.startsWith('[');}catch{return false;}
}
function setMode(mode){
  state.mode=mode;$('#current-mode').classList.toggle('selected',mode==='current');$('#manual-mode').classList.toggle('selected',mode==='manual');$('#current-mode').setAttribute('aria-pressed',mode==='current');$('#manual-mode').setAttribute('aria-pressed',mode==='manual');$('#ip-input').readOnly=mode==='current';$('#input-label').textContent=mode==='current'?'当前出口 IP':'输入查询 IP';$('#mode-note').textContent=mode==='current'?'切换节点后点击重新检测':'查询指定的 IPv4 或 IPv6 地址';$('#run-button').innerHTML=mode==='current'?'<span aria-hidden="true">↻</span> 重新检测':'<span aria-hidden="true">⌕</span> 开始检测';clearError();if(mode==='manual')$('#ip-input').focus();
}
function clearError(){$('#ip-error').hidden=true;$('#ip-input').removeAttribute('aria-invalid');}
function setBusy(value){state.busy=value;$('#run-button').disabled=value;$('#current-mode').disabled=value;$('#manual-mode').disabled=value;$('#ip-input').disabled=value;$('#copy-ip').disabled=value||!state.completedIP;}
async function getResponse(url){
  let response;
  try{response=await fetch(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(10000),cache:'no-store'});}catch{throw new Error('暂时无法连接检测服务，请确认网络后重试。');}
  if(!response.ok){if(response.status===429)throw new Error('该来源的查询额度暂时用尽，请稍后重试或查看原站。');throw new Error('检测服务暂时不可用，请稍后重试或查看原站。');}
  return response;
}
async function getCurrentIP(){
  try{const r=await getResponse('https://api.ipinfo.io/ip');const ip=(await r.text()).trim();if(!validIP(ip))throw new Error('invalid');state.ipSource='访问 IPinfo 时的出口';return ip;}catch(error){
    if(!apiBase)throw error;const r=await getResponse(`${apiBase}/api/ip`);const d=await r.json();if(!validIP(d.ip))throw error;state.ipSource='访问检测服务时的出口';return d.ip;
  }
}
async function lookup(ip){
  if(apiBase){
    const r=await getResponse(`${apiBase}/api/lookup?ip=${encodeURIComponent(ip)}`);const d=await r.json();if(!validIP(d.ip))throw new Error('检测来源返回的数据无效，请重试。');return d;
  }
  const r=await getResponse(`https://ipinfo.io/${encodeURIComponent(ip)}/json`),d=await r.json();
  if(!validIP(d.ip))throw new Error('检测来源返回的数据无效，请重试。');
  const match=typeof d.org==='string'?d.org.match(/^(AS\d+)\s*(.*)$/):null;
  return {ip:d.ip,provider:'IPinfo Public',country:d.country||null,city:d.city||null,asn:match?.[1]||null,as_name:match?.[2]||null,as_domain:null,retrievedAt:new Date().toISOString(),cached:false};
}
async function run(){
  let ip=$('#ip-input').value.trim();if(state.mode==='manual'&&!validIP(ip)){$('#ip-error').textContent='请输入有效的 IPv4 或 IPv6 地址，例如 1.1.1.1。';$('#ip-error').hidden=false;$('#ip-input').setAttribute('aria-invalid','true');$('#ip-input').focus();return;}
  clearError();const runID=++state.run;state.raw=false;state.info=null;state.error='';state.status.ipinfo='loading';
  if(state.mode==='current'){state.completedIP='';$('#ip-input').value='';}
  setBusy(true);updateQueryMeta();render();
  try{
    if(state.mode==='current')ip=await getCurrentIP();
    if(runID!==state.run)return;
    state.ip=ip;state.completedIP=ip;$('#ip-input').value=ip;renderRisk();syncLinks();
    if(active('ipinfo')){state.info=await lookup(ip);state.status.ipinfo='done';}else state.status.ipinfo='idle';
  }catch(error){state.error=error.message||'查询失败，请稍后重试。';state.status.ipinfo='error';}
  if(runID!==state.run)return;
  state.time=new Intl.DateTimeFormat('zh-CN',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date());setBusy(false);updateQueryMeta();render();
}
function retryInfo(){return run();}
function renderManage(){
  $('#manage-content').innerHTML=sources.map((s,i)=>`<div class="source-setting"><input id="source-${s.id}" type="checkbox" data-source="${s.id}" ${s.enabled?'checked':''}><label for="source-${s.id}"><b>${s.name}</b><span>${s.kind}</span></label><div class="move-buttons"><button data-move="${s.id}" data-step="-1" ${i===0?'disabled':''} aria-label="上移 ${s.name}">↑</button><button data-move="${s.id}" data-step="1" ${i===sources.length-1?'disabled':''} aria-label="下移 ${s.name}">↓</button></div></div>`).join('');
}
function openDialog(id){hideTooltip();if(id==='manage-dialog')renderManage();$('#'+id).showModal();}
$('#glossary-content').innerHTML=Object.values(terms).map(t=>`<div class="glossary-item"><h3>${t.title}</h3><p>${t.text}</p><a href="${t.url}" target="_blank" rel="noopener noreferrer">官方字段说明 ↗</a></div>`).join('');
let tooltipOwner=null,pinned=false;
function showTooltip(button,pin=false){
  if(tooltipOwner&&tooltipOwner!==button)tooltipOwner.setAttribute('aria-expanded','false');
  tooltipOwner=button;pinned=pin;const t=$('#tooltip');t.textContent=terms[button.dataset.term].text;t.hidden=false;button.setAttribute('aria-expanded','true');button.setAttribute('aria-describedby','tooltip');
  const r=button.getBoundingClientRect(),tr=t.getBoundingClientRect(),left=Math.max(12,Math.min(r.left-80,innerWidth-tr.width-12));let top=r.bottom+9;if(top+tr.height>innerHeight-12)top=Math.max(12,r.top-tr.height-9);t.style.left=left+'px';t.style.top=top+'px';
}
function hideTooltip(){if(tooltipOwner){tooltipOwner.setAttribute('aria-expanded','false');tooltipOwner.removeAttribute('aria-describedby');}tooltipOwner=null;pinned=false;$('#tooltip').hidden=true;}
document.addEventListener('pointerover',e=>{const b=e.target.closest('[data-term]');if(b&&!pinned)showTooltip(b);});
document.addEventListener('pointerout',e=>{if(e.target.closest('[data-term]')&&!pinned)hideTooltip();});
document.addEventListener('focusin',e=>{const b=e.target.closest('[data-term]');if(b)showTooltip(b);});
document.addEventListener('focusout',e=>{if(e.target.closest('[data-term]')&&!pinned)hideTooltip();});
document.addEventListener('keydown',e=>{if(e.key==='Escape')hideTooltip();});
window.addEventListener('scroll',hideTooltip,{passive:true});window.addEventListener('resize',hideTooltip);
document.addEventListener('click',e=>{
  const term=e.target.closest('[data-term]');if(term){if(tooltipOwner===term&&pinned)hideTooltip();else showTooltip(term,true);return;}
  hideTooltip();const close=e.target.closest('[data-close]');if(close){$('#'+close.dataset.close).close();return;}
  const action=e.target.closest('[data-action]');if(action){openDialog({glossary:'glossary-dialog',manage:'manage-dialog',about:'about-dialog'}[action.dataset.action]);return;}
  if(e.target.closest('#raw-toggle')){state.raw=!state.raw;renderInfo();return;}
  if(e.target.closest('#retry-info')){retryInfo();return;}
  const move=e.target.closest('[data-move]');if(move){const i=sources.findIndex(s=>s.id===move.dataset.move),j=i+Number(move.dataset.step);if(j<0||j>=sources.length)return;[sources[i],sources[j]]=[sources[j],sources[i]];persist();renderManage();render();$('#manage-content').querySelector(`[data-move="${move.dataset.move}"][data-step="${move.dataset.step}"]`).focus();}
});
document.addEventListener('change',e=>{if(e.target.dataset.source){const s=sources.find(s=>s.id===e.target.dataset.source);s.enabled=e.target.checked;persist();render();}});
for(const dialog of document.querySelectorAll('dialog'))dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
$('#reset-sources').addEventListener('click',()=>{sources=defaults.map(s=>({...s}));persist();renderManage();render();toast('已恢复默认检测源与排序。');});
$('#current-mode').addEventListener('click',()=>setMode('current'));$('#manual-mode').addEventListener('click',()=>setMode('manual'));
$('#query-form').addEventListener('submit',e=>{e.preventDefault();run();});$('#ip-input').addEventListener('input',clearError);
$('#copy-ip').addEventListener('click',async()=>{const v=$('#ip-input').value.trim();if(!validIP(v)){toast('请先输入有效的 IP 地址。');return;}try{await navigator.clipboard.writeText(v);toast('IP 已复制：'+v);}catch{const t=document.createElement('textarea');t.value=v;t.style.position='fixed';t.style.opacity='0';document.body.append(t);t.select();const success=document.execCommand('copy');t.remove();toast(success?'IP 已复制：'+v:'无法自动复制，请选中 IP 后复制。');}});
render();updateQueryMeta();run();
