import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { checkArchitecture } from "./check-architecture.mjs";

function inspect(files, compilerOptions = {}) {
  const root = mkdtempSync(join(tmpdir(), "atlas-architecture-"));
  try {
    for (const [file, text] of Object.entries({
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          moduleResolution: "bundler",
          module: "esnext",
          ...compilerOptions,
        },
        include: ["src"],
      }),
      "src/editor/model/types.ts":
        "export const value = 1; export type Value = number;",
      "src/editor/render/view.ts": 'export { value } from "../model/types";',
      "src/editor/EditorController.ts":
        "export const controller = 1; export type Controller = number;",
      ...files,
    })) {
      mkdirSync(dirname(join(root, file)), { recursive: true });
      writeFileSync(join(root, file), text);
    }
    return checkArchitecture(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const core = "src/editor/model/example.ts";
for (const source of [
  'import { controller } from "../EditorController"; export { controller };',
  'export { controller } from "../EditorController";',
  'export type { Controller } from "../EditorController";',
  'export type T = import("../EditorController").Controller;',
  'export const load = () => import("../EditorController");',
  'import adapter = require("../EditorController"); export { adapter };',
  'export const load = () => require("../EditorController");',
  'import "react";',
  'import type { X } from "electron";',
  'import "node:fs";',
])
  test(`rejects core dependency: ${source}`, () => {
    assert.match(
      inspect({ [core]: source }).join("\n"),
      /example.ts:1: model must depend only/,
    );
  });

test("resolves aliases before checking boundaries", () => {
  assert.match(
    inspect(
      { [core]: 'export { controller } from "@controller";' },
      {
        baseUrl: ".",
        paths: { "@controller": ["src/editor/EditorController.ts"] },
      },
    ).join("\n"),
    /model must depend only/,
  );
});

test("rejects computed lazy imports in protected modules", () => {
  assert.match(
    inspect({
      [core]: "export const load = (path: string) => import(path);",
    }).join("\n"),
    /computed module loading/,
  );
});

test("rejects renderer control and native dependencies, including types", () => {
  for (const source of [
    'export type { Controller } from "../EditorController";',
    'import "electron";',
    'import "better-sqlite3";',
    'import "fs";',
    'import "node:fs";',
    'import "@tauri-apps/api/core";',
  ]) {
    assert.match(
      inspect({ "src/editor/render/bad.ts": source }).join("\n"),
      /renderer must not import/,
    );
  }
});

test("allows pure calculations, render reads, type cycles and test-only imports", () => {
  assert.deepEqual(
    inspect({
      [core]:
        'import { value } from "./types"; export const twice = value * 2; // import "react"',
      "src/editor/model/a.ts":
        'import type { B } from "./b"; export type A = { b?: B };',
      "src/editor/model/b.ts":
        'import type { A } from "./a"; export type B = { a?: A };',
      "src/editor/model/example.spec.ts": 'import "vitest";',
      "src/editor/model/example.test.ts":
        'import "vitest"; import "../EditorController";',
    }),
    [],
  );
});

test("rejects a runtime cycle across ordinary UI modules and re-exports", () => {
  assert.match(
    inspect({
      "src/a.ts": 'export { b } from "./b"; export const a = 1;',
      "src/b.ts": 'import { a } from "./a"; export const b = a + 1;',
    }).join("\n"),
    /runtime dependency cycle: src\/a.ts -> src\/b.ts -> src\/a.ts/,
  );
});

test("does not interpret import-looking strings as dependencies", () => {
  assert.deepEqual(
    inspect({ [core]: `export const example = 'import "electron"';` }),
    [],
  );
});

test("rejects production core imports of test modules", () => {
  assert.match(
    inspect({
      [core]: 'import "./helper.test";',
      "src/editor/model/helper.test.ts": "export {};",
    }).join("\n"),
    /model must depend only/,
  );
});

test("allows rendering infrastructure without admitting arbitrary helpers", () => {
  assert.deepEqual(
    inspect({
      "src/editor/budgets.ts": "export const limit = 1;",
      "src/editor/render/allowed.ts":
        'import "pixi.js"; export { limit } from "../budgets";',
    }),
    [],
  );
  assert.match(
    inspect({
      "src/editor/helper.ts": "export const helper = 1;",
      "src/editor/render/bad.ts": 'export { helper } from "../helper";',
    }).join("\n"),
    /renderer must not import/,
  );
});

test("handles declaration modules without inventing runtime edges", () => {
  assert.deepEqual(
    inspect({
      "src/editor/model/declarations.d.ts":
        'import type { Value } from "./types"; export declare const declared: Value;',
    }),
    [],
  );
  assert.match(
    inspect({
      "src/editor/model/declarations.d.ts":
        'export type { Controller } from "../EditorController";',
    }).join("\n"),
    /model must depend only/,
  );
});
