package features.world.dungeon.shell.editor.input;

@SuppressWarnings("unused")
public record ComposeEditorInput(
        features.world.dungeon.dungeonmap.DungeonMapObject mapObject,
        features.world.dungeon.dungeonmap.state.DungeonMapState mapState,
        features.world.dungeon.catalog.application.DungeonMapCatalogService mapCatalogService,
        features.world.dungeon.state.DungeonEditorSessionState sessionState,
        features.world.dungeon.dungeonmap.application.DungeonMapApplicationService mapApplicationService,
        features.world.dungeon.dungeonmap.cluster.application.ApplicationObject clusterApplicationService,
        features.world.dungeon.dungeonmap.corridor.application.DungeonCorridorApplicationService corridorApplicationService,
        features.world.dungeon.application.stair.DungeonStairApplicationService stairApplicationService,
        features.world.dungeon.application.transition.DungeonTransitionApplicationService transitionApplicationService,
        features.world.dungeon.room.RoomObject roomObject,
        features.world.dungeon.shell.interaction.DungeonHitCollector hitCollector
) {
}
