# Djinn

A local-first sandbox for learning about distributed systems. Djinn visualizes deterministic simulations of nodes, messages, time, failures, and algorithms in one browser tab.

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
- **Replication** — send a write message from the client -> stale replicas, no global state
- **Heartbeats** — failure is inferred from silence
- **Leader Election** — bully-style, via messages
- **Gossip** — eventual spread with a seeded PRNG
- **Quorum Write** — send a write message from the client
- **Raft** — elections, heartbeats, majority log replication
