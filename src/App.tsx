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
import { PerturbationControls } from "./components/PerturbationControls";

export default function App() {
  const { theme, palette, toggleTheme } = useTheme();
  const [scenarioId, setScenarioId] = useState("ping-pong");
  const [sim, setSim] = useState(() => new Simulation(getScenario("ping-pong")));
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
      const dt = now - last;
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
            <Logo size={32} crescent={palette.ink} />
          </button>
          <div>
            <div {...stylex.props(styles.wordmark)}>Druid</div>
            <div {...stylex.props(styles.tag)}>
              deterministic distributed systems sandbox
            </div>
          </div>
        </div>
        <label {...stylex.props(styles.scenario)}>
          <span>SCENARIO</span>
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
      <p {...stylex.props(styles.desc)}>{scenario.description}</p>
      {scenario.actions && scenario.actions.length > 0 ? (
        <div {...stylex.props(styles.actions)}>
          {scenario.actions.map((action) => (
            <button
              key={action.id}
              type="button"
              onClick={() => sim.invokeAction(action.id)}
              {...stylex.props(styles.action)}
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
      <div {...stylex.props(styles.main)}>
        <NetworkCanvas
          snapshot={snapshot}
          scenario={scenario}
          selection={selection}
          onSelect={setSelection}
        />
        <aside {...stylex.props(styles.side)}>
          <Inspector
            snapshot={snapshot}
            scenario={scenario}
            selection={selection}
          />
          <PerturbationControls
            snapshot={snapshot}
            selection={selection}
            onDelay={(id, ts) => sim.delayMessage(id, ts)}
            onDrop={(id) => {
              sim.dropMessage(id);
              setSelection(null);
            }}
            onPartition={(a, b) => sim.partition(a, b)}
            onHeal={(a, b) => sim.healPartition(a, b)}
            onCrash={(id) => sim.crashNode(id)}
            onRestart={(id) => sim.restartNode(id)}
          />
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
    justifyContent: "space-between",
    gap: 24,
    padding: "14px 18px 8px",
    borderBottomWidth: 1,
    borderBottomStyle: "solid",
    borderBottomColor: colors.faint,
    backgroundColor: colors.bg,
  },
  brand: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    minWidth: 240,
  },
  wordmark: {
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: 800,
    lineHeight: 1,
    letterSpacing: "-0.03em",
  },
  tag: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.muted,
    marginTop: 4,
    letterSpacing: "0.02em",
  },
  scenario: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: "0.14em",
    color: colors.muted,
    flex: 1,
  },
  select: {
    fontFamily: fonts.mono,
    fontSize: 13,
    color: colors.ink,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: colors.faint,
    padding: "6px 8px",
    letterSpacing: 0,
    minWidth: 240,
  },
  desc: {
    position: "relative",
    zIndex: 1,
    margin: 0,
    padding: "8px 18px",
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.muted,
    backgroundColor: colors.bg,
    borderBottomWidth: 1,
    borderBottomStyle: "solid",
    borderBottomColor: colors.faint,
  },
  actions: {
    position: "relative",
    zIndex: 1,
    display: "flex",
    gap: 8,
    padding: "8px 18px",
    backgroundColor: colors.bg,
    borderBottomWidth: 1,
    borderBottomStyle: "solid",
    borderBottomColor: colors.faint,
  },
  action: {
    backgroundColor: colors.lime,
    color: colors.charcoal,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: colors.lime,
    fontFamily: fonts.mono,
    fontSize: 12,
    padding: "6px 12px",
    cursor: "pointer",
    fontWeight: 600,
  },
  main: {
    position: "relative",
    zIndex: 1,
    flex: "1 1 auto",
    minHeight: 0,
    display: "grid",
    gridTemplateColumns: "1fr 400px",
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
