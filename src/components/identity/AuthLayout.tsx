import type { ReactNode } from "react";
import { ArrowUpRight, Check, FileText, MessagesSquare, ScanLine } from "lucide-react";
import ProductAvatar from "../brand/ProductAvatar";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <main className="auth-page">
    <section className="auth-story" aria-label="孔明职配介绍">
      <a className="auth-brand" href="/" aria-label="孔明职配首页"><ProductAvatar compact /><span><strong>孔明职配</strong><small>KONGMING CAREER</small></span></a>
      <div className="auth-story-copy"><span className="auth-kicker"><i /> 为下一步，做好准备</span><h1>看清自己的积累，<br />走向适合的机会。</h1><p>梳理简历、理解岗位、练习面试。<br />把每一次准备，留在自己的求职工作区。</p></div>
      <div className="auth-path" aria-label="产品功能">
        <div><span><FileText size={20} /></span><strong>整理简历画像</strong><small>从经历中找到能力证据</small><Check size={16} /></div>
        <i />
        <div><span><ScanLine size={20} /></span><strong>理解岗位要求</strong><small>看见匹配依据与准备重点</small><ArrowUpRight size={17} /></div>
        <i />
        <div><span><MessagesSquare size={20} /></span><strong>练习并复盘面试</strong><small>记录反馈，持续完善表达</small><ArrowUpRight size={17} /></div>
      </div>
      <footer>你的经历，由你积累。你的方向，由你选择。</footer>
    </section>
    <section className="auth-form-side"><div className="auth-mobile-brand"><ProductAvatar compact /><strong>孔明职配</strong></div><div className="auth-form-wrap">{children}</div><footer>孔明职配 · 学生求职智能工作台</footer></section>
  </main>;
}
