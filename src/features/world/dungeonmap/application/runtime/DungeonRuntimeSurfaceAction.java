package features.world.dungeonmap.application.runtime;

public record DungeonRuntimeSurfaceAction(
        String label,
        String description,
        DungeonRuntimeLocation targetLocation
) {
    public DungeonRuntimeSurfaceAction {
        label = label == null || label.isBlank() ? "Aktion" : label.trim();
        description = description == null ? "" : description.trim();
    }
}
