import type { Node, Scenario, ScenarioContext } from "../simulation/types";
import { clusterIds, electionTimeoutFor, majorityOf, makeNodes, nodeIds } from "./helpers";

const HEARTBEAT = 400;

type Role = "FOLLOWER" | "CANDIDATE" | "LEADER";

type LogEntry = {
  term: number;
  command: string;
};

type RaftState = {
  role: Role;
  term: number;
  votedFor: string | null;
  log: LogEntry[];
  commitIndex: number;
  lastApplied: number;
  leader: string | null;
  votes: string[];
  nextIndex: Record<string, number>;
  matchIndex: Record<string, number>;
  kv: Record<string, unknown>;
  nextCommand: number;
};

function raft(node: Node): RaftState {
  return node.state as unknown as RaftState;
}

function lastIndex(log: LogEntry[]): number {
  return log.length - 1;
}

function lastTerm(log: LogEntry[]): number {
  return log.length === 0 ? 0 : log[log.length - 1].term;
}

function cloneState(s: RaftState): RaftState {
  return {
    ...s,
    log: s.log.map((e) => ({ ...e })),
    votes: [...s.votes],
    nextIndex: { ...s.nextIndex },
    matchIndex: { ...s.matchIndex },
    kv: { ...s.kv },
  };
}

function write(ctx: ScenarioContext, nodeId: string, mut: (s: RaftState) => void) {
  ctx.updateNodeState(nodeId, (raw) => {
    const next = cloneState(raw as unknown as RaftState);
    mut(next);
    return next as unknown as Record<string, unknown>;
  });
}

function applyCommitted(s: RaftState) {
  while (s.lastApplied < s.commitIndex) {
    s.lastApplied += 1;
    const entry = s.log[s.lastApplied];
    const match = /^SET\s+(\w+)\s*=\s*(.+)$/i.exec(entry.command);
    if (match) {
      const num = Number(match[2]);
      s.kv[match[1]] = Number.isNaN(num) ? match[2] : num;
    }
  }
}

function resetElection(ctx: ScenarioContext, nodeId: string) {
  ctx.cancelTimers(nodeId, "election");
  ctx.setTimer(nodeId, electionTimeoutFor(nodeId), "election");
}

function stepDown(ctx: ScenarioContext, nodeId: string, term: number) {
  write(ctx, nodeId, (s) => {
    const higher = term > s.term;
    s.term = Math.max(s.term, term);
    s.role = "FOLLOWER";
    if (higher) {
      s.votedFor = null;
      s.votes = [];
      s.leader = null;
    }
  });
  ctx.cancelTimers(nodeId, "heartbeat");
  resetElection(ctx, nodeId);
}

function becomeLeader(ctx: ScenarioContext, nodeId: string) {
  write(ctx, nodeId, (s) => {
    s.role = "LEADER";
    s.leader = nodeId;
    s.votes = [];
    const next = s.log.length;
    for (const id of nodeIds(ctx)) {
      s.nextIndex[id] = next;
      s.matchIndex[id] = id === nodeId ? lastIndex(s.log) : -1;
    }
  });
  ctx.cancelTimers(nodeId, "election");
  ctx.cancelTimers(nodeId, "heartbeat");
  ctx.log(`${nodeId} became LEADER for term ${raft(ctx.getNode(nodeId)).term}`, {
    kind: "state",
    nodeId,
  });
  replicateAll(ctx, nodeId);
  ctx.setTimer(nodeId, HEARTBEAT, "heartbeat");
}

function replicateAll(ctx: ScenarioContext, leaderId: string) {
  for (const to of nodeIds(ctx)) {
    if (to !== leaderId) sendAppendEntries(ctx, leaderId, to);
  }
}

function sendAppendEntries(ctx: ScenarioContext, from: string, to: string) {
  const s = raft(ctx.getNode(from));
  const nextIndex = s.nextIndex[to] ?? 0;
  const prevLogIndex = nextIndex - 1;
  const prevLogTerm = prevLogIndex >= 0 ? s.log[prevLogIndex].term : 0;
  ctx.sendMessage(
    from,
    to,
    {
      type: "AppendEntries",
      term: s.term,
      leaderId: from,
      prevLogIndex,
      prevLogTerm,
      entries: s.log.slice(nextIndex),
      leaderCommit: s.commitIndex,
    },
  );
}

