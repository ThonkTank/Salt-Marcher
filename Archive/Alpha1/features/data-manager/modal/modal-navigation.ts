// src/features/data-manager/modal-navigation.ts
// Service for managing modal navigation with sections

import { createFormCard } from "../layout/layouts";
import type { FormCardHandles } from "../layout/layouts";
import type { SectionSpec } from "../types";

/**
 * Callback for mounting a section's content.
 */
export type MountSectionCallback = (handles: FormCardHandles, section: SectionSpec) => void;

/**
 * Options for ModalNavigation.
 */
export interface ModalNavigationOptions {
  container: HTMLElement;
  sections: SectionSpec[];
  title: string;
  subtitle?: string;
  onMountSection: MountSectionCallback;
  addValidator: (runner: () => string[]) => void;
}

/**
 * Service responsible for modal navigation with sections.
 * Handles IntersectionObserver, navigation buttons, and section creation.
 */
export class ModalNavigation {
  private sectionObserver: IntersectionObserver | null = null;
  private navButtons: Array<{ id: string; button: HTMLButtonElement }> = [];

  constructor(private options: ModalNavigationOptions) {}

  /**
   * Mount the navigation layout: header, shell (nav + content), and footer.
   * Returns the footer element for action buttons.
   */
  mount(): HTMLElement {
    const { container, sections, title, subtitle, onMountSection, addValidator } = this.options;

    // Header
    const header = container.createDiv({ cls: "sm-cc-modal-header" });
    header.createEl("h2", { text: title });
    if (subtitle) {
      header.createEl("p", {
        cls: "sm-cc-modal-subtitle",
        text: subtitle,
      });
    }

    // Shell layout
    const shell = container.createDiv({ cls: "sm-cc-shell" });
    const nav = shell.createEl("nav", { cls: "sm-cc-shell__nav", attr: { "aria-label": "Abschnitte" } });
    nav.createEl("p", { cls: "sm-cc-shell__nav-label", text: "Abschnitte" });
    const navList = nav.createDiv({ cls: "sm-cc-shell__nav-list" });
    const content = shell.createDiv({ cls: "sm-cc-shell__content" });

    // Active section tracking
    const setActive = (sectionId: string | null) => {
      for (const entry of this.navButtons) {
        const isActive = entry.id === sectionId;
        entry.button.classList.toggle("is-active", isActive);
        if (isActive) {
          entry.button.setAttribute("aria-current", "true");
        } else {
          entry.button.removeAttribute("aria-current");
        }
      }
    };

    // IntersectionObserver for auto-highlighting visible section
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting);
      if (!visible.length) return;
      visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      const next = (visible[0].target as HTMLElement).id;
      if (next) setActive(next);
    }, { root: container, rootMargin: "-45% 0px -45% 0px", threshold: 0 });
    this.sectionObserver = observer;

    // Create sections
    for (const section of sections) {
      this.createSection(section, content, navList, observer, setActive, onMountSection, addValidator);
    }

    // Set first section as active
    if (sections.length) {
      setActive(sections[0].id);
    }

    // Footer with buttons
    const footer = container.createDiv({ cls: "sm-cc-modal-footer" });
    return footer;
  }

  /**
   * Create a single section with navigation button and form card.
   */
  private createSection(
    section: SectionSpec,
    content: HTMLElement,
    navList: HTMLElement,
    observer: IntersectionObserver,
    setActive: (id: string | null) => void,
    onMountSection: MountSectionCallback,
    addValidator: (runner: () => string[]) => void
  ): void {
    const handles = createFormCard(content, {
      title: section.label,
      subtitle: section.description,
      registerValidator: (runner) => addValidator(runner),
      id: section.id,
    });

    const navButton = navList.createEl("button", {
      cls: "sm-cc-shell__nav-button",
      text: section.label,
    }) as HTMLButtonElement;
    navButton.type = "button";
    navButton.setAttribute("aria-controls", handles.card.id);
    this.navButtons.push({ id: handles.card.id, button: navButton });

    navButton.addEventListener("click", () => {
      setActive(handles.card.id);
      handles.card.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    // Render sub-items if available
    if (section.subItems && section.subItems.length > 0) {
      const subList = navList.createDiv({ cls: "sm-cc-shell__nav-subitems" });
      for (const subItem of section.subItems) {
        const subButton = subList.createEl("button", {
          cls: "sm-cc-shell__nav-subitem",
          text: subItem.label,
        }) as HTMLButtonElement;
        subButton.type = "button";
        subButton.addEventListener("click", () => {
          // Scroll to the specific entry within the section
          const entryEl = document.querySelector(`[data-entry-id="${subItem.id}"]`) as HTMLElement;
          if (entryEl) {
            entryEl.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        });
      }
    }

    observer.observe(handles.card);

    // Delegate section content mounting to callback
    onMountSection(handles, section);
  }

  /**
   * Scroll to a specific section by ID.
   */
  scrollToSection(id: string): void {
    const entry = this.navButtons.find(btn => btn.id === id);
    if (entry) {
      const section = document.getElementById(id);
      section?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  /**
   * Cleanup navigation resources.
   */
  dispose(): void {
    this.sectionObserver?.disconnect();
    this.sectionObserver = null;
    this.navButtons = [];
  }
}
