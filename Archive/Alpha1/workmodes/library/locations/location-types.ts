/**
 * Location Types (Re-exported from shared types)
 *
 * This file maintains backward compatibility by re-exporting location types
 * from the shared types layer (src/services/domain).
 *
 * Workmode imports can continue using this path, but features/services
 * should import directly from @services/domain to avoid layer violations.
 */

export type {
	LocationType,
	OwnerType,
	LocationData,
	DungeonRoom,
	GridBounds,
	DungeonDoor,
	DungeonFeature,
	DungeonFeatureType,
	GridPosition,
	TokenType,
	DungeonToken,
} from "@services/domain";

export {
	getFeatureTypePrefix,
	getFeatureTypeLabel,
	getDefaultTokenColor,
	isDungeonLocation,
	isBuildingLocation,
} from "@services/domain";
