import type { ReactNode } from "react";
import ProductAvatar from "../brand/ProductAvatar";
import AuthFlowDiagram from "./AuthFlowDiagram";
import "../../styles/auth-flow.css";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <main className="auth-page">
    <div className="auth-atmosphere" aria-hidden="true" />
    <header className="auth-header">
      <a className="auth-brand" href="/" aria-label="孔明职配首页">
        <ProductAvatar compact /><strong>孔明职配</strong>
      </a>
    </header>
    <div className="auth-content">
      <AuthFlowDiagram />
      <div className="auth-form-wrap">{children}</div>
    </div>
  </main>;
}
