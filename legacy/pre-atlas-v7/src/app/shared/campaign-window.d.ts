import type { DesktopAPI } from './desktop-api';
declare global {
  interface Window {
    campaign: DesktopAPI;
  }
}
