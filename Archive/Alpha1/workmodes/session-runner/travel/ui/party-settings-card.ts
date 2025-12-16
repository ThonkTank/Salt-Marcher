// src/workmodes/session-runner/travel/ui/party-settings-card.ts
// Party configuration UI card for Session Runner
// Uses shared party store for individual character management

import { getAllCharacters, type Character } from "@services/state/character-store";
import { subscribePartyState, addPartyMember, updatePartyMember, removePartyMember, type PartyMember } from "@services/state/party-store";

export type PartySettingsCard = {
    root: HTMLElement;
    destroy(): void;
};

export function createPartySettingsCard(
    host: HTMLElement,
): PartySettingsCard {
    // Party Settings Card (direct card creation, compact variant)
    const partyCard = host.createDiv({ cls: "sm-panel-card sm-panel-card--compact is-expanded" });
    const partyHeader = partyCard.createDiv({ cls: "sm-panel-card__header" });
    partyHeader.createDiv({ cls: "sm-panel-card__icon", text: "▸" });
    partyHeader.createDiv({ cls: "sm-panel-card__title", text: "Party-Einstellungen" });
    const partyBody = partyCard.createDiv({ cls: "sm-panel-card__body" });

    // Toggle party card
    partyHeader.addEventListener("click", () => {
        if (partyCard.hasClass("is-expanded")) {
            partyCard.removeClass("is-expanded");
            partyCard.addClass("is-collapsed");
        } else {
            partyCard.removeClass("is-collapsed");
            partyCard.addClass("is-expanded");
        }
    });

    // Add Character Form
    const form = partyBody.createEl("form", { cls: "sm-party-form sm-party-form__grid" });

    // Character Search/Autocomplete Field (optional - loads from library)
    const searchField = form.createDiv({ cls: "sm-party-form__field sm-party-form__field--full-width" });
    searchField.createEl("label", { text: "Load from Library (optional)", attr: { for: "party-search-input" } });
    const searchInput = searchField.createEl("input", {
        type: "text",
        cls: "sm-session__travel-input",
        attr: {
            id: "party-search-input",
            placeholder: "Search characters by name...",
            autocomplete: "off"
        },
    }) as HTMLInputElement;

    // Autocomplete dropdown
    const searchDropdown = searchField.createDiv({ cls: "sm-party-search__dropdown", attr: { style: "display: none;" } });

    // Track selected character for auto-fill
    let selectedCharacter: Character | null = null;

    // Filter and display character suggestions
    function updateSearchSuggestions() {
        const query = searchInput.value.trim().toLowerCase();
        searchDropdown.empty();

        // Get all characters and filter by name (or show all if no query)
        const allCharacters = getAllCharacters();
        const matches = query
            ? allCharacters.filter(char => char.name.toLowerCase().includes(query)).slice(0, 5)
            : allCharacters.slice(0, 5); // Show first 5 characters if no query

        if (matches.length === 0) {
            searchDropdown.style.display = "none";
            selectedCharacter = null;
            return;
        }

        // Show dropdown with matches
        searchDropdown.style.display = "block";
        for (const character of matches) {
            const item = searchDropdown.createDiv({ cls: "sm-party-search__item" });

            // Character name (bold)
            item.createEl("div", {
                cls: "sm-party-search__name",
                text: character.name
            });

            // Character stats (class, level, AC, HP)
            item.createEl("div", {
                cls: "sm-party-search__stats",
                text: `${character.characterClass} • L${character.level} • AC: ${character.ac} • HP: ${character.maxHp}`
            });

            // Click handler to select character
            item.addEventListener("click", () => {
                selectedCharacter = character;
                searchInput.value = character.name;
                nameInput.value = character.name;
                levelInput.value = String(character.level);
                searchDropdown.style.display = "none";

                // Focus on XP input for quick entry
                xpInput.focus();
            });
        }
    }

    // Show all characters on focus (when clicking into field)
    searchInput.addEventListener("focus", () => {
        updateSearchSuggestions();
    });

    // Search input debounce (300ms)
    let searchTimeout: ReturnType<typeof setTimeout> | null = null;
    searchInput.addEventListener("input", () => {
        if (searchTimeout) clearTimeout(searchTimeout);
        searchTimeout = setTimeout(updateSearchSuggestions, 300);
    });

    // Hide dropdown when clicking outside
    document.addEventListener("click", (e) => {
        if (!searchField.contains(e.target as Node)) {
            searchDropdown.style.display = "none";
        }
    });

    // Keyboard navigation (ESC to close)
    searchInput.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            searchDropdown.style.display = "none";
            searchInput.blur();
        }
    });

    // Name Input
    const nameField = form.createDiv({ cls: "sm-party-form__field" });
    nameField.createEl("label", { text: "Name", attr: { for: "party-name-input" } });
    const nameInput = nameField.createEl("input", {
        type: "text",
        cls: "sm-session__travel-input",
        attr: {
            id: "party-name-input",
            placeholder: "Character name",
            required: "true"
        },
    }) as HTMLInputElement;

    // Level Input
    const levelField = form.createDiv({ cls: "sm-party-form__field" });
    levelField.createEl("label", { text: "Level", attr: { for: "party-level-input" } });
    const levelInput = levelField.createEl("input", {
        type: "number",
        cls: "sm-session__travel-input",
        attr: {
            id: "party-level-input",
            min: "1",
            step: "1",
            value: "1"
        },
    }) as HTMLInputElement;

    // Current XP Input (optional)
    const xpField = form.createDiv({ cls: "sm-party-form__field" });
    xpField.createEl("label", { text: "Current XP", attr: { for: "party-xp-input" } });
    const xpInput = xpField.createEl("input", {
        type: "number",
        cls: "sm-session__travel-input",
        attr: {
            id: "party-xp-input",
            min: "0",
            step: "1",
            placeholder: "Optional"
        },
    }) as HTMLInputElement;

    // Add Button
    const buttonField = form.createDiv({ cls: "sm-party-form__field sm-party-form__field--button" });
    const addButton = buttonField.createEl("button", {
        cls: "sm-button sm-button--primary",
        text: "Add Character",
        type: "submit",
    });

    // Error Display
    const errorEl = form.createDiv({ cls: "sm-party-form__error" });

    // Form submission handler
    form.addEventListener("submit", (event) => {
        event.preventDefault();
        handleAddCharacter();
    });

    // Clear error on input
    form.addEventListener("input", () => {
        errorEl.textContent = "";
    });

    function handleAddCharacter() {
        const name = nameInput.value.trim();
        const level = parseInt(levelInput.value, 10);
        const currentXp = xpInput.value.trim() ? parseInt(xpInput.value, 10) : undefined;

        // Validation
        if (!name) {
            errorEl.textContent = "Name is required";
            return;
        }

        if (!Number.isFinite(level) || level < 1) {
            errorEl.textContent = "Level must be at least 1";
            return;
        }

        if (currentXp !== undefined && (!Number.isFinite(currentXp) || currentXp < 0)) {
            errorEl.textContent = "Current XP must be 0 or greater";
            return;
        }

        // Create party member with UUID (and characterId if selected from library)
        const newMember: PartyMember = {
            id: crypto.randomUUID(),
            characterId: selectedCharacter?.id,  // Link to character library if selected
            name,
            level,
            currentXp,
        };

        // Add to store
        try {
            addPartyMember(newMember);

            // Clear form
            searchInput.value = "";
            nameInput.value = "";
            levelInput.value = "1";
            xpInput.value = "";
            errorEl.textContent = "";
            selectedCharacter = null;

            // Focus back on search input
            searchInput.focus();
        } catch (error) {
            errorEl.textContent = `Error adding character: ${error}`;
        }
    }

    // Party Members List
    const listEl = partyBody.createDiv({ cls: "sm-party-list sm-party-list__items" });

    // Summary (shows count and average level)
    const summaryEl = partyBody.createDiv({ cls: "sm-party-summary" });

    // Render party members
    function renderPartyList(members: readonly PartyMember[]) {
        listEl.empty();

        if (members.length === 0) {
            listEl.createDiv({
                cls: "sm-party-list__empty",
                text: "No party members added yet. Add characters to track individual levels and XP.",
            });
            summaryEl.textContent = "";
            return;
        }

        // Render each member
        for (const member of members) {
            const itemEl = listEl.createDiv({ cls: "sm-party-list__item" });

            // Character stats header (if linked to library character)
            if (member.characterId) {
                const character = getAllCharacters().find(c => c.id === member.characterId);
                if (character) {
                    const statsHeader = itemEl.createDiv({ cls: "sm-party-list__stats-header" });

                    // Class badge
                    statsHeader.createEl("span", {
                        cls: "sm-party-list__class-badge",
                        text: character.characterClass
                    });

                    // AC display
                    statsHeader.createEl("span", {
                        cls: "sm-party-list__stat",
                        text: `AC: ${character.ac}`
                    });

                    // HP display
                    statsHeader.createEl("span", {
                        cls: "sm-party-list__stat",
                        text: `HP: ${character.maxHp}`
                    });
                }
            }

            // Name Field
            const nameFieldEl = itemEl.createDiv({ cls: "sm-party-list__field" });
            nameFieldEl.createEl("label", {
                text: "Name",
                attr: { for: `party-${member.id}-name` },
                cls: "sm-party-list__label"
            });
            const nameInputEl = nameFieldEl.createEl("input", {
                type: "text",
                cls: "sm-session__travel-input",
                attr: {
                    id: `party-${member.id}-name`,
                    value: member.name,
                },
            }) as HTMLInputElement;
            nameInputEl.addEventListener("change", () => {
                const nextName = nameInputEl.value.trim();
                if (nextName && nextName !== member.name) {
                    updatePartyMember(member.id, { name: nextName });
                } else if (!nextName) {
                    // Restore original name if empty
                    nameInputEl.value = member.name;
                }
            });

            // Level Field
            const levelFieldEl = itemEl.createDiv({ cls: "sm-party-list__field" });
            levelFieldEl.createEl("label", {
                text: "Level",
                attr: { for: `party-${member.id}-level` },
                cls: "sm-party-list__label"
            });
            const levelInputEl = levelFieldEl.createEl("input", {
                type: "number",
                cls: "sm-session__travel-input",
                attr: {
                    id: `party-${member.id}-level`,
                    min: "1",
                    step: "1",
                    value: String(member.level),
                },
            }) as HTMLInputElement;
            levelInputEl.addEventListener("change", () => {
                const nextLevel = parseInt(levelInputEl.value, 10);
                if (Number.isFinite(nextLevel) && nextLevel >= 1 && nextLevel !== member.level) {
                    updatePartyMember(member.id, { level: nextLevel });
                } else {
                    // Restore original level if invalid
                    levelInputEl.value = String(member.level);
                }
            });

            // Current XP Field (optional)
            const xpFieldEl = itemEl.createDiv({ cls: "sm-party-list__field" });
            xpFieldEl.createEl("label", {
                text: "XP",
                attr: { for: `party-${member.id}-xp` },
                cls: "sm-party-list__label"
            });
            const xpInputEl = xpFieldEl.createEl("input", {
                type: "number",
                cls: "sm-session__travel-input",
                attr: {
                    id: `party-${member.id}-xp`,
                    min: "0",
                    step: "1",
                    value: member.currentXp !== undefined ? String(member.currentXp) : "",
                    placeholder: "Optional",
                },
            }) as HTMLInputElement;
            xpInputEl.addEventListener("change", () => {
                const xpValue = xpInputEl.value.trim();
                if (xpValue === "") {
                    // Clear XP if empty
                    updatePartyMember(member.id, { currentXp: undefined });
                } else {
                    const nextXp = parseInt(xpValue, 10);
                    if (Number.isFinite(nextXp) && nextXp >= 0 && nextXp !== member.currentXp) {
                        updatePartyMember(member.id, { currentXp: nextXp });
                    } else {
                        // Restore original XP if invalid
                        xpInputEl.value = member.currentXp !== undefined ? String(member.currentXp) : "";
                    }
                }
            });

            // Remove Button
            const removeButton = itemEl.createEl("button", {
                cls: "sm-button sm-button--danger sm-party-list__remove sm-party-list__remove--icon",
                text: "×",
                type: "button",
                attr: {
                    title: "Remove",
                },
            });
            removeButton.addEventListener("click", () => {
                removePartyMember(member.id);
            });
        }

        // Update summary
        const totalLevel = members.reduce((sum, m) => sum + m.level, 0);
        const avgLevel = Math.floor(totalLevel / members.length);
        summaryEl.textContent = `Party: ${members.length} character${members.length === 1 ? "" : "s"}, Average Level ${avgLevel}`;
    }

    // Subscribe to party store changes
    const unsubscribe = subscribePartyState((state) => {
        renderPartyList(state.members);
    });

    const destroy = () => {
        unsubscribe();
        partyCard.remove();
    };

    return {
        root: partyCard,
        destroy,
    };
}
