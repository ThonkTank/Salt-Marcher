// src/apps/encounter/workspace-view.ts
// Stellt die Encounter-Oberfläche für das Zentrumspanel bereit.
import { App, Notice, TAbstractFile, TFile, normalizePath } from "obsidian";
import { NameInputModal } from "../../ui/modals";
import type { EncounterPresenter, EncounterViewState } from "./presenter";
import type { EncounterRuleModifierType, EncounterXpRule } from "./session-store";
import {
    ENCOUNTER_RULE_PRESET_DIR,
    type EncounterRulePresetSummary,
    deleteEncounterRulePreset,
    isEncounterPresetFile,
    listEncounterRulePresets,
    loadEncounterRulePreset,
    saveEncounterRulePreset,
} from "./rule-presets";

export class EncounterWorkspaceView {
    private readonly app: App;
    private readonly containerEl: HTMLElement;
    private presenter: EncounterPresenter | null = null;

    private xpInputEl!: HTMLInputElement;
    private xpErrorEl!: HTMLDivElement;
    private ruleListEl!: HTMLDivElement;
    private presetSelectEl!: HTMLSelectElement;
    private presetOpenButton!: HTMLButtonElement;
    private presetSaveButton!: HTMLButtonElement;
    private presetDeleteButton!: HTMLButtonElement;
    private presetOptions: EncounterRulePresetSummary[] = [];
    private detachPresetWatcher?: () => void;
    private presetRefreshTimeout: number | null = null;

    private partyFormNameEl!: HTMLInputElement;
    private partyFormLevelEl!: HTMLInputElement;
    private partyFormCurrentXpEl!: HTMLInputElement;
    private partyFormErrorEl!: HTMLDivElement;
    private partyListEl!: HTMLDivElement;

    private resultWarningsEl!: HTMLDivElement;
    private xpResultsEl!: HTMLDivElement;
    private treasureResultsEl!: HTMLDivElement;
    private debugSectionEl!: HTMLDivElement;
    private debugRuleEffectsDetailsEl!: HTMLDetailsElement;
    private debugRuleEffectsEl!: HTMLDivElement;

    private notesEl!: HTMLTextAreaElement;
    private resolveBtn!: HTMLButtonElement;

    constructor(app: App, containerEl: HTMLElement) {
        this.app = app;
        this.containerEl = containerEl;
    }

    mount() {
        this.containerEl.addClass("sm-encounter-view");
        this.renderShell();
        this.registerPresetWatcher();
        void this.refreshPresetOptions();
        this.syncPresetControlsState();
    }

    unmount() {
        this.containerEl.empty();
        this.containerEl.removeClass("sm-encounter-view");
        this.presenter = null;
        this.detachPresetWatcher?.();
        this.detachPresetWatcher = undefined;
        if (this.presetRefreshTimeout != null) {
            window.clearTimeout(this.presetRefreshTimeout);
            this.presetRefreshTimeout = null;
        }
        this.presetOptions = [];
    }

    setPresenter(presenter: EncounterPresenter | null) {
        this.presenter = presenter;
        this.syncPresetControlsState();
    }

    render(state: EncounterViewState) {
        const session = state.session ?? null;
        this.renderParty(state);
        this.renderRules(state);
        this.renderResults(state);
        this.renderRuleEffectsDebug(state);
        this.syncSessionControls(session);
    }

