// src/features/data-manager/storage/entry-card.ts
// Entry card rendering logic - visual representation of individual entries
import { setIcon } from "obsidian";

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface EntryCardBadge {
  text: string;
  variant?: string;
  title?: string;
}

export interface EntryRenderContext<TEntry> {
  readonly entry: TEntry;
  readonly index: number;
  readonly total: number;
  readonly shouldFocus: boolean;
  readonly canMoveUp: boolean;
  readonly canMoveDown: boolean;
  remove(): void;
  moveUp(): void;
  moveDown(): void;
  requestRender(): void;
}

export interface EntryCardActionOptions<TEntry> {
  remove?: () => void;
  moveUp?: () => void;
  moveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  deleteLabel?: string;
  deleteAriaLabel?: string;
  moveUpAriaLabel?: string;
  moveDownAriaLabel?: string;
  showMoveButtons?: boolean;
  showDeleteButton?: boolean;
}

export interface EntryCardContentOptions<TEntry> {
  className?: string | string[];
  type?: string | ((context: EntryRenderContext<TEntry>) => string | null | undefined);
  badge?: EntryCardBadge | ((context: EntryRenderContext<TEntry>) => EntryCardBadge | null | undefined) | null;
  nameBoxClassName?: string | string[];
  renderName?: (nameBox: HTMLDivElement, context: EntryRenderContext<TEntry>) => HTMLElement | void;
  renderBody: (card: HTMLDivElement, context: EntryRenderContext<TEntry>) => void;
  actions?: EntryCardActionOptions<TEntry>;
  shouldFocus?: boolean;
  dataset?: Record<string, string>;
  renderHeadExtras?: (
    head: HTMLDivElement,
    context: EntryRenderContext<TEntry>,
    slots: EntryCardSlots
  ) => void;
}

export interface StandardEntryCardOptions<TEntry> extends EntryCardContentOptions<TEntry> {
  parent: HTMLElement;
  context: EntryRenderContext<TEntry>;
}

export interface EntryCardSlots {
  card: HTMLDivElement;
  head: HTMLDivElement;
  badge: HTMLSpanElement | null;
  nameBox: HTMLDivElement;
  actions: HTMLDivElement;
}

export type EntryCardConfigFactory<TEntry> = (
  context: EntryRenderContext<TEntry>
) => EntryCardContentOptions<TEntry>;

export type EntryRenderer<TEntry> = (
  container: HTMLElement,
  context: EntryRenderContext<TEntry>
) => HTMLElement;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function toArray(value?: string | string[]): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

// ============================================================================
// RENDERING FUNCTIONS
// ============================================================================

