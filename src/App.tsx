import { lazy, Suspense, useEffect, useRef, useState } from "react";
import ResumeEditorPage from "./pages/ResumeEditorPage";
import AppNav from "./components/layout/AppNav";
import PageLoadingFallback from "./components/shared/PageLoadingFallback";
import type { ActivePage } from "./app/types";
import { useCareerChat } from "./features/assistant/useCareerChat";
import { useJobWorkspace } from "./features/jobs/useJobWorkspace";
import { useMatchInsights } from "./features/matching/useMatchInsights";
import { useResumeProcessing } from "./features/resume/useResumeProcessing";
import { useGrowthPlan } from "./features/growth/useGrowthPlan";
import LoadingScreen from "./LoadingScreen";

const AIAssistantPage = lazy(() => import("./pages/AIAssistantPage"));
const HomePage = lazy(() => import("./pages/HomePage"));
const InterviewPage = lazy(() => import("./pages/InterviewPage"));
const MatchingWorkspacePage = lazy(() => import("./pages/MatchingWorkspacePage"));
const GrowthPlanPage = lazy(() => import("./pages/GrowthPlanPage"));

function App() {
  const [introVisible, setIntroVisible] = useState(true);
  const [activePage, setActivePage] = useState<ActivePage>("home");
  const profileColumnRef = useRef<HTMLElement | null>(null);
  const {
    resumeText,
    originalResumePreview,
    resumeOcrDocument,
    structuredResume,
    setStructuredResume,
    activeProfile,
    modelJobs,
    modelInsight,
    modelStatus,
    documentStatus,
    modelMessage,
    pipelineStep,
    uploadMessage,
    resumeSource,
    hasResume,
    uploadResume,
    runMatchAnalysis,
  } = useResumeProcessing();

  const {
    selectedJob,
    hasAnalysis,
    matchResult: result,
    rankedJobs,
    customTitle,
    setCustomTitle,
    customJdText,
    setCustomJdText,
    customJobs,
    jdStatus,
    jdStep,
    jdMessage,
    selectJob,
    deleteCustomJob,
    analyzeCustomJob,
  } = useJobWorkspace({
    resumeText,
    resumeProfile: structuredResume,
    onResumeProfileChange: setStructuredResume,
    modelJobs,
    profile: activeProfile,
  });
  const {
    optimizedDraft,
    careerOpsEvaluation,
    copyStatus,
    downloadReport,
    copyOptimizedDraft,
  } = useMatchInsights({
    profile: activeProfile,
    selectedJob,
    matchResult: result,
    resumeText,
  });
  const {
    messages: chatMessages,
    input: chatInput,
    setInput: setChatInput,
    status: chatStatus,
    statusMessage: chatMessage,
    bodyRef: chatBodyRef,
    memoryStatus,
    memoryCount,
    memoryUpdatedAt,
    feedback: chatFeedback,
    startVoiceInput: handleChatSpeechInput,
    send: handleSendChat,
    clearMemory: handleClearChatMemory,
    submitFeedback: handleChatFeedback,
  } = useCareerChat({
    resumeText,
    resumeProfile: structuredResume,
    selectedJob,
    matchResult: result,
    hasAnalysis,
  });
  const growth = useGrowthPlan({
    profile: activeProfile,
    job: selectedJob,
    matchResult: result,
    hasAnalysis,
  });

  useEffect(() => {
    if (activePage !== "resume" || !structuredResume) return;
    window.requestAnimationFrame(() => {
      profileColumnRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    });
  }, [activePage, structuredResume]);

  if (introVisible) {
    return <LoadingScreen onFinish={() => setIntroVisible(false)} />;
  }

  return (
    <main className="app-shell">
      <AppNav activePage={activePage} onChange={setActivePage} />

      <Suspense fallback={<PageLoadingFallback />}>
        {activePage === "home" ? <HomePage onNavigate={setActivePage} /> : null}

        {activePage === "resume-editor" ? (
          <ResumeEditorPage
            original={originalResumePreview}
            originalText={resumeText}
            ocrDocument={resumeOcrDocument}
            resume={structuredResume}
            onChange={setStructuredResume}
            onUpload={(file) => uploadResume(file, { jdText: customJdText })}
            uploadMessage={uploadMessage}
            isUploading={documentStatus === "loading"}
          />
        ) : null}

        <MatchingWorkspacePage
            activePage={activePage}
            profileColumnRef={profileColumnRef}
            resume={{
              hasResume,
              source: resumeSource,
              status: modelStatus,
              step: pipelineStep,
              text: resumeText,
              structured: structuredResume,
            }}
            jd={{
              title: customTitle,
              text: customJdText,
              status: jdStatus,
              step: jdStep,
              message: jdMessage,
              customJobs,
              onTitleChange: setCustomTitle,
              onTextChange: setCustomJdText,
              onAnalyze: () => void analyzeCustomJob(),
              onSelect: selectJob,
              onDelete: deleteCustomJob,
            }}
            match={{
              hasAnalysis,
              profile: activeProfile,
              rankedJobs,
              selectedJob,
              result,
              careerOps: careerOpsEvaluation,
              optimizedDraft,
            }}
            insight={{
              modelStatus,
              modelMessage,
              modelInsight,
              copyStatus,
              onDownloadReport: downloadReport,
              onRunModelAnalysis: () => void runMatchAnalysis({ selectedJob, matchResult: result, hasAnalysis }),
              onCopyDraft: () => void copyOptimizedDraft(),
            }}
        />

        {activePage === "assistant" ? (
          <section className="assistant-panel">
            <AIAssistantPage
              messages={chatMessages}
              input={chatInput}
              status={chatStatus}
              statusMessage={chatStatus === "loading" ? "正在生成回复" : chatStatus === "listening" ? "正在收听" : chatMessage}
              bodyRef={chatBodyRef}
              memoryStatus={memoryStatus}
              memoryCount={memoryCount}
              memoryUpdatedAt={memoryUpdatedAt}
              feedback={chatFeedback}
              onInputChange={setChatInput}
              onSend={() => void handleSendChat()}
              onVoiceInput={handleChatSpeechInput}
              onClearMemory={() => void handleClearChatMemory()}
              onFeedback={handleChatFeedback}
            />
          </section>
        ) : null}

        {activePage === "interview" ? (
          <InterviewPage
            job={selectedJob}
            profile={activeProfile}
            resumeText={resumeText}
            hasAnalysis={hasAnalysis}
            onComplete={growth.completeInterview}
            onOpenGrowthPlan={() => setActivePage("growth")}
          />
        ) : null}

        {activePage === "growth" ? (
          <GrowthPlanPage
            plan={growth.plan}
            status={growth.status}
            message={growth.message}
            progress={growth.progress}
            isTargetCurrent={growth.isTargetCurrent}
            onOpenInterview={() => setActivePage("interview")}
            onUpdateTask={growth.updateTask}
            onUpdateTargetDate={growth.updateTargetDate}
            onRegenerate={growth.regenerate}
          />
        ) : null}
      </Suspense>
    </main>
  );
}

export default App;
