// src/apps/library/create/creature/components/spellcasting/spell-input.ts
// Wiederverwendbarer Spell-Input mit Autocomplete

/**
 * Handle for a spell input component
 */
export interface SpellInputHandle {
  /** The underlying input element */
  input: HTMLInputElement;
  /** Refreshes the autocomplete dropdown matches */
  refreshMatches: () => void;
}

/**
 * Options for creating a spell input
 */
export interface SpellInputOptions {
  /** Placeholder text for the input */
  placeholder: string;
  /** Function that returns candidate spell names for autocomplete */
  getCandidates: () => readonly string[];
  /** Optional callback when the input value changes */
  onChange?: (value: string) => void;
}

/**
 * Creates a spell input with autocomplete dropdown
 *
 * Features:
 * - Autocomplete dropdown showing up to 24 matches
 * - Filters candidates based on query
 * - Click to select from dropdown
 * - ESC to clear and close
 * - Blur closes dropdown after 120ms delay
 *
 * @param parent - Parent element to append the input to
 * @param options - Configuration options
 * @returns Handle with input element and refresh method
 *
 * @example
 * ```ts
 * const handle = createSpellInput(container, {
 *   placeholder: "Zaubername",
 *   getCandidates: () => ["Fireball", "Magic Missile"],
 *   onChange: (value) => console.log("Selected:", value)
 * });
 * handle.input.value = "Fireball";
 * ```
 */
export function createSpellInput(
  parent: HTMLElement,
  options: SpellInputOptions
): SpellInputHandle {
  const box = parent.createDiv({ cls: "sm-preset-box sm-cc-spellcasting__input" });
  const input = box.createEl("input", {
    cls: "sm-preset-input",
    attr: { type: "text", placeholder: options.placeholder },
  }) as HTMLInputElement;
  const menu = box.createDiv({ cls: "sm-preset-menu" });

  const renderMatches = () => {
    const query = (input.value || "").toLowerCase();
    menu.empty();
    const matches = options
      .getCandidates()
      .filter((name) => !query || name.toLowerCase().includes(query))
      .slice(0, 24);

    if (!matches.length) {
      box.removeClass("is-open");
      return;
    }

    matches.forEach((name) => {
      const item = menu.createDiv({ cls: "sm-preset-item", text: name });
      item.onclick = () => {
        input.value = name;
        box.removeClass("is-open");
        input.dispatchEvent(new Event("input"));
      };
    });

    box.addClass("is-open");
  };

  input.addEventListener("focus", renderMatches);
  input.addEventListener("input", () => {
    if (options.onChange) options.onChange(input.value);
    if (document.activeElement === input) renderMatches();
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      input.value = "";
      box.removeClass("is-open");
    }
  });
  input.addEventListener("blur", () => {
    window.setTimeout(() => box.removeClass("is-open"), 120);
  });

  return {
    input,
    refreshMatches: () => {
      if (document.activeElement === input || box.hasClass("is-open")) {
        renderMatches();
      }
    },
  };
}
