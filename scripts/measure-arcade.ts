/**
 * Application snapshot-delivery model, NOT a TCP/network emulator or browser.
 * Run from the repository root with the existing backend ts-node dependency:
 * node backend/node_modules/ts-node/dist/bin.js --project backend/tsconfig.json scripts/measure-arcade.ts
 */
import { createHash } from 'crypto';
import { execFileSync } from 'child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { arch, cpus, loadavg, platform, release } from 'os';
import { resolve } from 'path';
import { performance } from 'perf_hooks';
import { createGame, createSeededRng, GameState, MatchInput, stepGame } from '../shared/game-core';
import { advanceClock, createClock, STEP_MS } from '../shared/fixed-clock';
import { captureSnapshot, Snapshot } from '../shared/protocol';
import { SnapshotBuffer, SnapshotDisplayMode } from '../frontend/src/arcade/snapshot-buffer';

const root = resolve(__dirname, '..');
const output = resolve(root, 'docs/arcade-upgrade/measurements');
const SEED = 20260907;
const REPEATS = 5;
const WARMUP_MS = 2000;
const MEASURE_MS = 12000;
const TOTAL_MS = WARMUP_MS + MEASURE_MS;
const TICKS = TOTAL_MS / 1000 * 60;
const WARMUP_TICKS = WARMUP_MS / 1000 * 60;
const modes: SnapshotDisplayMode[] = ['latest', 'interpolate'];

interface Scenario {
  name: string;
  snapshotHz: 20 | 30 | 60;
  nominalRttMs: number | null;
  downlinks: { viewer: string; delayMs: number }[];
  jitterMs?: number;
  omitEvery?: number;
  reorderEvery?: number;
}
const scenarios: Scenario[] = [
  { name: '20hz_nominal_rtt_0', snapshotHz: 20, nominalRttMs: 0, downlinks: [{ viewer: 'viewer', delayMs: 0 }] },
  { name: '20hz_nominal_rtt_100', snapshotHz: 20, nominalRttMs: 100, downlinks: [{ viewer: 'viewer', delayMs: 50 }] },
  { name: '20hz_nominal_rtt_200', snapshotHz: 20, nominalRttMs: 200, downlinks: [{ viewer: 'viewer', delayMs: 100 }] },
  { name: '30hz_nominal_rtt_100', snapshotHz: 30, nominalRttMs: 100, downlinks: [{ viewer: 'viewer', delayMs: 50 }] },
  { name: '60hz_nominal_rtt_100', snapshotHz: 60, nominalRttMs: 100, downlinks: [{ viewer: 'viewer', delayMs: 50 }] },
  { name: '20hz_ordered_jitter', snapshotHz: 20, nominalRttMs: null, downlinks: [{ viewer: 'viewer', delayMs: 50 }], jitterMs: 40 },
  { name: '20hz_asymmetric_observers', snapshotHz: 20, nominalRttMs: null,
    downlinks: [{ viewer: 'observer_20ms', delayMs: 20 }, { viewer: 'observer_80ms', delayMs: 80 }] },
  { name: '20hz_application_omission', snapshotHz: 20, nominalRttMs: null,
    downlinks: [{ viewer: 'viewer', delayMs: 50 }], omitEvery: 7 },
  { name: '20hz_application_reorder', snapshotHz: 20, nominalRttMs: null,
    downlinks: [{ viewer: 'viewer', delayMs: 50 }], reorderEvery: 7 },
];

function sha256(value: string | Buffer): string { return createHash('sha256').update(value).digest('hex'); }
function stats(values: number[]) {
  if (!values.length) return { n: 0, mean: null, p50: null, p95: null, max: null };
  const sorted = [...values].sort((a, b) => a - b);
  const percentile = (fraction: number) => sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)];
  return { n: values.length, mean: values.reduce((sum, value) => sum + value, 0) / values.length,
    p50: percentile(0.5), p95: percentile(0.95), max: sorted[sorted.length - 1] };
}
function csv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return '';
  const keys = Object.keys(rows[0]);
  const quote = (value: unknown) => {
    if (value === null || value === undefined) return '';
    const text = String(value);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [keys.join(','), ...rows.map((row) => keys.map((key) => quote(row[key])).join(','))].join('\n') + '\n';
}
function sameRally(a: GameState, b: GameState): boolean {
  return a.phase === 'rally' && b.phase === 'rally' && a.rallyId === b.rallyId
    && a.players.left.score === b.players.left.score && a.players.right.score === b.players.right.score;
}
function truthAt(states: GameState[], tick: number): { x: number; y: number } {
  const lower = Math.max(0, Math.min(states.length - 1, Math.floor(tick)));
  const upper = Math.min(states.length - 1, lower + 1);
  const a = states[lower]; const b = states[upper];
  const alpha = sameRally(a, b) ? tick - lower : 0;
  return { x: a.ball.x + (b.ball.x - a.ball.x) * alpha, y: a.ball.y + (b.ball.y - a.ball.y) * alpha };
}

