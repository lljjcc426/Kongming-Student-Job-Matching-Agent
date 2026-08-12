import { useState, type CSSProperties } from "react";
import type { AbilityNode, MatchResult } from "../../matchEngine";

type CareerAbilityGraphProps = {
  result: MatchResult;
};

const positions = [
  [50, 7],
  [79, 18],
  [90, 48],
  [79, 80],
  [50, 92],
  [21, 80],
  [10, 48],
  [21, 18],
] as const;

const statusText: Record<AbilityNode["status"], string> = {
  matched: "已证实",
  partial: "部分支撑",
  gap: "待补证",
};

const pickInitialNode = (nodes: AbilityNode[]) =>
  nodes.find((item) => item.importance === "核心" && item.status === "gap")
  ?? nodes.find((item) => item.importance === "核心")
  ?? nodes[0];

export default function CareerAbilityGraph({ result }: CareerAbilityGraphProps) {
  const visibleNodes = result.abilityGraph.nodes.slice(0, positions.length);
  const initialNode = pickInitialNode(result.abilityGraph.nodes);
  const [selectedNodeId, setSelectedNodeId] = useState(initialNode?.id ?? "");
  const selectedNode = result.abilityGraph.nodes.find((item) => item.id === selectedNodeId)
    ?? initialNode;
  const evidenceById = new Map(result.evidence.map((item) => [item.id, item]));

  return (
    <section className="ability-graph-card" aria-labelledby="ability-graph-title">
      <div className="section-head ability-graph-head">
        <div>
          <span>Career Ability Graph</span>
          <h3 id="ability-graph-title">职业能力图谱</h3>
        </div>
        <div className="ability-graph-legend" aria-label="图谱状态图例">
          <span className="matched">已证实 {result.abilityGraph.matchedCount}</span>
          <span className="partial">部分支撑 {result.abilityGraph.partialCount}</span>
          <span className="gap">待补证 {result.abilityGraph.gapCount}</span>
        </div>
      </div>

      <p className="ability-graph-summary">{result.abilityGraph.summary} 点击能力节点可查看岗位要求和简历原文证据。</p>

      <div className="ability-graph-stage" data-testid="career-ability-graph">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {visibleNodes.map((node, index) => {
            const [x, y] = positions[index];
            return <line key={node.id} className={node.status} x1="50" y1="50" x2={x} y2={y} />;
          })}
        </svg>
        <div className="ability-target-node">
          <small>目标岗位</small>
          <strong>{result.abilityGraph.targetNode.name}</strong>
          <span>证据覆盖 {result.abilityGraph.evidenceCoverage}%</span>
        </div>
        {visibleNodes.map((node, index) => {
          const [x, y] = positions[index];
          return (
            <button
              key={node.id}
              type="button"
              className={`ability-node ${node.status} ${selectedNode?.id === node.id ? "active" : ""}`}
              style={{ "--ability-x": `${x}%`, "--ability-y": `${y}%` } as CSSProperties}
              onClick={() => setSelectedNodeId(node.id)}
              aria-pressed={selectedNode?.id === node.id}
              aria-label={`${node.name}，${statusText[node.status]}，证据分 ${node.score}`}
            >
              <small>{node.importance} · {node.category}</small>
              <strong>{node.name}</strong>
              <span>{node.score}/{node.targetScore}</span>
            </button>
          );
        })}
      </div>

      {result.abilityGraph.nodes.length > visibleNodes.length ? (
        <div className="ability-overflow-nodes" aria-label="更多能力节点">
          {result.abilityGraph.nodes.slice(visibleNodes.length).map((node) => (
            <button
              type="button"
              key={node.id}
              className={`${node.status} ${selectedNode?.id === node.id ? "active" : ""}`}
              onClick={() => setSelectedNodeId(node.id)}
            >
              {node.name} · {node.score}
            </button>
          ))}
        </div>
      ) : null}

      {selectedNode ? (
        <article className={`ability-node-detail ${selectedNode.status}`} aria-live="polite">
          <div className="ability-node-detail-head">
            <div>
              <span>{selectedNode.importance}能力 · {selectedNode.category}</span>
              <strong>{selectedNode.name}</strong>
            </div>
            <b>{statusText[selectedNode.status]} · {selectedNode.score}/{selectedNode.targetScore}</b>
          </div>
          <div className="ability-node-detail-grid">
            <p className="ability-node-score-explanation">{selectedNode.explanation} 该节点的岗位目标线为 {selectedNode.targetScore} 分。</p>
            <div>
              <h4>岗位依据</h4>
              <ul>
                {selectedNode.requirementSources.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
            <div>
              <h4>简历证据</h4>
              {selectedNode.evidenceIds.length ? (
                <ul>
                  {selectedNode.evidenceIds.map((id) => evidenceById.get(id)).filter(Boolean).map((item) => (
                    <li key={item!.id}><span>{item!.label}</span>“{item!.text}”</li>
                  ))}
                </ul>
              ) : <p>未找到可引用证据，因此该节点不计匹配分。</p>}
            </div>
          </div>
        </article>
      ) : null}
    </section>
  );
}
