package src.domain.mapcore.published;

/**
 * Stable cell reference within one topology-aware map surface.
 */
public record MapCellRef(
        int q,
        int r,
        int level
) {
}
