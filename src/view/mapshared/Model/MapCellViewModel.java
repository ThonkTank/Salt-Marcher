package src.view.mapshared.Model;

/**
 * View-local cell payload used by shared map rendering.
 */
public record MapCellViewModel(
        int q,
        int r,
        String label,
        boolean room,
        boolean corridor,
        boolean blocked,
        boolean interactive,
        boolean current,
        String ownerKind,
        long ownerId,
        String partKind
) {
}
