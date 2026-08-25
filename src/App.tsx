import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import * as stylex from "@stylexjs/stylex";
import { Simulation } from "./simulation/Simulation";
import { SCENARIOS, getScenario } from "./scenarios";
import type { PlaybackSpeed } from "./simulation/types";
import { colors, fonts, lightTheme } from "./ui/theme.stylex";
import { Logo } from "./ui/Logo";
import { useTheme } from "./ui/Theme";
import { selectionFromLog, type Selection } from "./ui/selection";
import { NetworkCanvas } from "./components/NetworkCanvas";
import { EventTimeline } from "./components/EventTimeline";
import { Inspector } from "./components/Inspector";
import { SimulationControls } from "./components/SimulationControls";

export default function App() {
  const { theme, palette, toggleTheme } = useTheme();
  const [scenarioId, setScenarioId] = useState("raft");
  const [sim, setSim] = useState(() => new Simulation(getScenario("raft")));
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
      const maxEvents = snapshot.speed >= 32 ? 10 : 40;
      sim.advanceBy(dt * snapshot.speed, maxEvents);
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
        setSelection(entry ? selectionFromLog(entry, snap) : null);
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        sim.seekToNextEvent();
        const snap = sim.snapshot();
        const entry = snap.tapeLog.find((row) => row.seq === snap.playheadLogSeq);
        setSelection(entry ? selectionFromLog(entry, snap) : null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sim]);

  function loadScenario(id: string) {
    setScenarioId(id);
    setSim(new Simulation(getScenario(id)));
    setSelection(null);
  }

  const running = snapshot.nodes.filter((n) => n.status === "running").length;
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
          <div {...stylex.props(styles.wordmark)}>Druid</div>
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
        </div>
        <div {...stylex.props(styles.status)}>
          <span {...stylex.props(styles.time)}>{Math.round(snapshot.currentTime)}ms</span>
          <span {...stylex.props(styles.dot)}>·</span>
          <span>
            {running}/{snapshot.nodes.length} nodes
          </span>
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
          setSelection(selectionFromLog(entry, sim.snapshot()));
        }}
        onSeekPending={(event) => {
          sim.seekToTime(event.timestamp);
          const snap = sim.snapshot();
          const entry = snap.tapeLog.find((row) => row.seq === snap.playheadLogSeq);
          setSelection(entry ? selectionFromLog(entry, snap) : null);
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
    gap: 16,
    padding: "10px 16px",
    borderBottomWidth: 1,
    borderBottomStyle: "solid",
    borderBottomColor: colors.faint,
    backgroundColor: colors.bg,
  },
  brand: {
    display: "flex",
    alignItems: "center",
    gap: 10,
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
    fontFamily: fonts.mono,
    fontSize: 12,
  },
  select: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.ink,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: colors.faint,
    padding: "4px 8px",
    maxWidth: 160,
  },
  status: {
    flex: 1,
    display: "flex",
    alignItems: "baseline",
    gap: 8,
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.muted,
    minWidth: 0,
    overflow: "hidden",
  },
  time: {
    fontSize: 18,
    fontWeight: 600,
    color: colors.ink,
    fontVariantNumeric: "tabular-nums",
    letterSpacing: "-0.02em",
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
    gridTemplateColumns: "1fr 340px",
  },
  side: {
    display: "flex",
    flexDirection: "column",
    minHeight: 0,
    borderLeftWidth: 1,
    borderLeftStyle: "solid",
    borderLeftColor: colors.faint,
    backgroundColor: colors.white,
    overflow: "auto",
  },
});
