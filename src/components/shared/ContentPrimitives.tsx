import { ArrowUpRight, CheckCircle2 } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <section className="empty-state">
      <strong>{title}</strong>
      <p>{text}</p>
    </section>
  );
}

export function Panel({ eyebrow, title, icon, children }: { eyebrow: string; title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="panel">
      <div className="panel-title">
        <div>{icon}</div>
        <section>
          <span>{eyebrow}</span>
          <h2>{title}</h2>
        </section>
      </div>
      {children}
    </section>
  );
}

export function InfoBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="info-block">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

export function TagList({ items, compact = false, muted = false }: { items: string[]; compact?: boolean; muted?: boolean }) {
  return (
    <div className={`tag-list ${compact ? "compact" : ""} ${muted ? "muted" : ""}`}>
      {items.length ? items.map((item) => <span key={item}>{item}</span>) : <span>暂无</span>}
    </div>
  );
}

export function BulletList({ items, icon }: { items: string[]; icon?: "check" | "risk" }) {
  return (
    <ul className={`bullet-list ${icon ?? ""}`}>
      {items.map((item) => (
        <li key={item}>
          {icon === "check" ? <CheckCircle2 size={15} /> : null}
          {icon === "risk" ? <ArrowUpRight size={15} /> : null}
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
