export const repository = 'https://github.com/baihejiangnan/ip-lens';
export const sourceTypes = ['原站查询', '检测当前连接', '打开自动检测'];
const reserved = new Set(['ipinfo', 'scam']);

export function validateSource(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('检测源必须是一个 JSON 对象。');
  const limits = {id:48, name:40, url:500, description:80, initial:3, hint:320};
  const result = {};
  const allowed = new Set([...Object.keys(limits), 'type', 'order']);
  if (Object.keys(value).some(key => !allowed.has(key))) throw new Error('检测源含有未知字段。');
  for (const [key, max] of Object.entries(limits)) {
    if (typeof value[key] !== 'string' || !value[key].trim() || value[key].length > max) throw new Error(`${key} 必须填写，且不超过 ${max} 个字符。`);
    result[key] = value[key].trim();
  }
  if (!/^[a-z][a-z0-9-]*$/.test(result.id) || reserved.has(result.id)) throw new Error('标识请用小写字母开头，只含小写字母、数字和短横线，且不能使用保留名称。');
  let url;
  try {url = new URL(result.url);} catch {throw new Error('请填写完整的 HTTPS 网址。');}
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('网址必须使用 HTTPS，且不能包含账号或密码。');
  result.url = url.href;
  if (!sourceTypes.includes(value.type)) throw new Error('请选择有效的检测方式。');
  result.type = value.type;
  result.order = value.order ?? 100;
  if (!Number.isInteger(result.order) || result.order < 0 || result.order > 9999) throw new Error('排序必须是 0–9999 的整数。');
  return result;
}

export function validateCatalog(values) {
  const ids = new Set(), urls = new Set();
  return values.map(value => {
    const source = validateSource(value);
    if (ids.has(source.id) || urls.has(source.url)) throw new Error(`检测源标识或网址重复：${source.id}`);
    ids.add(source.id); urls.add(source.url);
    return source;
  }).sort((a,b) => a.order - b.order || a.id.localeCompare(b.id));
}

export function mergePreferences(defaults, saved) {
  if (!Array.isArray(saved)) return defaults.map(source => ({...source}));
  const known = new Map(defaults.map(source => [source.id, source])), result = [];
  for (const preference of saved) {
    if (!preference || !known.has(preference.id)) continue;
    result.push({...known.get(preference.id), enabled:preference.enabled !== false});
    known.delete(preference.id);
  }
  return [...result, ...[...known.values()].map(source => ({...source}))];
}

export function githubDraftURL(value) {
  const source = validateSource(value);
  const url = new URL(`${repository}/new/main/sources`);
  url.searchParams.set('filename', `${source.id}.json`);
  url.searchParams.set('value', `${JSON.stringify(source, null, 2)}\n`);
  return url.href;
}
