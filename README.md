# Druid

A local-first sandbox for learning and debugging distributed systems. Druid visualizes deterministic simulations of nodes, messages, time, failures, and algorithms — all in one browser tab.

Distributed systems are difficult because behavior emerges from the ordering and timing of events. Druid makes that execution inspectable, controllable, reproducible, and perturbable.

## Run

```bash
npm install
npm run dev
```

```bash
npm test
npm run build
```

## How to use it

1. Pick a scenario.
2. Press **Step** to execute exactly one event, or **Play** to watch simulated time pass.
3. Click a node, in-flight message, or link to inspect it.
4. Delay or drop messages, partition links, crash and restart nodes.
5. **Reset** replays the same scenario from the same seed. Without perturbations, the event history is identical.

Playback speed only changes how fast you watch simulated time. A 500ms message still takes 500ms of simulation time at 4× — you just watch it sooner.

## Scenarios

- **Ping / Pong** — learn the UI
- **Replication** — stale replicas, no global state
- **Heartbeats** — failure is inferred from silence
- **Leader Election** — bully-style, via messages
- **Gossip** — eventual spread with a seeded PRNG
- **Quorum Write** — N=3, W=2
- **Raft** — elections, heartbeats, majority log replication
- **Manual** — inject your own messages onto the same queue
