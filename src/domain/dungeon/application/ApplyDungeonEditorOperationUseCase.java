package src.domain.dungeon.application;

import src.domain.dungeon.map.aggregate.DungeonMap;
import src.domain.dungeon.map.policy.DungeonMapOperationFeedbackPolicy;
import src.domain.dungeon.map.value.DungeonDerivedState;
import src.domain.dungeon.map.value.DungeonMapIdentity;

import java.util.List;
import java.util.Objects;
import java.util.function.Function;
import org.jspecify.annotations.Nullable;

/**
 * Owns the fixed dungeon editor mutation pipeline.
 */
public final class ApplyDungeonEditorOperationUseCase {

    private static final DungeonMapOperationFeedbackPolicy OPERATION_FEEDBACK_POLICY =
            new DungeonMapOperationFeedbackPolicy();

    @FunctionalInterface
    public interface OperationMutation {
        DungeonMap apply(DungeonMap current);

        static OperationMutation identity() {
            return current -> current;
        }
    }

    public record OperationResultData(
            LoadDungeonSnapshotUseCase.DungeonSnapshotData snapshot,
            List<String> validationMessages,
            List<String> reactionMessages
    ) {
        public OperationResultData {
            validationMessages = validationMessages == null ? List.of() : List.copyOf(validationMessages);
            reactionMessages = reactionMessages == null ? List.of() : List.copyOf(reactionMessages);
        }
    }

    private final LoadDungeonMapUseCase loadDungeonMap;
    private final Function<DungeonMap, DungeonMap> saveMap;
    private final Function<DungeonMap, DungeonDerivedState> deriveState;
    private final AssembleDungeonSnapshotUseCase assembleDungeonSnapshot;
    private final PublishDungeonEditorHandlesUseCase publishDungeonEditorHandles;

    public ApplyDungeonEditorOperationUseCase(
            LoadDungeonMapUseCase loadDungeonMap,
            Function<DungeonMap, DungeonMap> saveMap,
            Function<DungeonMap, DungeonDerivedState> deriveState,
            AssembleDungeonSnapshotUseCase assembleDungeonSnapshot,
            PublishDungeonEditorHandlesUseCase publishDungeonEditorHandles
    ) {
        this.loadDungeonMap = Objects.requireNonNull(loadDungeonMap, "loadDungeonMap");
        this.saveMap = Objects.requireNonNull(saveMap, "saveMap");
        this.deriveState = Objects.requireNonNull(deriveState, "deriveState");
        this.assembleDungeonSnapshot = Objects.requireNonNull(assembleDungeonSnapshot, "assembleDungeonSnapshot");
        this.publishDungeonEditorHandles = Objects.requireNonNull(
                publishDungeonEditorHandles,
                "publishDungeonEditorHandles");
    }

    public OperationResultData execute(OperationMutation operation) {
        return execute(null, operation);
    }

    public OperationResultData execute(@Nullable DungeonMapIdentity mapId, OperationMutation operation) {
        DungeonMap current = currentMap(mapId);
        DungeonMap mutated = operation.apply(current);
        List<String> validationMessages = OPERATION_FEEDBACK_POLICY.validationMessages(current, mutated);
        List<String> reactionMessages = OPERATION_FEEDBACK_POLICY.reactionMessages(current, mutated);
        DungeonDerivedState derived = deriveState.apply(mutated);
        DungeonMap saved = saveMap.apply(mutated);
        var snapshot = snapshot(saved, derived);
        return new OperationResultData(snapshot, validationMessages, reactionMessages);
    }

    public OperationResultData preview(@Nullable DungeonMapIdentity mapId, OperationMutation operation) {
        DungeonMap current = currentMap(mapId);
        DungeonMap mutated = operation.apply(current);
        DungeonDerivedState derived = deriveState.apply(mutated);
        return new OperationResultData(
                snapshot(mutated, derived),
                OPERATION_FEEDBACK_POLICY.validationMessages(current, mutated),
                OPERATION_FEEDBACK_POLICY.reactionMessages(current, mutated));
    }

    private LoadDungeonSnapshotUseCase.DungeonSnapshotData snapshot(DungeonMap dungeonMap, DungeonDerivedState derived) {
        return assembleDungeonSnapshot.execute(
                dungeonMap,
                derived,
                publishDungeonEditorHandles.execute(dungeonMap));
    }

    private DungeonMap currentMap(@Nullable DungeonMapIdentity mapId) {
        return loadDungeonMap.execute(mapId);
    }
}
