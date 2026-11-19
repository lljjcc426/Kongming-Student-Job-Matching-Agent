import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import ResumeEditorPage from "./pages/ResumeEditorPage";
import AppNav from "./components/layout/AppNav";
import PageLoadingFallback from "./components/shared/PageLoadingFallback";
import type { ActivePage } from "./app/types";
import { useCareerChat } from "./features/assistant/useCareerChat";
import { useJobWorkspace } from "./features/jobs/useJobWorkspace";
import { useMatchInsights } from "./features/matching/useMatchInsights";
import { useResumeProcessing } from "./features/resume/useResumeProcessing";
import { useGrowthPlan } from "./features/growth/useGrowthPlan";
import IdentityDialog from "./components/identity/IdentityDialog";
import { useIdentity } from "./features/identity/useIdentity";
import type { AppIdentity } from "./features/identity/identityClient";
import { loadWorkspace, type WorkspaceSnapshot } from "./features/workspace/workspaceClient";
import { useWorkspacePersistence } from "./features/workspace/useWorkspacePersistence";
import "./styles/workspace.css";

const AdminConsolePage = lazy(() => import("./pages/AdminConsolePage"));
const AIAssistantPage = lazy(() => import("./pages/AIAssistantPage"));
const HomePage = lazy(() => import("./pages/HomePage"));
const InterviewPage = lazy(() => import("./pages/InterviewPage"));
const MatchingWorkspacePage = lazy(() => import("./pages/MatchingWorkspacePage"));
const GrowthPlanPage = lazy(() => import("./pages/GrowthPlanPage"));

type WorkspaceProps = {
  identity: AppIdentity;
  onOpenIdentity: () => void;
  onOpenConsole: () => void;
  onRegisterFlush: (flush: (() => Promise<boolean>) | null) => void;
};

function AccountWorkspace(props: WorkspaceProps) {
  const [loaded, setLoaded] = useState<{ snapshot: WorkspaceSnapshot | null } | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [revision, setRevision] = useState(0);
  const [entryPage, setEntryPage] = useState<ActivePage>("home");
  useEffect(() => {
    let active = true;
    setError("");
    void loadWorkspace(props.identity.userId)
      .then(snapshot => { if (active) setLoaded({ snapshot }); })
      .catch((loadError: unknown) => { if (active) setError(loadError instanceof Error ? loadError.message : "工作区读取失败。"); });
    return () => { active = false; };
  }, [props.identity.userId, retry]);
  if (error) return <main className="console-denied"><h1>工作区暂时无法读取</h1><p>{error}</p><button onClick={() => setRetry(value => value + 1)}>重新读取</button></main>;
  if (!loaded) return <PageLoadingFallback />;
  return <Workspace {...props} key={revision} initialWorkspace={loaded.snapshot} initialPage={entryPage} onClearWorkspace={page => {
    setLoaded({ snapshot: null });
    setEntryPage(page);
    setRevision(value => value + 1);
  }} />;
}

