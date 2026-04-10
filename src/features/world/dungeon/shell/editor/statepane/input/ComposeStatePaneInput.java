package features.world.dungeon.shell.editor.statepane.input;

@SuppressWarnings("unused")
public record ComposeStatePaneInput(
        features.world.dungeon.dungeonmap.state.DungeonMapState mapState,
        features.world.dungeon.dungeonmap.DungeonMapObject mapObject,
        features.world.dungeon.room.RoomObject roomObject,
        features.world.dungeon.state.EditorInteractionState interactionState
) {
}
