import { EventQueue } from "./EventQueue";
import { edgeKey, parseEdgeKey, payloadLabel } from "./format";
import { createRng } from "./seededRandom";
import type {
  LogEntry,
  LogKind,
  Message,
  Node,
  PlaybackSpeed,
  Scenario,
  ScenarioContext,
  SimStatus,
  SimulationEvent,
  Snapshot,
  TimerEvent,
  TimerInfo,
} from "./types";

export class Simulation {
  readonly scenario: Scenario;
  private nodes: Node[] = [];
  private messages = new Map<string, Message>();
  private partitions = new Set<string>();
  private queue = new EventQueue();
  private logEntries: LogEntry[] = [];
  private timers = new Map<string, TimerInfo>();
  private rng: () => number = createRng(1);
  private msgCounter = 0;
  private timerCounter = 0;
  private logSeq = 0;
  private listeners = new Set<() => void>();
  private cached: Snapshot | null = null;

  currentTime = 0;
  status: SimStatus = "paused";
  speed: PlaybackSpeed = 1;

  constructor(scenario: Scenario) {
    this.scenario = scenario;
    this.bootstrap();
    this.cached = this.buildSnapshot();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.cached = this.buildSnapshot();
    for (const listener of this.listeners) listener();
  }

  private bootstrap(): void {
    const initial = this.scenario.createInitialState();
    this.nodes = initial.nodes.map((n) => ({
      id: n.id,
      status: n.status,
      state: { ...n.state },
    }));
    this.rng = createRng(initial.seed ?? 1);
    this.scenario.onStart(this.ctx);
  }

  reset(): void {
    this.currentTime = 0;
    this.status = "paused";
    this.messages.clear();
    this.partitions.clear();
    this.queue.clear();
    this.logEntries = [];
    this.timers.clear();
    this.msgCounter = 0;
    this.timerCounter = 0;
    this.logSeq = 0;
    this.bootstrap();
    this.notify();
  }

  play(): void {
    this.status = "playing";
    this.notify();
  }

  pause(): void {
    this.status = "paused";
    this.notify();
  }

  setSpeed(speed: PlaybackSpeed): void {
    this.speed = speed;
    this.notify();
  }

  step(): SimulationEvent | null {
    const event = this.queue.pop();
    if (!event) return null;
    this.currentTime = event.timestamp;
    this.dispatch(event);
    this.notify();
    return event;
  }

  advanceBy(ms: number, maxEvents = Infinity): void {
    if (this.status !== "playing") return;
    const target = this.currentTime + ms;
    let processed = 0;
    while (processed < maxEvents) {
      const next = this.queue.peek();
      if (!next || next.timestamp > target) break;
      const event = this.queue.pop();
      if (!event) break;
      this.currentTime = event.timestamp;
      this.dispatch(event);
      processed += 1;
    }
    if (target > this.currentTime) this.currentTime = target;
    this.notify();
  }

  dropMessage(messageId: string): boolean {
    const message = this.messages.get(messageId);
    if (!message) return false;
    this.messages.delete(messageId);
    this.queue.remove((e) => e.type === "deliver" && e.messageId === messageId);
    this.pushLog(
      "drop",
      `dropped ${message.from} → ${message.to} ${payloadLabel(message.payload)}`,
      { messageId, reason: "user" },
    );
    this.notify();
    return true;
  }

  delayMessage(messageId: string, newTimestamp: number): boolean {
    const message = this.messages.get(messageId);
    if (!message) return false;
    const deliverAt = Math.max(newTimestamp, this.currentTime);
    const previous = message.deliverAt;
    message.deliverAt = deliverAt;
    this.queue.remove((e) => e.type === "deliver" && e.messageId === messageId);
    this.queue.schedule({
      type: "deliver",
      id: `deliver-${messageId}`,
      timestamp: deliverAt,
      messageId,
    });
    this.pushLog(
      "delay",
      `delayed ${message.from} → ${message.to} ${previous}ms → ${deliverAt}ms`,
      { messageId, previous, deliverAt },
    );
    this.notify();
    return true;
  }

  partition(a: string, b: string): void {
    const key = edgeKey(a, b);
    if (this.partitions.has(key)) return;
    this.partitions.add(key);
    const inFlight = [...this.messages.values()].filter(
      (m) => edgeKey(m.from, m.to) === key,
    );
    for (const message of inFlight) {
      this.messages.delete(message.id);
      this.queue.remove((e) => e.type === "deliver" && e.messageId === message.id);
      this.pushLog(
        "drop",
        `dropped ${message.from} → ${message.to} ${payloadLabel(message.payload)} (partition)`,
        { messageId: message.id, reason: "partition" },
      );
    }
    this.pushLog("partition", `partition ${a} ↔ ${b}`);
    this.notify();
  }

  healPartition(a: string, b: string): void {
    const key = edgeKey(a, b);
    if (!this.partitions.has(key)) return;
    this.partitions.delete(key);
    this.pushLog("heal", `heal ${a} ↔ ${b}`);
    this.notify();
  }

  crashNode(nodeId: string): void {
    const node = this.requireNode(nodeId);
    if (node.status === "stopped") return;
    node.status = "stopped";
    this.cancelTimers(nodeId);
    this.pushLog("crash", `${nodeId} crashed`);
    this.scenario.onCrash?.(nodeId, this.ctx);
    this.notify();
  }

  restartNode(nodeId: string): void {
    const node = this.requireNode(nodeId);
    if (node.status === "running") return;
    node.status = "running";
    this.pushLog("restart", `${nodeId} restarted`);
    this.scenario.onRestart?.(nodeId, this.ctx);
    this.notify();
  }