function tryCommit(ctx: ScenarioContext, leaderId: string) {
  write(ctx, leaderId, (s) => {
    for (let n = lastIndex(s.log); n > s.commitIndex; n -= 1) {
      if (s.log[n].term !== s.term) continue;
      let count = 0;
      for (const id of nodeIds(ctx)) {
        if ((s.matchIndex[id] ?? -1) >= n) count += 1;
      }
      if (count >= majorityOf(nodeIds(ctx).length)) {
        s.commitIndex = n;
        applyCommitted(s);
        ctx.log(`${leaderId} committed index ${n} (${s.log[n].command})`, {
          kind: "state",
          nodeId: leaderId,
        });
        break;
      }
    }
  });
}

function logUpToDate(
  reqLastTerm: number,
  reqLastIndex: number,
  log: LogEntry[],
): boolean {
  const myTerm = lastTerm(log);
  const myIndex = lastIndex(log);
  if (reqLastTerm !== myTerm) return reqLastTerm > myTerm;
  return reqLastIndex >= myIndex;
}

export const raftScenario: Scenario = {
  id: "raft",
  name: "Raft",
  layout: "triangle",
  description:
    "Educational Raft: elections, heartbeats, and majority log replication. Pause, delay a vote, drop a heartbeat, partition the leader.",
  actions: [{ id: "client-command", label: "Client SET x += 1" }],
  configurableNodeCount: true,
  defaultNodeCount: 3,
  createInitialState: (nodeCount = 3) => ({
    nodes: makeNodes(clusterIds(nodeCount), () => ({
      role: "FOLLOWER",
      term: 0,
      votedFor: null,
      log: [] as LogEntry[],
      commitIndex: -1,
      lastApplied: -1,
      leader: null,
      votes: [] as string[],
      nextIndex: {},
      matchIndex: {},
      kv: {},
      nextCommand: 1,
    })),
  }),
  onStart(ctx) {
    for (const id of nodeIds(ctx)) resetElection(ctx, id);
  },
  onAction(actionId, ctx) {
    if (actionId !== "client-command") return;
    const leader = ctx.getNodes().find((n) => raft(n).role === "LEADER" && n.status === "running");
    if (!leader) {
      ctx.log("client request failed: no leader");
      return;
    }
    ctx.sendMessage("client", leader.id, { type: "ClientCommand", command: "SET x+=1" });
  },
  onMessage(nodeId, message, ctx) {
    const p = message.payload as Record<string, unknown>;
    const incomingTerm = Number(p.term ?? 0);
    const local = raft(ctx.getNode(nodeId));

    if (incomingTerm > local.term) {
      stepDown(ctx, nodeId, incomingTerm);
    }

    if (p.type === "ClientCommand") {
      applyClientCommand(nodeId, ctx);
      return;
    }
    if (p.type === "RequestVote") {
      handleRequestVote(nodeId, message.from, p, ctx);
      return;
    }
    if (p.type === "VoteResponse") {
      handleVoteResponse(nodeId, message.from, p, ctx);
      return;
    }
    if (p.type === "AppendEntries") {
      handleAppendEntries(nodeId, message.from, p, ctx);
      return;
    }
    if (p.type === "AppendEntriesResponse") {
      handleAppendEntriesResponse(nodeId, message.from, p, ctx);
    }
  },
  onTimer(nodeId, timer, ctx) {
    if (!ctx.isRunning(nodeId)) return;
    const s = raft(ctx.getNode(nodeId));
    if (timer.name === "election" && s.role !== "LEADER") {
      startElection(ctx, nodeId);
    }
    if (timer.name === "heartbeat" && s.role === "LEADER") {
      replicateAll(ctx, nodeId);
      ctx.setTimer(nodeId, HEARTBEAT, "heartbeat");
    }
  },
  onRestart(nodeId, ctx) {
    write(ctx, nodeId, (s) => {
      s.role = "FOLLOWER";
      s.leader = null;
    });
    resetElection(ctx, nodeId);
  },
  summarizeNode(node) {
    const s = raft(node);
    const lines = [
      `${s.role}  term ${s.term}`,
      `votedFor: ${s.votedFor ?? "—"}`,
      `leader: ${s.leader ?? "—"}`,
      `commitIndex: ${s.commitIndex}`,
    ];
    if (Object.keys(s.kv).length > 0) {
      lines.push(
        `kv: ${Object.entries(s.kv)
          .map(([k, v]) => `${k}=${String(v)}`)
          .join(" ")}`,
      );
    }
    if (s.log.length === 0) lines.push("log: []");
    else {
      lines.push("log");
      for (const entry of s.log) {
        lines.push(`[${entry.term} ${entry.command}]`);
      }
    }
    return lines;
  },
  glanceNode(node) {
    const s = raft(node);
    if (s.role === "LEADER") {
      const commit = s.commitIndex < 0 ? "—" : String(s.commitIndex);
      const x = s.kv.x != null ? ` · x ${String(s.kv.x)}` : "";
      return ["LEADER", `Term ${s.term} · Commit ${commit}${x}`];
    }
    if (s.role === "CANDIDATE") {
      return ["CANDIDATE", `Term ${s.term} · votes ${s.votes.length}`];
    }
    return ["FOLLOWER", `Term ${s.term} · Leader ${s.leader ?? "—"}`];
  },
  presentNode(node) {
    const s = raft(node);
    const last = s.log.length > 0 ? s.log[s.log.length - 1] : null;
    const badges = last ? [{ label: last.command }] : undefined;
    if (s.role === "LEADER") {
      const commit = s.commitIndex < 0 ? "—" : String(s.commitIndex);
      const x = s.kv.x != null ? ` · x ${String(s.kv.x)}` : "";
      return { role: "LEADER", primary: `Term ${s.term} · Commit ${commit}${x}`, badges };
    }
    if (s.role === "CANDIDATE") {
      return { role: "CANDIDATE", primary: `Term ${s.term} · votes ${s.votes.length}` };
    }
    return {
      role: "FOLLOWER",
      primary: `Term ${s.term} · Leader ${s.leader ?? "—"}`,
      badges,
    };
  },
};

