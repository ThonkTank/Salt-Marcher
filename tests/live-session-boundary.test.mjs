import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const ROOT = new URL("../src/features/live-session/", import.meta.url);
const ALLOWED_STATIC_IMPORTS = new Set(["./contracts", "./ids", "./projections"]);

function importsIn(source, file = "module.ts") {
  const tree = ts.createSourceFile(
      file,
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    ),
    imports = [];
  assert.deepEqual(
    tree.parseDiagnostics,
    [],
    `${file} must parse before its imports can be checked`,
  );
  function visit(node) {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier
    ) {
      assert(ts.isStringLiteral(node.moduleSpecifier), `${file} has a nonliteral module specifier`);
      imports.push({ kind: "static", specifier: node.moduleSpecifier.text });
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference)
    ) {
      imports.push({ kind: "import-equals", specifier: "require" });
    } else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === "require"))
    ) {
      const argument = node.arguments[0];
      imports.push({
        kind:
          node.expression.kind === ts.SyntaxKind.ImportKeyword
            ? "dynamic-import"
            : "require",
        specifier: ts.isStringLiteral(argument) ? argument.text : "<nonliteral>",
      });
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  return imports;
}

function assertLocalStaticImports(source, file = "module.ts") {
  for (const dependency of importsIn(source, file)) {
    assert.equal(
      dependency.kind,
      "static",
      `${file} uses forbidden ${dependency.kind} dependency ${dependency.specifier}`,
    );
    assert(
      ALLOWED_STATIC_IMPORTS.has(dependency.specifier),
      `${file} imports forbidden dependency ${dependency.specifier}`,
    );
  }
}

test("live-session core has no host, persistence or player-display surface", async () => {
  const files = (await readdir(ROOT)).filter((file) => file.endsWith(".ts"));
  assert.deepEqual(files.sort(), ["contracts.ts", "ids.ts", "index.ts", "projections.ts"]);
  const sources = await Promise.all(
    files.map(async (file) => [file, await readFile(new URL(file, ROOT), "utf8")]),
  );
  for (const [file, source] of sources) {
    assertLocalStaticImports(source, file);
    assert.doesNotMatch(
      source,
      /\b(?:PlayerProjection|PassiveDisplay|SecondWindow|MapRepository|VaultStore)\b/,
      `${file} exposes a forbidden consumer or host type`,
    );
  }
});

test("live-session dependency guard rejects every privileged import form", () => {
  for (const [name, source] of [
    ["node-prefix", 'import { readFile } from "node:fs";'],
    ["node-bare", 'import fs from "fs";'],
    ["electron", 'export { app } from "electron";'],
    ["obsidian-side-effect", 'import "obsidian";'],
    ["dynamic", 'const module = import("./ids");'],
    ["require", 'const module = require("./ids");'],
    ["import-equals", 'import module = require("node:path");'],
  ])
    assert.throws(
      () => assertLocalStaticImports(source, `${name}.ts`),
      /forbidden/,
      name,
    );

  assert.doesNotThrow(() =>
    assertLocalStaticImports(
      'import type { CampaignId } from "./ids"; export { revision } from "./ids";',
      "allowed.ts",
    ),
  );
});
