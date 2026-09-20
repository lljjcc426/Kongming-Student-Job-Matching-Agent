import { Check, Copy, KeyRound, LogIn, LogOut, ShieldCheck, UserPlus, UserRound, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { AppIdentity } from "../../features/identity/identityClient";

type IdentityMode = "login" | "register" | "recover" | "account" | "recovery";

type RegisterResult = {
  recoveryCode: string;
  migratedLegacyIdentity: boolean;
};

type IdentityDialogProps = {
  open: boolean;
  required: boolean;
  loading: boolean;
  identity: AppIdentity;
  onClose: () => void;
  onRegister: (nickname: string, password: string) => Promise<RegisterResult>;
  onLogin: (nickname: string, password: string) => Promise<void>;
  onRecover: (nickname: string, recoveryCode: string, password: string) => Promise<void>;
  onLoginDemo: () => Promise<void>;
  onLogout: () => Promise<void>;
};

export default function IdentityDialog({
  open,
  required,
  loading,
  identity,
  onClose,
  onRegister,
  onLogin,
  onRecover,
  onLoginDemo,
  onLogout,
}: IdentityDialogProps) {
  const legacyAccount = identity.registered && !identity.hasPassword && !identity.authenticated;
  const initialMode = (): IdentityMode => identity.authenticated
    ? "account"
    : legacyAccount ? "register" : "login";
  const [mode, setMode] = useState<IdentityMode>(initialMode);
  const [nickname, setNickname] = useState(identity.nickname);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [issuedCode, setIssuedCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMode(initialMode());
    setNickname(identity.nickname);
    setPassword("");
    setConfirmPassword("");
    setRecoveryCode("");
    setIssuedCode("");
    setBusy(false);
    setError("");
    setCopied(false);
  }, [open]);

  if (!open) return null;

  const run = async (operation: () => Promise<void>, fallback: string) => {
    setBusy(true);
    setError("");
    try {
      await operation();
    } catch (operationError) {
      setError(operationError instanceof Error ? operationError.message : fallback);
    } finally {
      setBusy(false);
    }
  };

  const register = () => run(async () => {
    if (password !== confirmPassword) throw new Error("两次输入的密码不一致。");
    const result = await onRegister(nickname, password);
    if (result.recoveryCode) {
      setIssuedCode(result.recoveryCode);
      setMode("recovery");
    } else {
      onClose();
    }
  }, "账户创建失败，请重试。");

  const login = () => run(async () => {
    await onLogin(nickname, password);
    onClose();
  }, "登录失败，请重试。");

  const recover = () => run(async () => {
    if (password !== confirmPassword) throw new Error("两次输入的新密码不一致。");
    await onRecover(nickname, recoveryCode, password);
    onClose();
  }, "账户找回失败，请重试。");

  const loginDemo = () => run(async () => {
    await onLoginDemo();
    onClose();
  }, "演示账号暂时不可用。");

  const logout = () => run(async () => {
    await onLogout();
    setNickname("");
    setPassword("");
    setMode("login");
  }, "退出失败，请重试。");

  const copyCode = async () => {
    await navigator.clipboard.writeText(`${identity.nickname} ${issuedCode}`);
    setCopied(true);
  };

  if (loading) {
    return (
      <div className="identity-dialog-backdrop identity-login-backdrop">
        <section className="identity-dialog identity-login-dialog" aria-live="polite">
          <div className="identity-dialog-icon"><ShieldCheck size={28} /></div>
          <span className="identity-eyebrow">KONGMING ACCOUNT</span>
          <h2>正在恢复登录状态</h2>
          <p>正在安全读取你的求职工作区。</p>
        </section>
      </div>
    );
  }

  const closeButton = !required && identity.authenticated ? (
    <button type="button" className="identity-dialog-close" onClick={onClose} aria-label="关闭账户中心">
      <X size={18} />
    </button>
  ) : null;

  return (
    <div className={`identity-dialog-backdrop ${required ? "identity-login-backdrop" : ""}`} role="presentation">
      <section className={`identity-dialog ${required ? "identity-login-dialog" : ""}`} role="dialog" aria-modal="true" aria-labelledby="identity-title">
        {closeButton}

        {mode === "login" ? (
          <form onSubmit={(event) => { event.preventDefault(); void login(); }}>
            <div className="identity-dialog-icon"><LogIn size={28} /></div>
            <span className="identity-eyebrow">KONGMING ACCOUNT</span>
            <h2 id="identity-title">登录孔明职配</h2>
            <p>登录后继续查看你的简历画像、面试记录和动态成长计划。</p>
            <label className="identity-field">
              <span>昵称</span>
              <input autoFocus autoComplete="username" value={nickname} maxLength={24} placeholder="请输入昵称" onChange={(event) => setNickname(event.target.value)} />
            </label>
            <label className="identity-field">
              <span>密码</span>
              <input type="password" autoComplete="current-password" value={password} maxLength={128} placeholder="请输入密码" onChange={(event) => setPassword(event.target.value)} />
            </label>
            {error ? <p className="identity-error" role="alert">{error}</p> : null}
            <button type="submit" className="identity-wide-action" disabled={busy}>{busy ? "正在登录" : "登录"}</button>
            <div className="identity-login-links">
              <button type="button" onClick={() => { setMode("register"); setError(""); }}>创建账号</button>
              <button type="button" onClick={() => { setMode("recover"); setError(""); }}>忘记密码</button>
            </div>
            <div className="identity-demo-divider"><span>评委快速体验</span></div>
            <button type="button" className="identity-demo-action" onClick={() => void loginDemo()} disabled={busy}>
              <UserRound size={18} /> 一键进入演示账号
              <small>demo / 123456 · 每次进入自动重置</small>
            </button>
          </form>
        ) : null}

        {mode === "register" ? (
          <form onSubmit={(event) => { event.preventDefault(); void register(); }}>
            <div className="identity-dialog-icon"><UserPlus size={28} /></div>
            <span className="identity-eyebrow">{legacyAccount ? "账户安全升级" : "创建正式账号"}</span>
            <h2 id="identity-title">{legacyAccount ? "为原有身份设置密码" : "创建你的求职账号"}</h2>
            <p>{legacyAccount ? "检测到当前浏览器已有进度。设置密码后，原有数据会完整保留。" : "账号会绑定当前浏览器已有进度，并生成用于找回密码的 6 位恢复码。"}</p>
            <label className="identity-field">
              <span>昵称</span>
              <input autoFocus autoComplete="username" value={nickname} maxLength={24} placeholder="例如：小孔明" onChange={(event) => setNickname(event.target.value)} />
              <small>2–24 个字符，昵称不可与其他用户重复。</small>
            </label>
            <label className="identity-field">
              <span>设置密码</span>
              <input type="password" autoComplete="new-password" value={password} maxLength={128} placeholder="至少 8 个字符" onChange={(event) => setPassword(event.target.value)} />
              <small>请勿使用 123456、12345678 等常见弱密码。</small>
            </label>
            <label className="identity-field">
              <span>确认密码</span>
              <input type="password" autoComplete="new-password" value={confirmPassword} maxLength={128} placeholder="再次输入密码" onChange={(event) => setConfirmPassword(event.target.value)} />
            </label>
            {error ? <p className="identity-error" role="alert">{error}</p> : null}
            <div className="identity-form-actions">
              {!legacyAccount ? <button type="button" className="secondary" onClick={() => setMode("login")}>返回登录</button> : null}
              <button type="submit" className="primary" disabled={busy}>{busy ? "正在创建" : legacyAccount ? "设置密码并进入" : "创建账号"}</button>
            </div>
          </form>
        ) : null}

        {mode === "recover" ? (
          <form onSubmit={(event) => { event.preventDefault(); void recover(); }}>
            <div className="identity-dialog-icon"><KeyRound size={28} /></div>
            <span className="identity-eyebrow">安全找回</span>
            <h2 id="identity-title">重置登录密码</h2>
            <p>输入注册时保存的恢复码。重置后，其他设备上的旧会话会自动失效。</p>
            <label className="identity-field"><span>昵称</span><input autoFocus autoComplete="username" value={nickname} maxLength={24} onChange={(event) => setNickname(event.target.value)} /></label>
            <label className="identity-field"><span>6 位恢复码</span><input value={recoveryCode} inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000" onChange={(event) => setRecoveryCode(event.target.value.replace(/\D/g, "").slice(0, 6))} /></label>
            <label className="identity-field"><span>新密码</span><input type="password" autoComplete="new-password" value={password} maxLength={128} placeholder="至少 8 个字符" onChange={(event) => setPassword(event.target.value)} /></label>
            <label className="identity-field"><span>确认新密码</span><input type="password" autoComplete="new-password" value={confirmPassword} maxLength={128} onChange={(event) => setConfirmPassword(event.target.value)} /></label>
            {error ? <p className="identity-error" role="alert">{error}</p> : null}
            <div className="identity-form-actions">
              <button type="button" className="secondary" onClick={() => setMode("login")}>返回登录</button>
              <button type="submit" className="primary" disabled={busy}>{busy ? "正在重置" : "重置并登录"}</button>
            </div>
          </form>
        ) : null}

        {mode === "recovery" ? (
          <>
            <div className="identity-dialog-icon success"><Check size={28} /></div>
            <span className="identity-eyebrow">账号创建成功</span>
            <h2 id="identity-title">请保存恢复信息</h2>
            <p>恢复码只显示这一次。忘记密码时，需要同时输入昵称和恢复码。</p>
            <div className="identity-recovery-card">
              <span>{identity.nickname}</span>
              <strong>{issuedCode}</strong>
              <button type="button" onClick={() => void copyCode()}>{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? "已复制" : "复制昵称和恢复码"}</button>
            </div>
            <p className="identity-security-note">请勿将恢复码发送给他人。</p>
            <button type="button" className="identity-wide-action" onClick={onClose}>我已保存，进入工作台</button>
          </>
        ) : null}

        {mode === "account" ? (
          <>
            <div className="identity-dialog-icon"><UserRound size={28} /></div>
            <span className="identity-eyebrow">当前登录账号</span>
            <h2 id="identity-title">{identity.nickname}</h2>
            <p>该账号的智能体记忆、面试结果与成长计划保存在 D 盘数据库中，并由登录会话隔离。</p>
            <div className="identity-account-status"><ShieldCheck size={18} /> {identity.accountKind === "demo" ? "演示账号 · 数据仅用于体验" : "密码与恢复码保护已启用"}</div>
            <div className="identity-account-actions">
              <button type="button" onClick={() => { setNickname(identity.nickname); setMode("recover"); }} disabled={identity.accountKind === "demo"}><KeyRound size={18} />使用恢复码修改密码</button>
              <button type="button" onClick={() => void logout()} disabled={busy}><LogOut size={18} />{busy ? "正在退出" : "退出当前账号"}</button>
            </div>
          </>
        ) : null}
      </section>
    </div>
  );
}
