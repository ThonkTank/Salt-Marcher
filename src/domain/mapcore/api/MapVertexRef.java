package src.domain.mapcore.published;

/**
 * Stable vertex reference used for shared edit semantics.
 */
public record MapVertexRef(
        int q,
        int r,
        int level
) {
}
