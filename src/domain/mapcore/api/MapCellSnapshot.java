package src.domain.mapcore.api;

/**
 * Immutable cell payload published to views.
 */
public record MapCellSnapshot(
        MapCellRef ref,
        String label,
        MapCellStyle style
) {
}
