package src.domain.dungeon.published;

public record SetDungeonEditorOverlayCommand(DungeonOverlaySettings overlaySettings) {
    public SetDungeonEditorOverlayCommand {
        overlaySettings = overlaySettings == null ? DungeonOverlaySettings.defaults() : overlaySettings;
    }
}
