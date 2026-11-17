import { useCallback, useEffect, useState } from "react";
import { Activity, ArrowDownLeft, ArrowUpRight, Check, ChevronLeft, ChevronRight, CircleAlert, Clock3, Cpu, Database, ExternalLink, FileClock, LayoutDashboard, LogOut, RefreshCw, Search, Server, ShieldCheck, Users, Zap } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import ProductAvatar from "../components/brand/ProductAvatar";
import type { AppIdentity } from "../features/identity/identityClient";
import { changeAccount, loadAccounts, loadAudit, loadOverview, loadRequests, type AccountRow, type AuditRow, type Overview, type PageResult, type RequestRow } from "../features/admin/adminClient";

type View = "overview" | "requests" | "users" | "audit";
const views = [
  { id: "overview" as const, label: "运行概览", icon: LayoutDashboard, description: "查看服务运行、调用趋势与资源使用情况。" },
  { id: "requests" as const, label: "调用记录", icon: Activity, description: "查看应用接口的状态、耗时与模型用量。" },
  { id: "users" as const, label: "用户管理", icon: Users, description: "查看账号与会话，管理普通用户的访问状态。" },
  { id: "audit" as const, label: "操作审计", icon: FileClock, description: "追踪账号授权、停用及会话管理操作。" },
];
const number = (value: number | null) => (value || 0).toLocaleString("zh-CN");
const date = (value: string | null) => value ? new Date(value).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }) : "—";
const bytes = (value: number) => value >= 1024 ** 3 ? `${(value / 1024 ** 3).toFixed(1)} GB` : `${(value / 1024 ** 2).toFixed(1)} MB`;
const duration = (value: number) => value >= 1000 ? `${(value / 1000).toFixed(2)} s` : `${Math.round(value)} ms`;
const actionNames: Record<string, string> = { "account.role": "设置账号角色", "account.disable": "停用账号", "account.enable": "恢复账号", "account.revoke-sessions": "撤销登录会话" };

