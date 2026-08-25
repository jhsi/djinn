import type { Scenario, ScenarioContext } from "../simulation/types";
import { clusterIds, makeNodes, nodeIds } from "./helpers";

const HEARTBEAT_EVERY = 800;
const ELECTION_TIMEOUT = 2500;
const WAIT_FOR_OK = 700;
const LATENCY = 150;

function rankOf(id: string): number {
  return id.charCodeAt(0) - 64;
}

export const election: Scenario = {
  id: "election",
  name: "Leader Election",
  layout: "triangle",
  configurableNodeCount: true,
  defaultNodeCount: 3,
  description:
    "A simplified bully election. Highest live ID should become leader — but only through messages, never by global knowledge.",
  createInitialState: (nodeCount = 3) => {
    const ids = clusterIds(nodeCount);
    const leader = ids[ids.length - 1];
    return {
      nodes: makeNodes(ids, (id) => ({
        rank: rankOf(id),
        role: id === leader ? "LEADER" : "FOLLOWER",
        leader,
        lastHeartbeat: 0,
      })),
    };
  },
  onStart(ctx) {
    const ids = nodeIds(ctx);
    const leader = ids[ids.length - 1];
    becomeLeader(leader, ctx, false);
    for (const id of ids) {
      if (id !== leader) ctx.setTimer(id, ELECTION_TIMEOUT, "election-timeout");
    }
  },
  onMessage(nodeId, message, ctx) {
    const payload = message.payload as { type: string; leader?: string };
    if (!ctx.isRunning(nodeId)) return;

    if (payload.type === "HEARTBEAT") {
      ctx.updateNodeState(nodeId, {
        role: "FOLLOWER",
        leader: message.from,
        lastHeartbeat: ctx.now(),
      });
      ctx.cancelTimers(nodeId, "election-timeout");
      ctx.cancelTimers(nodeId, "wait-ok");
      ctx.setTimer(nodeId, ELECTION_TIMEOUT, "election-timeout");
      return;
    }

    if (payload.type === "ELECTION") {
      const myRank = rankOf(nodeId);
      const theirRank = rankOf(message.from);
      if (myRank > theirRank) {
        ctx.sendMessage(nodeId, message.from, { type: "OK" }, LATENCY);
        startElection(nodeId, ctx);
      }
      return;
    }

    if (payload.type === "OK") {
      ctx.updateNodeState(nodeId, { role: "FOLLOWER" });
      ctx.cancelTimers(nodeId, "wait-ok");
      ctx.cancelTimers(nodeId, "election-timeout");
      ctx.setTimer(nodeId, ELECTION_TIMEOUT, "await-coordinator");
      return;
    }

    if (payload.type === "COORDINATOR") {
      ctx.updateNodeState(nodeId, {
        role: "FOLLOWER",
        leader: payload.leader ?? message.from,
        lastHeartbeat: ctx.now(),
      });
      ctx.cancelTimers(nodeId, "election-timeout");
      ctx.cancelTimers(nodeId, "wait-ok");
      ctx.cancelTimers(nodeId, "await-coordinator");
      ctx.setTimer(nodeId, ELECTION_TIMEOUT, "election-timeout");
    }
  },
  onTimer(nodeId, timer, ctx) {
    if (!ctx.isRunning(nodeId)) return;
    if (timer.name === "heartbeat" && ctx.getNode(nodeId).state.role === "LEADER") {
      for (const to of nodeIds(ctx)) {
        if (to !== nodeId) ctx.sendMessage(nodeId, to, { type: "HEARTBEAT" }, LATENCY);
      }
      ctx.setTimer(nodeId, HEARTBEAT_EVERY, "heartbeat");
    }
    if (timer.name === "election-timeout" || timer.name === "await-coordinator") {
      ctx.log(`${nodeId} timed out waiting for leader`);
      startElection(nodeId, ctx);
    }
    if (timer.name === "wait-ok") {
      becomeLeader(nodeId, ctx, true);
    }
  },
  onCrash(nodeId, ctx) {
    if (ctx.getNode(nodeId).state.role === "LEADER") {
      ctx.log(`leader ${nodeId} is gone`);
    }
  },
  onRestart(nodeId, ctx) {
    startElection(nodeId, ctx);
  },
  summarizeNode(node) {
    return [
      `role: ${String(node.state.role)}`,
      `leader: ${node.state.leader == null ? "—" : String(node.state.leader)}`,
      `rank: ${String(node.state.rank)}`,
    ];
  },
};

function higherIds(id: string, ctx: ScenarioContext): string[] {
  const rank = rankOf(id);
  return nodeIds(ctx).filter((other) => rankOf(other) > rank);
}

function startElection(nodeId: string, ctx: ScenarioContext) {
  if (!ctx.isRunning(nodeId)) return;
  const higher = higherIds(nodeId, ctx);
  ctx.updateNodeState(nodeId, {
    role: "CANDIDATE",
    leader: null,
  });
  ctx.cancelTimers(nodeId, "election-timeout");
  ctx.cancelTimers(nodeId, "wait-ok");
  ctx.cancelTimers(nodeId, "await-coordinator");
  ctx.cancelTimers(nodeId, "heartbeat");

  if (higher.length === 0) {
    becomeLeader(nodeId, ctx, true);
    return;
  }

  ctx.log(`${nodeId} starts election`);
  for (const to of higher) {
    ctx.sendMessage(nodeId, to, { type: "ELECTION" }, LATENCY);
  }
  ctx.setTimer(nodeId, WAIT_FOR_OK, "wait-ok");
}

function becomeLeader(nodeId: string, ctx: ScenarioContext, announce: boolean) {
  if (!ctx.isRunning(nodeId)) return;
  ctx.updateNodeState(nodeId, { role: "LEADER", leader: nodeId });
  ctx.cancelTimers(nodeId, "election-timeout");
  ctx.cancelTimers(nodeId, "wait-ok");
  ctx.cancelTimers(nodeId, "await-coordinator");
  ctx.cancelTimers(nodeId, "heartbeat");
  if (announce) {
    ctx.log(`${nodeId} announces itself leader`);
    for (const to of nodeIds(ctx)) {
      if (to !== nodeId) {
        ctx.sendMessage(nodeId, to, { type: "COORDINATOR", leader: nodeId }, LATENCY);
      }
    }
  }
  for (const to of nodeIds(ctx)) {
    if (to !== nodeId) ctx.sendMessage(nodeId, to, { type: "HEARTBEAT" }, LATENCY);
  }
  ctx.setTimer(nodeId, HEARTBEAT_EVERY, "heartbeat");
}
