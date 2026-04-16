package src.domain.mapcore.api;

/**
 * Stable vertex reference used for shared edit semantics.
 */
public record MapVertexRef(
        int q,
        int r,
        int level
) {
}