function Empty({ children }: { children: string }) { return <div className="console-empty"><Database size={24} /><p>{children}</p></div>; }
function Pagination({ data, onPage }: { data: { total: number; page: number; pageSize: number }; onPage: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  return <div className="console-pagination"><span>共 {number(data.total)} 条记录</span><div><button disabled={data.page <= 1} onClick={() => onPage(data.page - 1)} aria-label="上一页"><ChevronLeft size={16} /></button><span>{data.page} / {pages}</span><button disabled={data.page >= pages} onClick={() => onPage(data.page + 1)} aria-label="下一页"><ChevronRight size={16} /></button></div></div>;
}

export default function AdminConsolePage({ identity, onOpenProduct, onLogout }: { identity: AppIdentity; onOpenProduct: () => void; onLogout: () => Promise<void> }) {
  const [view, setView] = useState<View>("overview");
  const [range, setRange] = useState("24h");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [accounts, setAccounts] = useState<PageResult<AccountRow> | null>(null);
  const [requests, setRequests] = useState<PageResult<RequestRow> | null>(null);
  const [audit, setAudit] = useState<PageResult<AuditRow> | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("user");
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pendingUser, setPendingUser] = useState("");
  const [updatedAt, setUpdatedAt] = useState("");
  const current = views.find((item) => item.id === view)!;

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (view === "overview") setOverview(await loadOverview(range));
      if (view === "users") setAccounts(await loadAccounts(page, query, kind));
      if (view === "requests") setRequests(await loadRequests(page, failed));
      if (view === "audit") setAudit(await loadAudit(page));
      setUpdatedAt(new Date().toISOString());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "控制台数据读取失败。");
    } finally { setLoading(false); }
  }, [view, range, page, query, kind, failed]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (view !== "overview") return;
    const timer = window.setInterval(() => { if (!document.hidden) void refresh(); }, 15_000);
    return () => window.clearInterval(timer);
  }, [refresh, view]);

  const manage = async (account: AccountRow, action: string) => {
    const label = action === "disable" ? "停用该账号并撤销其登录会话" : action === "enable" ? "恢复该账号的访问权限" : "撤销该账号的全部登录会话";
    if (!window.confirm(`确认${label}？`)) return;
    setPendingUser(account.userId);
    setNotice("");
    try {
      await changeAccount(account.userId, action);
      setNotice("账号状态已更新。");
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "账号操作失败。"); }
    finally { setPendingUser(""); }
  };

  return <main className="console-app">
    <aside className="console-sidebar">
      <a href="/console" className="console-brand"><ProductAvatar compact /><span><strong>孔明职配</strong><small>服务控制台</small></span></a>
      <span className="console-nav-label">工作空间</span>
      <nav aria-label="控制台导航">{views.map(({ id, label, icon: Icon }) => <button className={id === view ? "active" : ""} key={id} onClick={() => { setView(id); setPage(1); setNotice(""); }}><Icon size={18} />{label}{id === view ? <i /> : null}</button>)}</nav>
      <div className="console-sidebar-bottom"><button onClick={onOpenProduct}><ExternalLink size={16} />打开产品工作区</button><div className="console-admin-identity"><span>{identity.nickname.slice(0, 1).toUpperCase()}</span><div><strong>{identity.nickname}</strong><small><ShieldCheck size={11} />管理员</small></div><button onClick={() => void onLogout()} aria-label="退出控制台"><LogOut size={17} /></button></div></div>
    </aside>
    <section className="console-workspace">
      <header className="console-topbar"><span>工作空间 <i>/</i> {current.label}</span><span className="console-private"><ShieldCheck size={13} />管理员工作区</span></header>
      <div className="console-content">
        <div className="console-page-heading"><div><span className="console-eyebrow">KONGMING / OPERATIONS</span><h1>{current.label}</h1><p>{current.description}</p></div><div className="console-heading-actions">{view === "overview" ? <select aria-label="统计范围" value={range} onChange={(event) => setRange(event.target.value)}><option value="24h">最近 24 小时</option><option value="7d">最近 7 天</option></select> : null}<button className="console-button" disabled={loading} onClick={() => void refresh()}><RefreshCw size={15} />{loading ? "读取中" : "刷新数据"}</button></div></div>
        {error ? <div className="console-alert" role="alert"><CircleAlert size={16} />{error}<button onClick={onOpenProduct}>返回产品</button></div> : null}
        {notice ? <div className="console-notice" role="status"><Check size={16} />{notice}</div> : null}
        {loading && !updatedAt ? <div className="console-loading" role="status">正在读取服务数据…</div> : null}

        {view === "overview" && overview ? <>
          <div className="console-stat-grid">
            {[{ label: "接口请求", value: number(overview.summary.requests), detail: `${number(overview.summary.inFlight)} 个请求处理中`, icon: Activity }, { label: "模型调用", value: number(overview.summary.modelCalls), detail: `${number(overview.summary.meteredCalls)} 次返回 Token 用量`, icon: Zap }, { label: "Token 用量", value: number(overview.summary.totalTokens), detail: `输入 ${number(overview.summary.inputTokens)} / 输出 ${number(overview.summary.outputTokens)}`, icon: Cpu }, { label: "请求成功率", value: overview.summary.requests ? `${(overview.summary.successful / overview.summary.requests * 100).toFixed(1)}%` : "—", detail: `${number(overview.summary.serverErrors)} 次服务错误 · ${number(overview.summary.clientErrors)} 次请求错误`, icon: ShieldCheck }].map(({ label, value, detail, icon: Icon }) => <article className="console-stat-card" key={label}><div><span>{label}</span><Icon size={16} /></div><strong>{value}</strong><small>{detail}</small></article>)}
          </div>
          <section className="console-card console-trend-card"><div className="console-card-heading"><div><h2>请求趋势</h2><p>按{range === "7d" ? "天" : "小时"}统计应用接口请求</p></div><div className="console-chart-legend"><span><i />请求量</span><span><i />错误请求</span></div></div><div className="console-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={overview.trend} margin={{ top: 12, right: 12, left: -26, bottom: 0 }}><defs><linearGradient id="requests-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#37877b" stopOpacity={0.18} /><stop offset="100%" stopColor="#37877b" stopOpacity={0} /></linearGradient></defs><CartesianGrid vertical={false} stroke="#edf0ed" strokeDasharray="3 5" /><XAxis dataKey="time" tickFormatter={(value: string) => new Date(value).toLocaleString("zh-CN", range === "7d" ? { month: "2-digit", day: "2-digit" } : { hour: "2-digit", minute: "2-digit", hour12: false })} tickLine={false} axisLine={false} minTickGap={38} tick={{ fontSize: 10, fill: "#8d999a" }} /><YAxis tickLine={false} axisLine={false} allowDecimals={false} tick={{ fontSize: 10, fill: "#8d999a" }} /><Tooltip labelFormatter={(value) => date(String(value))} contentStyle={{ borderRadius: 10, border: "1px solid #e1e8e4", fontSize: 12 }} /><Area name="请求量" type="monotone" dataKey="requests" stroke="#37877b" strokeWidth={2} fill="url(#requests-fill)" isAnimationActive={false} /><Area name="错误请求" type="monotone" dataKey="errors" stroke="#cf8d63" strokeWidth={1.5} fill="transparent" isAnimationActive={false} /></AreaChart></ResponsiveContainer></div><div className="console-trend-footer"><span><Clock3 size={13} />平均耗时 <strong>{duration(overview.summary.averageMs)}</strong></span><span>P95 耗时 <strong>{duration(overview.summary.p95Ms)}</strong></span><small>仅统计启用监控后的请求；Token 以模型返回用量为准。</small></div></section>
          <div className="console-two-columns">
            <section className="console-card"><div className="console-card-heading"><div><h2>服务状态</h2><p>运行状态与连接配置</p></div><Server size={17} /></div><div className="console-service-list">{overview.services.map((service) => <div key={service.id}><span className={`console-service-dot ${service.state}`} /><div><strong>{service.name}</strong><small>{service.detail}</small></div><span className={`console-badge ${service.state === "missing" ? "muted" : service.state === "healthy" ? "green" : "blue"}`}>{service.state === "healthy" ? "运行正常" : service.state === "configured" ? "已配置" : "未配置"}</span></div>)}</div><div className="console-card-footnote">“已配置”表示连接参数就绪，实际调用结果请查看调用记录。</div></section>
            <section className="console-card"><div className="console-card-heading"><div><h2>资源与存储</h2><p>当前进程与服务器快照</p></div><Database size={17} /></div><dl className="console-resources"><div><dt>应用内存</dt><dd>{bytes(overview.resources.processMemoryBytes)}</dd></div><div><dt>系统已用内存</dt><dd>{bytes(overview.resources.systemMemoryBytes - overview.resources.systemFreeBytes)} <span>/ {bytes(overview.resources.systemMemoryBytes)}</span></dd></div><div><dt>系统负载 / CPU 核心</dt><dd>{overview.resources.loadAverage.toFixed(2)} <span>/ {overview.resources.cpuCount} 核</span></dd></div><div><dt>进程运行时间</dt><dd>{Math.floor(overview.resources.uptimeSeconds / 3600)} 小时 {Math.floor(overview.resources.uptimeSeconds / 60) % 60} 分钟</dd></div><div><dt>账号数据库 / WAL</dt><dd>{bytes(overview.resources.databaseBytes)} <span>/ {bytes(overview.resources.walBytes)}</span></dd></div><div><dt>磁盘可用空间</dt><dd>{bytes(overview.resources.diskFreeBytes)}</dd></div></dl></section>
          </div>
          <div className="console-two-columns">
            <section className="console-card"><div className="console-card-heading"><div><h2>账号与业务记录</h2><p>数据库中当前保存的记录</p></div><Users size={17} /></div><div className="console-count-grid">{[{ label: "正式账号", value: overview.accounts.registered }, { label: "访客身份", value: overview.accounts.guests }, { label: "对话消息", value: overview.storage.messages }, { label: "面试记录", value: overview.storage.interviews }, { label: "成长计划", value: overview.storage.growthPlans }, { label: "停用账号", value: overview.accounts.disabled }].map((item) => <div key={item.label}><strong>{number(item.value)}</strong><span>{item.label}</span></div>)}</div></section>
            <section className="console-card"><div className="console-card-heading"><div><h2>数据库备份</h2><p>服务器上的 SQLite 在线备份</p></div><ShieldCheck size={17} /></div>{overview.backup.latest ? <div className="console-backup"><span className={`console-badge ${Date.now() - new Date(overview.backup.latest.createdAt).getTime() > 36 * 3_600_000 ? "orange" : "green"}`}>{Date.now() - new Date(overview.backup.latest.createdAt).getTime() > 36 * 3_600_000 ? "请检查定时任务" : "已有近期备份"}</span><strong>{date(overview.backup.latest.createdAt)}</strong><p>最近备份 {bytes(overview.backup.latest.bytes)} · 共 {overview.backup.count} 份 · 保留 {overview.backup.retentionDays} 天</p><small>当前为同机备份，异机副本需单独安排。</small></div> : <Empty>尚未发现备份，请检查服务器备份任务。</Empty>}</section>
          </div>
          <section className="console-card"><div className="console-card-heading"><div><h2>接口分布</h2><p>当前统计范围内的接口使用情况</p></div></div>{overview.endpoints.length ? <div className="console-table-wrap"><table><thead><tr><th>接口</th><th>请求次数</th><th>错误次数</th><th>平均耗时</th></tr></thead><tbody>{overview.endpoints.map((row) => <tr key={row.route}><td className="console-mono">{row.route}</td><td>{number(row.requests)}</td><td>{number(row.errors)}</td><td>{duration(row.averageMs)}</td></tr>)}</tbody></table></div> : <Empty>尚无接口调用记录。</Empty>}</section>
        </> : null}

        {view === "users" ? <section className="console-card"><div className="console-table-toolbar"><form onSubmit={(event) => { event.preventDefault(); setQuery(search); setPage(1); }}><Search size={16} /><input aria-label="搜索账号昵称" placeholder="搜索账号昵称" value={search} onChange={(event) => setSearch(event.target.value)} /><button type="submit">搜索</button></form><select value={kind} aria-label="账号类型" onChange={(event) => { setKind(event.target.value); setPage(1); }}><option value="user">正式账号</option><option value="demo">访客身份</option><option value="all">全部账号</option></select></div><div className="console-policy-note"><ShieldCheck size={14} />管理员角色仅由服务器授权，此处可管理普通账号的状态与会话。</div>{accounts?.rows.length ? <><div className="console-table-wrap"><table><thead><tr><th>账号</th><th>角色</th><th>状态</th><th>最近登录</th><th>有效会话</th><th>模型调用</th><th>操作</th></tr></thead><tbody>{accounts.rows.map((account) => <tr key={account.userId}><td><strong>{account.nickname}</strong><small className="console-cell-sub">{account.accountKind === "demo" ? `访客 · ${account.userId.slice(-8)}` : `注册于 ${date(account.createdAt)}`}</small></td><td><span className={`console-badge ${account.role === "admin" ? "green" : "muted"}`}>{account.role === "admin" ? "管理员" : account.accountKind === "demo" ? "访客" : "普通用户"}</span></td><td><span className={`console-badge ${account.status === "active" ? "green" : "orange"}`}>{account.status === "active" ? "正常" : "已停用"}</span></td><td>{date(account.lastLoginAt)}</td><td>{account.activeSessions}</td><td>{number(account.modelCalls)}</td><td>{account.role === "admin" ? <span className="console-muted">服务器维护</span> : <div className="console-row-actions"><button disabled={Boolean(pendingUser)} onClick={() => void manage(account, account.status === "active" ? "disable" : "enable")}>{account.status === "active" ? "停用" : "恢复"}</button><button disabled={Boolean(pendingUser)} onClick={() => void manage(account, "revoke-sessions")}>撤销会话</button></div>}</td></tr>)}</tbody></table></div><Pagination data={accounts} onPage={setPage} /></> : !loading ? <Empty>没有符合条件的账号。</Empty> : null}</section> : null}

        {view === "requests" ? <section className="console-card"><div className="console-table-toolbar"><div><h2>接口调用记录</h2><p>记录接口与用量元数据，不记录简历、对话正文或密钥。</p></div><label className="console-checkbox"><input type="checkbox" checked={failed} onChange={(event) => { setFailed(event.target.checked); setPage(1); }} />仅看错误</label></div>{requests?.rows.length ? <><div className="console-table-wrap"><table><thead><tr><th>时间</th><th>接口 / 任务</th><th>HTTP 状态</th><th>耗时</th><th>模型</th><th>输入 / 输出 Token</th></tr></thead><tbody>{requests.rows.map((row) => <tr key={row.id}><td>{date(row.occurredAt)}</td><td><span className="console-mono">{row.route}</span><small className="console-cell-sub">{row.task || row.method}</small></td><td><span className={`console-badge ${row.status < 400 ? "green" : row.status < 500 ? "orange" : "red"}`}>{row.status}</span></td><td>{duration(row.durationMs)}</td><td>{row.model || "—"}</td><td>{row.inputTokens === null ? "—" : <span className="console-tokens"><ArrowDownLeft size={12} />{number(row.inputTokens)}<ArrowUpRight size={12} />{number(row.outputTokens)}</span>}</td></tr>)}</tbody></table></div><Pagination data={requests} onPage={setPage} /></> : !loading ? <Empty>尚无符合条件的调用记录。</Empty> : null}</section> : null}

        {view === "audit" ? <section className="console-card"><div className="console-card-heading"><div><h2>管理操作记录</h2><p>管理员授权与账号管理操作均保留记录。</p></div></div>{audit?.rows.length ? <><div className="console-table-wrap"><table><thead><tr><th>时间</th><th>操作人</th><th>操作</th><th>目标账号</th><th>详情</th></tr></thead><tbody>{audit.rows.map((row) => <tr key={row.id}><td>{date(row.occurredAt)}</td><td>{row.actor}</td><td>{actionNames[row.action] || row.action}</td><td>{row.target}</td><td>{row.detail === "admin" ? "授予管理员" : row.detail === "user" ? "设为普通用户" : row.detail || "—"}</td></tr>)}</tbody></table></div><Pagination data={audit} onPage={setPage} /></> : !loading ? <Empty>尚无管理操作记录。</Empty> : null}</section> : null}
        <footer className="console-footer"><span>孔明职配 · 服务控制台</span><span>{updatedAt ? `最近读取 ${date(updatedAt)}${view === "overview" ? " · 每 15 秒刷新" : ""}` : "等待服务数据"}</span></footer>
      </div>
    </section>
  </main>;
}