    private renderShell() {
        this.containerEl.empty();

        const xpSection = createSection(this.containerEl, "sm-encounter-xp");
        xpSection.createEl("h3", { cls: "sm-encounter-section-title", text: "Encounter XP & Rules" });
        const xpRow = xpSection.createDiv({ cls: "sm-encounter-xp-row" });
        const xpLeftGroup = xpRow.createDiv({ cls: "sm-encounter-xp-group sm-encounter-xp-group-left" });
        this.xpInputEl = createNumberInput(xpLeftGroup, {
            id: "encounter-base-xp",
            label: "Base XP",
            min: 0,
            step: 1,
        });
        this.xpInputEl.parentElement?.addClass("sm-encounter-field-inline");
        this.xpInputEl.parentElement?.addClass("sm-encounter-field-base-xp");
        this.xpInputEl.addEventListener("change", () => this.handleEncounterXpChange());
        this.xpInputEl.addEventListener("input", () => {
            this.xpErrorEl.setText("");
        });
        const xpLeftActions = xpLeftGroup.createDiv({ cls: "sm-encounter-inline-actions sm-encounter-inline-actions-left" });
        const addRuleButton = xpLeftActions.createEl("button", {
            cls: "sm-encounter-button",
            text: "Add rule",
        });
        addRuleButton.type = "button";
        addRuleButton.addEventListener("click", () => {
            this.handleAddRule();
        });
        const xpRightGroup = xpRow.createDiv({ cls: "sm-encounter-xp-group sm-encounter-xp-group-right" });
        this.presetSelectEl = xpRightGroup.createEl("select", {
            cls: "sm-encounter-input sm-encounter-preset-select",
            attr: { "aria-label": "Encounter rule preset" },
        }) as HTMLSelectElement;
        this.presetSelectEl.addEventListener("change", () => {
            this.syncPresetControlsState();
        });
        const xpPresetActions = xpRightGroup.createDiv({
            cls: "sm-encounter-inline-actions sm-encounter-inline-actions-right",
        });
        this.presetOpenButton = xpPresetActions.createEl("button", {
            cls: "sm-encounter-button",
            text: "Open preset",
        });
        this.presetOpenButton.type = "button";
        this.presetOpenButton.addEventListener("click", () => {
            void this.handleOpenPreset();
        });
        this.presetSaveButton = xpPresetActions.createEl("button", {
            cls: "sm-encounter-button sm-encounter-button-primary",
            text: "Save preset",
        });
        this.presetSaveButton.type = "button";
        this.presetSaveButton.addEventListener("click", () => {
            void this.handleSavePreset();
        });
        this.presetDeleteButton = xpPresetActions.createEl("button", {
            cls: "sm-encounter-button sm-encounter-button-danger",
            text: "Delete preset",
        });
        this.presetDeleteButton.type = "button";
        this.presetDeleteButton.addEventListener("click", () => {
            void this.handleDeletePreset();
        });
        this.xpErrorEl = xpSection.createDiv({ cls: "sm-encounter-error" });
        this.ruleListEl = xpSection.createDiv({ cls: "sm-encounter-rule-list" });

        const layoutEl = this.containerEl.createDiv({ cls: "sm-encounter-columns" });
        const leftColumn = layoutEl.createDiv({ cls: "sm-encounter-column" });

        const partySection = createSection(leftColumn, "sm-encounter-party");
        partySection.createEl("h3", { cls: "sm-encounter-section-title", text: "Party" });
        const partyForm = partySection.createEl("form", { cls: "sm-encounter-form" });
        const partyFormGrid = partyForm.createDiv({ cls: "sm-encounter-form-grid" });
        this.partyFormNameEl = createTextInput(partyFormGrid, {
            id: "encounter-party-name",
            label: "Name",
            placeholder: "Character name",
        });
        this.partyFormLevelEl = createNumberInput(partyFormGrid, {
            id: "encounter-party-level",
            label: "Level",
            min: 1,
            step: 1,
            value: 1,
        });
        this.partyFormCurrentXpEl = createNumberInput(partyFormGrid, {
            id: "encounter-party-current-xp",
            label: "Current XP",
            min: 0,
            step: 1,
            placeholder: "Optional",
        });
        const partySubmitWrapper = partyFormGrid.createDiv({ cls: "sm-encounter-field sm-encounter-field-actions" });
        const partySubmitButton = partySubmitWrapper.createEl("button", {
            cls: "sm-encounter-button",
            text: "Add party member",
        });
        partySubmitButton.type = "submit";
        this.partyFormErrorEl = partyForm.createDiv({ cls: "sm-encounter-error" });
        partyForm.addEventListener("submit", (event) => {
            event.preventDefault();
            this.handleAddPartyMember();
        });
        partyForm.addEventListener("input", () => {
            this.partyFormErrorEl.setText("");
        });
        this.partyListEl = partySection.createDiv({ cls: "sm-encounter-party-list" });

        const rightColumn = layoutEl.createDiv({ cls: "sm-encounter-column" });
        const resultsSection = createSection(rightColumn, "sm-encounter-results");
        resultsSection.createEl("h3", { cls: "sm-encounter-section-title", text: "Results" });
        this.resultWarningsEl = resultsSection.createDiv({ cls: "sm-encounter-result-warnings" });
        const breakdownWrapper = resultsSection.createDiv({ cls: "sm-encounter-breakdowns" });
        this.xpResultsEl = breakdownWrapper.createDiv({ cls: "sm-encounter-result-party" });
        this.treasureResultsEl = breakdownWrapper.createDiv({ cls: "sm-encounter-result-party" });

        this.debugSectionEl = createSection(rightColumn, "sm-encounter-debug");
        this.debugSectionEl.createEl("h3", {
            cls: "sm-encounter-section-title",
            text: "Debug",
        });
        this.debugRuleEffectsDetailsEl = this.debugSectionEl.createEl("details", {
            cls: "sm-encounter-debug-details",
        }) as HTMLDetailsElement;
        this.debugRuleEffectsDetailsEl.createEl("summary", {
            cls: "sm-encounter-debug-summary",
            text: "Rule effects",
        });
        this.debugRuleEffectsEl = this.debugRuleEffectsDetailsEl.createDiv({
            cls: "sm-encounter-debug-rule-effects",
        });

        const notesSection = resultsSection.createDiv({ cls: "sm-encounter-notes" });
        notesSection.createEl("label", {
            cls: "sm-encounter-notes-label",
            attr: { for: "encounter-notes" },
            text: "Notes",
        });
        this.notesEl = notesSection.createEl("textarea", {
            cls: "sm-encounter-notes-input",
            attr: {
                id: "encounter-notes",
                placeholder: "Record tactical notes, initiative order, or follow-up tasks…",
                rows: "6",
            },
        }) as HTMLTextAreaElement;
        this.notesEl.disabled = true;
        this.notesEl.addEventListener("input", () => {
            if (!this.presenter) return;
            this.presenter.setNotes(this.notesEl.value);
        });

        const actionsRow = resultsSection.createDiv({ cls: "sm-encounter-actions" });
        this.resolveBtn = actionsRow.createEl("button", {
            cls: "sm-encounter-button sm-encounter-button-primary",
            text: "Mark encounter resolved",
        });
        this.resolveBtn.type = "button";
        this.resolveBtn.disabled = true;
        this.resolveBtn.addEventListener("click", () => {
            this.presenter?.markResolved();
        });
    }

    private registerPresetWatcher() {
        this.detachPresetWatcher?.();
        const baseDir = normalizePath(ENCOUNTER_RULE_PRESET_DIR);
        const prefix = `${baseDir}/`;
        const handler = (file: TAbstractFile) => {
            if (file instanceof TFile) {
                if (isEncounterPresetFile(file)) {
                    this.schedulePresetRefresh();
                }
                return;
            }
            if (file.path === baseDir || file.path.startsWith(prefix)) {
                this.schedulePresetRefresh();
            }
        };
        this.app.vault.on("create", handler);
        this.app.vault.on("delete", handler);
        this.app.vault.on("rename", handler);
        this.app.vault.on("modify", handler);
        this.detachPresetWatcher = () => {
            this.app.vault.off("create", handler);
            this.app.vault.off("delete", handler);
            this.app.vault.off("rename", handler);
            this.app.vault.off("modify", handler);
        };
    }

