// src/workmodes/library/entities/regions/types.ts
// Type definitions for region entities

export interface RegionData {
  name: string;
  terrain: string; // Reference to terrain name
  encounter_odds?: number; // 1/N chance (e.g., 6 means 1/6)
  description?: string;
}
