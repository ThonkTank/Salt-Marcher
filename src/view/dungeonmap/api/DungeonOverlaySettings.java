package src.view.dungeonshared.ViewModel;
import java.util.List;
/**
 * Shared view-state for dungeon overlay placeholders.
 */
public record DungeonOverlaySettings(
        DungeonOverlayMode mode,
        int levelRange,
        double opacity,
        List<Integer> selectedLevels
) {
    public DungeonOverlaySettings {
        mode = mode == null ? DungeonOverlayMode.defaultMode() : mode;
        levelRange = Math.max(1, levelRange);
        opacity = Math.max(0.1, Math.min(1.0, opacity));
        selectedLevels = selectedLevels == null ? List.of() : List.copyOf(selectedLevels);
    }
    public static DungeonOverlaySettings defaults() {
        return new DungeonOverlaySettings(DungeonOverlayMode.defaultMode(), 1, 0.35, List.of());
    }
    public DungeonOverlaySettings withMode(DungeonOverlayMode nextMode) {
        return new DungeonOverlaySettings(nextMode, levelRange, opacity, selectedLevels);
    }
    public DungeonOverlaySettings withLevelRange(int nextRange) {
        return new DungeonOverlaySettings(mode, nextRange, opacity, selectedLevels);
    }
    public DungeonOverlaySettings withOpacity(double nextOpacity) {
        return new DungeonOverlaySettings(mode, levelRange, nextOpacity, selectedLevels);
    }
    public DungeonOverlaySettings withSelectedLevels(List<Integer> nextSelectedLevels) {
        return new DungeonOverlaySettings(mode, levelRange, opacity, nextSelectedLevels);
    }
}
