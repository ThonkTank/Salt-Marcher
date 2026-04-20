package src.domain.mapcore.published;

/**
 * Stable edge reference used for shared boundary semantics.
 */
public record MapEdgeRef(
        MapCellRef from,
        MapCellRef to
) {
}
