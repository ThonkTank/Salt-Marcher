// src/apps/encounter/workspace-view.ts
// Stellt die Encounter-Oberfläche für das Zentrumspanel bereit.
import type { EncounterPresenter, EncounterViewState } from "./presenter";
import type { EncounterRuleModifierType, EncounterRuleScope } from "./session-store";

export class EncounterWorkspaceView {
    private readonly containerEl: HTMLElement;
    private presenter: EncounterPresenter | null = null;

    private xpInputEl!: HTMLInputElement;
    private xpErrorEl!: HTMLDivElement;
    private resetXpButton!: HTMLButtonElement;
    private ruleListEl!: HTMLDivElement;

    private partyFormNameEl!: HTMLInputElement;
    private partyFormLevelEl!: HTMLInputElement;
    private partyFormCurrentXpEl!: HTMLInputElement;
    private partyFormErrorEl!: HTMLDivElement;
    private partyListEl!: HTMLDivElement;

    private ruleFormTitleEl!: HTMLInputElement;
    private ruleFormScopeEl!: HTMLSelectElement;
    private ruleFormTypeEl!: HTMLSelectElement;
    private ruleFormValueEl!: HTMLInputElement;
    private ruleFormNotesEl!: HTMLTextAreaElement;
    private ruleFormEnabledEl!: HTMLInputElement;
    private ruleFormErrorEl!: HTMLDivElement;

    private resultTotalsEl!: HTMLDivElement;
    private resultWarningsEl!: HTMLDivElement;
    private resultPartyEl!: HTMLDivElement;
    private resultRulesEl!: HTMLDivElement;

    private notesEl!: HTMLTextAreaElement;
    private resolveBtn!: HTMLButtonElement;

    constructor(containerEl: HTMLElement) {
        this.containerEl = containerEl;
    }

    mount() {
        this.containerEl.addClass("sm-encounter-view");
        this.renderShell();
    }

    unmount() {
        this.containerEl.empty();
        this.containerEl.removeClass("sm-encounter-view");
        this.presenter = null;
    }

    setPresenter(presenter: EncounterPresenter | null) {
        this.presenter = presenter;
    }

    render(state: EncounterViewState) {
        const session = state.session ?? null;
        this.renderParty(state);
        this.renderRules(state);
        this.renderResults(state);
        this.syncSessionControls(session);
    }

