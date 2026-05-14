package src.data.dungeoneditor;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonAuthoredMutationResult;
import src.domain.dungeon.published.DungeonOperationResult;
import src.domain.dungeoneditor.model.session.model.DungeonEditorSessionValues;

final class DungeonEditorDungeonStatusFacts {

    private DungeonEditorDungeonStatusFacts() {
        throw new AssertionError("No instances.");
    }

    static String mutationStatusText(@Nullable DungeonAuthoredMutationResult mutation) {
        return statusFromMessages(operationResult(mutation));
    }

    static String previewStatusText(
            @Nullable DungeonAuthoredMutationResult mutation,
            DungeonEditorSessionValues.Preview preview
    ) {
        return preview == DungeonEditorSessionValues.Preview.none() ? "" : statusFromMessages(operationResult(mutation));
    }

    static @Nullable DungeonOperationResult operationResult(@Nullable DungeonAuthoredMutationResult mutation) {
        if (mutation instanceof DungeonAuthoredMutationResult.Operation operation) {
            return operation.result();
        }
        return null;
    }

    private static String statusFromMessages(@Nullable DungeonOperationResult result) {
        if (result == null) {
            return "";
        }
        if (!result.reactionMessages().isEmpty()) {
            return result.reactionMessages().getFirst();
        }
        if (!result.validationMessages().isEmpty()) {
            return result.validationMessages().getFirst();
        }
        return "";
    }
}
