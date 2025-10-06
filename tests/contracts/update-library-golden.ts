// salt-marcher/tests/contracts/update-library-golden.ts
// Generiert Golden-Files für Library-Serializer-Roundtrips basierend auf dem Vertragstest-Harness.
import { createHash } from "node:crypto";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createLibraryHarness } from "./library-harness";
import { libraryFixtures } from "./library-fixtures";
import {
    CREATURES_DIR,
} from "../../src/apps/library/core/creature-files";
import {
    EQUIPMENT_DIR,
} from "../../src/apps/library/core/equipment-files";
import { ITEMS_DIR } from "../../src/apps/library/core/item-files";
import {
    SPELL_PRESETS_DIR,
    spellPresetToMarkdown,
} from "../../src/apps/library/core/spell-presets";
import { sanitizeVaultFileName } from "../../src/apps/library/core/file-pipeline";

type DomainKey = "creatures" | "items" | "equipment" | "spells";

type ManifestEntry = {
    fixtureId: string;
    name: string;
    storagePath: string;
    goldenFile: string;
    checksum: string;
};

type GoldenManifest = {
    schemaVersion: number;
    domain: DomainKey;
    generatedBy: string;
    generatedAt: string;
    owner: string;
    samples: ManifestEntry[];
};

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const GOLDEN_ROOT = path.resolve(__dirname, "../golden/library");

function sha256(input: string): string {
    return createHash("sha256").update(input, "utf8").digest("hex");
}

async function cleanupDomainDir(dir: string): Promise<void> {
    await mkdir(dir, { recursive: true });
    const files = await readdir(dir);
    await Promise.all(
        files
            .filter(file => file.endsWith(".md") || file === ".manifest.json")
            .map(file => rm(path.join(dir, file)))
    );
}

async function writeManifest(dir: string, manifest: GoldenManifest): Promise<void> {
    const manifestPath = path.join(dir, ".manifest.json");
    const contents = `${JSON.stringify(manifest, null, 4)}\n`;
    await writeFile(manifestPath, contents, "utf8");
}

async function main(): Promise<void> {
    const harness = createLibraryHarness({ fixtures: libraryFixtures });
    await harness.reset();

    const serializer = harness.ports.serializer;

    const domainConfigs: Array<{
        key: DomainKey;
        directory: string;
        fallback: string;
        owner: string;
        serialize: (entry: any) => string;
        fixtures: Array<{ fixtureId: string; name?: string }>;
    }> = [
        {
            key: "creatures",
            directory: CREATURES_DIR,
            fallback: "Creature",
            owner: libraryFixtures.creatures.owner,
            serialize: entry => serializer.creatureToMarkdown(entry),
            fixtures: libraryFixtures.creatures.entries,
        },
        {
            key: "items",
            directory: ITEMS_DIR,
            fallback: "Item",
            owner: libraryFixtures.items.owner,
            serialize: entry => serializer.itemToMarkdown(entry),
            fixtures: libraryFixtures.items.entries,
        },
        {
            key: "equipment",
            directory: EQUIPMENT_DIR,
            fallback: "Equipment",
            owner: libraryFixtures.equipment.owner,
            serialize: entry => serializer.equipmentToMarkdown(entry),
            fixtures: libraryFixtures.equipment.entries,
        },
        {
            key: "spells",
            directory: SPELL_PRESETS_DIR,
            fallback: "Spell Preset",
            owner: libraryFixtures.spellPresets.owner,
            serialize: entry => spellPresetToMarkdown(entry, { fixtureId: entry.fixtureId }),
            fixtures: libraryFixtures.spellPresets.entries,
        },
    ];

    for (const config of domainConfigs) {
        const domainDir = path.join(GOLDEN_ROOT, config.key);
        await cleanupDomainDir(domainDir);

        const samples: ManifestEntry[] = [];
        for (const entry of config.fixtures) {
            const goldenFile = `${entry.fixtureId}.md`;
            const goldenPath = path.join(domainDir, goldenFile);
            const name = entry.name ?? entry.fixtureId;
            const content = config.serialize(entry);
            await writeFile(goldenPath, content, "utf8");

            const sanitizedName = sanitizeVaultFileName(name, config.fallback);
            const storagePath = path.posix.join(config.directory, `${sanitizedName}.md`);

            samples.push({
                fixtureId: entry.fixtureId,
                name,
                storagePath,
                goldenFile,
                checksum: sha256(content),
            });
        }

        samples.sort((a, b) => a.fixtureId.localeCompare(b.fixtureId));

        const manifest: GoldenManifest = {
            schemaVersion: 1,
            domain: config.key,
            generatedBy: "LIB-TD-0002",
            generatedAt: new Date().toISOString(),
            owner: config.owner,
            samples,
        };

        await writeManifest(domainDir, manifest);
    }
}

await main().catch(error => {
    console.error("Failed to update library golden files:", error);
    process.exitCode = 1;
});