    private schedulePresetRefresh() {
        if (this.presetRefreshTimeout != null) return;
        this.presetRefreshTimeout = window.setTimeout(() => {
            this.presetRefreshTimeout = null;
            void this.refreshPresetOptions();
        }, 100);
    }

    private async refreshPresetOptions() {
        const select = this.presetSelectEl;
        if (!select || !select.isConnected) return;
        const previousValue = select.value;
        try {
            const entries = await listEncounterRulePresets(this.app);
            this.presetOptions = entries;
            while (select.firstChild) {
                select.removeChild(select.firstChild);
            }
            const placeholder = select.createEl("option", {
                attr: { value: "" },
                text: entries.length ? "Preset auswählen…" : "Keine Presets gespeichert",
            }) as HTMLOptionElement;
            if (!entries.length) {
                placeholder.selected = true;
            }
            for (const entry of entries) {
                const option = select.createEl("option", {
                    attr: { value: entry.file.path },
                    text: entry.name,
                }) as HTMLOptionElement;
                if (entry.file.path === previousValue) {
                    option.selected = true;
                }
            }
            if (select.value !== previousValue) {
                if (entries.some((entry) => entry.file.path === previousValue)) {
                    select.value = previousValue;
                } else {
                    select.value = "";
                }
            }
        } catch (error) {
            console.error("[encounter] failed to list rule presets", error);
        }
        this.syncPresetControlsState();
    }

    private getSelectedPreset(): EncounterRulePresetSummary | null {
        const value = this.presetSelectEl?.value;
        if (!value) return null;
        return this.presetOptions.find((entry) => entry.file.path === value) ?? null;
    }

    private syncPresetControlsState() {
        const hasPresenter = !!this.presenter;
        const selected = this.getSelectedPreset();
        if (this.presetOpenButton) {
            this.presetOpenButton.disabled = !hasPresenter || !selected;
        }
        if (this.presetDeleteButton) {
            this.presetDeleteButton.disabled = !selected;
        }
        if (this.presetSaveButton) {
            this.presetSaveButton.disabled = !hasPresenter;
        }
    }

    private async handleOpenPreset() {
        const presenter = this.presenter;
        const selected = this.getSelectedPreset();
        if (!presenter) {
            new Notice("Encounter-Presenter nicht verfügbar.");
            return;
        }
        if (!selected) {
            new Notice("Bitte ein Preset auswählen.");
            return;
        }
        try {
            const preset = await loadEncounterRulePreset(this.app, selected.file);
            const seen = new Set<string>();
            const rules = preset.rules.map((rule) => {
                let id = rule.id;
                if (!id || seen.has(id)) {
                    id = createId("rule");
                }
                seen.add(id);
                return { ...rule, id };
            });
            presenter.replaceRules(rules);
            if (typeof preset.encounterXp === "number" && Number.isFinite(preset.encounterXp)) {
                presenter.setEncounterXp(preset.encounterXp);
            }
            new Notice(`Preset "${preset.name}" geladen.`);
        } catch (error) {
            console.error("[encounter] failed to load preset", error);
            new Notice("Preset konnte nicht geladen werden.");
        }
    }

    private async handleSavePreset() {
        const presenter = this.presenter;
        if (!presenter) {
            new Notice("Encounter-Presenter nicht verfügbar.");
            return;
        }
        const selected = this.getSelectedPreset();
        const currentState = presenter.getState();
        const rules = currentState.xp.rules.map((rule) => ({ ...rule }));
        const encounterXp = currentState.xp.encounterXp;
        const modal = new NameInputModal(
            this.app,
            async (rawName) => {
                const name = rawName.trim();
                const fallbackName = name || "Encounter Rule Preset";
                try {
                    const file = await saveEncounterRulePreset(
                        this.app,
                        { name: name || fallbackName, encounterXp, rules },
                        {
                            path: selected && selected.name === (name || fallbackName) ? selected.file.path : undefined,
                        },
                    );
                    new Notice(`Preset "${name || fallbackName}" gespeichert.`);
                    await this.refreshPresetOptions();
                    if (this.presetSelectEl && this.presetSelectEl.isConnected) {
                        this.presetSelectEl.value = file.path;
                    }
                } catch (error) {
                    console.error("[encounter] failed to save preset", error);
                    new Notice("Preset konnte nicht gespeichert werden.");
                }
                this.syncPresetControlsState();
            },
            {
                title: "Preset speichern",
                placeholder: "Preset-Name",
                cta: "Speichern",
                initialValue: selected?.name ?? "",
            },
        );
        modal.open();
    }

    private async handleDeletePreset() {
        const selected = this.getSelectedPreset();
        if (!selected) {
            new Notice("Bitte ein Preset auswählen.");
            return;
        }
        const confirmed = window.confirm(`Preset "${selected.name}" löschen?`);
        if (!confirmed) return;
        try {
            await deleteEncounterRulePreset(this.app, selected.file);
            new Notice(`Preset "${selected.name}" gelöscht.`);
            await this.refreshPresetOptions();
            if (this.presetSelectEl && this.presetSelectEl.isConnected) {
                this.presetSelectEl.value = "";
            }
        } catch (error) {
            console.error("[encounter] failed to delete preset", error);
            new Notice("Preset konnte nicht gelöscht werden.");
        }
        this.syncPresetControlsState();
    }

    private syncSessionControls(session: EncounterViewState["session"] | null) {
        if (!session) {
            this.notesEl.value = "";
            this.notesEl.disabled = true;
            this.resolveBtn.disabled = true;
            this.resolveBtn.setText("Mark encounter resolved");
            return;
        }

        if (this.notesEl.value !== session.notes) {
            this.notesEl.value = session.notes;
        }
        this.notesEl.disabled = false;

        if (session.status === "resolved") {
            this.resolveBtn.disabled = true;
            this.resolveBtn.setText("Encounter resolved");
        } else {
            this.resolveBtn.disabled = false;
            this.resolveBtn.setText("Mark encounter resolved");
        }
    }

