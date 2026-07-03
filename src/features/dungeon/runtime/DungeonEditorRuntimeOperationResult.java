package src.features.dungeon.runtime;

import java.util.Arrays;
import java.util.List;

record DungeonEditorRuntimeOperationResult(
        List<DungeonEditorAction> actions,
        boolean publishRuntimeFrame,
        boolean publishSuppressedStateModelFrame
) {
    DungeonEditorRuntimeOperationResult {
        actions = actions == null ? List.of() : List.copyOf(actions);
    }

    static DungeonEditorRuntimeOperationResult none() {
        return new DungeonEditorRuntimeOperationResult(List.of(), false, true);
    }

    static DungeonEditorRuntimeOperationResult publish(DungeonEditorAction... actions) {
        return publish(actions == null ? List.of() : Arrays.asList(actions));
    }

    static DungeonEditorRuntimeOperationResult publish(List<DungeonEditorAction> actions) {
        return new DungeonEditorRuntimeOperationResult(actions, true, true);
    }

    static DungeonEditorRuntimeOperationResult publishAfterStateModelSideEffect() {
        return new DungeonEditorRuntimeOperationResult(List.of(), false, true);
    }

    DungeonEditorRuntimeOperationResult merge(DungeonEditorRuntimeOperationResult next) {
        DungeonEditorRuntimeOperationResult safeNext = next == null ? none() : next;
        if (actions.isEmpty()) {
            return new DungeonEditorRuntimeOperationResult(
                    safeNext.actions(),
                    publishRuntimeFrame || safeNext.publishRuntimeFrame(),
                    publishSuppressedStateModelFrame || safeNext.publishSuppressedStateModelFrame());
        }
        if (safeNext.actions().isEmpty()) {
            return new DungeonEditorRuntimeOperationResult(
                    actions,
                    publishRuntimeFrame || safeNext.publishRuntimeFrame(),
                    publishSuppressedStateModelFrame || safeNext.publishSuppressedStateModelFrame());
        }
        List<DungeonEditorAction> merged = new java.util.ArrayList<>(actions);
        merged.addAll(safeNext.actions());
        return new DungeonEditorRuntimeOperationResult(
                merged,
                publishRuntimeFrame || safeNext.publishRuntimeFrame(),
                publishSuppressedStateModelFrame || safeNext.publishSuppressedStateModelFrame());
    }

    boolean shouldPublish(boolean stateModelFrameSuppressed) {
        return publishRuntimeFrame || stateModelFrameSuppressed && publishSuppressedStateModelFrame;
    }
}
