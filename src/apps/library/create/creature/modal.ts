import { App, Modal } from "obsidian";
import {
    ABILITY_KEYS,
    ABILITY_LABEL,
    CreatureStatblock,
    SKILL_OPTIONS,
    SpellListGroup,
    buildStatblockMarkdown,
    cloneStatblock,
    createEmptyStatblock,
    createSpellGroup,
    ensureSkillName,
    parseListInput,
} from "./statblock";

type SubmitHandler = (result: { statblock: CreatureStatblock; markdown: string }) => void | Promise<void>;

type CancelHandler = () => void;

export interface CreatureCreatorOptions {
    initial?: Partial<CreatureStatblock>;
    onSubmit?: SubmitHandler;
    onCancel?: CancelHandler;
}

export interface CreatureCreatorHandle {
    destroy(): void;
    getState(): CreatureStatblock;
    update(patch: Partial<CreatureStatblock>): void;
}

type SavingThrowInputs = {
    checkbox: HTMLInputElement;
    override: HTMLInputElement;
};

type SpellListRenderers = {
    container: HTMLElement;
    type: keyof Pick<CreatureStatblock, "spellcastingPerDay" | "spellcastingPerRest" | "spellcastingBySlot" | "spellcastingOther">;
    label: string;
};

function mergeIntoState(target: CreatureStatblock, patch: Partial<CreatureStatblock>): void {
    if (!patch) return;
    const assign = <K extends keyof CreatureStatblock>(key: K) => {
        if (patch[key] !== undefined) (target[key] as CreatureStatblock[K]) = patch[key] as CreatureStatblock[K];
    };
    assign("name");
    assign("size");
    assign("type");
    assign("alignment");
    assign("armorClass");
    assign("hitPoints");
    assign("hitDice");
    assign("speed");
    assign("proficiencyBonus");
    assign("challengeRating");
    assign("initiativeEnabled");
    assign("initiative");
    assign("skills");
    assign("senses");
    assign("languages");
    assign("resistances");
    assign("immunities");
    assign("vulnerabilities");
    assign("traits");
    assign("actions");
    assign("bonusActions");
    assign("reactions");
    assign("legendaryActions");
    assign("spellcastingAbility");
    assign("spellSaveDc");
    assign("spellAttackBonus");
    assign("spellcastingAtWill");
    assign("spellcastingPerDay");
    assign("spellcastingPerRest");
    assign("spellcastingBySlot");
    assign("spellcastingOther");
    assign("equipment");
    assign("xpEnabled");
    assign("experiencePoints");

    if (patch.abilityScores) {
        for (const key of ABILITY_KEYS) {
            if (patch.abilityScores[key] !== undefined) {
                target.abilityScores[key] = patch.abilityScores[key] ?? "";
            }
        }
    }
    if (patch.savingThrows) {
        for (const key of ABILITY_KEYS) {
            if (patch.savingThrows[key] !== undefined) {
                const next = patch.savingThrows[key];
                if (next) {
                    target.savingThrows[key] = {
                        enabled: next.enabled ?? target.savingThrows[key].enabled,
                        override: next.override ?? target.savingThrows[key].override,
                    };
                }
            }
        }
    }
}

function buildInitialState(initial?: Partial<CreatureStatblock>): CreatureStatblock {
    const base = createEmptyStatblock();
    if (!initial) return base;
    mergeIntoState(base, initial);
    if (initial.skills) base.skills = initial.skills.map((skill) => ({ ...skill }));
    if (initial.senses) base.senses = [...initial.senses];
    if (initial.languages) base.languages = [...initial.languages];
    if (initial.resistances) base.resistances = [...initial.resistances];
    if (initial.immunities) base.immunities = [...initial.immunities];
    if (initial.vulnerabilities) base.vulnerabilities = [...initial.vulnerabilities];
    if (initial.spellcastingAtWill) base.spellcastingAtWill = [...initial.spellcastingAtWill];
    if (initial.spellcastingPerDay) base.spellcastingPerDay = initial.spellcastingPerDay.map((group) => ({ label: group.label, spells: [...group.spells] }));
    if (initial.spellcastingPerRest) base.spellcastingPerRest = initial.spellcastingPerRest.map((group) => ({ label: group.label, spells: [...group.spells] }));
    if (initial.spellcastingBySlot) base.spellcastingBySlot = initial.spellcastingBySlot.map((group) => ({ label: group.label, spells: [...group.spells] }));
    if (initial.spellcastingOther) base.spellcastingOther = initial.spellcastingOther.map((group) => ({ label: group.label, spells: [...group.spells] }));
    return base;
}

