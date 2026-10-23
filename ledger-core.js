// 记账本手机端数据层:拉取 GitHub 私有仓库的 ledger.json 并计算展示所需数据。
// 用顶层 function 声明,浏览器 <script> 加载后即成为全局;末尾 UMD 导出供 node require。

// 可支配余额 = settings.balance − Σ(支出) + Σ(收入),与电脑端 calc() 一致。
function currentBalance(settings, entries) {
  const balance = parseFloat(settings.balance) || 0;
  let flowExpense = 0;
  let flowIncome = 0;
  for (const e of entries) {
    const amt = parseFloat(e.amount) || 0;
    if (e.type === '收入') flowIncome += amt;
    else flowExpense += amt;
  }
  return balance - flowExpense + flowIncome;
}

// 按日期倒序分组,每条保留 type/category/note/amount。
function groupEntriesByDate(entries) {
  const map = new Map();
  for (const e of entries) {
    if (!map.has(e.date)) map.set(e.date, []);
    map.get(e.date).push({ type: e.type, category: e.category, note: e.note, amount: e.amount });
  }
  return Array.from(map.entries())
    .sort((a, b) => (a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0))
    .map(([date, items]) => ({ date, items }));
}

// 把 GitHub Contents API 返回的 { content: base64, encoding: 'base64' } 解码成对象。
function decodeLedgerJson(githubApiResponse) {
  const bytes = Uint8Array.from(atob(githubApiResponse.content), (c) => c.charCodeAt(0));
  const json = new TextDecoder('utf-8').decode(bytes);
  return JSON.parse(json);
}

// GET 拉取 ledger.json 并解码;失败抛可读错误。
async function fetchLedger(owner, repo, token) {
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/ledger.json`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
    },
  });
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    if (res.status === 404) detail = '还没有同步数据,或仓库名/密钥未授权该仓库';
    else if (res.status === 401 || res.status === 403) detail = '手机访问密钥失效或权限不足';
    throw new Error(detail);
  }
  const resp = await res.json();
  return decodeLedgerJson(resp);
}

// UMD 导出:浏览器里 `module` 未定义,函数已是全局;node 里供 require 使用。
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { currentBalance, groupEntriesByDate, decodeLedgerJson, fetchLedger };
}
