/**
 * Character Types (Re-exported from shared types)
 *
 * This file maintains backward compatibility by re-exporting character types
 * from the shared types layer (src/services/domain).
 *
 * Workmode imports can continue using this path, but features/services
 * should import directly from @services/domain to avoid layer violations.
 */

export type { Character, CharacterCreateData, CharacterUpdateData } from "@services/domain";