function Workspace({ identity, onOpenIdentity, onOpenConsole, onRegisterFlush, initialWorkspace, initialPage, onClearWorkspace }: WorkspaceProps & {
  initialWorkspace: WorkspaceSnapshot | null;
  initialPage: ActivePage;
  onClearWorkspace: (page: ActivePage) => void;
}) {
  const [activePage, setActivePage] = useState<ActivePage>(initialPage);
  const profileColumnRef = useRef<HTMLElement | null>(null);
  const {
    resumeText,
    originalResumeText,
    originalResumePreview,
    resumeOcrDocument,
    structuredResume,
    setStructuredResume,
    updateResumeFields,
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
    generateRecommendations,
    runMatchAnalysis,
  } = useResumeProcessing(initialWorkspace?.resume);

  const {
    selectedJob,
    selectedJobId,
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
    initial: initialWorkspace?.jobs,
  });
  const snapshot = useMemo<WorkspaceSnapshot>(() => ({
    version: 1,
    resume: {
      text: resumeText, originalText: originalResumeText, structured: structuredResume,
      modelJobs, insight: modelInsight, source: resumeSource,
      original: { kind: originalResumePreview.kind, name: originalResumePreview.name },
    },
    jobs: { customTitle, customJdText, customJobs, selectedJobId },
  }), [resumeText, originalResumeText, structuredResume, modelJobs, modelInsight, resumeSource, originalResumePreview.kind, originalResumePreview.name, customTitle, customJdText, customJobs, selectedJobId]);
  const persistence = useWorkspacePersistence(identity.userId, snapshot);
  useEffect(() => {
    onRegisterFlush(persistence.flush);
    return () => onRegisterFlush(null);
  }, [onRegisterFlush, persistence.flush]);
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
    userId: identity.userId,
    resumeText,
    resumeProfile: structuredResume,
    selectedJob,
    matchResult: result,
    hasAnalysis,
  });
  const growth = useGrowthPlan({
    userId: identity.userId,
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

  return (
    <main className="app-shell">
      <AppNav
        activePage={activePage}
        identity={identity}
        onChange={setActivePage}
        onOpenIdentity={onOpenIdentity}
        onOpenConsole={onOpenConsole}
      />
      <aside className="workspace-save-state" data-status={persistence.status} role={persistence.status === "error" ? "alert" : "status"}>
        {persistence.status === "error" ? <>{persistence.error}<button type="button" onClick={persistence.retry}>重试保存</button></> : persistence.status === "saving" ? "正在保存工作区" : "工作区已保存"}
      </aside>

      <Suspense fallback={<PageLoadingFallback />}>
        {activePage === "home" ? <HomePage onNavigate={setActivePage} /> : null}

        {activePage === "resume-editor" ? (
          <ResumeEditorPage
            original={originalResumePreview}
            originalText={originalResumeText}
            ocrDocument={resumeOcrDocument}
            resume={structuredResume}
            onChange={updateResumeFields}
            onUpload={(file) => uploadResume(file, { jdText: customJdText })}
            onGenerateRecommendations={() => void generateRecommendations({ jdText: customJdText })}
            uploadMessage={uploadMessage}
            isUploading={documentStatus === "loading"}
            isGenerating={modelStatus === "loading"}
            hasResume={hasResume}
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
              onClearMemory={() => {
                void persistence.suspend().then(handleClearChatMemory).then(cleared => {
                  if (cleared) onClearWorkspace(activePage);
                  else persistence.resume();
                });
              }}
              onFeedback={handleChatFeedback}
            />
          </section>
        ) : null}

        {activePage === "interview" ? (
          <InterviewPage
            userId={identity.userId}
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
            onReassess={growth.reassess}
          />
        ) : null}
      </Suspense>
    </main>
  );
}

function App() {
  const identity = useIdentity();
  const workspaceFlushRef = useRef<(() => Promise<boolean>) | null>(null);
  const [pathname, setPathname] = useState(window.location.pathname);
  const navigate = async (path: string) => {
    if (workspaceFlushRef.current && !await workspaceFlushRef.current()) return;
    window.history.pushState({}, "", path);
    setPathname(path);
  };
  const logout = async () => {
    if (workspaceFlushRef.current && !await workspaceFlushRef.current()) {
      throw new Error("工作区尚未保存，请重试保存后退出。");
    }
    await identity.logout();
  };
  useEffect(() => {
    const update = () => setPathname(window.location.pathname);
    window.addEventListener("popstate", update);
    return () => window.removeEventListener("popstate", update);
  }, []);
  useEffect(() => {
    if (identity.loading) return;
    const target = !identity.identity.authenticated ? "/" : pathname === "/" ? identity.identity.role === "admin" ? "/console" : "/app" : pathname;
    if (target !== pathname) {
      window.history.replaceState({}, "", target);
      setPathname(target);
    }
  }, [identity.loading, identity.identity.authenticated, identity.identity.role, pathname]);

  return (
    <>
      {identity.identity.authenticated ? (
        pathname.startsWith("/console") ? identity.identity.role === "admin" ? (
          <Suspense fallback={<PageLoadingFallback />}><AdminConsolePage identity={identity.identity} onOpenProduct={() => navigate("/app")} onLogout={logout} /></Suspense>
        ) : <main className="console-denied"><h1>当前账号没有控制台权限</h1><button onClick={() => navigate("/app")}>进入产品工作区</button></main> : (
          <AccountWorkspace key={identity.identity.userId} identity={identity.identity} onOpenIdentity={identity.openDialog} onOpenConsole={() => navigate("/console")} onRegisterFlush={flush => { workspaceFlushRef.current = flush; }} />
        )
      ) : null}
      <IdentityDialog
        open={identity.dialogOpen || !identity.identity.authenticated}
        required={!identity.identity.authenticated}
        loading={identity.loading}
        identity={identity.identity}
        onClose={identity.closeDialog}
        onRegister={identity.register}
        onLogin={identity.login}
        onRecover={identity.recover}
        onLoginDemo={identity.loginDemo}
        onLogout={logout}
      />
    </>
  );
}

export default App;
