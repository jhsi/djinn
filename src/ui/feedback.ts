import { useEffect, useMemo, useRef, useState } from "react";
import type { LogEntry, PlaybackSpeed, Scenario, Snapshot } from "../simulation/types";
import { presentNode } from "./presentation";

export type FeedbackKind = "send" | "receive" | "role" | "field" | "timer";

export type FeedbackPulse = {
  id: string;
  kind: FeedbackKind;
  nodeId: string;
  field?: string;
  until: number;
};

export type NodeFeedback = {
  send: boolean;
  receive: boolean;
  role: boolean;
  timer: boolean;
  fields: ReadonlySet<string>;
};

type VisualSnap = {
  role: string;
  primary: string;
  secondary: string;
  placeholder: string;
  badges: string;
  timerName: string;
  timerRemaining: number;
  status: string;
};

const EMPTY_FIELDS: ReadonlySet<string> = new Set();

const BASE_MS: Record<FeedbackKind, number> = {
  send: 140,
  receive: 220,
  field: 280,
  role: 420,
  timer: 340,
};

export function feedbackDuration(
  kind: FeedbackKind,
  speed: PlaybackSpeed,
  opts: { reducedMotion: boolean; playing: boolean },
): number {
  if (opts.reducedMotion && kind === "send") return 0;
  if (!opts.playing) {
    const paused = { send: 220, receive: 520, field: 640, role: 800, timer: 700 }[kind];
    if (speed === 32) return kind === "send" ? 0 : 120;
    if (opts.reducedMotion) return Math.min(240, paused);
    return paused;
  }
  if (speed === 32) {
    if (kind === "send") return 0;
    if (kind === "receive") return opts.reducedMotion ? 80 : 60;
    return 90;
  }
  const scale = speed === 4 ? 0.4 : speed === 0.25 ? 1.25 : 1;
  const ms = Math.round(BASE_MS[kind] * scale);
  if (opts.reducedMotion) return Math.min(180, Math.max(140, Math.round(ms * 0.7)));
  return ms;
}

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() =>
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

export function useSimulationFeedback(
  snapshot: Snapshot,
  scenario: Scenario,
): Map<string, NodeFeedback> {
  const reducedMotion = usePrefersReducedMotion();
  const processedSeq = useRef(-1);
  const prevVisual = useRef<Map<string, VisualSnap>>(new Map());
  const snapRef = useRef(snapshot);
  snapRef.current = snapshot;
  const scenarioRef = useRef(scenario);
  scenarioRef.current = scenario;
  const [pulses, setPulses] = useState<FeedbackPulse[]>([]);

  useEffect(() => {
    processedSeq.current = -1;
    prevVisual.current = new Map();
    setPulses([]);
  }, [scenario.id]);

  useEffect(() => {
    const snap = snapRef.current;
    const playhead = snap.playheadLogSeq;
    if (playhead < processedSeq.current) {
      processedSeq.current = playhead;
      prevVisual.current = captureVisuals(snap, scenarioRef.current);
      setPulses([]);
      return;
    }

    const newEntries = snap.tapeLog.filter(
      (entry) => entry.seq > processedSeq.current && entry.seq <= playhead,
    );
    processedSeq.current = playhead;

    const nextVisual = captureVisuals(snap, scenarioRef.current);
    if (newEntries.length === 0 && prevVisual.current.size === 0) {
      prevVisual.current = nextVisual;
      return;
    }

    const now = performance.now();
    const playing = snap.status === "playing";
    const burst = snap.speed === 32 || newEntries.length > 6;
    const duration = (kind: FeedbackKind) =>
      feedbackDuration(kind, snap.speed, { reducedMotion, playing });

    const added: FeedbackPulse[] = [];
    const push = (pulse: Omit<FeedbackPulse, "kind" | "until">, kind: FeedbackKind) => {
      const ms = duration(kind);
      if (ms <= 0) return;
      added.push({ ...pulse, kind, until: now + ms });
    };

    if (!burst) {
      for (const entry of newEntries) {
        addLogPulses(entry, push);
      }
    } else {
      for (const entry of lastByKind(newEntries, "deliver")) addLogPulses(entry, push);
    }

    for (const [nodeId, next] of nextVisual) {
      const prev = prevVisual.current.get(nodeId);
      if (!prev) continue;
      if (prev.role !== next.role && (prev.role || next.role)) {
        push({ id: `${nodeId}:role:${playhead}`, nodeId, field: "role" }, "role");
      }
      if (prev.primary !== next.primary && next.primary) {
        push({ id: `${nodeId}:primary:${playhead}`, nodeId, field: "primary" }, "field");
      }
      if (prev.secondary !== next.secondary && next.secondary) {
        push({ id: `${nodeId}:secondary:${playhead}`, nodeId, field: "secondary" }, "field");
      }
      if (prev.badges !== next.badges || prev.placeholder !== next.placeholder) {
        if (next.badges || next.placeholder) {
          push({ id: `${nodeId}:known:${playhead}`, nodeId, field: "known" }, "field");
        }
      }
      if (
        prev.timerName === next.timerName &&
        prev.timerName &&
        next.timerRemaining > prev.timerRemaining + 80
      ) {
        push({ id: `${nodeId}:timer:${playhead}`, nodeId, field: "timer" }, "timer");
      }
    }
    prevVisual.current = nextVisual;

    if (added.length === 0) return;
    setPulses((current) => mergePulses(current, added, now));
  }, [snapshot.playheadLogSeq, scenario.id, reducedMotion]);

  useEffect(() => {
    if (pulses.length === 0) return;
    const next = Math.min(...pulses.map((p) => p.until));
    const delay = Math.max(16, next - performance.now());
    const id = window.setTimeout(() => {
      const t = performance.now();
      setPulses((current) => current.filter((p) => p.until > t));
    }, delay);
    return () => window.clearTimeout(id);
  }, [pulses]);

  return useMemo(() => indexFeedback(pulses, performance.now()), [pulses]);
}

