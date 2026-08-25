import { EventQueue } from "./EventQueue";
import { edgeKey, parseEdgeKey, payloadLabel } from "./format";
import { SeededRng } from "./seededRandom";
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
import { DEFAULT_LINK_LATENCY } from "./types";

type Checkpoint = {
  currentTime: number;
  nodes: Node[];
  messages: [string, Message][];
  partitions: string[];
  queueItems: SimulationEvent[];
  queueSeq: number;
  logEntries: LogEntry[];
  timers: [string, TimerInfo][];
  msgCounter: number;
  timerCounter: number;
  logSeq: number;
  rngState: number;
  defaultLatency: number;
  linkLatencies: [string, number][];
  pendingDrops: string[];
};

function cloneNode(node: Node): Node {
  return { id: node.id, status: node.status, state: structuredClone(node.state) };
}

function cloneMessage(message: Message): Message {
  return { ...message, payload: structuredClone(message.payload) };
}

function cloneLog(entry: LogEntry): LogEntry {
  return { ...entry, meta: entry.meta ? structuredClone(entry.meta) : undefined };
}

function cloneEvent(event: SimulationEvent): SimulationEvent {
  return { ...event };
}

function cloneTimer(timer: TimerInfo): TimerInfo {
  return { ...timer, data: structuredClone(timer.data) };
}

function lastLogSeq(entries: LogEntry[]): number {
  return entries.length === 0 ? -1 : entries[entries.length - 1].seq;
}

export class Simulation {
  readonly scenario: Scenario;
  readonly nodeCount: number | undefined;
  private nodes: Node[] = [];
  private messages = new Map<string, Message>();
  private partitions = new Set<string>();
  private queue = new EventQueue();
  private logEntries: LogEntry[] = [];
  private timers = new Map<string, TimerInfo>();
  private rng = new SeededRng(1);
  private msgCounter = 0;
  private timerCounter = 0;
  private logSeq = 0;
  private listeners = new Set<() => void>();
  private cached: Snapshot | null = null;

  private frames: Checkpoint[] = [];
  private cursor = 0;
  private tapeLog: LogEntry[] = [];
  private exploredUntil = 0;
  private defaultLatency = DEFAULT_LINK_LATENCY;
  private linkLatencies = new Map<string, number>();
  private pendingDrops = new Set<string>();

  currentTime = 0;
  status: SimStatus = "paused";
  speed: PlaybackSpeed = "auto";
  private started = false;

  constructor(scenario: Scenario, nodeCount?: number) {
    this.scenario = scenario;
    this.nodeCount = nodeCount;
    this.bootstrap();
    this.frames = [this.capture()];
    this.cursor = 0;
    this.tapeLog = this.logEntries.map(cloneLog);
    this.exploredUntil = this.currentTime;
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
    const initial = this.scenario.createInitialState(this.nodeCount);
    this.nodes = initial.nodes.map((n) => ({
      id: n.id,
      status: n.status,
      state: { ...n.state },
    }));
    this.rng = new SeededRng(initial.seed ?? 1);
    this.defaultLatency = initial.defaultLatency ?? DEFAULT_LINK_LATENCY;
    this.linkLatencies.clear();
    this.pendingDrops.clear();
    const ids = this.nodes.map((n) => n.id);
    for (let i = 0; i < ids.length; i += 1) {
      for (let j = i + 1; j < ids.length; j += 1) {
        this.linkLatencies.set(edgeKey(ids[i], ids[j]), this.defaultLatency);
      }
    }
    for (const [a, b, ms] of initial.linkLatencies ?? []) {
      this.linkLatencies.set(edgeKey(a, b), Math.max(0, ms));
    }
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
    this.defaultLatency = DEFAULT_LINK_LATENCY;
    this.linkLatencies.clear();
    this.pendingDrops.clear();
    this.bootstrap();
    this.frames = [this.capture()];
    this.cursor = 0;
    this.tapeLog = this.logEntries.map(cloneLog);
    this.exploredUntil = this.currentTime;
    this.started = false;
    this.notify();
  }

