import { readFileSync, readdirSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const model = "src/editor/model/";
const render = "src/editor/render/";
const production = (file) =>
  /\.[cm]?[jt]sx?$/.test(file) &&
  !/\.(test|spec|typechecks)\.[^.]+$/.test(file);
const normalize = (file) => file.replaceAll("\\", "/");

/** Read module edges structurally, including re-exports and lazy/type imports. */
export function imports(file, source) {
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const edges = [];
  function add(node, argument) {
    const line =
      tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1;
    edges.push({
      specifier:
        argument && ts.isStringLiteralLike(argument) ? argument.text : null,
      line,
    });
  }
  function visit(node) {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier
    )
      add(node, node.moduleSpecifier);
    else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference)
    )
      add(node, node.moduleReference.expression);
    else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument))
      add(node, node.argument.literal);
    else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) &&
          node.expression.text === "require"))
    )
      add(node, node.arguments[0]);
    ts.forEachChild(node, visit);
  }
  visit(tree);
  return edges;
}

/** Resolve against the actual tsconfig so aliases cannot bypass a boundary. */
export function inspectArchitecture(root, sources, options) {
  const errors = [];
  const graph = new Map();
  const resolveImport = (file, specifier) => {
    const result = ts.resolveModuleName(
      specifier,
      resolve(root, file),
      options,
      ts.sys,
    ).resolvedModule;
    return result ? normalize(relative(root, result.resolvedFileName)) : null;
  };
  for (const [file, source] of sources) {
    if (!production(file)) continue;
    const protectedCore = file.startsWith(model);
    const protectedRender = file.startsWith(render);
    for (const edge of imports(file, source)) {
      if (!protectedCore && !protectedRender) continue;
      const target =
        edge.specifier === null ? null : resolveImport(file, edge.specifier);
      if (edge.specifier === null) {
        errors.push(
          `${file}:${edge.line}: computed module loading is not allowed inside model/render boundaries`,
        );
      } else if (
        protectedCore &&
        (!target?.startsWith(model) || !production(target))
      ) {
        errors.push(
          `${file}:${edge.line}: model must depend only on production model modules: ${edge.specifier}`,
        );
      } else if (
        protectedRender &&
        !(
          (target &&
            production(target) &&
            (target.startsWith(model) ||
              target.startsWith(render) ||
              [
                "src/editor/budgets.ts",
                "src/editor/observation.ts",
                "src/editor/ComputeJobs.ts",
              ].includes(target))) ||
          /^(pixi\.js)(\/|$)/.test(edge.specifier)
        )
      ) {
        errors.push(
          `${file}:${edge.line}: renderer must not import outside render/model, budgets, observation, ComputeJobs or Pixi: ${edge.specifier}`,
        );
      }
    }
    // Declaration modules have no executable output.
    if (/\.d\.[cm]?ts$/.test(file)) {
      graph.set(file, []);
      continue;
    }
    // Type-only and erased imports do not create runtime initialization cycles.
    const emitted = ts.transpileModule(source, {
      fileName: file,
      compilerOptions: {
        ...options,
        module: ts.ModuleKind.ESNext,
        noEmit: false,
      },
    }).outputText;
    graph.set(
      file,
      imports(file, emitted).flatMap(({ specifier }) => {
        const target =
          specifier === null ? null : resolveImport(file, specifier);
        return target && sources.has(target) && production(target)
          ? [target]
          : [];
      }),
    );
  }
  const visited = new Set();
  const active = new Set();
  const stack = [];
  function visit(file) {
    if (active.has(file)) {
      errors.push(
        `runtime dependency cycle: ${[...stack.slice(stack.indexOf(file)), file].join(" -> ")}`,
      );
      return;
    }
    if (visited.has(file)) return;
    visited.add(file);
    active.add(file);
    stack.push(file);
    for (const target of graph.get(file) ?? []) visit(target);
    stack.pop();
    active.delete(file);
  }
  for (const file of graph.keys()) visit(file);
  return errors;
}

export function checkArchitecture(root) {
  const config = ts.readConfigFile(
    resolve(root, "tsconfig.json"),
    ts.sys.readFile,
  );
  if (config.error)
    throw new Error(
      ts.flattenDiagnosticMessageText(config.error.messageText, "\n"),
    );
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
  if (parsed.errors.length)
    throw new Error(
      parsed.errors
        .map((e) => ts.flattenDiagnosticMessageText(e.messageText, "\n"))
        .join("\n"),
    );
  const sources = new Map();
  function read(directory) {
    for (const entry of readdirSync(resolve(root, directory), {
      withFileTypes: true,
    })) {
      const file = `${directory}/${entry.name}`;
      if (entry.isDirectory()) read(file);
      else if (production(file))
        sources.set(file, readFileSync(resolve(root, file), "utf8"));
    }
  }
  read("src");
  if (
    ![...sources.keys()].some((file) => file.startsWith(model)) ||
    ![...sources.keys()].some((file) => file.startsWith(render))
  )
    throw new Error(
      "Expected model and render modules are missing; review architecture boundaries explicitly.",
    );
  return inspectArchitecture(root, sources, parsed.options);
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const errors = checkArchitecture(
    resolve(dirname(fileURLToPath(import.meta.url)), ".."),
  );
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  } else
    console.log("Architecture boundaries and runtime dependency graph passed.");
}
