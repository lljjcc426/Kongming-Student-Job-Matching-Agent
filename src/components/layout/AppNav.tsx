import { faUserAstronaut } from "@fortawesome/free-solid-svg-icons";
import { Bot, BriefcaseBusiness, FilePenLine, FileText, Sprout, LayoutDashboard, UserRound, Video } from "lucide-react";
import type { ReactNode } from "react";
import type { ActivePage } from "../../app/types";
import type { AppIdentity } from "../../features/identity/identityClient";
import ProductAvatar from "../brand/ProductAvatar";
import FontAwesomeShapeIcon from "../shared/FontAwesomeShapeIcon";

const NAV_ITEMS: Array<{ id: ActivePage; label: string; icon: ReactNode }> = [
  { id: "home", label: "首页", icon: <FontAwesomeShapeIcon icon={faUserAstronaut} size={16} /> },
  { id: "resume-editor", label: "简历编辑", icon: <FilePenLine size={16} /> },
  { id: "resume", label: "简历解析", icon: <FileText size={16} /> },
  { id: "jobs", label: "岗位推荐", icon: <BriefcaseBusiness size={16} /> },
  { id: "interview", label: "模拟面试", icon: <Video size={16} /> },
  { id: "growth", label: "成长规划", icon: <Sprout size={16} /> },
  { id: "assistant", label: "AI 助手", icon: <Bot size={16} /> },
];

type AppNavProps = {
  activePage: ActivePage;
  identity: AppIdentity;
  onChange: (page: ActivePage) => void;
  onOpenIdentity: () => void;
  onOpenConsole: () => void;
};

export default function AppNav({ activePage, identity, onChange, onOpenIdentity, onOpenConsole }: AppNavProps) {
  return (
    <nav className="app-nav" aria-label="页面导航">
      <button type="button" className="nav-brand" onClick={() => onChange("home")}>
        <ProductAvatar compact />
        <span className="brand-name">孔明职配</span>
        <small>学生求职智能工作台</small>
      </button>
      <div>
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={activePage === item.id ? "active" : ""}
            onClick={() => onChange(item.id)}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </div>
      {identity.role === "admin" ? <button type="button" className="nav-console" onClick={onOpenConsole}><LayoutDashboard size={16} />服务控制台</button> : null}
      <button type="button" className="nav-identity" onClick={onOpenIdentity}>
        <span className="nav-identity-avatar"><UserRound size={17} /></span>
        <span>
          <strong>{identity.registered ? identity.nickname : "访客体验"}</strong>
          <small>{identity.role === "admin" ? "管理员" : identity.accountKind === "demo" ? "当前浏览器体验" : "普通用户"}</small>
        </span>
      </button>
    </nav>
  );
}
