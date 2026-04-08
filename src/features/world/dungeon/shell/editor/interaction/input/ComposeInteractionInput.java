package features.world.dungeon.shell.editor.interaction.input;

public record ComposeInteractionInput(
        features.world.dungeon.dungeonmap.state.DungeonMapState mapState,
        features.world.dungeon.dungeonmap.application.DungeonMapLoadingService loadingService,
        features.world.dungeon.state.DungeonEditorSessionState sessionState,
        features.world.dungeon.dungeonmap.application.DungeonMapApplicationService mapApplicationService,
        features.world.dungeon.dungeonmap.cluster.application.ApplicationObject clusterApplicationService,
        features.world.dungeon.dungeonmap.corridor.application.DungeonCorridorApplicationService corridorApplicationService,
        features.world.dungeon.application.stair.DungeonStairApplicationService stairApplicationService,
        features.world.dungeon.shell.interaction.DungeonHitCollector hitCollector,
        features.world.dungeon.state.EditorInteractionState interactionState,
        features.world.dungeon.shell.editor.statepane.StatePaneObject statePaneObject
) {
}