    private renderParty(state: EncounterViewState) {
        const { party } = state.xp;
        this.partyListEl.empty();
        if (!party.length) {
            this.partyListEl.createDiv({
                cls: "sm-encounter-empty-row",
                text: "No party members added yet.",
            });
        }

        for (const member of party) {
            const itemEl = this.partyListEl.createDiv({ cls: "sm-encounter-party-item" });

            const nameField = createFieldContainer(itemEl);
            nameField.addClass("sm-encounter-party-field");
            const nameLabel = nameField.createEl("label", {
                attr: { for: `party-${member.id}-name` },
                text: "Name",
            });
            nameLabel.addClass("sm-encounter-inline-label");
            const nameInput = nameField.createEl("input", {
                cls: "sm-encounter-input",
                attr: {
                    id: `party-${member.id}-name`,
                    type: "text",
                    value: member.name,
                },
            }) as HTMLInputElement;
            nameInput.addEventListener("change", () => {
                const presenter = this.presenter;
                if (!presenter) return;
                const nextName = nameInput.value.trim();
                presenter.updatePartyMember(member.id, { name: nextName });
            });

            const levelField = createFieldContainer(itemEl);
            levelField.addClass("sm-encounter-party-field");
            const levelLabel = levelField.createEl("label", {
                attr: { for: `party-${member.id}-level` },
                text: "Level",
            });
            levelLabel.addClass("sm-encounter-inline-label");
            const levelInput = levelField.createEl("input", {
                cls: "sm-encounter-input",
                attr: {
                    id: `party-${member.id}-level`,
                    type: "number",
                    min: "1",
                    step: "1",
                    value: String(member.level),
                },
            }) as HTMLInputElement;
            levelInput.addEventListener("change", () => {
                const presenter = this.presenter;
                if (!presenter) return;
                const numeric = Number(levelInput.value);
                if (!Number.isFinite(numeric) || numeric < 1) {
                    levelInput.value = String(member.level);
                    return;
                }
                presenter.updatePartyMember(member.id, { level: Math.floor(numeric) });
            });

            const removeButton = itemEl.createEl("button", {
                cls: "sm-encounter-button sm-encounter-button-danger sm-encounter-party-remove",
                text: "Remove",
            });
            removeButton.type = "button";
            removeButton.addEventListener("click", () => {
                this.presenter?.removePartyMember(member.id);
            });
        }
    }

