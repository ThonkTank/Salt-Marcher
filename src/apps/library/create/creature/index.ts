import { App, normalizePath, TFile } from "obsidian";
import { ensureCreatureDir, sanitizeFileName } from "../../core/creature-files";
import { CreatureStatblock, buildStatblockMarkdown } from "./statblock";
import { CreateCreatureModal, CreatureCreatorOptions } from "./modal";

export { buildStatblockMarkdown } from "./statblock";
export { CreateCreatureModal, mountCreatureCreator } from "./modal";
export type { CreatureCreatorHandle, CreatureCreatorOptions } from "./modal";
export type { CreatureStatblock } from "./statblock";

export interface OpenCreatureCreatorOptions extends CreatureCreatorOptions {
    onSaved?: (result: { file: TFile; markdown: string; statblock: CreatureStatblock }) => void | Promise<void>;
}

export async function saveCreatureMarkdownFile(app: App, statblock: CreatureStatblock, markdown?: string): Promise<TFile> {
    const folder = await ensureCreatureDir(app);
    const content = markdown ?? buildStatblockMarkdown(statblock);
    const baseName = sanitizeFileName(statblock.name || "Creature");
    let fileName = `${baseName}.md`;
    let path = normalizePath(`${folder.path}/${fileName}`);
    let index = 2;
    while (app.vault.getAbstractFileByPath(path)) {
        fileName = `${baseName} (${index}).md`;
        path = normalizePath(`${folder.path}/${fileName}`);
        index += 1;
    }
    const file = await app.vault.create(path, content);
    return file;
}

export function openCreatureCreator(app: App, options: OpenCreatureCreatorOptions = {}): CreateCreatureModal {
    const modal = new CreateCreatureModal(app, {
        initial: options.initial,
        onCancel: options.onCancel,
        onSubmit: async ({ statblock, markdown }) => {
            const file = await saveCreatureMarkdownFile(app, statblock, markdown);
            await options.onSaved?.({ file, markdown, statblock });
        },
    });
    modal.open();
    return modal;
}

