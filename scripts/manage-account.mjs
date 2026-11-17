import { parseArgs } from "node:util";
import { closeAgentMemoryStore } from "../server/agentMemoryCore.js";
import { setAccountRole } from "../server/operationsCore.js";

const { values } = parseArgs({ options: { nickname: { type: "string" }, role: { type: "string" } } });
if (!values.nickname || !values.role) throw new Error("用法：node scripts/manage-account.mjs --nickname <昵称> --role admin|user");
try {
  setAccountRole(values.nickname, values.role);
  console.info(`[account] ${values.nickname} 的角色已设置为 ${values.role}。`);
} finally {
  closeAgentMemoryStore();
}
