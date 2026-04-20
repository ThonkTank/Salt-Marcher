package src.domain.mapcore.published;

/**
 * Immutable cell payload published to views.
 */
public record MapCellSnapshot(
        MapCellRef ref,
        String label,
        MapCellStyle style,
        MapSelectionRef selectionRef
) {
}
