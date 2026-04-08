package features.world.dungeon.shell.editor.statepane.input;

public record ComposeStatePaneInput(
        features.world.dungeon.dungeonmap.state.DungeonMapState mapState,
        features.world.dungeon.dungeonmap.application.DungeonMapLoadingService loadingService,
        features.world.dungeon.room.RoomObject roomObject,
        features.world.dungeon.state.EditorInteractionState interactionState
) {
}
