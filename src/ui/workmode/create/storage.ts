// src/ui/workmode/create/storage.ts
// Helpers for serializing and persisting declarative create modal payloads.
import { normalizePath, stringifyYaml, TFile, type App } from "obsidian";
import type { PersistResult, SerializedPayload, StorageSpec } from "./types";

function slugify(value: string): string {
  const trimmed = value.trim().toLowerCase();
  const replaced = trimmed
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
  return replaced || "entry";
}

function ensureExtension(path: string, extension: string): string {
  if (path.toLowerCase().endsWith(`.${extension}`)) return path;
  return `${path}.${extension}`;
}

function applyTemplate(template: string, replacements: Record<string, string>): string {
  return template.replace(/\{([^}]+)\}/g, (_, key) => {
    const replacement = replacements[key];
    return replacement ?? "";
  });
}

function collectReplacements(values: Record<string, unknown>): Record<string, string> {
  const map: Record<string, string> = {};
  for (const [key, raw] of Object.entries(values)) {
    if (raw == null) continue;
    map[key] = typeof raw === "string" ? raw : String(raw);
  }
  if (values.name) {
    map.slug = slugify(String(values.name));
    map.name = String(values.name);
  }
  return map;
}

function resolveTargetPath(storage: StorageSpec, values: Record<string, unknown>): string {
  const replacements = collectReplacements(values);
  const filenameSource = values[storage.filenameFrom];
  const slug = typeof filenameSource === "string" ? slugify(filenameSource) : slugify(String(filenameSource ?? "entry"));
  replacements.slug = slug;
  replacements.filename = slug;
  const templatePath = applyTemplate(storage.pathTemplate, replacements);
  const extension =
    storage.format === "md-frontmatter" || storage.format === "codeblock"
      ? "md"
      : storage.format === "json"
        ? "json"
        : "yaml";
  const target = ensureExtension(templatePath, extension);
  if (storage.directory) {
    const sanitizedDir = normalizePath(storage.directory);
    const fileName = target.split("/").pop() ?? target;
    return normalizePath(`${sanitizedDir}/${fileName}`);
  }
  return normalizePath(target);
}

function buildFrontmatter(values: Record<string, unknown>, storage: StorageSpec): Record<string, unknown> {
  const frontmatter: Record<string, unknown> = {};
  if (Array.isArray(storage.frontmatter)) {
    for (const key of storage.frontmatter) {
      if (values[key] !== undefined) {
        frontmatter[key] = values[key];
      }
    }
  } else if (storage.frontmatter) {
    for (const [fieldId, fmKey] of Object.entries(storage.frontmatter)) {
      if (values[fieldId] !== undefined) {
        frontmatter[fmKey] = values[fieldId];
      }
    }
  }
  if (!("name" in frontmatter) && typeof values.name === "string") {
    frontmatter.name = values.name;
  }
  return frontmatter;
}

function buildMarkdownBody(values: Record<string, unknown>, storage: StorageSpec): string {
  if (storage.bodyTemplate) {
    return storage.bodyTemplate(values as Record<string, any>);
  }
  if (storage.bodyFields?.length) {
    const parts: string[] = [];
    for (const fieldId of storage.bodyFields) {
      const value = values[fieldId];
      if (value == null) continue;
      if (typeof value === "string") {
        parts.push(value);
      } else if (Array.isArray(value)) {
        parts.push(value.join(", "));
      } else {
        parts.push(String(value));
      }
    }
    return parts.join("\n\n");
  }
  return "";
}

function serializeMarkdown(storage: StorageSpec, values: Record<string, unknown>, path: string): SerializedPayload {
  const frontmatter = buildFrontmatter(values, storage);
  const body = buildMarkdownBody(values, storage);
  const fm = stringifyYaml(frontmatter ?? {});
  const content = [`---`, fm.trimEnd(), `---`, "", body.trimEnd()].join("\n").trimEnd() + "\n";
  return { path, content, metadata: { frontmatter, format: storage.format } };
}

