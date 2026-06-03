import { Crosshair, FileSearch, Lightbulb, Video, type LucideIcon } from "lucide-react";

export type LoadingStage = {
  label: string;
  percent: number;
  Icon: LucideIcon;
};

export const loadingStages: LoadingStage[] = [
  { label: "解析简历", percent: 25, Icon: FileSearch },
  { label: "岗位匹配", percent: 50, Icon: Crosshair },
  { label: "生成建议", percent: 75, Icon: Lightbulb },
  { label: "模拟面试", percent: 100, Icon: Video },
];
