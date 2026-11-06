import {
  SCHEMA_VERSION,
  statusFor,
  validateProjection,
} from "../contracts/p03-v1/contract.mjs";
import { releasedFixture } from "./fixture.mjs";

const empty = (sceneId, generation, state, statusCode) =>
  validateProjection({
    schemaVersion: SCHEMA_VERSION,
    sceneId,
    generation,
    state,
    map: null,
    releasedMarkers: [],
    releasedImage: null,
    statusCode,
  });

export class PassiveProjectionChannel {
  #projection = empty("scene_none", 0, "blank", "NO_FOCUS");
  #listeners = new Set();
  #timers = new Set();
  #messages = [];
  #sinkTouches = [];

  readProjection(role) {
    this.#requirePassive(role);
    return this.#projection;
  }

  readCoreStatus(role) {
    this.#requirePassive(role);
    return statusFor(this.#projection);
  }

  subscribe(role, listener) {
    this.#requirePassive(role);
    if (typeof listener !== "function") throw new Error("LISTENER_REQUIRED");
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  focus({ sceneId, knowledgePercent, delayMs = 0, failure = null }) {
    const generation = this.#projection.generation + 1;
    this.#publish(empty(sceneId, generation, "blank", "LOADING"));
    const reply = async () => {
      let candidate;
      try {
        if (failure) throw new Error(failure);
        const released = releasedFixture(sceneId, knowledgePercent);
        candidate = validateProjection({
          schemaVersion: SCHEMA_VERSION,
          sceneId,
          generation,
          state: "ready",
          ...released,
          statusCode: "READY",
        });
      } catch {
        candidate = empty(
          sceneId,
          generation,
          "error",
          "PROJECTION_UNAVAILABLE",
        );
      }
      if (generation !== this.#projection.generation) return false;
      this.#publish(candidate);
      return true;
    };
    if (delayMs === 0) return Promise.resolve(reply());
    return new Promise((resolve) => {
      const timer = setTimeout(async () => {
        this.#timers.delete(timer);
        resolve(await reply());
      }, delayMs);
      this.#timers.add(timer);
    });
  }

  recordDeniedSink(kind) {
    this.#sinkTouches.push(String(kind).slice(0, 48));
  }

  evidence() {
    return Object.freeze({
      messages: Object.freeze(
        this.#messages.map((entry) => Object.freeze({ ...entry })),
      ),
      deniedSinkKinds: Object.freeze([...this.#sinkTouches]),
    });
  }

  close() {
    for (const timer of this.#timers) clearTimeout(timer);
    this.#timers.clear();
    this.#listeners.clear();
  }

  #publish(value) {
    this.#projection = validateProjection(value);
    this.#messages.push({
      generation: this.#projection.generation,
      state: this.#projection.state,
      bytes: Buffer.byteLength(JSON.stringify(this.#projection)),
      canonicalPayload: JSON.stringify(this.#projection),
    });
    for (const listener of this.#listeners) listener(this.#projection);
  }

  #requirePassive(role) {
    if (role !== "passive-display") throw new Error("ROLE_DENIED");
  }
}