function serializeJson(values: Record<string, unknown>, path: string): SerializedPayload {
  const content = JSON.stringify(values, null, 2) + "\n";
  return { path, content, metadata: { format: "json" } };
}

function serializeYaml(values: Record<string, unknown>, path: string): SerializedPayload {
  const content = stringifyYaml(values ?? {}) + "\n";
  return { path, content, metadata: { format: "yaml" } };
}

function serializeCodeblock(storage: StorageSpec, values: Record<string, unknown>, path: string): SerializedPayload {
  if (!storage.blockRenderer) {
    throw new Error("Codeblock storage requires a blockRenderer definition");
  }
  const raw = storage.blockRenderer.serialize(values);
  const content = typeof raw === "string" ? raw.trim() : String(raw ?? "");
  return {
    path,
    content,
    metadata: {
      format: "codeblock",
      language: storage.blockRenderer.language,
      values,
    },
  };
}

export function buildSerializedPayload(storage: StorageSpec, values: Record<string, unknown>): SerializedPayload {
  const path = resolveTargetPath(storage, values);
  switch (storage.format) {
    case "json":
      return serializeJson(values, path);
    case "yaml":
      return serializeYaml(values, path);
    case "codeblock":
      return serializeCodeblock(storage, values, path);
    case "md-frontmatter":
    default:
      return serializeMarkdown(storage, values, path);
  }
}

function ensureFolder(app: App, path: string): Promise<void> {
  const parts = path.split("/");
  parts.pop();
  const folder = parts.join("/");
  if (!folder) return Promise.resolve();
  const normalized = normalizePath(folder);
  const existing = app.vault.getAbstractFileByPath(normalized);
  if (existing) return Promise.resolve();
  return app.vault.createFolder(normalized).catch(() => {});
}

function toContentString(content: string | Record<string, unknown>): string {
  if (typeof content === "string") return content;
  return JSON.stringify(content, null, 2);
}

export async function persistSerializedPayload(
  app: App,
  storage: StorageSpec,
  payload: SerializedPayload,
): Promise<PersistResult> {
  await storage.hooks?.ensureDirectory?.(app);
  await ensureFolder(app, payload.path);
  const metadata = payload.metadata as { values?: Record<string, unknown> } | undefined;
  await storage.hooks?.beforeWrite?.(payload, { app, values: metadata?.values });
  const existing = app.vault.getAbstractFileByPath(payload.path);
  let file: TFile | undefined;
  const content = toContentString(payload.content);
  if (storage.format === "codeblock") {
    if (!storage.blockRenderer) {
      throw new Error("Codeblock storage requires a blockRenderer definition");
    }
    const language = storage.blockRenderer.language;
    const fence = "```";
    const blockRegex = new RegExp(`^\\s*${fence}${language}(?:\\s|$)[\\s\\S]*?${fence}`, "im");
    const normalizedBlock = content.trim();
    const blockWithNewline = normalizedBlock.endsWith("\\n") ? normalizedBlock : `${normalizedBlock}\\n`;
    if (existing instanceof TFile) {
      const current = await app.vault.read(existing);
      const trimmedCurrent = current.trimEnd();
      const replacement = blockWithNewline.trimEnd();
      const hasBlock = blockRegex.test(current);
      const next = hasBlock
        ? current.replace(blockRegex, replacement)
        : `${trimmedCurrent}\\n\\n${replacement}`;
      await app.vault.modify(existing, next.trimEnd() + "\\n");
      file = existing;
    } else {
      const initial = storage.bodyTemplate
        ? storage.bodyTemplate({ ...(payload.metadata?.values as Record<string, unknown> ?? {}), block: blockWithNewline })
        : blockWithNewline;
      file = await app.vault.create(payload.path, initial.endsWith("\\n") ? initial : `${initial}\\n`);
    }
  } else {
    if (existing instanceof TFile) {
      await app.vault.modify(existing, content);
      file = existing;
    } else {
      file = await app.vault.create(payload.path, content);
    }
  }
  const result: PersistResult = { filePath: payload.path, file };
  await storage.hooks?.afterWrite?.(result);
  return result;
}
