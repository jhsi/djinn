import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import * as stylex from "@stylexjs/stylex";
import { Simulation } from "./simulation/Simulation";
import { SCENARIOS, getScenario } from "./scenarios";
import type { PlaybackSpeed } from "./simulation/types";
import { MAX_CLUSTER_SIZE, MIN_CLUSTER_SIZE } from "./scenarios/helpers";
import { colors, fonts, lightTheme } from "./ui/theme.stylex";
import { Logo } from "./ui/Logo";
import { useTheme } from "./ui/Theme";
import { playbackRate } from "./ui/playback";
import { eventKey, type Selection } from "./ui/selection";
import { NetworkCanvas } from "./components/NetworkCanvas";
import { EventTimeline } from "./components/EventTimeline";
import { Inspector } from "./components/Inspector";
import { SimulationControls } from "./components/SimulationControls";

export default function App() {
  const { theme, palette, toggleTheme } = useTheme();
  const [scenarioId, setScenarioId] = useState("raft");
  const [nodeCount, setNodeCount] = useState(3);
  const [sim, setSim] = useState(() => new Simulation(getScenario("raft"), 3));
  const [selection, setSelection] = useState<Selection>(null);
  const subscribe = useCallback(
    (onStoreChange: () => void) => sim.subscribe(onStoreChange),
    [sim],
  );
  const snapshot = useSyncExternalStore(
    subscribe,
    () => sim.snapshot(),
    () => sim.snapshot(),
  );
  const scenario = useMemo(() => getScenario(scenarioId), [scenarioId]);

  useEffect(() => {
    if (snapshot.status !== "playing") return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(48, now - last);
      last = now;
      const snap = sim.snapshot();
      const rate = playbackRate(snap);
      const maxEvents = snap.speed === "auto" ? 8 : snap.speed === 32 ? 10 : 40;
      sim.advanceBy(dt * rate, maxEvents);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [sim, snapshot.status, snapshot.speed]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA" || tag === "BUTTON") return;
      if (e.code === "Space" || e.key === "p") {
        e.preventDefault();
        if (sim.status === "playing") sim.pause();
        else sim.play();
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        sim.seekToPrevEvent();
        const snap = sim.snapshot();
        const entry = snap.tapeLog.find((row) => row.seq === snap.playheadLogSeq);
        setSelection(entry ? { kind: "event", key: `log:${entry.seq}` } : null);
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        sim.seekToNextEvent();
        const snap = sim.snapshot();
        const entry = snap.tapeLog.find((row) => row.seq === snap.playheadLogSeq);
        setSelection(entry ? { kind: "event", key: `log:${entry.seq}` } : null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sim]);

  function loadScenario(id: string) {
    const next = getScenario(id);
    const count = next.configurableNodeCount ? (next.defaultNodeCount ?? 3) : undefined;
    setScenarioId(id);
    setNodeCount(count ?? 2);
    setSim(new Simulation(next, count));
    setSelection(null);
  }

  function applyNodeCount(count: number) {
    if (snapshot.started || !scenario.configurableNodeCount) return;
    setNodeCount(count);
    setSim(new Simulation(scenario, count));
    setSelection(null);
  }

  const partitions =
    snapshot.partitions.length === 0
      ? "no partitions"
      : `${snapshot.partitions.length} partition${snapshot.partitions.length === 1 ? "" : "s"}`;

  return (
    <div {...stylex.props(theme === "light" && lightTheme, styles.shell)}>
      <header {...stylex.props(styles.top)}>
        <div {...stylex.props(styles.brand)}>
          <button
            type="button"
            onClick={toggleTheme}
            title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            {...stylex.props(styles.logoBtn)}
          >
            <Logo size={28} crescent={palette.ink} />
          </button>
          <div {...stylex.props(styles.wordmark)}>djinn</div>
          <label {...stylex.props(styles.scenario)} title={scenario.description}>
            <select
              value={scenarioId}
              onChange={(e) => loadScenario(e.target.value)}
              {...stylex.props(styles.select)}
            >
              {SCENARIOS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          {scenario.configurableNodeCount ? (
            <label
              {...stylex.props(styles.nodes)}
              title={
                snapshot.started
                  ? "Reset the scenario to change node count"
                  : "Nodes in this scenario"
              }
            >
              <span {...stylex.props(styles.nodesLabel)}>Nodes</span>
              <select
                value={nodeCount}
                disabled={snapshot.started}
                onChange={(e) => applyNodeCount(Number(e.target.value))}
                {...stylex.props(styles.select, snapshot.started && styles.selectLocked)}
              >
                {[...Array(MAX_CLUSTER_SIZE - MIN_CLUSTER_SIZE + 1)].map((_, i) => {
                  const n = MIN_CLUSTER_SIZE + i;
                  return (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  );
                })}
              </select>
            </label>
          ) : null}
        </div>
        <div {...stylex.props(styles.status)}>
          <span {...stylex.props(styles.time)}>{Math.round(snapshot.currentTime)}ms</span>
          <span {...stylex.props(styles.dot)}>·</span>
          <span>{snapshot.inFlight.length} in flight</span>
          <span {...stylex.props(styles.dot)}>·</span>
          <span>{snapshot.pendingCount} pending</span>
          <span {...stylex.props(styles.dot)}>·</span>
          <span {...stylex.props(snapshot.partitions.length > 0 && styles.alert)}>
            {partitions}
          </span>
        </div>
        <SimulationControls
          status={snapshot.status}
          speed={snapshot.speed}
          onReset={() => {
            sim.reset();
            setSelection(null);
          }}
          onPlayPause={() => {
            if (sim.status === "playing") sim.pause();
            else sim.play();
          }}
          onStep={() => {
            if (sim.status === "playing") sim.pause();
            sim.step();
          }}
          onSpeed={(speed: PlaybackSpeed) => sim.setSpeed(speed)}
        />
      </header>
      <div {...stylex.props(styles.main)}>
        <NetworkCanvas
          snapshot={snapshot}
          scenario={scenario}
          selection={selection}
          onSelect={setSelection}
          onCrash={(id) => sim.crashNode(id)}
          onRestart={(id) => sim.restartNode(id)}
          onPartition={(a, b) => sim.partition(a, b)}
          onHeal={(a, b) => sim.healPartition(a, b)}
          onLinkLatency={(a, b, ms) => sim.setLinkLatency(a, b, ms)}
          onDropNext={(a, b) => {
            sim.dropNextOnLink(a, b);
            if (selection?.kind === "message") setSelection(null);
          }}
          onDropMessage={(id) => {
            sim.dropMessage(id);
            setSelection(null);
          }}
          onDelayMessage={(id, ts) => sim.delayMessage(id, ts)}
          onClientSend={() => {
            const action = scenario.actions?.[0];
            if (action) sim.invokeAction(action.id);
          }}
        />
        <aside {...stylex.props(styles.side)}>
          <Inspector snapshot={snapshot} scenario={scenario} selection={selection} />
        </aside>
      </div>
      <EventTimeline
        snapshot={snapshot}
        selection={selection}
        onSeekTime={(time) => sim.seekToTime(time)}
        onSeekLog={(entry) => {
          sim.seekToLog(entry.seq);
          setSelection({ kind: "event", key: `log:${entry.seq}` });
        }}
        onSeekPending={(event) => {
          sim.seekToTime(event.timestamp);
          setSelection({ kind: "event", key: eventKey(event) });
        }}
      />
    </div>
  );
}

const styles = stylex.create({
  shell: {
    position: "relative",
    height: "100vh",
    display: "flex",
    flexDirection: "column",
    backgroundColor: colors.bg,
    color: colors.ink,
    fontFamily: fonts.ui,
    overflow: "hidden",
  },
  logoBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
    margin: 0,
    borderWidth: 0,
    backgroundColor: "transparent",
    cursor: "pointer",
  },
  top: {
    position: "relative",
    zIndex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 24,
    padding: "8px 20px",
    borderBottomWidth: 1,
    borderBottomStyle: "solid",
    borderBottomColor: colors.faint,
    backgroundColor: colors.bg,
  },
  brand: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    flexShrink: 0,
  },
  wordmark: {
    fontFamily: fonts.display,
    fontSize: 18,
    fontWeight: 800,
    letterSpacing: "-0.03em",
  },
  scenario: {
    display: "flex",
    fontFamily: fonts.ui,
    fontSize: 13,
  },
  select: {
    fontFamily: fonts.ui,
    fontSize: 13,
    color: colors.ink,
    backgroundColor: "transparent",
    borderWidth: 0,
    padding: "2px 0",
    maxWidth: 160,
    cursor: "pointer",
  },
  selectLocked: {
    opacity: 0.45,
    cursor: "default",
  },
  nodes: {
    display: "flex",
    alignItems: "baseline",
    gap: 6,
    fontFamily: fonts.ui,
    fontSize: 13,
    color: colors.muted,
  },
  nodesLabel: {
    fontSize: 12,
    letterSpacing: "0.04em",
  },
  status: {
    flex: 1,
    display: "flex",
    alignItems: "baseline",
    gap: 8,
    fontFamily: fonts.ui,
    fontSize: 12,
    color: colors.muted,
    minWidth: 0,
    overflow: "hidden",
  },
  time: {
    fontFamily: fonts.mono,
    fontSize: 22,
    fontWeight: 600,
    color: colors.ink,
    fontVariantNumeric: "tabular-nums",
    letterSpacing: "-0.03em",
    marginRight: 4,
  },
  dot: {
    color: colors.faint,
  },
  alert: {
    color: colors.coral,
  },
  main: {
    position: "relative",
    zIndex: 1,
    flex: "1 1 auto",
    minHeight: 0,
    display: "grid",
    gridTemplateColumns: {
      default: "1fr 292px",
      "@media (max-width: 1100px)": "1fr 248px",
    },
  },
  side: {
    display: "flex",
    flexDirection: "column",
    minHeight: 0,
    borderLeftWidth: 1,
    borderLeftStyle: "solid",
    borderLeftColor: colors.faint,
    backgroundColor: colors.bg,
    overflow: "auto",
  },
});
