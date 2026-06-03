package src.domain.dungeon.model.runtime.travel.projection;


public record TraversalSource(
        TraversalSourceKind kind,
        long id,
        String label
) {

    public TraversalSource {
        kind = kind == null ? TraversalSourceKind.defaultKind() : kind;
        id = Math.max(0L, id);
        label = label == null || label.isBlank() ? kind.defaultLabel(id) : label.trim();
    }
}