    private renderRules(state: EncounterViewState) {
        const rules = state.xp.rules;
        const ruleViews = new Map(state.xpView.rules.map((view) => [view.rule.id, view]));
        this.ruleListEl.empty();
        if (!rules.length) {
            this.ruleListEl.createDiv({
                cls: "sm-encounter-empty-row",
                text: "No rules configured yet.",
            });
            return;
        }

        rules.forEach((rule) => {
            const ruleItem = this.ruleListEl.createDiv({ cls: "sm-encounter-rule" });
            if (!rule.enabled) {
                ruleItem.addClass("is-disabled");
            }

            const headerRow = ruleItem.createDiv({ cls: "sm-encounter-rule-header" });
            const toggleWrapper = headerRow.createDiv({ cls: "sm-encounter-rule-toggle" });
            const toggleInput = toggleWrapper.createEl("input", {
                cls: "sm-encounter-rule-toggle-input",
                attr: {
                    type: "checkbox",
                    "aria-label": "Toggle rule",
                    checked: rule.enabled ? "true" : undefined,
                },
            }) as HTMLInputElement;
            toggleInput.checked = rule.enabled;
            toggleInput.addEventListener("change", () => {
                const presenter = this.presenter;
                if (!presenter) return;
                presenter.toggleRule(rule.id, toggleInput.checked);
            });

            const titleInput = headerRow.createEl("input", {
                cls: "sm-encounter-input sm-encounter-rule-title",
                attr: {
                    type: "text",
                    value: rule.title,
                    placeholder: "Rule name",
                    "aria-label": "Rule name",
                },
            }) as HTMLInputElement;
            titleInput.addEventListener("change", () => {
                const presenter = this.presenter;
                if (!presenter) return;
                presenter.updateRule(rule.id, { title: titleInput.value.trim() });
            });

            const scopeWrapper = headerRow.createDiv({ cls: "sm-encounter-rule-scope" });
            const scopeSelect = scopeWrapper.createEl("select", {
                cls: "sm-encounter-input",
                attr: { "aria-label": "Rule scope" },
            }) as HTMLSelectElement;
            const scopeOptions: Array<{ value: EncounterXpRule["scope"]; label: string }> = [
                { value: "xp", label: "XP" },
                { value: "gold", label: "Gold" },
            ];
            for (const option of scopeOptions) {
                scopeSelect.createEl("option", {
                    attr: { value: option.value, selected: option.value === rule.scope ? "true" : undefined },
                    text: option.label,
                });
            }
            scopeSelect.value = rule.scope;
            scopeSelect.addEventListener("change", () => {
                const presenter = this.presenter;
                if (!presenter) return;
                presenter.updateRule(rule.id, { scope: scopeSelect.value as EncounterXpRule["scope"] });
            });

            const valueWrapper = headerRow.createDiv({ cls: "sm-encounter-rule-range" });
            const minInput = valueWrapper.createEl("input", {
                cls: "sm-encounter-input sm-encounter-rule-range-input",
                attr: {
                    id: `rule-${rule.id}-min`,
                    type: "number",
                    value: String(rule.modifierValueMin),
                    "aria-label": "Modifier minimum value",
                },
            }) as HTMLInputElement;
            valueWrapper.createSpan({ cls: "sm-encounter-rule-range-separator", text: "–" });
            const maxInput = valueWrapper.createEl("input", {
                cls: "sm-encounter-input sm-encounter-rule-range-input",
                attr: {
                    id: `rule-${rule.id}-max`,
                    type: "number",
                    value: String(rule.modifierValueMax),
                    "aria-label": "Modifier maximum value",
                },
            }) as HTMLInputElement;
            valueWrapper.createSpan({
                cls: "sm-encounter-rule-range-result",
                text: `→ ${formatNumber(rule.modifierValue)}`,
            });

            const typeSelect = headerRow.createEl("select", {
                cls: "sm-encounter-input sm-encounter-rule-type",
                attr: { "aria-label": "Modifier type" },
            }) as HTMLSelectElement;
            const typeOptions: Array<{ value: EncounterRuleModifierType; label: string }> = [
                { value: "flat", label: "Flat" },
                { value: "flatPerAverageLevel", label: "Flat * avrg lvl" },
                { value: "flatPerTotalLevel", label: "Flat * total lvl" },
                { value: "percentTotal", label: "% of total" },
                { value: "percentNextLevel", label: "% to next level" },
            ];
            for (const option of typeOptions) {
                typeSelect.createEl("option", {
                    attr: { value: option.value, selected: option.value === rule.modifierType ? "true" : undefined },
                    text: option.label,
                });
            }
            typeSelect.value = rule.modifierType;
            typeSelect.addEventListener("change", () => {
                const presenter = this.presenter;
                if (!presenter) return;
                presenter.updateRule(rule.id, { modifierType: typeSelect.value as EncounterRuleModifierType });
            });
            const ruleErrorEl = ruleItem.createDiv({ cls: "sm-encounter-error" });
            const handleRangeChange = () => {
                const presenter = this.presenter;
                if (!presenter) return;
                const minRaw = minInput.value.trim();
                const maxRaw = maxInput.value.trim();
                if (minRaw === "" || maxRaw === "") {
                    ruleErrorEl.setText("Modifier range requires both values.");
                    minInput.value = String(rule.modifierValueMin);
                    maxInput.value = String(rule.modifierValueMax);
                    return;
                }
                const minNumeric = Number(minRaw);
                const maxNumeric = Number(maxRaw);
                if (!Number.isFinite(minNumeric) || !Number.isFinite(maxNumeric)) {
                    ruleErrorEl.setText("Modifier range values must be numbers.");
                    minInput.value = String(rule.modifierValueMin);
                    maxInput.value = String(rule.modifierValueMax);
                    return;
                }
                ruleErrorEl.setText("");
                const nextMin = Math.min(minNumeric, maxNumeric);
                const nextMax = Math.max(minNumeric, maxNumeric);
                if (nextMin !== minNumeric || nextMax !== maxNumeric) {
                    minInput.value = String(nextMin);
                    maxInput.value = String(nextMax);
                }
                presenter.updateRule(rule.id, { modifierValueMin: nextMin, modifierValueMax: nextMax });
            };
            minInput.addEventListener("change", handleRangeChange);
            maxInput.addEventListener("change", handleRangeChange);
            minInput.addEventListener("input", () => {
                ruleErrorEl.setText("");
            });
            maxInput.addEventListener("input", () => {
                ruleErrorEl.setText("");
            });

            const notesField = createFieldContainer(ruleItem);
            notesField.addClass("sm-encounter-rule-notes");
            notesField.createEl("label", {
                attr: { for: `rule-${rule.id}-notes` },
                text: "Notes",
            });
            const notesInput = notesField.createEl("textarea", {
                cls: "sm-encounter-input",
                attr: {
                    id: `rule-${rule.id}-notes`,
                    rows: rule.notes?.trim() ? "2" : "1",
                },
                text: rule.notes ?? "",
            }) as HTMLTextAreaElement;
            const syncNoteRows = () => {
                const trimmed = notesInput.value.trim();
                if (!trimmed) {
                    notesInput.rows = 1;
                    return;
                }
                const lineCount = trimmed.split(/\r?\n/).length;
                notesInput.rows = Math.min(6, Math.max(2, lineCount));
            };
            syncNoteRows();
            notesInput.addEventListener("input", () => {
                syncNoteRows();
            });
            notesInput.addEventListener("change", () => {
                const presenter = this.presenter;
                if (!presenter) return;
                const trimmed = notesInput.value.trim();
                presenter.updateRule(rule.id, { notes: trimmed === "" ? "" : trimmed });
            });

            const removeButton = ruleItem.createEl("button", {
                cls: "sm-encounter-button sm-encounter-button-danger",
                text: "Remove rule",
            });
            removeButton.type = "button";
            removeButton.addEventListener("click", () => {
                this.presenter?.removeRule(rule.id);
            });

            const view = ruleViews.get(rule.id);
            if (view?.warnings.length) {
                const warningEl = ruleItem.createDiv({ cls: "sm-encounter-callout" });
                view.warnings.forEach((warning) => {
                    warningEl.createEl("p", { text: warning });
                });
            }

        });
    }