function applyClientCommand(nodeId: string, ctx: ScenarioContext) {
  const local = raft(ctx.getNode(nodeId));
  if (local.role !== "LEADER") {
    ctx.log(`client request ignored: ${nodeId} is not leader`, { nodeId });
    return;
  }
  let command = "";
  write(ctx, nodeId, (s) => {
    command = `SET x=${s.nextCommand}`;
    s.nextCommand += 1;
    s.log.push({ term: s.term, command });
    s.matchIndex[nodeId] = lastIndex(s.log);
  });
  ctx.log(`appended ${command}`, { kind: "state", nodeId });
  replicateAll(ctx, nodeId);
}

function startElection(ctx: ScenarioContext, nodeId: string) {
  write(ctx, nodeId, (s) => {
    s.term += 1;
    s.role = "CANDIDATE";
    s.votedFor = nodeId;
    s.leader = null;
    s.votes = [nodeId];
  });
  const s = raft(ctx.getNode(nodeId));
  ctx.log(`${nodeId} → CANDIDATE term ${s.term}`, { kind: "state", nodeId });
  resetElection(ctx, nodeId);
  ctx.cancelTimers(nodeId, "heartbeat");
  for (const to of nodeIds(ctx)) {
    if (to === nodeId) continue;
    ctx.sendMessage(
      nodeId,
      to,
      {
        type: "RequestVote",
        term: s.term,
        candidateId: nodeId,
        lastLogIndex: lastIndex(s.log),
        lastLogTerm: lastTerm(s.log),
      },
    );
  }
  if (s.votes.length >= majorityOf(nodeIds(ctx).length)) becomeLeader(ctx, nodeId);
}

function handleRequestVote(
  nodeId: string,
  from: string,
  p: Record<string, unknown>,
  ctx: ScenarioContext,
) {
  const reqTerm = Number(p.term);
  const lastLogIndex = Number(p.lastLogIndex);
  const lastLogTerm = Number(p.lastLogTerm);
  const s = raft(ctx.getNode(nodeId));
  let granted = false;

  if (reqTerm < s.term) {
    granted = false;
  } else {
    const eligible = s.votedFor == null || s.votedFor === from;
    granted = eligible && logUpToDate(lastLogTerm, lastLogIndex, s.log);
    if (granted) {
      write(ctx, nodeId, (st) => {
        st.votedFor = from;
        st.role = "FOLLOWER";
      });
      resetElection(ctx, nodeId);
    }
  }

  const term = raft(ctx.getNode(nodeId)).term;
  ctx.sendMessage(
    nodeId,
    from,
    { type: "VoteResponse", term, granted },
  );
}

