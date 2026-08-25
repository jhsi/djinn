import type { Scenario } from "../simulation/types";
import { pingPong } from "./pingPong";
import { replication } from "./replication";
import { heartbeat } from "./heartbeat";
import { election } from "./election";
import { gossip } from "./gossip";
import { quorum } from "./quorum";
import { raftScenario } from "./raft";
import { manual } from "./manual";

export const SCENARIOS: Scenario[] = [
  pingPong,
  replication,
  heartbeat,
  election,
  gossip,
  quorum,
  raftScenario,
  manual,
];

export function getScenario(id: string): Scenario {
  return SCENARIOS.find((s) => s.id === id) ?? pingPong;
}