    private renderResults(state: EncounterViewState) {
        const { xpView } = state;
        const partyViews = xpView.party;
        const enabledXpRuleViews = xpView.rules.filter(
            (ruleView) => ruleView.rule.enabled && ruleView.rule.scope === "xp",
        );
        const totalModifierDelta = enabledXpRuleViews.reduce((sum, ruleView) => sum + ruleView.totalDelta, 0);
        const xpPerMember = partyViews.length ? xpView.totalEncounterXp / partyViews.length : 0;

        const treasureSummary = this.calculateTreasureSummary(state);
        const warnings: string[] = [];
        const pushWarning = (message: string) => {
            if (!message) return;
            if (!warnings.includes(message)) {
                warnings.push(message);
            }
        };
        xpView.warnings.forEach(pushWarning);
        treasureSummary.warnings.forEach(pushWarning);

        this.resultWarningsEl.empty();
        if (warnings.length) {
            const warning = this.resultWarningsEl.createDiv({ cls: "sm-encounter-callout" });
            warnings.forEach((message) => {
                warning.createEl("p", { text: message });
            });
        }

        this.xpResultsEl.empty();
        this.xpResultsEl.createEl("h4", {
            cls: "sm-encounter-subheading",
            text: "XP Result.",
        });

        const summaryCard = this.xpResultsEl.createDiv({
            cls: "sm-encounter-result-party-member sm-encounter-result-party-member--xp-only",
        });
        const summaryList = summaryCard.createEl("ul", { cls: "sm-encounter-result-summary" });
        createStatItem(summaryList, "Base XP", formatNumber(xpView.baseEncounterXp));

        const modifiersItem = summaryList.createEl("li", {
            cls: "sm-encounter-result-summary-item sm-encounter-result-summary-item--modifiers",
        });
        modifiersItem.createEl("span", { cls: "label", text: "Modifiers:" });
        const modifiersValue = modifiersItem.createDiv({ cls: "value" });
        if (enabledXpRuleViews.length) {
            const modifiersList = modifiersValue.createEl("ul", { cls: "sm-encounter-result-modifier-list" });
            for (const ruleView of enabledXpRuleViews) {
                const modifierRow = modifiersList.createEl("li", { cls: "sm-encounter-result-modifier" });
                const ruleTitle = ruleView.rule.title.trim();
                modifierRow.createEl("span", {
                    cls: "name",
                    text: ruleTitle || "Untitled rule",
                });
                modifierRow.createEl("span", {
                    cls: "delta",
                    text: formatSignedNumber(ruleView.totalDelta),
                });
            }
        } else {
            modifiersValue.createEl("span", {
                cls: "sm-encounter-result-modifier-empty",
                text: "None",
            });
        }

        createStatItem(summaryList, "Total Modifiers", formatSignedNumber(totalModifierDelta));
        createStatItem(summaryList, "Total XP", formatNumber(xpView.totalEncounterXp));
        createStatItem(summaryList, "XP per Character", formatNumber(xpPerMember));

        if (!partyViews.length) {
            this.xpResultsEl.createDiv({
                cls: "sm-encounter-empty-row",
                text: "No party members added yet.",
            });
            this.renderTreasureResults(state, treasureSummary);
            return;
        }

        const aggregatedWarnings: string[] = [];
        for (const memberView of partyViews) {
            for (const warning of memberView.warnings) {
                aggregatedWarnings.push(`${memberView.member.name}: ${warning}`);
            }
        }
        if (aggregatedWarnings.length) {
            const warningEl = this.xpResultsEl.createDiv({ cls: "sm-encounter-callout" });
            aggregatedWarnings.forEach((warning) => {
                warningEl.createEl("p", { text: warning });
            });
        }

        this.renderTreasureResults(state, treasureSummary);
    }

    private renderTreasureResults(state: EncounterViewState, summary: EncounterTreasureSummary) {
        this.treasureResultsEl.empty();
        this.treasureResultsEl.createEl("h4", {
            cls: "sm-encounter-subheading",
            text: "Treasure.",
        });

        const party = state.xp.party;
        if (!party.length) {
            this.treasureResultsEl.createDiv({
                cls: "sm-encounter-empty-row",
                text: "No party members added yet.",
            });
            return;
        }

        const summaryCard = this.treasureResultsEl.createDiv({
            cls: "sm-encounter-result-party-member sm-encounter-result-party-member--xp-only",
        });
        const summaryList = summaryCard.createEl("ul", { cls: "sm-encounter-result-summary" });
        createStatItem(summaryList, "Gold Base", formatNumber(summary.baseGold));

        const modifiersItem = summaryList.createEl("li", {
            cls: "sm-encounter-result-summary-item sm-encounter-result-summary-item--modifiers",
        });
        modifiersItem.createEl("span", { cls: "label", text: "Modifiers:" });
        const modifiersValue = modifiersItem.createDiv({ cls: "value" });
        if (summary.enabledRules.length) {
            const modifiersList = modifiersValue.createEl("ul", { cls: "sm-encounter-result-modifier-list" });
            for (const rule of summary.enabledRules) {
                const modifierRow = modifiersList.createEl("li", { cls: "sm-encounter-result-modifier" });
                const ruleTitle = rule.rule.title.trim();
                modifierRow.createEl("span", {
                    cls: "name",
                    text: ruleTitle || "Untitled rule",
                });
                modifierRow.createEl("span", {
                    cls: "delta",
                    text: formatSignedNumber(rule.delta),
                });
            }
        } else {
            modifiersValue.createEl("span", {
                cls: "sm-encounter-result-modifier-empty",
                text: "None",
            });
        }

        createStatItem(summaryList, "Total Modifiers", formatSignedNumber(summary.totalModifierDelta));
        createStatItem(summaryList, "Total Gold", formatNumber(summary.totalGold));
        const goldPerCharacter = party.length ? summary.totalGold / party.length : 0;
        createStatItem(summaryList, "Gold per Character", formatNumber(goldPerCharacter));
    }

