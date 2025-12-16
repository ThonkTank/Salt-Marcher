/**
 * Playlist Types (Re-exported from shared types)
 *
 * This file maintains backward compatibility by re-exporting playlist types
 * from the shared types layer (src/services/domain).
 *
 * Workmode imports can continue using this path, but features/services
 * should import directly from @services/domain to avoid layer violations.
 */

export type { AudioTrack, PlaylistData } from "@services/domain";
