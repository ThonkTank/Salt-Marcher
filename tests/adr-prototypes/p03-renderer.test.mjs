import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { parseHTML } from "linkedom";

const root = fileURLToPath(new URL("../../", import.meta.url));
const html = await readFile(
  path.join(root, "tools", "adr-prototypes", "p03", "passive.html"),
  "utf8",
);
const script = await readFile(
  path.join(root, "tools", "adr-prototypes", "p03", "passive-renderer.js"),
  "utf8",
);

const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

const projection = ({
  generation,
  sceneId,
  state = "ready",
  image = true,
}) => ({
  generation,
  sceneId,
  state,
  map:
    state === "ready"
      ? {
          label: `Scene ${sceneId}`,
          backgroundColor: "#112233",
          gridColor: "#445566",
        }
      : null,
  releasedMarkers: [],
  releasedImage:
    state === "ready" && image
      ? {
          id: `image_${sceneId}`,
          alt: `Released ${sceneId}`,
          color: "#778899",
          accentColor: "#aabbcc",
        }
      : null,
  statusCode: state === "ready" ? "READY" : "LOADING",
});

function harness(initialRead) {
  const { window, document } = parseHTML(html);
  let listener;
  window.partyDisplay = {
    readProjection: () => initialRead,
    subscribeProjectionChanged: (value) => {
      listener = value;
      return () => {};
    },
    readCoreStatus: () => Promise.resolve(null),
  };
  vm.runInContext(script, vm.createContext({ window, document }));
  return { document, publish: (value) => listener(value) };
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

test("P03 renderer never lets a delayed initial read replace a newer event", async () => {
  const initial = deferred();
  const view = harness(initial.promise);
  view.publish(projection({ generation: 2, sceneId: "new" }));
  initial.resolve(projection({ generation: 1, sceneId: "old" }));
  await flush();
  assert.equal(view.document.documentElement.dataset.generation, "2");
  assert.equal(
    view.document.querySelector("#scene-heading").textContent,
    "Scene new",
  );
});

test("P03 renderer rejects same-generation ready-to-blank regression", async () => {
  const view = harness(
    Promise.resolve(projection({ generation: 3, sceneId: "a" })),
  );
  await flush();
  view.publish(projection({ generation: 3, sceneId: "a", state: "blank" }));
  assert.equal(view.document.documentElement.dataset.projectionState, "ready");
  assert.equal(
    view.document.querySelector("#scene-heading").textContent,
    "Scene a",
  );
});

test("P03 renderer clears released art when the next ready scene has none", async () => {
  const view = harness(
    Promise.resolve(projection({ generation: 1, sceneId: "a" })),
  );
  await flush();
  const art = view.document.querySelector("#art");
  assert.equal(art.getAttribute("aria-label"), "Released a");
  assert.equal(art.style.backgroundColor, "#778899");
  view.publish(projection({ generation: 2, sceneId: "b", image: false }));
  assert.equal(art.getAttribute("aria-label"), "No released art");
  assert.equal(art.getAttribute("style"), null);
});