  invokeAction(actionId: string): void {
    this.scenario.onAction?.(actionId, this.ctx);
    this.notify();
  }

  injectMessage(
    from: string,
    to: string,
    payload: unknown,
    latency: number,
  ): string | null {
    const id = this.ctx.sendMessage(from, to, payload, latency);
    this.notify();
    return id;
  }

  snapshot(): Snapshot {
    return this.cached ?? (this.cached = this.buildSnapshot());
  }

  private buildSnapshot(): Snapshot {
    const pending = this.queue.toArray();
    return {
      currentTime: this.currentTime,
      status: this.status,
      speed: this.speed,
      nodes: this.nodes.map((n) => ({
        id: n.id,
        status: n.status,
        state: structuredClone(n.state),
      })),
      inFlight: [...this.messages.values()].map((m) => ({ ...m })),
      pendingEvents: pending.map((e) => ({ ...e })),
      eventLog: this.logEntries.map((e) => ({ ...e })),
      partitions: [...this.partitions].map(parseEdgeKey),
      nextEvent: pending[0] ? { ...pending[0] } : null,
      pendingCount: pending.length,
      timers: [...this.timers.values()].map((t) => ({ ...t })),
    };
  }

  getMessage(messageId: string): Message | undefined {
    const m = this.messages.get(messageId);
    return m ? { ...m } : undefined;
  }

  private dispatch(event: SimulationEvent): void {
    if (event.type === "deliver") {
      this.deliver(event.messageId);
      return;
    }
    this.fireTimer(event);
  }

  private deliver(messageId: string): void {
    const message = this.messages.get(messageId);
    if (!message) return;
    this.messages.delete(messageId);

    if (this.isPartitioned(message.from, message.to)) {
      this.pushLog(
        "drop",
        `dropped ${message.from} → ${message.to} ${payloadLabel(message.payload)} (partition)`,
        { messageId, reason: "partition" },
      );
      return;
    }

    const dest = this.requireNode(message.to);
    if (dest.status === "stopped") {
      this.pushLog(
        "drop",
        `dropped ${message.from} → ${message.to} ${payloadLabel(message.payload)} (node ${message.to} stopped)`,
        { messageId, reason: "node-stopped" },
      );
      return;
    }

    this.pushLog(
      "deliver",
      `${message.to} receives ${payloadLabel(message.payload)} from ${message.from}`,
      { messageId, payload: message.payload },
    );
    this.scenario.onMessage(message.to, message, this.ctx);
  }

  private fireTimer(event: TimerEvent): void {
    this.timers.delete(event.id);
    const node = this.requireNode(event.nodeId);
    if (node.status === "stopped") return;
    this.scenario.onTimer?.(event.nodeId, event, this.ctx);
  }

  private isPartitioned(a: string, b: string): boolean {
    return this.partitions.has(edgeKey(a, b));
  }

  private requireNode(id: string): Node {
    const node = this.nodes.find((n) => n.id === id);
    if (!node) throw new Error(`Unknown node ${id}`);
    return node;
  }

  private cancelTimers(nodeId: string, name?: string): void {
    this.queue.remove((e) => {
      if (e.type !== "timer") return false;
      if (e.nodeId !== nodeId) return false;
      if (name && e.name !== name) return false;
      this.timers.delete(e.id);
      return true;
    });
  }

  private pushLog(
    kind: LogKind,
    text: string,
    meta?: Record<string, unknown>,
  ): void {
    this.logEntries.push({
      seq: this.logSeq++,
      timestamp: this.currentTime,
      kind,
      text,
      meta,
    });
  }

  private readonly ctx: ScenarioContext = {
    now: () => this.currentTime,
    sendMessage: (from, to, payload, latency) => {
      const id = `m${++this.msgCounter}`;
      const deliverAt = this.currentTime + Math.max(0, latency);
      const message: Message = {
        id,
        from,
        to,
        payload,
        sentAt: this.currentTime,
        deliverAt,
      };
      this.pushLog(
        "send",
        `${from} sends ${payloadLabel(payload)} → ${to}`,
        { messageId: id, payload, deliverAt },
      );
      if (this.isPartitioned(from, to)) {
        this.pushLog(
          "drop",
          `dropped ${from} → ${to} ${payloadLabel(payload)} (partition)`,
          { messageId: id, reason: "partition" },
        );
        return null;
      }
      this.messages.set(id, message);
      this.queue.schedule({
        type: "deliver",
        id: `deliver-${id}`,
        timestamp: deliverAt,
        messageId: id,
      });
      return id;
    },
    setTimer: (nodeId, delay, name, data) => {
      const id = `t${++this.timerCounter}`;
      const fireAt = this.currentTime + Math.max(0, delay);
      this.timers.set(id, { id, nodeId, name, fireAt, data });
      this.queue.schedule({
        type: "timer",
        id,
        timestamp: fireAt,
        nodeId,
        name,
        data,
      });
      return id;
    },
    cancelTimers: (nodeId, name) => {
      this.cancelTimers(nodeId, name);
    },
    updateNodeState: (nodeId, updater) => {
      const node = this.requireNode(nodeId);
      node.state =
        typeof updater === "function"
          ? updater(node.state)
          : { ...node.state, ...updater };
    },
    log: (text, meta) => {
      this.pushLog("info", text, meta);
    },
    getNode: (nodeId) => {
      const node = this.requireNode(nodeId);
      return {
        id: node.id,
        status: node.status,
        state: node.state,
      };
    },
    getNodes: () => this.nodes.map((n) => ({ ...n, state: n.state })),
    random: () => this.rng(),
    isRunning: (nodeId) => this.requireNode(nodeId).status === "running",
  };
}