    private renderShell() {
        this.containerEl.empty();

        const xpSection = createSection(this.containerEl, "sm-encounter-xp");
        xpSection.createEl("h3", { cls: "sm-encounter-section-title", text: "Encounter XP & Rules" });
        const xpRow = xpSection.createDiv({ cls: "sm-encounter-xp-row" });
        this.xpInputEl = createNumberInput(xpRow, {
            id: "encounter-base-xp",
            label: "Base encounter XP",
            min: 0,
            step: 1,
        });
        this.xpInputEl.addEventListener("change", () => this.handleEncounterXpChange());
        this.xpInputEl.addEventListener("input", () => {
            this.xpErrorEl.setText("");
        });
        const xpControls = xpRow.createDiv({ cls: "sm-encounter-inline-actions" });
        this.resetXpButton = xpControls.createEl("button", {
            cls: "sm-encounter-button sm-encounter-button-secondary",
            text: "Reset XP state",
        });
        this.resetXpButton.type = "button";
        this.resetXpButton.addEventListener("click", () => {
            this.presenter?.resetXpState();
        });
        this.xpErrorEl = xpSection.createDiv({ cls: "sm-encounter-error" });
        this.ruleListEl = xpSection.createDiv({ cls: "sm-encounter-rule-list" });

        const addRuleHeading = xpSection.createEl("h4", {
            cls: "sm-encounter-subheading",
            text: "Add rule",
        });
        addRuleHeading.setAttr("aria-hidden", "true");
        const ruleForm = xpSection.createEl("form", { cls: "sm-encounter-form" });
        const ruleFormGrid = ruleForm.createDiv({ cls: "sm-encounter-form-grid" });
        this.ruleFormTitleEl = createTextInput(ruleFormGrid, {
            id: "encounter-rule-title",
            label: "Title",
            placeholder: "Rule description",
        });
        this.ruleFormScopeEl = createSelect(ruleFormGrid, {
            id: "encounter-rule-scope",
            label: "Scope",
            options: [
                { value: "overall", label: "Entire encounter" },
                { value: "perPlayer", label: "Per character" },
            ],
        });
        this.ruleFormScopeEl.value = "overall";
        this.ruleFormTypeEl = createSelect(ruleFormGrid, {
            id: "encounter-rule-type",
            label: "Modifier type",
            options: [
                { value: "flat", label: "Flat" },
                { value: "percentTotal", label: "% of total" },
                { value: "percentNextLevel", label: "% to next level" },
            ],
        });
        this.ruleFormTypeEl.value = "flat";
        this.ruleFormValueEl = createNumberInput(ruleFormGrid, {
            id: "encounter-rule-value",
            label: "Value",
            step: 1,
            value: 0,
        });
        this.ruleFormValueEl.value = "0";
        this.ruleFormNotesEl = createTextarea(ruleFormGrid, {
            id: "encounter-rule-notes",
            label: "Notes",
            placeholder: "Optional notes",
            rows: 2,
        });
        const ruleEnabledWrapper = ruleFormGrid.createDiv({ cls: "sm-encounter-field sm-encounter-field-toggle" });
        const enabledId = "encounter-rule-enabled";
        const enabledLabel = ruleEnabledWrapper.createEl("label", {
            attr: { for: enabledId },
            text: "Enabled",
        });
        enabledLabel.addClass("sm-encounter-toggle-label");
        this.ruleFormEnabledEl = ruleEnabledWrapper.createEl("input", {
            attr: { id: enabledId, type: "checkbox" },
        }) as HTMLInputElement;
        this.ruleFormEnabledEl.checked = true;
        const ruleSubmitWrapper = ruleFormGrid.createDiv({ cls: "sm-encounter-field sm-encounter-field-actions" });
        const ruleSubmitButton = ruleSubmitWrapper.createEl("button", {
            cls: "sm-encounter-button",
            text: "Add rule",
        });
        ruleSubmitButton.type = "submit";
        this.ruleFormErrorEl = ruleForm.createDiv({ cls: "sm-encounter-error" });
        ruleForm.addEventListener("submit", (event) => {
            event.preventDefault();
            this.handleAddRule();
        });
        ruleForm.addEventListener("input", () => {
            this.ruleFormErrorEl.setText("");
        });

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
        this.resultTotalsEl = resultsSection.createDiv({ cls: "sm-encounter-result-totals" });
        this.resultWarningsEl = resultsSection.createDiv({ cls: "sm-encounter-result-warnings" });
        const breakdownWrapper = resultsSection.createDiv({ cls: "sm-encounter-breakdowns" });
        this.resultPartyEl = breakdownWrapper.createDiv({ cls: "sm-encounter-result-party" });
        this.resultRulesEl = breakdownWrapper.createDiv({ cls: "sm-encounter-result-rules" });

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
            const memberErrorEl = itemEl.createDiv({ cls: "sm-encounter-error" });
            levelInput.addEventListener("change", () => {
                const presenter = this.presenter;
                if (!presenter) return;
                const numeric = Number(levelInput.value);
                if (!Number.isFinite(numeric) || numeric < 1) {
                    memberErrorEl.setText("Level must be 1 or greater.");
                    return;
                }
                memberErrorEl.setText("");
                presenter.updatePartyMember(member.id, { level: Math.floor(numeric) });
            });

            const xpField = createFieldContainer(itemEl);
            const xpLabel = xpField.createEl("label", {
                attr: { for: `party-${member.id}-xp` },
                text: "Current XP",
            });
            xpLabel.addClass("sm-encounter-inline-label");
            const xpInput = xpField.createEl("input", {
                cls: "sm-encounter-input",
                attr: {
                    id: `party-${member.id}-xp`,
                    type: "number",
                    min: "0",
                    step: "1",
                    value: member.currentXp != null ? String(member.currentXp) : "",
                },
            }) as HTMLInputElement;
            xpInput.addEventListener("change", () => {
                const presenter = this.presenter;
                if (!presenter) return;
                const raw = xpInput.value.trim();
                if (raw === "") {
                    memberErrorEl.setText("");
                    presenter.updatePartyMember(member.id, { currentXp: undefined });
                    return;
                }
                const numeric = Number(raw);
                if (!Number.isFinite(numeric) || numeric < 0) {
                    memberErrorEl.setText("Current XP must be a non-negative number.");
                    return;
                }
                memberErrorEl.setText("");
                presenter.updatePartyMember(member.id, { currentXp: numeric });
            });

            const removeButton = itemEl.createEl("button", {
                cls: "sm-encounter-button sm-encounter-button-danger",
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
            const titleInput = headerRow.createEl("input", {
                cls: "sm-encounter-input sm-encounter-rule-title",
                attr: {
                    type: "text",
                    value: rule.title,
                },
            }) as HTMLInputElement;
            titleInput.addEventListener("change", () => {
                const presenter = this.presenter;
                if (!presenter) return;
                presenter.updateRule(rule.id, { title: titleInput.value.trim() });
            });

            const toggleWrapper = headerRow.createDiv({ cls: "sm-encounter-rule-toggle" });
            const toggleId = `rule-${rule.id}-enabled`;
            toggleWrapper.createEl("label", {
                cls: "sm-encounter-toggle-label",
                attr: { for: toggleId },
                text: "Enabled",
            });
            const toggleInput = toggleWrapper.createEl("input", {
                attr: {
                    id: toggleId,
                    type: "checkbox",
                    checked: rule.enabled ? "true" : undefined,
                },
            }) as HTMLInputElement;
            toggleInput.checked = rule.enabled;
            toggleInput.addEventListener("change", () => {
                const presenter = this.presenter;
                if (!presenter) return;
                presenter.toggleRule(rule.id, toggleInput.checked);
            });

            const controls = ruleItem.createDiv({ cls: "sm-encounter-rule-controls" });
            const scopeSelect = controls.createEl("select", {
                cls: "sm-encounter-input",
            }) as HTMLSelectElement;
            const scopeOptions: Array<{ value: EncounterRuleScope; label: string }> = [
                { value: "overall", label: "Entire encounter" },
                { value: "perPlayer", label: "Per character" },
            ];
            for (const option of scopeOptions) {
                scopeSelect.createEl("option", {
                    attr: { value: option.value, selected: option.value === rule.scope ? "true" : undefined },
                    text: option.label,
                });
            }
            scopeSelect.addEventListener("change", () => {
                const presenter = this.presenter;
                if (!presenter) return;
                presenter.updateRule(rule.id, { scope: scopeSelect.value as EncounterRuleScope });
            });

            const typeSelect = controls.createEl("select", {
                cls: "sm-encounter-input",
            }) as HTMLSelectElement;
            const typeOptions: Array<{ value: EncounterRuleModifierType; label: string }> = [
                { value: "flat", label: "Flat" },
                { value: "percentTotal", label: "% of total" },
                { value: "percentNextLevel", label: "% to next level" },
            ];
            for (const option of typeOptions) {
                typeSelect.createEl("option", {
                    attr: { value: option.value, selected: option.value === rule.modifierType ? "true" : undefined },
                    text: option.label,
                });
            }
            typeSelect.addEventListener("change", () => {
                const presenter = this.presenter;
                if (!presenter) return;
                presenter.updateRule(rule.id, { modifierType: typeSelect.value as EncounterRuleModifierType });
            });

            const valueField = createFieldContainer(controls);
            valueField.addClass("sm-encounter-field");
            const valueLabel = valueField.createEl("label", {
                attr: { for: `rule-${rule.id}-value` },
                text: "Value",
            });
            valueLabel.addClass("sm-encounter-inline-label");
            const valueInput = valueField.createEl("input", {
                cls: "sm-encounter-input",
                attr: {
                    id: `rule-${rule.id}-value`,
                    type: "number",
                    value: String(rule.modifierValue),
                },
            }) as HTMLInputElement;
            const ruleErrorEl = ruleItem.createDiv({ cls: "sm-encounter-error" });
            valueInput.addEventListener("change", () => {
                const presenter = this.presenter;
                if (!presenter) return;
                const numeric = Number(valueInput.value);
                if (!Number.isFinite(numeric)) {
                    ruleErrorEl.setText("Modifier value must be a number.");
                    return;
                }
                ruleErrorEl.setText("");
                presenter.updateRule(rule.id, { modifierValue: numeric });
            });

            const notesField = ruleItem.createDiv({ cls: "sm-encounter-field" });
            notesField.createEl("label", {
                attr: { for: `rule-${rule.id}-notes` },
                text: "Notes",
            });
            const notesInput = notesField.createEl("textarea", {
                cls: "sm-encounter-input",
                attr: {
                    id: `rule-${rule.id}-notes`,
                    rows: "2",
                },
                text: rule.notes ?? "",
            }) as HTMLTextAreaElement;
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
        this.resultTotalsEl.empty();
        this.resultTotalsEl.createDiv({
            cls: "sm-encounter-result-total",
            text: `Base XP: ${formatNumber(xpView.baseXp)}`,
        });
        this.resultTotalsEl.createDiv({
            cls: "sm-encounter-result-total",
            text: `Total modifiers: ${formatSignedNumber(xpView.totalRuleDelta)}`,
        });
        this.resultTotalsEl.createDiv({
            cls: "sm-encounter-result-total",
            text: `Total XP: ${formatNumber(xpView.totalXp)}`,
        });

        this.resultWarningsEl.empty();
        if (xpView.warnings.length) {
            const warning = this.resultWarningsEl.createDiv({ cls: "sm-encounter-callout" });
            xpView.warnings.forEach((message) => {
                warning.createEl("p", { text: message });
            });
        }

        this.resultPartyEl.empty();
        this.resultPartyEl.createEl("h4", {
            cls: "sm-encounter-subheading",
            text: "Per character",
        });
        if (!xpView.party.length) {
            this.resultPartyEl.createDiv({
                cls: "sm-encounter-empty-row",
                text: "No party members added yet.",
            });
        } else {
            for (const memberView of xpView.party) {
                const memberEl = this.resultPartyEl.createDiv({ cls: "sm-encounter-result-party-member" });
                const header = memberEl.createDiv({ cls: "sm-encounter-result-party-header" });
                header.createEl("span", {
                    cls: "name",
                    text: `${memberView.member.name} (Level ${memberView.member.level})`,
                });
                const stats = memberEl.createEl("ul", { cls: "sm-encounter-result-stats" });
                createStatItem(stats, "Base", formatNumber(memberView.baseXp));
                createStatItem(stats, "Modifiers", formatSignedNumber(memberView.modifiersDelta));
                createStatItem(stats, "Total", formatNumber(memberView.totalXp));
                createStatItem(
                    stats,
                    "XP to next level",
                    memberView.xpToNextLevel == null ? "—" : formatNumber(memberView.xpToNextLevel),
                );
                if (memberView.warnings.length) {
                    const warningEl = memberEl.createDiv({ cls: "sm-encounter-callout" });
                    memberView.warnings.forEach((warning) => {
                        warningEl.createEl("p", { text: warning });
                    });
                }
            }
        }

        this.resultRulesEl.empty();
        this.resultRulesEl.createEl("h4", {
            cls: "sm-encounter-subheading",
            text: "Rule effects",
        });
        if (!xpView.rules.length) {
            this.resultRulesEl.createDiv({
                cls: "sm-encounter-empty-row",
                text: "No rules applied.",
            });
        } else {
            for (const ruleView of xpView.rules) {
                const ruleResult = this.resultRulesEl.createDiv({ cls: "sm-encounter-result-rule" });
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
                if (ruleView.perMemberDeltas.length) {
                    const perMemberList = ruleResult.createEl("ul", { cls: "sm-encounter-rule-deltas" });
                    ruleView.perMemberDeltas.forEach((delta) => {
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
        const title = this.ruleFormTitleEl.value.trim();
        const scope = this.ruleFormScopeEl.value as EncounterRuleScope;
        const modifierType = this.ruleFormTypeEl.value as EncounterRuleModifierType;
        const valueRaw = this.ruleFormValueEl.value.trim();
        const notes = this.ruleFormNotesEl.value.trim();
        const enabled = this.ruleFormEnabledEl.checked;
        const numericValue = Number(valueRaw);
        const errors: string[] = [];
        if (!title) {
            errors.push("Title is required.");
        }
        if (!Number.isFinite(numericValue)) {
            errors.push("Modifier value must be a number.");
        }
        if (errors.length) {
            this.ruleFormErrorEl.setText(errors.join(" "));
            return;
        }

        const rule: Parameters<EncounterPresenter["addRule"]>[0] = {
            id: createId("rule"),
            title,
            scope,
            modifierType,
            modifierValue: numericValue,
            enabled,
        };
        if (notes !== "") {
            rule.notes = notes;
        }
        presenter.addRule(rule);

        this.ruleFormTitleEl.value = "";
        this.ruleFormScopeEl.value = "overall";
        this.ruleFormTypeEl.value = "flat";
        this.ruleFormValueEl.value = "0";
        this.ruleFormNotesEl.value = "";
        this.ruleFormEnabledEl.checked = true;
        this.ruleFormErrorEl.setText("");
        this.ruleFormTitleEl.focus();
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

function createStatItem(list: HTMLUListElement, label: string, value: string) {
    const item = list.createEl("li");
    item.createEl("span", { cls: "label", text: `${label}:` });
    item.createEl("span", { cls: "value", text: value });
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
