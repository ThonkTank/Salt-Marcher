package src.features.dungeon.runtime;

import java.util.Objects;
import src.domain.dungeon.DungeonAuthoredApplicationService;

final class DungeonEditorMapCatalogRuntimeOperations {
    private final DungeonAuthoredApplicationService.RuntimeCommands commands;
    private final DungeonEditorStairDraftRuntimeOperation stairDraftOperation;

    DungeonEditorMapCatalogRuntimeOperations(
            DungeonEditorAuthoredRuntimeOperationUseCases.MapUseCases useCases,
            DungeonEditorStairDraftRuntimeOperation stairDraftOperation
    ) {
        DungeonEditorAuthoredRuntimeOperationUseCases.MapUseCases safeUseCases =
                Objects.requireNonNull(useCases, "useCases");
        this.stairDraftOperation = Objects.requireNonNull(stairDraftOperation, "stairDraftOperation");
        commands = Objects.requireNonNull(safeUseCases.commands(), "commands");
    }

    DungeonEditorRuntimeOperationResult selectMap(long mapIdValue) {
        stairDraftOperation.clear();
        return DungeonEditorRuntimeResultTranslator.fromSnapshot(commands.selectMap(mapIdValue));
    }

    DungeonEditorRuntimeOperationResult createMap(String mapName) {
        stairDraftOperation.clear();
        return DungeonEditorRuntimeResultTranslator.fromSnapshot(commands.createMap(mapName));
    }

    DungeonEditorRuntimeOperationResult renameMap(long mapIdValue, String mapName) {
        return DungeonEditorRuntimeResultTranslator.fromSnapshot(commands.renameMap(mapIdValue, mapName));
    }

    DungeonEditorRuntimeOperationResult deleteMap(long mapIdValue) {
        stairDraftOperation.clear();
        return DungeonEditorRuntimeResultTranslator.fromSnapshot(commands.deleteMap(mapIdValue));
    }
}
