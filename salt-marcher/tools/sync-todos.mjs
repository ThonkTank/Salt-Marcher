// salt-marcher/tools/sync-todos.mjs
// Sammelt ToDos aus allen AGENTS-Dateien und aktualisiert oder prüft die zentrale TODO.md.
import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const TOOL_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TOOL_DIR, "..", "..");
const TODO_PATH = path.join(REPO_ROOT, "TODO.md");
const AGENT_FILE_NAME = "AGENTS.md";
const IGNORED_DIRECTORIES = new Set(["node_modules", ".git", ".obsidian", ".idea", ".vscode", "dist", "build"]);
const PRIORITY_SECTIONS = new Map([
    [0, "Fehlerbehebung"],
    [1, "Funktionalität absichern"],
    [2, "Robustheit & Wartbarkeit"],
    [3, "Neue Features"],
    [4, "User Experience verbessern"],
    [5, "Weitere Aufgaben"],
]);

/** @typedef {{ sourcePath: string; description: string; major: number; minor?: number }} AgentTodo */

async function collectAgentFiles(root) {
    const entries = await fs.readdir(root, { withFileTypes: true });
    const files = [];

    for (const entry of entries) {
        if (entry.name.startsWith(".")) {
            if (entry.name === "." || entry.name === "..") {
                continue;
            }
        }

        const absolute = path.join(root, entry.name);

        if (entry.isDirectory()) {
            if (IGNORED_DIRECTORIES.has(entry.name) || entry.name.startsWith(".")) {
                continue;
            }
            const nested = await collectAgentFiles(absolute);
            files.push(...nested);
            continue;
        }

        if (!entry.isFile()) {
            continue;
        }

        if (entry.name === AGENT_FILE_NAME) {
            files.push(absolute);
        }
    }

    return files;
}

function parseAgentTodos(content, relativePath) {
    const lines = content.split(/\r?\n/);
    const todos = [];
    let inTodoSection = false;

    for (const rawLine of lines) {
        const line = rawLine.trim();

        if (line.startsWith("#")) {
            const heading = line.replace(/^#+\s*/, "").toLowerCase();
            if (heading === "todo") {
                inTodoSection = true;
                continue;
            }

            if (inTodoSection) {
                break;
            }
        }

        if (!inTodoSection) {
            continue;
        }

        if (!line.startsWith("-") && !line.startsWith("*")) {
            continue;
        }

        const item = line.replace(/^[-*]\s+/, "");
        if (item.length === 0) {
            continue;
        }

        if (/keine offenen todos?/i.test(item)) {
            continue;
        }

        const match = item.match(/^\[P(?<priority>\d+(?:\.\d+)?)\]\s*(?<description>.+)$/i);
        if (!match || !match.groups) {
            throw new Error(`Fehlender Prioritätsmarker in ${relativePath}: \"${item}\"`);
        }

        const priority = match.groups.priority;
        const [majorPart, minorPart] = priority.split(".");
        const major = Number(majorPart);
        if (!Number.isInteger(major) || !PRIORITY_SECTIONS.has(major)) {
            throw new Error(`Unbekannte Priorität [P${priority}] in ${relativePath}`);
        }

        let minor;
        if (minorPart !== undefined) {
            minor = Number(minorPart);
            if (!Number.isInteger(minor)) {
                throw new Error(`Ungültige Dezimalpriorität [P${priority}] in ${relativePath}`);
            }
        }

        const description = match.groups.description.trim();
        if (description.length === 0) {
            throw new Error(`Leere Aufgabenbeschreibung in ${relativePath}`);
        }

        todos.push({
            sourcePath: relativePath,
            description,
            major,
            minor,
        });
    }

    return todos;
}

function distributePriorities(todos) {
    const withMinor = todos
        .filter((todo) => todo.minor !== undefined)
        .sort((a, b) => {
            if (a.minor === b.minor) {
                return a.description.localeCompare(b.description, "de");
            }
            return /** @type {number} */ (a.minor) - /** @type {number} */ (b.minor);
        });
    const withoutMinor = todos
        .filter((todo) => todo.minor === undefined)
        .sort((a, b) => {
            if (a.sourcePath === b.sourcePath) {
                return a.description.localeCompare(b.description, "de");
            }
            return a.sourcePath.localeCompare(b.sourcePath, "de");
        });

    const used = new Set(withMinor.map((todo) => /** @type {number} */ (todo.minor)));
    let counter = 1;
    const assigned = [];

    for (const todo of withMinor) {
        assigned.push({ ...todo, order: /** @type {number} */ (todo.minor) });
    }

    for (const todo of withoutMinor) {
        while (used.has(counter)) {
            counter += 1;
        }
        used.add(counter);
        assigned.push({ ...todo, order: counter });
        counter += 1;
    }

    return assigned.sort((a, b) => {
        if (a.order === b.order) {
            return a.description.localeCompare(b.description, "de");
        }
        return a.order - b.order;
    });
}

function formatTodoFile(todos) {
    const lines = [
        "# Gesamt-ToDo-Liste",
        "",
        "Die Aufgaben sind nach Priorität sortiert. Dezimalstellen kennzeichnen die Reihenfolge innerhalb einer Prioritätsstufe.",
        "",
    ];

    for (const [major, title] of PRIORITY_SECTIONS.entries()) {
        lines.push(`## ${major}. ${title}`);
        const sectionTodos = todos.filter((todo) => todo.major === major);

        if (sectionTodos.length === 0) {
            lines.push("- keine offenen ToDos.");
            lines.push("");
            continue;
        }

        const distributed = distributePriorities(sectionTodos);
        for (const todo of distributed) {
            lines.push(`- ${major}.${todo.order} [${todo.sourcePath}] ${todo.description}`);
        }
        lines.push("");
    }

    return lines.join("\n").replace(/\n+$/, "\n");
}

async function collectTodos() {
    const agentFiles = await collectAgentFiles(REPO_ROOT);
    const todos = [];

    for (const file of agentFiles) {
        const content = await fs.readFile(file, "utf8");
        const relativePath = path.relative(REPO_ROOT, file).replace(/\\/g, "/");
        const entries = parseAgentTodos(content, relativePath);
        todos.push(...entries);
    }

    return todos.sort((a, b) => {
        if (a.major === b.major) {
            if (a.minor !== undefined && b.minor !== undefined && a.minor !== b.minor) {
                return a.minor - b.minor;
            }
            if (a.minor === undefined && b.minor !== undefined) {
                return 1;
            }
            if (a.minor !== undefined && b.minor === undefined) {
                return -1;
            }
            if (a.sourcePath === b.sourcePath) {
                return a.description.localeCompare(b.description, "de");
            }
            return a.sourcePath.localeCompare(b.sourcePath, "de");
        }
        return a.major - b.major;
    });
}

async function main() {
    const args = process.argv.slice(2);
    const checkOnly = args.includes("--check");

    const todos = await collectTodos();
    const output = formatTodoFile(todos);

    if (checkOnly) {
        const existing = await fs.readFile(TODO_PATH, "utf8");
        if (existing.replace(/\r?\n/g, "\n") !== output.replace(/\r?\n/g, "\n")) {
            console.error("TODO.md ist nicht synchron mit den AGENTS-Aufgaben. Bitte 'node salt-marcher/tools/sync-todos.mjs' ausführen.");
            process.exitCode = 1;
            return;
        }
        return;
    }

    await fs.writeFile(TODO_PATH, output, "utf8");
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
});