  play(): void {
    this.started = true;
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
    this.started = true;
    this.status = "paused";
    if (this.cursor < this.frames.length - 1) {
      this.restore(this.cursor + 1);
      this.notify();
      return null;
    }
    const event = this.executeNext();
    this.notify();
    return event;
  }

  advanceBy(ms: number, maxEvents = Infinity): void {
    if (this.status !== "playing") return;
    const target = this.currentTime + ms;
    let processed = 0;

    while (this.cursor < this.frames.length - 1 && processed < maxEvents) {
      const nextFrame = this.frames[this.cursor + 1];
      if (nextFrame.currentTime > target) {
        this.currentTime = target;
        this.notify();
        return;
      }
      this.restore(this.cursor + 1);
      processed += 1;
    }

    while (processed < maxEvents) {
      const next = this.queue.peek();
      if (!next || next.timestamp > target) break;
      this.executeNext();
      processed += 1;
    }

    if (this.queue.peek()) {
      if (processed < maxEvents && target > this.currentTime) {
        this.currentTime = Math.min(target, this.queue.peek()!.timestamp);
        this.exploredUntil = Math.max(this.exploredUntil, this.currentTime);
      }
    } else if (this.atTip()) {
      this.status = "paused";
    }

    this.notify();
  }

  seekToTime(t: number): void {
    this.status = "paused";
    const target = Math.min(Math.max(0, t), this.horizon());
    if (target > 0) this.started = true;

    if (target > this.exploredUntil + 1e-9) {
      this.restore(this.frames.length - 1);
      this.runUntil(target);
      this.notify();
      return;
    }

    let index = 0;
    for (let i = 0; i < this.frames.length; i += 1) {
      if (this.frames[i].currentTime <= target) index = i;
    }
    this.restore(index);
    if (target > this.currentTime) {
      const next = this.frames[index + 1];
      if (!next || next.currentTime > target) this.currentTime = target;
    }
    this.notify();
  }

  seekToLog(seq: number): void {
    this.started = true;
    this.status = "paused";
    const index = this.frames.findIndex((frame) => lastLogSeq(frame.logEntries) >= seq);
    if (index >= 0) {
      this.restore(index);
      this.notify();
      return;
    }
    const entry = this.tapeLog.find((e) => e.seq === seq);
    if (entry) {
      this.seekToTime(entry.timestamp);
      return;
    }
    this.notify();
  }

  seekToPrevEvent(): void {
    this.started = true;
    this.status = "paused";
    const seq = lastLogSeq(this.logEntries);
    const prev = [...this.tapeLog].reverse().find((entry) => entry.seq < seq);
    if (prev) {
      this.seekToLog(prev.seq);
      return;
    }
    this.restore(0);
    this.notify();
  }

  seekToNextEvent(): void {
    this.started = true;
    this.status = "paused";
    const seq = lastLogSeq(this.logEntries);
    const next = this.tapeLog.find((entry) => entry.seq > seq);
    if (next) {
      this.seekToLog(next.seq);
      return;
    }
    this.restore(this.frames.length - 1);
    this.executeNext();
    this.notify();
  }

  dropMessage(messageId: string): boolean {
    const message = this.messages.get(messageId);
    if (!message) return false;
    this.started = true;
    this.branchIfNeeded();
    this.messages.delete(messageId);
    this.queue.remove((e) => e.type === "deliver" && e.messageId === messageId);
    this.pushLog("drop", `dropped ${message.from} → ${message.to} ${payloadLabel(message.payload)}`, {
      messageId,
      from: message.from,
      to: message.to,
      reason: "user",
    });
    this.recordFrame();
    this.notify();
    return true;
  }

