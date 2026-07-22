import { useEffect, useMemo, useState } from "react";
import AbilityRadarCard from "./AbilityRadarCard";
import ConnectionLines from "./ConnectionLines";
import GlowBase from "./GlowBase";
import JobRecommendCard from "./JobRecommendCard";
import MatchPanel from "./MatchPanel";
import ResumeAnalysisCard from "./ResumeAnalysisCard";
import SuggestionCard from "./SuggestionCard";

const showcaseScenarios = [
  {
    id: "tech",
    evidenceCoverage: 92,
    jobs: [
      { title: "算法工程师", track: "互联网 / 技术", evidenceCoverage: 95 },
      { title: "数据分析师", track: "互联网 / 数据", evidenceCoverage: 90 },
      { title: "产品经理", track: "互联网 / 产品", evidenceCoverage: 88 },
    ],
    resumeEvidenceCompleteness: 84,
    progressItems: [
      ["教育背景", 90],
      ["专业技能", 85],
      ["项目经验", 80],
      ["综合素质", 80],
    ] as const,
    radarValues: [88, 84, 78, 74, 82],
    strengths: ["专业技能匹配", "项目经验相关", "职业兴趣契合", "发展路径一致"],
    suggestions: ["突出项目成果数据化", "补充相关技能证书", "优化求职目标描述"],
  },
  {
    id: "content",
    evidenceCoverage: 89,
    jobs: [
      { title: "AI 产品实习生", track: "互联网 / AI 产品", evidenceCoverage: 91 },
      { title: "用户研究实习生", track: "互联网 / 用户体验", evidenceCoverage: 88 },
      { title: "产品运营实习生", track: "互联网 / 运营", evidenceCoverage: 85 },
    ],
    resumeEvidenceCompleteness: 82,
    progressItems: [
      ["教育背景", 88],
      ["专业技能", 78],
      ["项目经验", 84],
      ["综合素质", 86],
    ] as const,
    radarValues: [80, 88, 86, 76, 84],
    strengths: ["表达能力突出", "调研经历相关", "内容判断稳定", "协作路径清晰"],
    suggestions: ["补充作品集链接", "强化调研方法描述", "量化传播效果"],
  },
  {
    id: "business",
    evidenceCoverage: 86,
    jobs: [
      { title: "商业分析实习生", track: "互联网 / 分析", evidenceCoverage: 89 },
      { title: "产品运营实习生", track: "互联网 / 运营", evidenceCoverage: 86 },
      { title: "数据产品实习生", track: "互联网 / 数据产品", evidenceCoverage: 83 },
    ],
    resumeEvidenceCompleteness: 80,
    progressItems: [
      ["教育背景", 84],
      ["专业技能", 82],
      ["项目经验", 78],
      ["综合素质", 88],
    ] as const,
    radarValues: [82, 80, 88, 84, 72],
    strengths: ["逻辑结构完整", "业务理解较强", "执行闭环清楚", "沟通协作稳定"],
    suggestions: ["补充业务指标口径", "突出跨团队协作", "精简经历层级"],
  },
];

export default function DashboardShowcase() {
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const scenario = useMemo(() => showcaseScenarios[scenarioIndex], [scenarioIndex]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setScenarioIndex((current) => (current + 1) % showcaseScenarios.length);
    }, 3200);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <section className="km-dashboard-showcase" aria-label="AI 智能匹配展示">
      <ConnectionLines />
      <div className="km-showcase-card km-showcase-jobs">
        <JobRecommendCard key={`jobs-${scenario.id}`} jobs={scenario.jobs} />
      </div>
      <div className="km-showcase-card km-showcase-resume">
        <ResumeAnalysisCard key={`resume-${scenario.id}`} evidenceCompleteness={scenario.resumeEvidenceCompleteness} progressItems={scenario.progressItems} />
      </div>
      <div className="km-showcase-card km-showcase-ability">
        <AbilityRadarCard key={`ability-${scenario.id}`} values={scenario.radarValues} />
      </div>
      <div className="km-showcase-card km-showcase-suggestion">
        <SuggestionCard key={`suggestion-${scenario.id}`} suggestions={scenario.suggestions} />
      </div>
      <div className="km-showcase-main">
        <MatchPanel key={`match-${scenario.id}`} evidenceCoverage={scenario.evidenceCoverage} strengths={scenario.strengths} />
      </div>
      <GlowBase />
    </section>
  );
}
