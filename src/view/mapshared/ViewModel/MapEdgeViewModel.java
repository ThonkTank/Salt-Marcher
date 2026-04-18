package src.view.mapshared.ViewModel;

/**
 * View-local edge overlay payload for shared dungeon rendering.
 */
public record MapEdgeViewModel(
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