    private calculateTreasureSummary(state: EncounterViewState): EncounterTreasureSummary {
        const xpState = state.xp;
        const xpView = state.xpView;
        const party = xpState.party ?? [];
        const partyViews = xpView.party;
        const partyCount = party.length;
        const totalLevels = party.reduce((sum, member) => sum + member.level, 0);
        const averageLevel = partyCount > 0 ? totalLevels / partyCount : 0;
        const baseMultiplier = getGoldBaseMultiplier(averageLevel);
        const baseGold = partyCount > 0 ? xpView.baseEncounterXp * baseMultiplier : 0;
        let runningGold = baseGold;
        let totalModifierDelta = 0;
        const enabledRules: EncounterTreasureRuleView[] = [];
        const warnings: string[] = [];
        const pushWarning = (message: string) => {
            if (!message) return;
            if (!warnings.includes(message)) {
                warnings.push(message);
            }
        };
        const xpToNextByMember = new Map<string, number | null>(
            partyViews.map((memberView) => [memberView.member.id, memberView.xpToNextLevel]),
        );

        for (const rule of xpState.rules ?? []) {
            if (rule.scope !== "gold" || !rule.enabled) {
                continue;
            }

            if (!partyCount) {
                pushWarning(`Gold rule "${rule.title}" ignored because no party members are present.`);
                enabledRules.push({ rule, delta: 0 });
                continue;
            }

            let delta = 0;
            switch (rule.modifierType) {
                case "flat": {
                    delta = rule.modifierValue;
                    break;
                }
                case "flatPerAverageLevel": {
                    delta = rule.modifierValue * averageLevel;
                    break;
                }
                case "flatPerTotalLevel": {
                    delta = rule.modifierValue * totalLevels;
                    break;
                }
                case "percentTotal": {
                    delta = runningGold * (rule.modifierValue / 100);
                    break;
                }
                case "percentNextLevel": {
                    let aggregateNext = 0;
                    let applied = false;
                    for (const member of party) {
                        const xpToNext = xpToNextByMember.get(member.id);
                        if (xpToNext == null) {
                            pushWarning(
                                `${member.name} has no next-level XP threshold; "${rule.title}" gold modifier ignored for them.`,
                            );
                            continue;
                        }
                        aggregateNext += xpToNext;
                        applied = true;
                    }
                    if (!applied || aggregateNext === 0) {
                        delta = 0;
                    } else {
                        delta = (aggregateNext * rule.modifierValue) / 100;
                    }
                    break;
                }
            }

            totalModifierDelta += delta;
            runningGold += delta;
            enabledRules.push({ rule, delta });
        }

        return {
            baseGold,
            totalGold: baseGold + totalModifierDelta,
            totalModifierDelta,
            enabledRules,
            warnings,
        };
    }

    private renderRuleEffectsDebug(state: EncounterViewState) {
        if (!this.debugRuleEffectsEl || !this.debugSectionEl || !this.debugRuleEffectsDetailsEl) {
            return;
        }

        const { xpView } = state;
        const partyViews = xpView.party;
        const ruleViews = xpView.rules;

        this.debugRuleEffectsEl.empty();

        if (!ruleViews.length) {
            this.debugSectionEl.addClass("sm-encounter-hidden");
            this.debugRuleEffectsDetailsEl.open = false;
            return;
        }

        this.debugSectionEl.removeClass("sm-encounter-hidden");

        const runningTotals = new Map<string, number>();
        for (const memberView of partyViews) {
            runningTotals.set(memberView.member.id, memberView.baseXp);
        }

        for (const ruleView of ruleViews) {
            const ruleResult = this.debugRuleEffectsEl.createDiv({ cls: "sm-encounter-result-rule" });
            const title = ruleResult.createEl("div", {
                cls: "sm-encounter-result-rule-title",
                text: ruleView.rule.title,
            });
            if (!ruleView.rule.enabled) {
                title.addClass("is-disabled");
            }
            const deltaSummary = ruleResult.createDiv({ cls: "sm-encounter-result-rule-total" });
            deltaSummary.createEl("span", { cls: "label", text: "Total delta:" });
            deltaSummary.createEl("span", { cls: "value", text: formatSignedNumber(ruleView.totalDelta) });

            const perMemberFinals = ruleView.perMemberDeltas.map((delta) => {
                const previous = runningTotals.get(delta.memberId) ?? 0;
                const shouldApply = ruleView.rule.enabled;
                const total = shouldApply ? previous + delta.delta : previous;
                if (shouldApply) {
                    runningTotals.set(delta.memberId, total);
                }
                return { ...delta, previous, total };
            });

            if (perMemberFinals.length) {
                const perMemberList = ruleResult.createEl("ul", { cls: "sm-encounter-rule-deltas" });
                perMemberFinals.forEach((delta) => {
                    perMemberList.createEl("li", {
                        text: `${delta.memberName}: ${formatSignedNumber(delta.delta)}`,
                    });
                });
            }
            if (ruleView.warnings.length) {
                const warningEl = ruleResult.createDiv({ cls: "sm-encounter-callout" });
                ruleView.warnings.forEach((warning) => {
                    warningEl.createEl("p", { text: warning });
                });
            }
        }
    }

    private handleAddPartyMember() {
        const presenter = this.presenter;
        if (!presenter) return;
        const name = this.partyFormNameEl.value.trim();
        const levelValue = Number(this.partyFormLevelEl.value);
        const currentXpRaw = this.partyFormCurrentXpEl.value.trim();
        const errors: string[] = [];
        if (!name) {
            errors.push("Name is required.");
        }
        if (!Number.isFinite(levelValue) || levelValue < 1) {
            errors.push("Level must be 1 or greater.");
        }
        let currentXp: number | undefined;
        if (currentXpRaw !== "") {
            const numericCurrent = Number(currentXpRaw);
            if (!Number.isFinite(numericCurrent) || numericCurrent < 0) {
                errors.push("Current XP must be a non-negative number.");
            } else {
                currentXp = numericCurrent;
            }
        }
        if (errors.length) {
            this.partyFormErrorEl.setText(errors.join(" "));
            return;
        }

        const member: Parameters<EncounterPresenter["addPartyMember"]>[0] = {
            id: createId("party"),
            name,
            level: Math.floor(levelValue),
        };
        if (currentXp !== undefined) {
            member.currentXp = currentXp;
        }
        presenter.addPartyMember(member);

        this.partyFormNameEl.value = "";
        this.partyFormLevelEl.value = "1";
        this.partyFormCurrentXpEl.value = "";
        this.partyFormErrorEl.setText("");
        this.partyFormNameEl.focus();
    }

