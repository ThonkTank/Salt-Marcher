/**
 * Slot Assignment Dialog
 *
 * Modal dialog for assigning a completed encounter to a quest slot.
 * Shows after encounter:resolved when open slots exist.
 */

import { App, Modal, Setting } from 'obsidian';
import { formatXPSplit } from '@/features/quest';

// ============================================================================
// Types
// ============================================================================

export interface OpenSlot {
  questId: string;
  questName: string;
  slotId: string;
  slotDescription: string;
}

export interface SlotAssignmentDialogResult {
  assigned: boolean;
  questId?: string;
  slotId?: string;
}

export interface SlotAssignmentDialogOptions {
  encounterId: string;
  encounterXP: number;
  openSlots: OpenSlot[];
}

// ============================================================================
// Dialog
// ============================================================================

/**
 * Modal dialog for quest slot assignment.
 * Returns a promise that resolves when the user makes a choice.
 */
export class SlotAssignmentDialog extends Modal {
  private options: SlotAssignmentDialogOptions;
  private selectedSlot: { questId: string; slotId: string } | null = null;
  private resolvePromise: ((result: SlotAssignmentDialogResult) => void) | null = null;

  constructor(app: App, options: SlotAssignmentDialogOptions) {
    super(app);
    this.options = options;
  }

  /**
   * Open the dialog and wait for user choice.
   */
  openAndWait(): Promise<SlotAssignmentDialogResult> {
    return new Promise((resolve) => {
      this.resolvePromise = resolve;
      this.open();
    });
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();

    // Title
    contentEl.createEl('h2', { text: 'Quest Encounter zuweisen' });

    // Description
    contentEl.createEl('p', {
      text: 'Dieser Encounter kann einer Quest zugewiesen werden. Der Quest-Pool erhält 60% der XP.',
    });

    // XP breakdown
    const xpInfo = contentEl.createDiv({ cls: 'slot-assignment-xp-info' });
    xpInfo.style.cssText = `
      background: var(--background-secondary);
      padding: 12px;
      border-radius: 6px;
      margin: 12px 0;
    `;
    const xpText = formatXPSplit(this.options.encounterXP);
    xpInfo.createEl('p', {
      text: `XP-Verteilung: ${xpText}`,
    });

    // Slot selection
    new Setting(contentEl)
      .setName('Quest-Slot auswählen')
      .setDesc('Wähle einen Quest-Slot für diesen Encounter')
      .addDropdown((dropdown) => {
        dropdown.addOption('', '-- Slot auswählen --');
        for (const slot of this.options.openSlots) {
          const value = `${slot.questId}|${slot.slotId}`;
          const label = `${slot.questName} - ${slot.slotDescription}`;
          dropdown.addOption(value, label);
        }
        dropdown.onChange((value) => {
          if (value) {
            const [questId, slotId] = value.split('|');
            this.selectedSlot = { questId, slotId };
          } else {
            this.selectedSlot = null;
          }
        });
      });

    // Buttons
    const buttonContainer = contentEl.createDiv({ cls: 'slot-assignment-buttons' });
    buttonContainer.style.cssText = `
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 16px;
    `;

    // Skip button
    const skipBtn = buttonContainer.createEl('button', { text: 'Überspringen' });
    skipBtn.addEventListener('click', () => {
      this.resolvePromise?.({ assigned: false });
      this.close();
    });

    // Assign button
    const assignBtn = buttonContainer.createEl('button', {
      text: 'Zuweisen',
      cls: 'mod-cta',
    });
    assignBtn.addEventListener('click', () => {
      if (this.selectedSlot) {
        this.resolvePromise?.({
          assigned: true,
          questId: this.selectedSlot.questId,
          slotId: this.selectedSlot.slotId,
        });
      } else {
        this.resolvePromise?.({ assigned: false });
      }
      this.close();
    });
  }

  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();

    // Ensure promise resolves if dialog closed without action
    if (this.resolvePromise) {
      this.resolvePromise({ assigned: false });
      this.resolvePromise = null;
    }
  }
}

/**
 * Helper function to show the slot assignment dialog.
 */
export function showSlotAssignmentDialog(
  app: App,
  options: SlotAssignmentDialogOptions
): Promise<SlotAssignmentDialogResult> {
  const dialog = new SlotAssignmentDialog(app, options);
  return dialog.openAndWait();
}
