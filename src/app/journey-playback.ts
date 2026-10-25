export const journeySpeeds = [1, 2, 5, 10] as const;
export type JourneySpeed = (typeof journeySpeeds)[number];
export interface PlaybackFrame {
  key: string;
  revision: number;
  nextIndex: number;
  seconds: number;
}
interface PlaybackPorts {
  read(): PlaybackFrame | null;
  step(basis: PlaybackFrame): Promise<boolean>;
  changed(): void;
  now?: () => number;
  later?: (run: () => void, delay: number) => ReturnType<typeof setTimeout>;
  cancel?: (timer: ReturnType<typeof setTimeout>) => void;
}
/** A presentation timer; the existing checkpoint command alone owns position and time. */
export function journeyPlayback(ports: PlaybackPorts) {
  const now = ports.now ?? (() => performance.now()),
    later = ports.later ?? setTimeout,
    cancel = ports.cancel ?? clearTimeout;
  let speed: JourneySpeed = 1,
    running = false,
    basis: PlaybackFrame | null = null,
    timer: ReturnType<typeof setTimeout> | null = null,
    remaining = 0,
    mark = 0,
    generation = 0,
    task: Promise<void> | null = null;
  const same = (a: PlaybackFrame | null, b: PlaybackFrame | null) =>
    !!a && !!b && a.key === b.key && a.revision === b.revision && a.nextIndex === b.nextIndex;
  function clear() {
    if (timer !== null) cancel(timer);
    timer = null;
  }
  function stop() {
    generation++;
    running = false;
    basis = null;
    clear();
    ports.changed();
  }
  function elapsed() {
    if (running) {
      const t = now();
      remaining = Math.max(0, remaining - (t - mark) * speed);
      mark = t;
    }
  }
  function sync() {
    if (running && !task && !same(basis, ports.read())) stop();
    return running;
  }
  function arm() {
    clear();
    if (!sync()) return;
    timer = later(tick, Math.max(4, Math.min(60000, remaining / speed)));
    ports.changed();
  }
  function tick() {
    timer = null;
    if (!sync() || !basis) return;
    elapsed();
    if (remaining > 0) {
      arm();
      return;
    }
    const expected = basis,
      epoch = generation;
    const operation = Promise.resolve().then(async () => {
      try {
        if (!running || generation !== epoch || !same(expected, ports.read())) return;
        const ok = await ports.step(expected);
        if (generation !== epoch || !running) return;
        const next = ports.read();
        if (
          !ok ||
          !next ||
          next.key !== expected.key ||
          next.nextIndex !== expected.nextIndex + 1
        ) {
          stop();
          return;
        }
        basis = next;
        remaining = next.seconds / 3.6;
        mark = now();
      } catch {
        stop();
      } finally {
        if (task === operation) {
          task = null;
          if (running) arm();
          else ports.changed();
        }
      }
    });
    task = operation;
    ports.changed();
  }
  return {
    stop,
    sync,
    play() {
      if (task) return false;
      const current = ports.read();
      if (!current) return false;
      generation++;
      running = true;
      basis = current;
      remaining = current.seconds / 3.6;
      mark = now();
      arm();
      return true;
    },
    setSpeed(next: JourneySpeed) {
      if (!journeySpeeds.includes(next)) throw new Error('Wiedergabe: 1×, 2×, 5× oder 10× wählen.');
      elapsed();
      speed = next;
      if (running && !task) arm();
      else ports.changed();
    },
    get speed() {
      return speed;
    },
    get running() {
      return running;
    },
    get busy() {
      return task !== null;
    },
    settled() {
      return task ?? Promise.resolve();
    },
  };
}
