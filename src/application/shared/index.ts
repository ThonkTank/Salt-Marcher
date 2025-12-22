/**
 * Shared application services and utilities.
 */

export {
  createNotificationService,
  type NotificationService,
  type Notification,
  type NotificationType,
  // Feature-specific error formatters
  formatMapError,
  formatTravelError,
  formatTimeError,
  formatWeatherError,
  formatPartyError,
  formatEncounterError,
  formatCombatError,
  formatQuestError,
} from './notification-service';

export {
  showSlotAssignmentDialog,
  SlotAssignmentDialog,
  type SlotAssignmentDialogResult,
  type SlotAssignmentDialogOptions,
  type OpenSlot,
} from './dialogs';
