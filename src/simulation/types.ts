export type NodeStatus = "running" | "stopped";
export type SimStatus = "playing" | "paused";
export type PlaybackSpeed = 0.25 | 1 | 4 | 32;

export type Node = {
  id: string;
  status: NodeStatus;
  state: Record<string, unknown>;
};

export type Message = {
  id: string;
  from: string;
  to: string;
  payload: unknown;
  sentAt: number;
  deliverAt: number;
};

export type DeliverMessageEvent = {
  type: "deliver";
  id: string;
  timestamp: number;
  seq: number;
  messageId: string;
};

export type TimerEvent = {
  type: "timer";
  id: string;
  timestamp: number;
  seq: number;
  nodeId: string;
  name: string;
  data?: unknown;
};

export type SimulationEvent = DeliverMessageEvent | TimerEvent;

export type LogKind =
  | "send"
  | "deliver"
  | "drop"
  | "delay"
  | "timer"
  | "crash"
  | "restart"
  | "partition"
  | "heal"
  | "info";

export type LogEntry = {
  seq: number;
  timestamp: number;
  kind: LogKind;
  text: string;
  meta?: Record<string, unknown>;
};

export type TimerInfo = {
  id: string;
  nodeId: string;
  name: string;
  fireAt: number;
  data?: unknown;
};

export type Snapshot = {
  currentTime: number;
  status: SimStatus;
  speed: PlaybackSpeed;
  nodes: Node[];
  inFlight: Message[];
  pendingEvents: SimulationEvent[];
  eventLog: LogEntry[];
  partitions: [string, string][];
  nextEvent: SimulationEvent | null;
  pendingCount: number;
  timers: TimerInfo[];
};

export type ScenarioContext = {
  now: () => number;
  sendMessage: (
    from: string,
    to: string,
    payload: unknown,
    latency: number,
  ) => string | null;
  setTimer: (
    nodeId: string,
    delay: number,
    name: string,
    data?: unknown,
  ) => string;
  cancelTimers: (nodeId: string, name?: string) => void;
  updateNodeState: (
    nodeId: string,
    updater:
      | Record<string, unknown>
      | ((state: Record<string, unknown>) => Record<string, unknown>),
  ) => void;
  log: (text: string, meta?: Record<string, unknown>) => void;
  getNode: (nodeId: string) => Node;
  getNodes: () => Node[];
  random: () => number;
  isRunning: (nodeId: string) => boolean;
};

export type InitialState = {
  nodes: Node[];
  seed?: number;
};

export type ScenarioAction = {
  id: string;
  label: string;
};

export type Scenario = {
  id: string;
  name: string;
  description: string;
  actions?: ScenarioAction[];
  createInitialState: () => InitialState;
  onStart: (ctx: ScenarioContext) => void;
  onMessage: (nodeId: string, message: Message, ctx: ScenarioContext) => void;
  onTimer?: (nodeId: string, timer: TimerEvent, ctx: ScenarioContext) => void;
  onCrash?: (nodeId: string, ctx: ScenarioContext) => void;
  onRestart?: (nodeId: string, ctx: ScenarioContext) => void;
  onAction?: (actionId: string, ctx: ScenarioContext) => void;
  summarizeNode?: (node: Node) => string[];
};
