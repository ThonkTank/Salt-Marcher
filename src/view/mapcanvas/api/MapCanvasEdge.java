package src.view.mapcanvas.api;

/**
 * View-local edge overlay payload for shared dungeon rendering.
 */
public record MapCanvasEdge(
        int fromQ,
        int fromR,
        int toQ,
        int toR,
        String kind,
        String label,
        boolean interactive,
        String ownerKind,
        long ownerId,
        String partKind
) {
}