const inputs: MatchInput[] = Array.from({ length: TICKS + 1 }, (_, tick) => ({
  left: { up: tick % 180 < 90, down: tick % 180 >= 90, action: tick % 97 === 0 },
  right: { up: tick % 240 < 120, down: tick % 240 >= 120, action: tick % 113 === 0 },
}));
const frameRows: Record<string, unknown>[] = [];
const packetRows: Record<string, unknown>[] = [];
const stepRows: Record<string, unknown>[] = [];
const runRows: Record<string, unknown>[] = [];
const allRuns: any[] = [];
const allStepTimes: number[] = [];
const replayHashes: string[] = [];
let finalState: GameState = createGame();

for (let repeat = 1; repeat <= REPEATS; repeat++) {
  const random = createSeededRng(SEED);
  const states = [createGame()];
  for (let tick = 1; tick <= TICKS; tick++) {
    const start = performance.now();
    const next = stepGame(states[tick - 1], inputs[tick], random);
    const cpuMs = performance.now() - start;
    states.push(next.state);
    stepRows.push({ repeat, tick, warmup: tick <= WARMUP_TICKS, phase: next.state.phase, cpu_ms: cpuMs });
    if (tick > WARMUP_TICKS) allStepTimes.push(cpuMs);
  }
  finalState = states[states.length - 1];
  // A completed game would freeze core tick, invalidating this fixed tick axis.
  // Fail visibly instead of silently interpreting simulation-window time as tick.
  if (finalState.tick !== TICKS) throw new Error('Replay finished early; choose a documented non-finishing input trace');
  replayHashes.push(sha256(JSON.stringify(states)));

  for (let scenarioIndex = 0; scenarioIndex < scenarios.length; scenarioIndex++) {
    const scenario = scenarios[scenarioIndex];
    const stride = 60 / scenario.snapshotHz;
    for (const viewer of scenario.downlinks) {
      // Delivery jitter varies by repeat; both display modes get identical packets.
      const jitter = createSeededRng(SEED ^ repeat ^ (scenarioIndex * 131));
      let previousArrival = -Infinity;
      const schedule: { packet: Snapshot; emittedMs: number; arrivalMs: number; bytes: number; omitted: boolean }[] = [];
      for (let tick = 0, seq = 0; tick <= TICKS; tick += stride, seq++) {
        const packet = captureSnapshot(states[tick], 'measurement-replay', seq, { left: 0, right: 0 });
        const emittedMs = tick * STEP_MS;
        const jitterMs = scenario.jitterMs ? (jitter() * 2 - 1) * scenario.jitterMs : 0;
        const reordered = !!scenario.reorderEvery && seq > 0 && seq % scenario.reorderEvery === 0;
        let arrivalMs = emittedMs + Math.max(0, viewer.delayMs + jitterMs) + (reordered ? 140 : 0);
        if (!scenario.reorderEvery) arrivalMs = Math.max(previousArrival, arrivalMs);
        previousArrival = arrivalMs;
        const omitted = !!scenario.omitEvery && seq > 0 && seq % scenario.omitEvery === 0;
        const bytes = Buffer.byteLength(JSON.stringify(packet), 'utf8');
        schedule.push({ packet, emittedMs, arrivalMs, bytes, omitted });
        packetRows.push({ repeat, scenario: scenario.name, viewer: viewer.viewer, seq, tick,
          emitted_ms: emittedMs, scheduled_arrival_ms: arrivalMs, omitted,
          delivered_in_window: !omitted && arrivalMs <= TOTAL_MS, json_payload_bytes: bytes });
      }
      const delivery = schedule.filter((item) => !item.omitted).sort((a, b) => a.arrivalMs - b.arrivalMs || a.packet.seq - b.packet.seq);
      for (const mode of modes) {
        const buffer = new SnapshotBuffer(mode, 100);
        let packetIndex = 0;
        let delivered = 0;
        let deliveredBytes = 0;
        let previous: GameState | null = null;
        const motion: number[] = [];
        const age: number[] = [];
        const estimatedAge: number[] = [];
        const error: number[] = [];
        const displayCpu: number[] = [];
        let zeroMotion = 0;
        let warmupUnderflows = 0;
        for (let frame = 0; frame <= TICKS; frame++) {
          const now = frame * STEP_MS;
          while (packetIndex < delivery.length && delivery[packetIndex].arrivalMs <= now + 0.000001) {
            const entry = delivery[packetIndex++];
            buffer.receive(entry.packet, entry.arrivalMs);
            delivered++; deliveredBytes += entry.bytes;
          }
          const beforeDisplay = performance.now();
          const shown = buffer.display(now);
          const displayMs = performance.now() - beforeDisplay;
          const measurement = buffer.metrics;
          if (frame === WARMUP_TICKS) warmupUnderflows = measurement.underflowCount;
          const measured = frame > WARMUP_TICKS;
          let displacement: number | null = null;
          let matchingTickError: number | null = null;
          let sourceAge: number | null = null;
          if (shown && measurement.presentationTick !== null) {
            sourceAge = Math.max(0, now - measurement.presentationTick * STEP_MS);
            if (shown.phase === 'rally') {
              const truth = truthAt(states, measurement.presentationTick);
              matchingTickError = Math.hypot(shown.ball.x - truth.x, shown.ball.y - truth.y);
            }
            if (previous && sameRally(previous, shown)) displacement = Math.hypot(shown.ball.x - previous.ball.x, shown.ball.y - previous.ball.y);
            if (measured) {
              age.push(sourceAge); estimatedAge.push(measurement.displayDelayMs); displayCpu.push(displayMs);
              if (matchingTickError !== null) error.push(matchingTickError);
              if (displacement !== null) { motion.push(displacement); if (displacement < 0.000001) zeroMotion++; }
            }
            previous = shown;
          }
          frameRows.push({ repeat, scenario: scenario.name, viewer: viewer.viewer, mode, frame,
            local_ms: now, warmup: !measured, presentation_tick: measurement.presentationTick,
            phase: shown?.phase ?? '', rally_id: shown?.rallyId ?? '', ball_x: shown?.ball.x ?? '', ball_y: shown?.ball.y ?? '',
            left_y: shown?.players.left.y ?? '', right_y: shown?.players.right.y ?? '',
            source_age_ms_model: sourceAge, estimated_display_age_ms: measurement.displayDelayMs,
            ball_step_distance: displacement, ball_error_at_same_tick: matchingTickError,
            display_cpu_ms: displayMs, buffer_depth: measurement.depth, underflow_episodes: measurement.underflowCount });
        }
        const run = {
          repeat, scenario: scenario.name, viewer: viewer.viewer, mode, snapshotHz: scenario.snapshotHz,
          nominalRttLabelMs: scenario.nominalRttMs, downlinkBaseMs: viewer.delayMs,
          emittedSnapshots: schedule.length, emittedJsonBytes: schedule.reduce((sum, item) => sum + item.bytes, 0),
          deliveredSnapshots: delivered, deliveredJsonBytes: deliveredBytes,
          omittedSnapshots: schedule.filter((item) => item.omitted).length,
          acceptedSnapshots: buffer.metrics.received, rejectedSnapshots: buffer.metrics.rejected,
          sequenceGaps: buffer.metrics.gaps, underflowEpisodes: buffer.metrics.underflowCount,
          measuredUnderflowEpisodes: buffer.metrics.underflowCount - warmupUnderflows,
          arrivalIntervalMeanMs: buffer.metrics.arrivalIntervalMeanMs, arrivalIntervalSdMs: buffer.metrics.arrivalJitterMs,
          motion: stats(motion), sourceAgeMsModel: stats(age), estimatedDisplayAgeMs: stats(estimatedAge),
          sameTickBallError: stats(error), displayCpuMs: stats(displayCpu),
          zeroMotionFraction: motion.length ? zeroMotion / motion.length : null,
        };
        allRuns.push(run);
        runRows.push({ repeat, scenario: scenario.name, viewer: viewer.viewer, mode,
          emitted_snapshots: run.emittedSnapshots, emitted_json_bytes: run.emittedJsonBytes,
          delivered_snapshots: delivered, delivered_json_bytes: deliveredBytes,
          accepted_snapshots: run.acceptedSnapshots, rejected_snapshots: run.rejectedSnapshots,
          underflow_episodes: run.underflowEpisodes, measured_underflow_episodes: run.measuredUnderflowEpisodes,
          arrival_interval_sd_ms: run.arrivalIntervalSdMs,
          motion_p95: run.motion.p95, zero_motion_fraction: run.zeroMotionFraction,
          source_age_mean_ms_model: run.sourceAgeMsModel.mean, source_age_p95_ms_model: run.sourceAgeMsModel.p95,
          same_tick_error_p95: run.sameTickBallError.p95, display_cpu_p95_ms: run.displayCpuMs.p95 });
      }
    }
  }
}