function handleVoteResponse(
  nodeId: string,
  from: string,
  p: Record<string, unknown>,
  ctx: ScenarioContext,
) {
  const s = raft(ctx.getNode(nodeId));
  if (s.role !== "CANDIDATE") return;
  if (Number(p.term) !== s.term) return;
  if (!p.granted) return;
  write(ctx, nodeId, (st) => {
    if (!st.votes.includes(from)) st.votes.push(from);
  });
  if (raft(ctx.getNode(nodeId)).votes.length >= majorityOf(nodeIds(ctx).length)) {
    becomeLeader(ctx, nodeId);
  }
}

function handleAppendEntries(
  nodeId: string,
  from: string,
  p: Record<string, unknown>,
  ctx: ScenarioContext,
) {
  const reqTerm = Number(p.term);
  const s = raft(ctx.getNode(nodeId));
  if (reqTerm < s.term) {
    ctx.sendMessage(
      nodeId,
      from,
      { type: "AppendEntriesResponse", term: s.term, success: false, matchIndex: -1 },
    );
    return;
  }

  write(ctx, nodeId, (st) => {
    st.role = "FOLLOWER";
    st.leader = String(p.leaderId ?? from);
    st.term = reqTerm;
  });
  ctx.cancelTimers(nodeId, "heartbeat");
  resetElection(ctx, nodeId);

  const prevLogIndex = Number(p.prevLogIndex);
  const prevLogTerm = Number(p.prevLogTerm);
  const entries = (p.entries as LogEntry[]) ?? [];
  const leaderCommit = Number(p.leaderCommit);

  const cur = raft(ctx.getNode(nodeId));
  if (prevLogIndex >= 0) {
    const prev = cur.log[prevLogIndex];
    if (!prev || prev.term !== prevLogTerm) {
      ctx.sendMessage(
        nodeId,
        from,
        {
          type: "AppendEntriesResponse",
          term: cur.term,
          success: false,
          matchIndex: -1,
        },
      );
      return;
    }
  }

  write(ctx, nodeId, (st) => {
    let idx = prevLogIndex + 1;
    for (const entry of entries) {
      const existing = st.log[idx];
      if (existing && existing.term !== entry.term) {
        st.log = st.log.slice(0, idx);
      }
      if (!st.log[idx]) st.log.push({ term: entry.term, command: entry.command });
      idx += 1;
    }
    if (leaderCommit > st.commitIndex) {
      st.commitIndex = Math.min(leaderCommit, lastIndex(st.log));
      applyCommitted(st);
    }
  });

  const after = raft(ctx.getNode(nodeId));
  ctx.sendMessage(
    nodeId,
    from,
    {
      type: "AppendEntriesResponse",
      term: after.term,
      success: true,
      matchIndex: prevLogIndex + entries.length,
    },
  );
}

function handleAppendEntriesResponse(
  nodeId: string,
  from: string,
  p: Record<string, unknown>,
  ctx: ScenarioContext,
) {
  const s = raft(ctx.getNode(nodeId));
  if (s.role !== "LEADER") return;
  if (Number(p.term) > s.term) {
    stepDown(ctx, nodeId, Number(p.term));
    return;
  }
  if (Number(p.term) !== s.term) return;

  if (p.success) {
    write(ctx, nodeId, (st) => {
      const match = Number(p.matchIndex);
      st.matchIndex[from] = Math.max(st.matchIndex[from] ?? -1, match);
      st.nextIndex[from] = (st.matchIndex[from] ?? -1) + 1;
    });
    tryCommit(ctx, nodeId);
  } else {
    write(ctx, nodeId, (st) => {
      st.nextIndex[from] = Math.max(0, (st.nextIndex[from] ?? 1) - 1);
    });
    sendAppendEntries(ctx, nodeId, from);
  }
}