  delayMessage(messageId: string, newTimestamp: number): boolean {
    const message = this.messages.get(messageId);
    if (!message) return false;
    this.started = true;
    this.branchIfNeeded();
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
      { messageId, from: message.from, to: message.to, previous, deliverAt },
    );
    this.recordFrame();
    this.notify();
    return true;
  }

  setLinkLatency(a: string, b: string, ms: number): void {
    const key = edgeKey(a, b);
    const next = Math.max(0, Math.round(ms));
    const previous = this.getLinkLatency(a, b);
    if (previous === next && this.linkLatencies.get(key) === next) return;
    this.started = true;
    this.branchIfNeeded();
    this.linkLatencies.set(key, next);
    const scale = previous <= 0 ? 1 : next / previous;
    for (const message of this.messages.values()) {
      if (edgeKey(message.from, message.to) !== key) continue;
      const remaining = Math.max(0, message.deliverAt - this.currentTime);
      const deliverAt = this.currentTime + Math.max(1, Math.round(remaining * scale));
      message.deliverAt = deliverAt;
      this.queue.remove((e) => e.type === "deliver" && e.messageId === message.id);
      this.queue.schedule({
        type: "deliver",
        id: `deliver-${message.id}`,
        timestamp: deliverAt,
        messageId: message.id,
      });
    }
    this.commitPhysics();
    this.notify();
  }

  dropNextOnLink(a: string, b: string): boolean {
    const key = edgeKey(a, b);
    const candidates = [...this.messages.values()]
      .filter((m) => edgeKey(m.from, m.to) === key)
      .sort((x, y) => x.deliverAt - y.deliverAt);
    if (candidates[0]) return this.dropMessage(candidates[0].id);
    this.started = true;
    this.branchIfNeeded();
    this.pendingDrops.add(key);
    this.commitPhysics();
    this.notify();
    return true;
  }

  getLinkLatency(a: string, b: string): number {
    return this.linkLatencies.get(edgeKey(a, b)) ?? this.defaultLatency;
  }

  partition(a: string, b: string): void {
    const key = edgeKey(a, b);
    if (this.partitions.has(key)) return;
    this.started = true;
    this.branchIfNeeded();
    this.partitions.add(key);
    const inFlight = [...this.messages.values()].filter((m) => edgeKey(m.from, m.to) === key);
    for (const message of inFlight) {
      this.messages.delete(message.id);
      this.queue.remove((e) => e.type === "deliver" && e.messageId === message.id);
      this.pushLog(
        "drop",
        `dropped ${message.from} → ${message.to} ${payloadLabel(message.payload)} (partition)`,
        { messageId: message.id, from: message.from, to: message.to, reason: "partition" },
      );
    }
    this.pushLog("partition", `partition ${a} ↔ ${b}`, { a, b });
    this.recordFrame();
    this.notify();
  }

  healPartition(a: string, b: string): void {
    const key = edgeKey(a, b);
    if (!this.partitions.has(key)) return;
    this.started = true;
    this.branchIfNeeded();
    this.partitions.delete(key);
    this.pushLog("heal", `heal ${a} ↔ ${b}`, { a, b });
    this.recordFrame();
    this.notify();
  }

  crashNode(nodeId: string): void {
    const node = this.requireNode(nodeId);
    if (node.status === "stopped") return;
    this.started = true;
    this.branchIfNeeded();
    node.status = "stopped";
    this.cancelTimers(nodeId);
    this.pushLog("crash", `${nodeId} crashed`, { nodeId });
    this.scenario.onCrash?.(nodeId, this.ctx);
    this.recordFrame();
    this.notify();
  }

  restartNode(nodeId: string): void {
    const node = this.requireNode(nodeId);
    if (node.status === "running") return;
    this.started = true;
    this.branchIfNeeded();
    node.status = "running";
    this.pushLog("restart", `${nodeId} restarted`, { nodeId });
    this.scenario.onRestart?.(nodeId, this.ctx);
    this.recordFrame();
    this.notify();
  }

  invokeAction(actionId: string): void {
    this.started = true;
    this.branchIfNeeded();
    this.scenario.onAction?.(actionId, this.ctx);
    this.recordFrame();
    this.notify();
  }

  injectMessage(
    from: string,
    to: string,
    payload: unknown,
    latency?: number,
  ): string | null {
    this.started = true;
    this.branchIfNeeded();
    const id = this.ctx.sendMessage(from, to, payload, latency);
    this.recordFrame();
    this.notify();
    return id;
  }

  snapshot(): Snapshot {
    return this.cached ?? (this.cached = this.buildSnapshot());
  }

  private atTip(): boolean {
    return this.cursor === this.frames.length - 1;
  }

  private horizon(): number {
    const lastTape = this.tapeLog.length === 0 ? 0 : this.tapeLog[this.tapeLog.length - 1].timestamp;
    const pending = this.queue.toArray();
    const lastPending = pending.length === 0 ? 0 : pending[pending.length - 1].timestamp;
    return Math.max(this.exploredUntil, this.currentTime, lastTape, lastPending);
  }

  private capture(): Checkpoint {
    return {
      currentTime: this.currentTime,
      nodes: this.nodes.map(cloneNode),
      messages: [...this.messages.entries()].map(([id, message]) => [id, cloneMessage(message)]),
      partitions: [...this.partitions],
      queueItems: this.queue.toArray().map(cloneEvent),
      queueSeq: this.queue.sequence,
      logEntries: this.logEntries.map(cloneLog),
      timers: [...this.timers.entries()].map(([id, timer]) => [id, cloneTimer(timer)]),
      msgCounter: this.msgCounter,
      timerCounter: this.timerCounter,
      logSeq: this.logSeq,
      rngState: this.rng.getState(),
      defaultLatency: this.defaultLatency,
      linkLatencies: [...this.linkLatencies.entries()],
      pendingDrops: [...this.pendingDrops],
    };
  }

  private restore(index: number): void {
    const frame = this.frames[index];
    this.currentTime = frame.currentTime;
    this.nodes = frame.nodes.map(cloneNode);
    this.messages = new Map(frame.messages.map(([id, message]) => [id, cloneMessage(message)]));
    this.partitions = new Set(frame.partitions);
    this.queue.restore(frame.queueItems.map(cloneEvent), frame.queueSeq);
    this.logEntries = frame.logEntries.map(cloneLog);
    this.timers = new Map(frame.timers.map(([id, timer]) => [id, cloneTimer(timer)]));
    this.msgCounter = frame.msgCounter;
    this.timerCounter = frame.timerCounter;
    this.logSeq = frame.logSeq;
    this.rng.setState(frame.rngState);
    this.defaultLatency = frame.defaultLatency;
    this.linkLatencies = new Map(frame.linkLatencies);
    this.pendingDrops = new Set(frame.pendingDrops);
    this.cursor = index;
  }

  private branchIfNeeded(): void {
    if (this.cursor >= this.frames.length - 1) return;
    this.frames.splice(this.cursor + 1);
    this.tapeLog = this.logEntries.map(cloneLog);
    this.exploredUntil = this.currentTime;
  }

  private recordFrame(): void {
    this.frames.push(this.capture());
    this.cursor = this.frames.length - 1;
    this.exploredUntil = Math.max(this.exploredUntil, this.currentTime);
    this.tapeLog = this.logEntries.map(cloneLog);
  }

  private commitPhysics(): void {
    const last = this.frames[this.cursor];
    if (this.atTip() && last && last.currentTime === this.currentTime) {
      this.frames[this.cursor] = this.capture();
      this.tapeLog = this.logEntries.map(cloneLog);
      this.exploredUntil = Math.max(this.exploredUntil, this.currentTime);
      return;
    }
    this.recordFrame();
  }

  private executeNext(): SimulationEvent | null {
    this.branchIfNeeded();
    const event = this.queue.pop();
    if (!event) return null;
    this.currentTime = event.timestamp;
    this.dispatch(event);
    this.recordFrame();
    return event;
  }

  private runUntil(target: number): void {
    while (true) {
      const next = this.queue.peek();
      if (!next || next.timestamp > target) break;
      this.executeNext();
    }
    if (this.queue.peek() && target > this.currentTime) {
      this.currentTime = target;
      this.exploredUntil = Math.max(this.exploredUntil, this.currentTime);
    }
  }

  private buildSnapshot(): Snapshot {
    const pending = this.queue.toArray();
    const horizon = this.horizon();
    const pad = Math.max(250, horizon * 0.08);
    return {
      currentTime: this.currentTime,
      status: this.status,
      speed: this.speed,
      nodes: this.nodes.map(cloneNode),
      inFlight: [...this.messages.values()].map(cloneMessage),
      pendingEvents: pending.map(cloneEvent),
      eventLog: this.logEntries.map(cloneLog),
      tapeLog: this.tapeLog.map(cloneLog),
      playheadLogSeq: lastLogSeq(this.logEntries),
      atTip: this.atTip(),
      duration: Math.max(horizon + pad, 500),
      exploredUntil: this.exploredUntil,
      partitions: [...this.partitions].map(parseEdgeKey),
      linkLatencies: [...this.linkLatencies.entries()].map(([key, ms]) => {
        const [a, b] = parseEdgeKey(key);
        return [a, b, ms];
      }),
      defaultLatency: this.defaultLatency,
      nextEvent: pending[0] ? cloneEvent(pending[0]) : null,
      pendingCount: pending.length,
      timers: [...this.timers.values()].map(cloneTimer),
      started: this.started,
    };
  }

  getMessage(messageId: string): Message | undefined {
    const m = this.messages.get(messageId);
    return m ? cloneMessage(m) : undefined;
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
        { messageId, from: message.from, to: message.to, reason: "partition" },
      );
      return;
    }

    const dest = this.requireNode(message.to);
    if (dest.status === "stopped") {
      this.pushLog(
        "drop",
        `dropped ${message.from} → ${message.to} ${payloadLabel(message.payload)} (node ${message.to} stopped)`,
        { messageId, from: message.from, to: message.to, reason: "node-stopped" },
      );
      return;
    }

    this.pushLog("deliver", `${message.to} ← ${payloadLabel(message.payload)}  (${message.from})`, {
      messageId,
      from: message.from,
      to: message.to,
      payload: message.payload,
    });
    this.scenario.onMessage(message.to, message, this.ctx);
  }

  private fireTimer(event: TimerEvent): void {
    this.timers.delete(event.id);
    const node = this.requireNode(event.nodeId);
    if (node.status === "stopped") return;
    this.pushLog("timer", `${event.nodeId} ${event.name} timeout`, {
      nodeId: event.nodeId,
      timerId: event.id,
      name: event.name,
    });
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

  private pushLog(kind: LogKind, text: string, meta?: Record<string, unknown>): void {
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
      const hop = latency ?? this.getLinkLatency(from, to);
      const deliverAt = this.currentTime + Math.max(0, hop);
      const message: Message = {
        id,
        from,
        to,
        payload,
        sentAt: this.currentTime,
        deliverAt,
      };
      this.pushLog("send", `${from} → ${to}  ${payloadLabel(payload)}`, {
        messageId: id,
        from,
        to,
        payload,
        deliverAt,
      });
      const key = edgeKey(from, to);
      if (this.pendingDrops.has(key)) {
        this.pendingDrops.delete(key);
        this.pushLog("drop", `dropped ${from} → ${to} ${payloadLabel(payload)} (link)`, {
          messageId: id,
          from,
          to,
          reason: "drop-next",
        });
        return null;
      }
      if (this.isPartitioned(from, to)) {
        this.pushLog("drop", `dropped ${from} → ${to} ${payloadLabel(payload)} (partition)`, {
          messageId: id,
          from,
          to,
          reason: "partition",
        });
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
    linkLatency: (a, b) => this.getLinkLatency(a, b),
    setTimer: (nodeId, delay, name, data) => {
      const id = `t${++this.timerCounter}`;
      const fireAt = this.currentTime + Math.max(0, delay);
      this.timers.set(id, { id, nodeId, name, fireAt, setAt: this.currentTime, data });
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
        typeof updater === "function" ? updater(node.state) : { ...node.state, ...updater };
    },
    log: (text, meta) => {
      const kind: LogKind = meta?.kind === "state" ? "state" : "info";
      this.pushLog(kind, text, meta);
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
    random: () => this.rng.random(),
    isRunning: (nodeId) => this.requireNode(nodeId).status === "running",
  };
}
