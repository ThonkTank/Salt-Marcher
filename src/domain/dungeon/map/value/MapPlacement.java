package src.domain.dungeon.map.value;

/**
 * Shared authored placement language for spatial topology and feature anchoring.
 */
public sealed interface MapPlacement permits EdgeAnchor, DoorSidePlacement, BoundarySidePlacement, StairPlacement {
}
