package src.features.dungeon.runtime;

import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Supplier;

final class DungeonEditorRuntimeOperationPublisher {
    private DungeonEditorRuntimeOperationPublisher() {
    }

    static void apply(
            DungeonEditorStore store,
            DungeonEditorRuntimeFramePublisher framePublisher,
            Supplier<DungeonEditorRuntimeOperationResult> action
    ) {
        apply(store, framePublisher, action, () -> { });
    }

    static void apply(
            DungeonEditorStore store,
            DungeonEditorRuntimeFramePublisher framePublisher,
            Supplier<DungeonEditorRuntimeOperationResult> action,
            Runnable beforePublish
    ) {
        apply(store, framePublisher, action, ignored -> beforePublish.run());
    }

    static void apply(
            DungeonEditorStore store,
            DungeonEditorRuntimeFramePublisher framePublisher,
            Supplier<DungeonEditorRuntimeOperationResult> action,
            Consumer<DungeonEditorRuntimeOperationResult> beforePublish
    ) {
        DungeonEditorStore safeStore = Objects.requireNonNull(store, "store");
        DungeonEditorRuntimeFramePublisher safeFramePublisher =
                Objects.requireNonNull(framePublisher, "framePublisher");
        Consumer<DungeonEditorRuntimeOperationResult> safeBeforePublish =
                Objects.requireNonNull(beforePublish, "beforePublish");
        DungeonEditorRuntimeFramePublisher.StateModelFrameDeferral<DungeonEditorRuntimeOperationResult> result =
                safeFramePublisher.deferStateModelFramePublication(
                        Objects.requireNonNull(action, "action"));
        DungeonEditorRuntimeOperationResult operationResult = result.result() == null
                ? DungeonEditorRuntimeOperationResult.none()
                : result.result();
        for (DungeonEditorAction storeAction : operationResult.actions()) {
            safeStore.dispatch(storeAction);
        }
        if (operationResult.shouldPublish(result.stateModelFrameSuppressed())) {
            safeBeforePublish.accept(operationResult);
            safeFramePublisher.publishCurrentToSubscribers();
        }
    }
}
