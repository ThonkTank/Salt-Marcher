package src.domain.mapcore.published;

/**
 * Semantic selection pointer shared between map views and domain APIs.
 */
public record MapSelectionRef(
        String ownerKind,
        long ownerId,
        String partKind,
        String label
) {
}
