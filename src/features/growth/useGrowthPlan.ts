import { useEffect, useMemo, useRef, useState } from "react";
import type { Job, StudentProfile } from "../../data";
import type { MatchResult } from "../../matchEngine";
import type { InterviewFeedbackReport, InterviewTurn, InterviewType } from "../../types/interview";
import {
  createGrowthPlan,
  growthPlanProgress,
  normalizeGrowthPlan,
  reassessGrowthPlan,
  updateGrowthTargetDate,
  updateGrowthTaskEvidence,
} from "./growthEngine";
import { loadGrowthPlan, saveGrowthPlan } from "./growthPlanClient";
import type { GrowthPlan, GrowthPlanStatus, InterviewGrowthSnapshot } from "./types";

type UseGrowthPlanOptions = {
  profile: StudentProfile;
  job: Job;
  matchResult: MatchResult;
  hasAnalysis: boolean;
};

export function useGrowthPlan({ profile, job, matchResult, hasAnalysis }: UseGrowthPlanOptions) {
  const [plan, setPlan] = useState<GrowthPlan | null>(null);
  const [status, setStatus] = useState<GrowthPlanStatus>("loading");
  const [message, setMessage] = useState("正在读取成长计划");
  const planRef = useRef<GrowthPlan | null>(null);

  useEffect(() => {
    planRef.current = plan;
  }, [plan]);

  useEffect(() => {
    let active = true;
    void loadGrowthPlan()
      .then((storedPlan) => {
        if (!active) return;
        const normalizedPlan = storedPlan ? normalizeGrowthPlan(storedPlan) : null;
        planRef.current = normalizedPlan;
        setPlan(normalizedPlan);
        setStatus(normalizedPlan ? "ready" : "empty");
        setMessage(normalizedPlan ? "已恢复上次成长计划" : "完成一次模拟面试后生成成长计划");
      })
      .catch(() => {
        if (!active) return;
        setStatus("error");
        setMessage("成长计划读取失败，请稍后重试");
      });
    return () => {
      active = false;
    };
  }, []);

  const persist = async (nextPlan: GrowthPlan, successMessage: string) => {
    planRef.current = nextPlan;
    setPlan(nextPlan);
    setStatus("saving");
    setMessage("正在保存成长计划");
    try {
      const storedPlan = await saveGrowthPlan(nextPlan);
      if (!storedPlan) throw new Error("成长计划保存后未返回有效数据。");
      planRef.current = storedPlan;
      setPlan(storedPlan);
      setStatus("ready");
      setMessage(successMessage);
      return storedPlan;
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "成长计划保存失败");
      throw error;
    }
  };

  const completeInterview = async (
    feedback: InterviewFeedbackReport,
    turns: InterviewTurn[],
    interviewType: InterviewType,
  ) => {
    if (!hasAnalysis) throw new Error("请先完成简历解析和目标岗位选择。");
    const interview: InterviewGrowthSnapshot = {
      feedback,
      turns,
      interviewType,
      completedAt: new Date().toISOString(),
    };
    const current = planRef.current;
    const nextPlan = current?.targetJobId === job.id
      ? reassessGrowthPlan(current, { profile, job, matchResult, interview }, "interview_reassessment")
      : createGrowthPlan({ profile, job, matchResult, interview });
    await persist(
      nextPlan,
      current?.targetJobId === job.id
        ? "已根据最新面试完成实证复测并调整后续计划"
        : `已根据最新面试生成 ${nextPlan.planningDays} 天动态成长计划`,
    );
  };

  const updateTask = async (
    taskId: string,
    evidenceText: string,
    evidenceUrl: string,
    completed: boolean,
  ) => {
    if (!planRef.current) throw new Error("尚未生成成长计划。");
    const nextPlan = updateGrowthTaskEvidence(planRef.current, taskId, evidenceText, evidenceUrl, completed);
    const updatedTask = nextPlan.tasks.find((item) => item.id === taskId);
    await persist(
      nextPlan,
      !completed
        ? "任务证据已撤回"
        : updatedTask?.evidenceStatus === "verified"
          ? "证据审核通过，已更新预测分；实证分需复测后更新"
          : "证据需要补充，当前不会计入进度或匹配预测",
    );
  };

  const updateTargetDate = async (targetDate: string) => {
    if (!planRef.current) return;
    if (!hasAnalysis || planRef.current.targetJobId !== job.id) {
      throw new Error("当前目标岗位已经变化，请先按当前画像重排计划。");
    }
    const nextPlan = updateGrowthTargetDate(
      planRef.current,
      { profile, job, matchResult, interview: planRef.current.interview },
      targetDate,
    );
    await persist(nextPlan, `已按目标日期重排为 ${nextPlan.planningDays} 天（${nextPlan.planningWeeks} 周）计划`);
  };

  const regenerate = async () => {
    if (!planRef.current) throw new Error("请先完成一次模拟面试。");
    const nextPlan = createGrowthPlan({
      profile,
      job,
      matchResult,
      interview: planRef.current.interview,
      targetDate: planRef.current.targetDate,
      previousPlan: planRef.current,
    });
    await persist(nextPlan, "已根据当前岗位和画像重新生成计划");
  };

  const reassess = async () => {
    if (!planRef.current) throw new Error("请先完成一次模拟面试。");
    if (!hasAnalysis || planRef.current.targetJobId !== job.id) {
      throw new Error("请先完成当前目标岗位的简历解析和匹配分析。");
    }
    const nextPlan = reassessGrowthPlan(
      planRef.current,
      { profile, job, matchResult, interview: planRef.current.interview },
      "resume_reassessment",
    );
    await persist(nextPlan, "已使用最新简历与岗位分析重算实证匹配度");
  };

  const progress = useMemo(
    () => plan ? growthPlanProgress(plan) : { completed: 0, total: 0, percentage: 0 },
    [plan],
  );

  return {
    plan,
    status,
    message,
    progress,
    isTargetCurrent: Boolean(plan && plan.targetJobId === job.id),
    completeInterview,
    updateTask,
    updateTargetDate,
    regenerate,
    reassess,
  };
}
