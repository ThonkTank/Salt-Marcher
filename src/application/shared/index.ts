/**
 * Shared application services and utilities.
 */

export {
  createNotificationService,
  type NotificationService,
} from './notification-service';

export {
  showSlotAssignmentDialog,
  SlotAssignmentDialog,
  type SlotAssignmentDialogResult,
  type SlotAssignmentDialogOptions,
  type OpenSlot,
} from './dialogs';