export function mountCreatureCreator(parent: HTMLElement, options: CreatureCreatorOptions = {}): CreatureCreatorHandle {
    const state = buildInitialState(options.initial);
    const root = parent.createDiv({ cls: "sm-creature-form" });
    const form = root.createEl("form", { cls: "sm-creature-form__form" });

    const inputs: {
        name: HTMLInputElement;
        size: HTMLInputElement;
        type: HTMLInputElement;
        alignment: HTMLInputElement;
        armorClass: HTMLInputElement;
        hitPoints: HTMLInputElement;
        hitDice: HTMLInputElement;
        speed: HTMLInputElement;
        proficiencyBonus: HTMLInputElement;
        challengeRating: HTMLInputElement;
        abilityScores: Record<typeof ABILITY_KEYS[number], HTMLInputElement>;
        initiativeEnabled: HTMLInputElement;
        initiative: HTMLInputElement;
        xpEnabled: HTMLInputElement;
        experiencePoints: HTMLInputElement;
        senses: HTMLTextAreaElement;
        languages: HTMLTextAreaElement;
        resistances: HTMLTextAreaElement;
        immunities: HTMLTextAreaElement;
        vulnerabilities: HTMLTextAreaElement;
        traits: HTMLTextAreaElement;
        actions: HTMLTextAreaElement;
        bonusActions: HTMLTextAreaElement;
        reactions: HTMLTextAreaElement;
        legendaryActions: HTMLTextAreaElement;
        equipment: HTMLTextAreaElement;
        spellcastingAbility: HTMLInputElement;
        spellSaveDc: HTMLInputElement;
        spellAttackBonus: HTMLInputElement;
        spellcastingAtWill: HTMLTextAreaElement;
        savingThrows: Record<typeof ABILITY_KEYS[number], SavingThrowInputs>;
    } = {
        name: form.createEl("input") as HTMLInputElement,
        size: form.createEl("input") as HTMLInputElement,
        type: form.createEl("input") as HTMLInputElement,
        alignment: form.createEl("input") as HTMLInputElement,
        armorClass: form.createEl("input") as HTMLInputElement,
        hitPoints: form.createEl("input") as HTMLInputElement,
        hitDice: form.createEl("input") as HTMLInputElement,
        speed: form.createEl("input") as HTMLInputElement,
        proficiencyBonus: form.createEl("input") as HTMLInputElement,
        challengeRating: form.createEl("input") as HTMLInputElement,
        abilityScores: { str: form.createEl("input") as HTMLInputElement, dex: form.createEl("input") as HTMLInputElement, con: form.createEl("input") as HTMLInputElement, int: form.createEl("input") as HTMLInputElement, wis: form.createEl("input") as HTMLInputElement, cha: form.createEl("input") as HTMLInputElement },
        initiativeEnabled: form.createEl("input") as HTMLInputElement,
        initiative: form.createEl("input") as HTMLInputElement,
        xpEnabled: form.createEl("input") as HTMLInputElement,
        experiencePoints: form.createEl("input") as HTMLInputElement,
        senses: form.createEl("textarea") as HTMLTextAreaElement,
        languages: form.createEl("textarea") as HTMLTextAreaElement,
        resistances: form.createEl("textarea") as HTMLTextAreaElement,
        immunities: form.createEl("textarea") as HTMLTextAreaElement,
        vulnerabilities: form.createEl("textarea") as HTMLTextAreaElement,
        traits: form.createEl("textarea") as HTMLTextAreaElement,
        actions: form.createEl("textarea") as HTMLTextAreaElement,
        bonusActions: form.createEl("textarea") as HTMLTextAreaElement,
        reactions: form.createEl("textarea") as HTMLTextAreaElement,
        legendaryActions: form.createEl("textarea") as HTMLTextAreaElement,
        equipment: form.createEl("textarea") as HTMLTextAreaElement,
        spellcastingAbility: form.createEl("input") as HTMLInputElement,
        spellSaveDc: form.createEl("input") as HTMLInputElement,
        spellAttackBonus: form.createEl("input") as HTMLInputElement,
        spellcastingAtWill: form.createEl("textarea") as HTMLTextAreaElement,
        savingThrows: {
            str: { checkbox: form.createEl("input") as HTMLInputElement, override: form.createEl("input") as HTMLInputElement },
            dex: { checkbox: form.createEl("input") as HTMLInputElement, override: form.createEl("input") as HTMLInputElement },
            con: { checkbox: form.createEl("input") as HTMLInputElement, override: form.createEl("input") as HTMLInputElement },
            int: { checkbox: form.createEl("input") as HTMLInputElement, override: form.createEl("input") as HTMLInputElement },
            wis: { checkbox: form.createEl("input") as HTMLInputElement, override: form.createEl("input") as HTMLInputElement },
            cha: { checkbox: form.createEl("input") as HTMLInputElement, override: form.createEl("input") as HTMLInputElement },
        },
    };

    form.empty();

    const title = form.createEl("h2", { text: "Neuer Statblock" });
    title.addClass("sm-creature-form__title");

    const fieldset = (legend: string, description?: string) => {
        const set = form.createEl("fieldset", { cls: "sm-creature-form__fieldset" });
        set.createEl("legend", { text: legend });
        if (description) set.createEl("p", { cls: "sm-creature-form__hint", text: description });
        return set;
    };

    const identity = fieldset("Identität", "Basisdaten der Kreatur");
    const makeInput = (
        container: HTMLElement,
        label: string,
        input: HTMLInputElement | HTMLTextAreaElement,
        opts: { required?: boolean; type?: string; placeholder?: string } = {}
    ) => {
        const wrapper = container.createDiv({ cls: "sm-creature-form__row" });
        wrapper.createEl("label", { text: label });
        input = wrapper.appendChild(input);
        if (opts.type) (input as HTMLInputElement).type = opts.type;
        if (opts.placeholder) input.placeholder = opts.placeholder;
        if (opts.required) input.required = true;
        return input;
    };

    inputs.name = makeInput(identity, "Name", identity.createEl("input"), { required: true });
    inputs.size = makeInput(identity, "Größe", identity.createEl("input"), { required: true, placeholder: "z. B. Medium" });
    inputs.type = makeInput(identity, "Typ", identity.createEl("input"), { required: true, placeholder: "z. B. Humanoid" });
    inputs.alignment = makeInput(identity, "Gesinnung", identity.createEl("input"), { required: true, placeholder: "z. B. Neutral" });

    const combat = fieldset("Kampfwerte", "Rüstungsklasse, Lebenspunkte und Geschwindigkeit");
    inputs.armorClass = makeInput(combat, "Armor Class", combat.createEl("input"), { required: true, placeholder: "z. B. 15 (Ringmail)" });
    inputs.hitPoints = makeInput(combat, "Hit Points", combat.createEl("input"), { required: true, placeholder: "z. B. 85" });
    inputs.hitDice = makeInput(combat, "Hit Dice", combat.createEl("input"), { placeholder: "z. B. 10d8 + 30" });
    inputs.speed = makeInput(combat, "Speed", combat.createEl("input"), { required: true, placeholder: "z. B. 30 ft., fly 40 ft." });
    inputs.challengeRating = makeInput(combat, "Challenge Rating", combat.createEl("input"), { required: true, placeholder: "z. B. 5" });
    inputs.proficiencyBonus = makeInput(combat, "Proficiency Bonus", combat.createEl("input"), { required: true, placeholder: "+3" });

    const abilitiesSet = fieldset("Ability Scores", "STR bis CHA als Pflichtfelder");
    const abilityGrid = abilitiesSet.createDiv({ cls: "sm-creature-form__abilities" });
    for (const key of ABILITY_KEYS) {
        const row = abilityGrid.createDiv({ cls: "sm-creature-form__row" });
        row.createEl("label", { text: `${key.toUpperCase()} (${ABILITY_LABEL[key]})` });
        const abilityInput = row.createEl("input", {
            attr: { type: "number", step: "1", required: "true" },
        }) as HTMLInputElement;
        abilityInput.placeholder = "10";
        inputs.abilityScores[key] = abilityInput;
    }

    const listsSet = fieldset("Listen", "Werte mit Komma oder Zeilenumbruch trennen");
    inputs.resistances = makeInput(listsSet, "Resistances", listsSet.createEl("textarea"));
    inputs.immunities = makeInput(listsSet, "Immunities", listsSet.createEl("textarea"));
    inputs.vulnerabilities = makeInput(listsSet, "Vulnerabilities", listsSet.createEl("textarea"));
    inputs.senses = makeInput(listsSet, "Senses", listsSet.createEl("textarea"));
    inputs.languages = makeInput(listsSet, "Languages", listsSet.createEl("textarea"));

    const textSections = fieldset("Abschnitte", "Freitext für Traits und Aktionen");
    inputs.traits = makeInput(textSections, "Traits", textSections.createEl("textarea"));
    inputs.actions = makeInput(textSections, "Actions", textSections.createEl("textarea"));
    inputs.bonusActions = makeInput(textSections, "Bonus Actions", textSections.createEl("textarea"));
    inputs.reactions = makeInput(textSections, "Reactions", textSections.createEl("textarea"));
    inputs.legendaryActions = makeInput(textSections, "Legendary Actions", textSections.createEl("textarea"));

    const spellSet = fieldset("Spellcasting", "Ability, Save DC, Attack Bonus und vorbereitete Listen");
    inputs.spellcastingAbility = makeInput(spellSet, "Ability", spellSet.createEl("input"));
    inputs.spellSaveDc = makeInput(spellSet, "Save DC", spellSet.createEl("input"));
    inputs.spellAttackBonus = makeInput(spellSet, "Attack Bonus", spellSet.createEl("input"));
    inputs.spellcastingAtWill = makeInput(spellSet, "At Will", spellSet.createEl("textarea"));

    const perDayContainer = spellSet.createDiv({ cls: "sm-creature-form__spell-groups" });
    const perRestContainer = spellSet.createDiv({ cls: "sm-creature-form__spell-groups" });
    const bySlotContainer = spellSet.createDiv({ cls: "sm-creature-form__spell-groups" });
    const otherSpellContainer = spellSet.createDiv({ cls: "sm-creature-form__spell-groups" });

    const advancedDetails = form.createEl("details", { cls: "sm-creature-form__advanced" });
    advancedDetails.createEl("summary", { text: "Erweiterte Werte" });

    const initiativeRow = advancedDetails.createDiv({ cls: "sm-creature-form__row" });
    const initiativeLabel = initiativeRow.createEl("label");
    inputs.initiativeEnabled = initiativeLabel.createEl("input", { attr: { type: "checkbox" } }) as HTMLInputElement;
    initiativeLabel.appendText(" Initiative anzeigen");
    inputs.initiative = initiativeRow.createEl("input", { attr: { type: "text", placeholder: "+4" } }) as HTMLInputElement;

    const savingWrapper = advancedDetails.createDiv({ cls: "sm-creature-form__saving-throws" });
    savingWrapper.createEl("h3", { text: "Saving Throws" });
    for (const key of ABILITY_KEYS) {
        const row = savingWrapper.createDiv({ cls: "sm-creature-form__row" });
        const checkbox = row.createEl("input", { attr: { type: "checkbox" } }) as HTMLInputElement;
        const label = row.createEl("label", { text: key.toUpperCase() });
        label.prepend(checkbox);
        const override = row.createEl("input", { attr: { type: "text", placeholder: "+5" } }) as HTMLInputElement;
        inputs.savingThrows[key] = { checkbox, override };
    }

    const skillsSection = advancedDetails.createDiv({ cls: "sm-creature-form__skills" });
    skillsSection.createEl("h3", { text: "Skills" });
    const skillPicker = skillsSection.createDiv({ cls: "sm-creature-form__row" });
    const skillSelect = skillPicker.createEl("select");
    const addSkillOption = skillSelect.createEl("option", { value: "", text: "Skill wählen" });
    for (const skill of SKILL_OPTIONS) {
        skillSelect.createEl("option", { value: skill, text: skill });
    }
    const addSkillButton = skillPicker.createEl("button", { text: "Hinzufügen", attr: { type: "button" } });
    const skillList = skillsSection.createDiv({ cls: "sm-creature-form__skill-list" });

    inputs.equipment = makeInput(advancedDetails, "Equipment & Notes", advancedDetails.createEl("textarea"));

    const xpRow = advancedDetails.createDiv({ cls: "sm-creature-form__row" });
    const xpLabel = xpRow.createEl("label");
    inputs.xpEnabled = xpLabel.createEl("input", { attr: { type: "checkbox" } }) as HTMLInputElement;
    xpLabel.appendText(" XP anzeigen");
    inputs.experiencePoints = xpRow.createEl("input", { attr: { type: "text", placeholder: "z. B. 1,800" } }) as HTMLInputElement;

    const footer = form.createDiv({ cls: "sm-creature-form__footer" });
    const validationMessage = footer.createSpan({ cls: "sm-creature-form__validation" });
    const cancelBtn = footer.createEl("button", { text: "Abbrechen", attr: { type: "button" } });
    const submitBtn = footer.createEl("button", { text: "Speichern", attr: { type: "submit" } });

    const renderSkills = () => {
        skillList.empty();
        state.skills.forEach((skill) => {
            const row = skillList.createDiv({ cls: "sm-creature-form__row" });
            row.createEl("span", { text: skill.name });
            const bonusInput = row.createEl("input", { attr: { type: "text", placeholder: "+5" } }) as HTMLInputElement;
            bonusInput.value = skill.bonus;
            bonusInput.oninput = () => {
                skill.bonus = bonusInput.value;
            };
            const removeBtn = row.createEl("button", { text: "Entfernen", attr: { type: "button" } });
            removeBtn.onclick = () => {
                const index = state.skills.indexOf(skill);
                if (index >= 0) {
                    state.skills.splice(index, 1);
                    renderSkills();
                    updateSubmitState();
                }
            };
        });
    };

    const spellRenderers: SpellListRenderers[] = [
        { container: perDayContainer, type: "spellcastingPerDay", label: "pro Tag" },
        { container: perRestContainer, type: "spellcastingPerRest", label: "pro Rast" },
        { container: bySlotContainer, type: "spellcastingBySlot", label: "Spell Slots" },
        { container: otherSpellContainer, type: "spellcastingOther", label: "Weitere" },
    ];

    const renderSpellGroups = (renderer: SpellListRenderers) => {
        const groups = state[renderer.type] as SpellListGroup[];
        renderer.container.empty();
        renderer.container.createEl("h4", { text: renderer.label });
        groups.forEach((group) => {
            const card = renderer.container.createDiv({ cls: "sm-creature-form__spell-group" });
            const labelInput = card.createEl("input", { attr: { type: "text", placeholder: "Überschrift" } }) as HTMLInputElement;
            labelInput.value = group.label;
            labelInput.oninput = () => {
                group.label = labelInput.value;
            };
            const spellsArea = card.createEl("textarea", { attr: { rows: "3", placeholder: "Zauber\npro Zeile" } }) as HTMLTextAreaElement;
            spellsArea.value = group.spells.join("\n");
            spellsArea.oninput = () => {
                group.spells = parseListInput(spellsArea.value);
            };
            const removeBtn = card.createEl("button", { text: "Entfernen", attr: { type: "button" } });
            removeBtn.onclick = () => {
                const index = groups.indexOf(group);
                if (index >= 0) {
                    groups.splice(index, 1);
                    renderSpellGroups(renderer);
                }
            };
        });
        const addBtn = renderer.container.createEl("button", { text: `${renderer.label} hinzufügen`, attr: { type: "button" } });
        addBtn.onclick = () => {
            groups.push(createSpellGroup(renderer.label));
            renderSpellGroups(renderer);
        };
    };

    const updateAdvancedVisibility = () => {
        inputs.initiative.style.display = inputs.initiativeEnabled.checked ? "" : "none";
        inputs.initiative.toggleAttribute("disabled", !inputs.initiativeEnabled.checked);
        xpRow.classList.toggle("is-disabled", !inputs.xpEnabled.checked);
        inputs.experiencePoints.toggleAttribute("disabled", !inputs.xpEnabled.checked);
    };

    const syncInputs = () => {
        inputs.name.value = state.name;
        inputs.size.value = state.size;
        inputs.type.value = state.type;
        inputs.alignment.value = state.alignment;
        inputs.armorClass.value = state.armorClass;
        inputs.hitPoints.value = state.hitPoints;
        inputs.hitDice.value = state.hitDice;
        inputs.speed.value = state.speed;
        inputs.challengeRating.value = state.challengeRating;
        inputs.proficiencyBonus.value = state.proficiencyBonus;
        for (const key of ABILITY_KEYS) {
            inputs.abilityScores[key].value = state.abilityScores[key];
        }
        inputs.resistances.value = state.resistances.join("\n");
        inputs.immunities.value = state.immunities.join("\n");
        inputs.vulnerabilities.value = state.vulnerabilities.join("\n");
        inputs.senses.value = state.senses.join("\n");
        inputs.languages.value = state.languages.join("\n");
        inputs.traits.value = state.traits;
        inputs.actions.value = state.actions;
        inputs.bonusActions.value = state.bonusActions;
        inputs.reactions.value = state.reactions;
        inputs.legendaryActions.value = state.legendaryActions;
        inputs.spellcastingAbility.value = state.spellcastingAbility;
        inputs.spellSaveDc.value = state.spellSaveDc;
        inputs.spellAttackBonus.value = state.spellAttackBonus;
        inputs.spellcastingAtWill.value = state.spellcastingAtWill.join("\n");
        inputs.equipment.value = state.equipment;
        inputs.initiativeEnabled.checked = state.initiativeEnabled;
        inputs.initiative.value = state.initiative;
        inputs.xpEnabled.checked = state.xpEnabled;
        inputs.experiencePoints.value = state.experiencePoints;
        for (const key of ABILITY_KEYS) {
            const s = state.savingThrows[key];
            inputs.savingThrows[key].checkbox.checked = s.enabled;
            inputs.savingThrows[key].override.value = s.override;
        }
        renderSkills();
        spellRenderers.forEach(renderSpellGroups);
        updateAdvancedVisibility();
        advancedDetails.open = Boolean(
            state.initiativeEnabled ||
            state.skills.length ||
            state.equipment.trim() ||
            state.xpEnabled ||
            state.spellcastingAtWill.length ||
            state.spellcastingPerDay.length ||
            state.spellcastingPerRest.length ||
            state.spellcastingBySlot.length ||
            state.spellcastingOther.length
        );
    };

    const updateSubmitState = () => {
        const requiredFieldsFilled = [
            state.name,
            state.size,
            state.type,
            state.alignment,
            state.armorClass,
            state.hitPoints,
            state.speed,
            state.challengeRating,
            state.proficiencyBonus,
        ].every((value) => value.trim().length > 0);
        const abilityFilled = ABILITY_KEYS.every((key) => state.abilityScores[key].trim().length > 0);
        const valid = requiredFieldsFilled && abilityFilled;
        submitBtn.disabled = !valid;
        validationMessage.setText(valid ? "" : "Bitte alle Pflichtfelder ausfüllen.");
    };

    const attachInputHandlers = () => {
        inputs.name.oninput = () => { state.name = inputs.name.value; updateSubmitState(); };
        inputs.size.oninput = () => { state.size = inputs.size.value; updateSubmitState(); };
        inputs.type.oninput = () => { state.type = inputs.type.value; updateSubmitState(); };
        inputs.alignment.oninput = () => { state.alignment = inputs.alignment.value; updateSubmitState(); };
        inputs.armorClass.oninput = () => { state.armorClass = inputs.armorClass.value; updateSubmitState(); };
        inputs.hitPoints.oninput = () => { state.hitPoints = inputs.hitPoints.value; updateSubmitState(); };
        inputs.hitDice.oninput = () => { state.hitDice = inputs.hitDice.value; };
        inputs.speed.oninput = () => { state.speed = inputs.speed.value; updateSubmitState(); };
        inputs.challengeRating.oninput = () => { state.challengeRating = inputs.challengeRating.value; updateSubmitState(); };
        inputs.proficiencyBonus.oninput = () => { state.proficiencyBonus = inputs.proficiencyBonus.value; updateSubmitState(); };
        for (const key of ABILITY_KEYS) {
            inputs.abilityScores[key].oninput = () => {
                state.abilityScores[key] = inputs.abilityScores[key].value;
                updateSubmitState();
            };
        }
        inputs.resistances.oninput = () => { state.resistances = parseListInput(inputs.resistances.value); };
        inputs.immunities.oninput = () => { state.immunities = parseListInput(inputs.immunities.value); };
        inputs.vulnerabilities.oninput = () => { state.vulnerabilities = parseListInput(inputs.vulnerabilities.value); };
        inputs.senses.oninput = () => { state.senses = parseListInput(inputs.senses.value); };
        inputs.languages.oninput = () => { state.languages = parseListInput(inputs.languages.value); };
        inputs.traits.oninput = () => { state.traits = inputs.traits.value; };
        inputs.actions.oninput = () => { state.actions = inputs.actions.value; };
        inputs.bonusActions.oninput = () => { state.bonusActions = inputs.bonusActions.value; };
        inputs.reactions.oninput = () => { state.reactions = inputs.reactions.value; };
        inputs.legendaryActions.oninput = () => { state.legendaryActions = inputs.legendaryActions.value; };
        inputs.spellcastingAbility.oninput = () => { state.spellcastingAbility = inputs.spellcastingAbility.value; };
        inputs.spellSaveDc.oninput = () => { state.spellSaveDc = inputs.spellSaveDc.value; };
        inputs.spellAttackBonus.oninput = () => { state.spellAttackBonus = inputs.spellAttackBonus.value; };
        inputs.spellcastingAtWill.oninput = () => { state.spellcastingAtWill = parseListInput(inputs.spellcastingAtWill.value); };
        inputs.equipment.oninput = () => { state.equipment = inputs.equipment.value; };
        inputs.initiativeEnabled.onchange = () => {
            state.initiativeEnabled = inputs.initiativeEnabled.checked;
            updateAdvancedVisibility();
        };
        inputs.initiative.oninput = () => { state.initiative = inputs.initiative.value; };
        inputs.xpEnabled.onchange = () => {
            state.xpEnabled = inputs.xpEnabled.checked;
            updateAdvancedVisibility();
        };
        inputs.experiencePoints.oninput = () => { state.experiencePoints = inputs.experiencePoints.value; };
        for (const key of ABILITY_KEYS) {
            const controls = inputs.savingThrows[key];
            controls.checkbox.onchange = () => {
                state.savingThrows[key].enabled = controls.checkbox.checked;
            };
            controls.override.oninput = () => {
                state.savingThrows[key].override = controls.override.value;
            };
        }
        addSkillButton.onclick = () => {
            const selected = ensureSkillName(skillSelect.value || "");
            if (!selected) return;
            if (!state.skills.some((skill) => skill.name === selected)) {
                state.skills.push({ name: selected, bonus: "" });
                renderSkills();
                skillSelect.value = "";
            }
        };
    };

    attachInputHandlers();
    syncInputs();
    updateSubmitState();

    form.onsubmit = async (event) => {
        event.preventDefault();
        updateSubmitState();
        if (submitBtn.disabled) {
            form.reportValidity();
            return;
        }
        const snapshot = cloneStatblock(state);
        const markdown = buildStatblockMarkdown(snapshot);
        await options.onSubmit?.({ statblock: snapshot, markdown });
    };

    cancelBtn.onclick = () => {
        options.onCancel?.();
    };

    return {
        destroy() {
            root.detach();
        },
        getState() {
            return cloneStatblock(state);
        },
        update(patch) {
            mergeIntoState(state, patch);
            syncInputs();
            updateSubmitState();
        },
    };
}

export class CreateCreatureModal extends Modal {
    private options: CreatureCreatorOptions;
    private handle: CreatureCreatorHandle | null = null;

    constructor(app: App, options: CreatureCreatorOptions = {}) {
        super(app);
        this.options = options;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("sm-creature-modal");
        this.handle = mountCreatureCreator(contentEl, {
            initial: this.options.initial,
            onSubmit: async (result) => {
                await this.options.onSubmit?.(result);
                this.close();
            },
            onCancel: () => {
                this.close();
                this.options.onCancel?.();
            },
        });
    }

    onClose() {
        this.handle?.destroy();
        this.handle = null;
    }
}