if (new Set(replayHashes).size !== 1) throw new Error('Identical core replay inputs did not reproduce identical state hashes');
const clockPolicy = [STEP_MS, 1000 / 30, 250, 5000].map((elapsedMs) => {
  let calls = 0;
  const result = advanceClock(createClock(), elapsedMs, () => { calls++; });
  return { suppliedElapsedMs: elapsedMs, stepCalls: calls, reportedSteps: result.steps, droppedMs: result.droppedMs, alpha: result.alpha };
});
const sourcePaths = ['shared/game-core.ts', 'shared/fixed-clock.ts', 'shared/protocol.ts',
  'frontend/src/arcade/snapshot-buffer.ts', 'scripts/measure-arcade.ts'];
const sourceHashes = Object.fromEntries(sourcePaths.map((path) => [path, sha256(readFileSync(resolve(root, path)))]));
const metadata = {
  generatedAtUtc: new Date().toISOString(), node: process.version, os: platform(), release: release(), architecture: arch(),
  cpuModel: cpus()[0]?.model, cpuCount: cpus().length, loadAverageAtEnd: loadavg(),
  gitHead: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  sourceHashes, combinedSourceHash: sha256(JSON.stringify(sourceHashes)),
  seed: SEED, config: createGame().config, repeats: REPEATS, warmupMsModel: WARMUP_MS,
  measuredMsModel: MEASURE_MS, renderHzModel: 60, inputTraceSha256: sha256(JSON.stringify(inputs)),
  replayStateHashes: replayHashes, finalReplay: { tick: finalState.tick, phase: finalState.phase,
    leftScore: finalState.players.left.score, rightScore: finalState.players.right.score },
  scope: 'Application snapshot-delivery model; nominal RTT is only a label whose half is applied to snapshot delivery. No uplink, real socket, TCP, Canvas, RAF or physical display timing is measured.',
  cpuScope: 'Wall-clock performance.now around actual Node pure-core stepGame and buffer.display calls. Warmup is 120 virtual simulation ticks; other host processes are not controlled.',
};
const aggregates = scenarios.flatMap((scenario) => scenario.downlinks.flatMap((viewer) => modes.map((mode) => {
  const runs = allRuns.filter((run) => run.scenario === scenario.name && run.viewer === viewer.viewer && run.mode === mode);
  const mean = (select: (run: any) => number) => runs.reduce((sum, run) => sum + select(run), 0) / runs.length;
  return { scenario: scenario.name, viewer: viewer.viewer, mode, repeats: runs.length,
    motionP95Mean: mean((run) => run.motion.p95), motionMaxMean: mean((run) => run.motion.max),
    sourceAgeMeanMsModel: mean((run) => run.sourceAgeMsModel.mean),
    sourceAgeP95MeanMsModel: mean((run) => run.sourceAgeMsModel.p95), sameTickErrorP95Mean: mean((run) => run.sameTickBallError.p95),
    sameTickErrorMaxMean: mean((run) => run.sameTickBallError.max),
    zeroMotionFractionMean: mean((run) => run.zeroMotionFraction), underflowEpisodesMean: mean((run) => run.underflowEpisodes),
    measuredUnderflowEpisodesMean: mean((run) => run.measuredUnderflowEpisodes),
    deliveredJsonBytesMean: mean((run) => run.deliveredJsonBytes), displayCpuP95MeanMs: mean((run) => run.displayCpuMs.p95) };
})));
mkdirSync(output, { recursive: true });
writeFileSync(resolve(output, 'frames.csv'), csv(frameRows));
writeFileSync(resolve(output, 'packets.csv'), csv(packetRows));
writeFileSync(resolve(output, 'simulation-steps.csv'), csv(stepRows));
writeFileSync(resolve(output, 'scenario-runs.csv'), csv(runRows));
writeFileSync(resolve(output, 'input-trace.json'), JSON.stringify({ seed: SEED, config: metadata.config, inputs }, null, 2) + '\n');
writeFileSync(resolve(output, 'clock-policy.json'), JSON.stringify(clockPolicy, null, 2) + '\n');
writeFileSync(resolve(output, 'summary.json'), JSON.stringify({ metadata, simulationCpuMs: stats(allStepTimes), aggregates, runs: allRuns }, null, 2) + '\n');
console.log(JSON.stringify({ output: 'docs/arcade-upgrade/measurements', scenarios: scenarios.length,
  displayRuns: allRuns.length, frameRows: frameRows.length, packetRows: packetRows.length,
  coreReplayHashesMatch: true, simulationCpuMs: stats(allStepTimes), aggregates }, null, 2));
