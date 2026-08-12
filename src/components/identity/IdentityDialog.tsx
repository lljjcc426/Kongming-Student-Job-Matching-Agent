import { Check, Copy, KeyRound, LogOut, ShieldCheck, Sparkles, UserRound, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { AppIdentity } from "../../features/identity/identityClient";

type IdentityMode = "choose" | "create" | "restore" | "account" | "recovery";

type IdentityDialogProps = {
  open: boolean;
  identity: AppIdentity;
  onClose: () => void;
  onCreate: (nickname: string) => Promise<string>;
  onRestore: (nickname: string, recoveryCode: string) => Promise<void>;
  onContinueAnonymous: () => void;
  onLogout: () => void;
  onStartFresh: () => void;
};

export default function IdentityDialog({
  open,
  identity,
  onClose,
  onCreate,
  onRestore,
  onContinueAnonymous,
  onLogout,
  onStartFresh,
}: IdentityDialogProps) {
  const [mode, setMode] = useState<IdentityMode>(identity.registered ? "account" : "choose");
  const [nickname, setNickname] = useState(identity.nickname);
  const [recoveryCode, setRecoveryCode] = useState("");
  const [issuedCode, setIssuedCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMode(identity.registered ? "account" : "choose");
    setNickname(identity.nickname);
    setRecoveryCode("");
    setIssuedCode("");
    setBusy(false);
    setError("");
    setCopied(false);
  }, [open]);

  if (!open) return null;

  const create = async () => {
    setBusy(true);
    setError("");
    try {
      const code = await onCreate(nickname);
      setIssuedCode(code);
      setMode("recovery");
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "身份创建失败，请重试。");
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    setBusy(true);
    setError("");
    try {
      await onRestore(nickname, recoveryCode);
    } catch (restoreError) {
      setError(restoreError instanceof Error ? restoreError.message : "身份找回失败，请重试。");
    } finally {
      setBusy(false);
    }
  };

  const copyCode = async () => {
    await navigator.clipboard.writeText(`${identity.nickname} ${issuedCode}`);
    setCopied(true);
  };

  const dismissButton = identity.registered ? (
    <button type="button" className="identity-dialog-close" onClick={onClose} aria-label="关闭身份中心">
      <X size={18} />
    </button>
  ) : null;

  return (
    <div className="identity-dialog-backdrop" role="presentation">
      <section className="identity-dialog" role="dialog" aria-modal="true" aria-labelledby="identity-title">
        {dismissButton}

        {mode === "choose" ? (
          <>
            <div className="identity-dialog-icon"><ShieldCheck size={28} /></div>
            <span className="identity-eyebrow">轻量身份 · 本地持久化</span>
            <h2 id="identity-title">保存你的求职成长进度</h2>
            <p>创建昵称后会获得 6 位恢复码。换浏览器时输入昵称和恢复码，即可找回面试记录、智能体记忆与成长计划。</p>
            <div className="identity-choice-grid">
              <button type="button" className="identity-choice-card primary" onClick={() => setMode("create")}>
                <UserRound size={22} />
                <span><strong>保护当前进度</strong><small>绑定当前匿名数据，不会重新开始</small></span>
              </button>
              <button type="button" className="identity-choice-card" onClick={() => setMode("restore")}>
                <KeyRound size={22} />
                <span><strong>找回已有进度</strong><small>使用昵称和 6 位恢复码</small></span>
              </button>
            </div>
            <button type="button" className="identity-text-action" onClick={onContinueAnonymous}>
              暂不绑定，继续本机体验
            </button>
          </>
        ) : null}

        {mode === "create" ? (
          <form onSubmit={(event) => { event.preventDefault(); void create(); }}>
            <div className="identity-dialog-icon"><UserRound size={28} /></div>
            <span className="identity-eyebrow">保护当前进度</span>
            <h2 id="identity-title">创建你的轻量身份</h2>
            <p>现有简历画像、对话与成长计划会直接绑定到该昵称。</p>
            <label className="identity-field">
              <span>昵称</span>
              <input
                autoFocus
                value={nickname}
                maxLength={24}
                placeholder="例如：小孔明"
                onChange={(event) => setNickname(event.target.value)}
              />
              <small>2–24 个字符，昵称不可与其他用户重复。</small>
            </label>
            {error ? <p className="identity-error" role="alert">{error}</p> : null}
            <div className="identity-form-actions">
              <button type="button" className="secondary" onClick={() => setMode("choose")}>返回</button>
              <button type="submit" className="primary" disabled={busy}>{busy ? "正在创建" : "创建并生成恢复码"}</button>
            </div>
          </form>
        ) : null}

        {mode === "restore" ? (
          <form onSubmit={(event) => { event.preventDefault(); void restore(); }}>
            <div className="identity-dialog-icon"><KeyRound size={28} /></div>
            <span className="identity-eyebrow">跨浏览器恢复</span>
            <h2 id="identity-title">找回已有进度</h2>
            <p>恢复成功后，当前工作区会切换到对应用户并重新读取数据。</p>
            <label className="identity-field">
              <span>昵称</span>
              <input autoFocus value={nickname} maxLength={24} onChange={(event) => setNickname(event.target.value)} />
            </label>
            <label className="identity-field">
              <span>6 位恢复码</span>
              <input
                value={recoveryCode}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="000000"
                onChange={(event) => setRecoveryCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              />
            </label>
            {error ? <p className="identity-error" role="alert">{error}</p> : null}
            <div className="identity-form-actions">
              <button type="button" className="secondary" onClick={() => setMode("choose")}>返回</button>
              <button type="submit" className="primary" disabled={busy}>{busy ? "正在找回" : "找回并进入"}</button>
            </div>
          </form>
        ) : null}

        {mode === "recovery" ? (
          <>
            <div className="identity-dialog-icon success"><Check size={28} /></div>
            <span className="identity-eyebrow">身份创建成功</span>
            <h2 id="identity-title">请保存你的恢复信息</h2>
            <p>恢复码只在这里显示。后续换浏览器或设备时，需要同时输入昵称和恢复码。</p>
            <div className="identity-recovery-card">
              <span>{identity.nickname}</span>
              <strong>{issuedCode}</strong>
              <button type="button" onClick={() => void copyCode()}>
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? "已复制" : "复制昵称和恢复码"}
              </button>
            </div>
            <p className="identity-security-note">请勿将恢复码发送给他人。遗失后可在当前浏览器重新生成。</p>
            <button type="button" className="identity-wide-action" onClick={onClose}>我已保存，进入工作台</button>
          </>
        ) : null}

        {mode === "account" ? (
          <>
            <div className="identity-dialog-icon"><UserRound size={28} /></div>
            <span className="identity-eyebrow">当前用户</span>
            <h2 id="identity-title">{identity.nickname}</h2>
            <p>该身份下的智能体记忆、面试结果与成长计划会在本机 D 盘数据库持续保存。</p>
            <div className="identity-account-status"><ShieldCheck size={18} /> 已启用跨浏览器找回</div>
            <div className="identity-account-actions">
              <button type="button" onClick={() => { setNickname(identity.nickname); setMode("create"); }}>
                <KeyRound size={18} />重新生成恢复码
              </button>
              <button type="button" onClick={onLogout}>
                <LogOut size={18} />退出当前用户
              </button>
              <button type="button" onClick={onStartFresh}>
                <Sparkles size={18} />开始新的体验
              </button>
            </div>
          </>
        ) : null}
      </section>
    </div>
  );
}