export function renderEntryCard<TEntry>(options: StandardEntryCardOptions<TEntry>): EntryCardSlots {
  const {
    parent,
    context,
    className,
    type,
    badge,
    nameBoxClassName,
    renderName,
    renderBody,
    actions,
    shouldFocus,
    dataset,
    renderHeadExtras,
  } = options;

  const classes = new Set<string>(["sm-cc-entry-card"]);
  for (const cls of toArray(className)) classes.add(cls);

  const resolvedType = typeof type === "function" ? type(context) : type;
  if (resolvedType) classes.add(`sm-cc-entry-card--type-${resolvedType}`);

  const card = parent.createDiv({ cls: Array.from(classes).join(" ") });
  if (dataset) {
    for (const [key, value] of Object.entries(dataset)) {
      card.dataset[key] = value;
    }
  }

  const head = card.createDiv({ cls: "sm-cc-entry-head" });

  const resolvedBadge = typeof badge === "function" ? badge(context) : badge;
  let badgeEl: HTMLSpanElement | null = null;
  if (resolvedBadge?.text) {
    const badgeClasses = ["sm-cc-entry-badge"];
    if (resolvedBadge.variant) {
      badgeClasses.push(`sm-cc-entry-badge--${resolvedBadge.variant}`);
    }
    badgeEl = head.createEl("span", {
      cls: badgeClasses.join(" "),
      text: resolvedBadge.text,
      attr: resolvedBadge.title ? { title: resolvedBadge.title } : undefined,
    });
  }

  const nameBoxClasses = ["sm-cc-entry-name-box", ...toArray(nameBoxClassName)];
  const nameBox = head.createDiv({ cls: nameBoxClasses.join(" ") });

  let focusTarget: HTMLElement | null = null;
  if (renderName) {
    const result = renderName(nameBox, context);
    if (result instanceof HTMLElement) {
      focusTarget = result;
    }
  }

  const actionsContainer = head.createDiv({ cls: "sm-cc-entry-actions" });
  const resolvedActions: EntryCardActionOptions<TEntry> = actions ?? {};

  const moveUpHandler = resolvedActions.moveUp ?? context.moveUp;
  const moveDownHandler = resolvedActions.moveDown ?? context.moveDown;
  const canMoveUp = resolvedActions.canMoveUp ?? context.canMoveUp;
  const canMoveDown = resolvedActions.canMoveDown ?? context.canMoveDown;
  const includeMoveButtons =
    resolvedActions.showMoveButtons ?? Boolean(moveUpHandler || moveDownHandler);

  if (includeMoveButtons && moveUpHandler) {
    const attributes: Record<string, string> = {
      type: "button",
      "aria-label": resolvedActions.moveUpAriaLabel ?? "Move Up",
    };
    if (!canMoveUp) {
      attributes.disabled = "true";
    }
    const moveUpBtn = actionsContainer.createEl("button", {
      cls: "sm-cc-entry-move-btn",
      attr: attributes,
    }) as HTMLButtonElement;
    setIcon(moveUpBtn, "chevron-up");
    moveUpBtn.addEventListener("click", moveUpHandler);
  }

  if (includeMoveButtons && moveDownHandler) {
    const attributes: Record<string, string> = {
      type: "button",
      "aria-label": resolvedActions.moveDownAriaLabel ?? "Move Down",
    };
    if (!canMoveDown) {
      attributes.disabled = "true";
    }
    const moveDownBtn = actionsContainer.createEl("button", {
      cls: "sm-cc-entry-move-btn",
      attr: attributes,
    }) as HTMLButtonElement;
    setIcon(moveDownBtn, "chevron-down");
    moveDownBtn.addEventListener("click", moveDownHandler);
  }

  const deleteHandler = resolvedActions.remove ?? context.remove;
  const includeDeleteButton = resolvedActions.showDeleteButton ?? Boolean(deleteHandler);
  if (includeDeleteButton && deleteHandler) {
    const deleteBtn = actionsContainer.createEl("button", {
      cls: "sm-cc-entry-delete",
      text: resolvedActions.deleteLabel ?? "×",
      attr: {
        type: "button",
        "aria-label": resolvedActions.deleteAriaLabel ?? "Delete Entry",
      },
    }) as HTMLButtonElement;
    deleteBtn.addEventListener("click", deleteHandler);
  }

  const slots: EntryCardSlots = {
    card,
    head,
    badge: badgeEl,
    nameBox,
    actions: actionsContainer,
  };

  renderHeadExtras?.(head, context, slots);

  const shouldAutoFocus = shouldFocus ?? context.shouldFocus;
  if (shouldAutoFocus) {
    setTimeout(() => {
      if (focusTarget && typeof focusTarget.focus === "function") {
        focusTarget.focus();
        return;
      }
      const candidate = nameBox.querySelector<HTMLElement>(
        "input, textarea, select, button, [tabindex]"
      );
      candidate?.focus();
    }, 0);
  }

  renderBody(card, context);

  return slots;
}

export function createEntryCardRenderer<TEntry>(
  factory: EntryCardConfigFactory<TEntry>
): EntryRenderer<TEntry> {
  return (container, context) => {
    const config = factory(context);
    return renderEntryCard({ parent: container, context, ...config }).card;
  };
}