    private handleEncounterXpChange() {
        const presenter = this.presenter;
        if (!presenter) return;
        const raw = this.xpInputEl.value.trim();
        if (raw === "") {
            this.xpErrorEl.setText("");
            presenter.setEncounterXp(0);
            return;
        }
        const numeric = Number(raw);
        if (!Number.isFinite(numeric) || numeric < 0) {
            this.xpErrorEl.setText("Encounter XP must be a non-negative number.");
            return;
        }
        this.xpErrorEl.setText("");
        presenter.setEncounterXp(numeric);
    }

    private handleAddRule() {
        const presenter = this.presenter;
        if (!presenter) return;
        const rule: Parameters<EncounterPresenter["addRule"]>[0] = {
            id: createId("rule"),
            title: "",
            modifierType: "flat",
            modifierValue: 0,
            modifierValueMin: 0,
            modifierValueMax: 0,
            enabled: true,
            scope: "xp",
        };
        presenter.addRule(rule);
    }
}

function createSection(parent: HTMLElement, className: string): HTMLDivElement {
    return parent.createDiv({ cls: `sm-encounter-section ${className}` });
}

interface TextInputOptions {
    id: string;
    label: string;
    placeholder?: string;
    value?: string | number;
}

interface EncounterTreasureRuleView {
    readonly rule: EncounterXpRule;
    readonly delta: number;
}

interface EncounterTreasureSummary {
    readonly baseGold: number;
    readonly totalGold: number;
    readonly totalModifierDelta: number;
    readonly enabledRules: EncounterTreasureRuleView[];
    readonly warnings: string[];
}

function getGoldBaseMultiplier(averageLevel: number): number {
    if (averageLevel >= 17) {
        return 3.2;
    }
    if (averageLevel >= 11) {
        return 1.6;
    }
    if (averageLevel >= 5) {
        return 0.415;
    }
    if (averageLevel > 0) {
        return 0.475;
    }
    return 0;
}

function createTextInput(parent: HTMLElement, options: TextInputOptions): HTMLInputElement {
    const field = createFieldContainer(parent);
    field.createEl("label", { attr: { for: options.id }, text: options.label });
    return field.createEl("input", {
        cls: "sm-encounter-input",
        attr: {
            id: options.id,
            type: "text",
            placeholder: options.placeholder ?? "",
            value: options.value != null ? String(options.value) : "",
        },
    }) as HTMLInputElement;
}

interface NumberInputOptions {
    id: string;
    label: string;
    min?: number;
    max?: number;
    step?: number;
    value?: number;
    placeholder?: string;
}

function createNumberInput(parent: HTMLElement, options: NumberInputOptions): HTMLInputElement {
    const field = createFieldContainer(parent);
    field.createEl("label", { attr: { for: options.id }, text: options.label });
    const attrs: Record<string, string> = {
        id: options.id,
        type: "number",
    };
    if (options.min !== undefined) attrs.min = String(options.min);
    if (options.max !== undefined) attrs.max = String(options.max);
    if (options.step !== undefined) attrs.step = String(options.step);
    if (options.placeholder) attrs.placeholder = options.placeholder;
    if (options.value !== undefined) attrs.value = String(options.value);
    return field.createEl("input", {
        cls: "sm-encounter-input",
        attr: attrs,
    }) as HTMLInputElement;
}

interface SelectOptions {
    id: string;
    label: string;
    options: Array<{ value: string; label: string }>;
}

function createSelect(parent: HTMLElement, options: SelectOptions): HTMLSelectElement {
    const field = createFieldContainer(parent);
    field.createEl("label", { attr: { for: options.id }, text: options.label });
    const select = field.createEl("select", {
        cls: "sm-encounter-input",
        attr: { id: options.id },
    }) as HTMLSelectElement;
    for (const option of options.options) {
        select.createEl("option", { attr: { value: option.value }, text: option.label });
    }
    return select;
}

interface TextareaOptions {
    id: string;
    label: string;
    rows?: number;
    placeholder?: string;
}

function createTextarea(parent: HTMLElement, options: TextareaOptions): HTMLTextAreaElement {
    const field = createFieldContainer(parent);
    field.createEl("label", { attr: { for: options.id }, text: options.label });
    return field.createEl("textarea", {
        cls: "sm-encounter-input",
        attr: {
            id: options.id,
            rows: options.rows != null ? String(options.rows) : "3",
            placeholder: options.placeholder ?? "",
        },
    }) as HTMLTextAreaElement;
}

function createFieldContainer(parent: HTMLElement): HTMLDivElement {
    return parent.createDiv({ cls: "sm-encounter-field" });
}

function createStatItem(list: HTMLUListElement, label: string, value: string): HTMLLIElement {
    const item = list.createEl("li", { cls: "sm-encounter-result-summary-item" });
    item.createEl("span", { cls: "label", text: `${label}:` });
    item.createEl("span", { cls: "value", text: value });
    return item;
}

const numberFormatter = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
});

function formatNumber(value: number): string {
    if (!Number.isFinite(value)) {
        return "0";
    }
    return numberFormatter.format(value);
}

function formatSignedNumber(value: number): string {
    const formatted = formatNumber(Math.abs(value));
    if (value > 0) return `+${formatted}`;
    if (value < 0) return `-${formatted}`;
    return formatted;
}

function createId(prefix: string): string {
    const globalCrypto = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
    if (globalCrypto?.randomUUID) {
        return `${prefix}-${globalCrypto.randomUUID()}`;
    }
    const random = Math.random().toString(36).slice(2, 8);
    return `${prefix}-${Date.now().toString(36)}-${random}`;
}