export function nodeFeedback(
  map: Map<string, NodeFeedback>,
  nodeId: string,
): NodeFeedback {
  return (
    map.get(nodeId) ?? {
      send: false,
      receive: false,
      role: false,
      timer: false,
      fields: EMPTY_FIELDS,
    }
  );
}

function addLogPulses(
  entry: LogEntry,
  push: (pulse: Omit<FeedbackPulse, "until" | "kind">, kind: FeedbackKind) => void,
) {
  const meta = entry.meta ?? {};
  if (entry.kind === "send" && typeof meta.from === "string") {
    push({ id: `${entry.seq}:send`, nodeId: meta.from }, "send");
  }
  if (entry.kind === "deliver" && typeof meta.to === "string") {
    push({ id: `${entry.seq}:receive`, nodeId: meta.to }, "receive");
  }
}

function lastByKind(entries: LogEntry[], kind: LogEntry["kind"]): LogEntry[] {
  const seen = new Set<string>();
  const out: LogEntry[] = [];
  for (let i = entries.length - 1; i >= 0; i -= 1) {
    const entry = entries[i];
    if (entry.kind !== kind) continue;
    const nodeId = String(entry.meta?.to ?? entry.meta?.from ?? "");
    if (!nodeId || seen.has(nodeId)) continue;
    seen.add(nodeId);
    out.push(entry);
  }
  return out;
}

function mergePulses(current: FeedbackPulse[], added: FeedbackPulse[], now: number): FeedbackPulse[] {
  const live = current.filter((p) => p.until > now);
  const byId = new Map(live.map((p) => [p.id, p]));
  for (const pulse of added) byId.set(pulse.id, pulse);
  return [...byId.values()];
}

function indexFeedback(pulses: FeedbackPulse[], now: number): Map<string, NodeFeedback> {
  const map = new Map<string, NodeFeedback>();
  for (const pulse of pulses) {
    if (pulse.until <= now) continue;
    const cur = map.get(pulse.nodeId) ?? {
      send: false,
      receive: false,
      role: false,
      timer: false,
      fields: new Set<string>(),
    };
    const fields = cur.fields instanceof Set ? cur.fields : new Set(cur.fields);
    if (pulse.kind === "send") cur.send = true;
    if (pulse.kind === "receive") cur.receive = true;
    if (pulse.kind === "role") {
      cur.role = true;
      fields.add("role");
    }
    if (pulse.kind === "timer") {
      cur.timer = true;
      fields.add("timer");
    }
    if (pulse.kind === "field" && pulse.field) fields.add(pulse.field);
    map.set(pulse.nodeId, { ...cur, fields });
  }
  return map;
}

function captureVisuals(snapshot: Snapshot, scenario: Scenario): Map<string, VisualSnap> {
  const out = new Map<string, VisualSnap>();
  for (const node of snapshot.nodes) {
    const view = presentNode(node, scenario, snapshot);
    out.set(node.id, {
      role: view.role ?? "",
      primary: view.primary ?? "",
      secondary: view.secondary ?? "",
      placeholder: view.placeholder ?? "",
      badges: (view.badges ?? []).map((b) => b.label).join(","),
      timerName: view.timer?.name ?? "",
      timerRemaining: view.timer?.remaining ?? -1,
      status: node.status,
    });
  }
  return out;
}
