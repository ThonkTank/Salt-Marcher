package src.domain.dungeon.model.worldspace.usecase;

import java.util.List;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.projection.DungeonDerivedState;
import src.domain.dungeon.model.core.structure.DungeonMapIdentity;
import src.domain.dungeon.model.core.structure.DungeonMapOperationFeedbackRules;
import src.domain.dungeon.model.worldspace.DungeonMap;
import src.domain.dungeon.model.worldspace.repository.DungeonMapRepository;

/**
 * Owns the fixed dungeon editor mutation pipeline.
 */
public final class ApplyDungeonEditorOperationUseCase {

    private static final DungeonMapOperationFeedbackRules OPERATION_FEEDBACK_POLICY =
            new DungeonMapOperationFeedbackRules();

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

    @FunctionalInterface
    public interface Mutation {
        DungeonMap apply(DungeonMap current);
    }

    private final LoadDungeonMapUseCase loadDungeonMap;
    private final DungeonMapRepository repository;
    private final BuildDungeonDerivedStateUseCase deriveState;
    private final AssembleDungeonSnapshotUseCase assembleDungeonSnapshot;
    private final PublishDungeonEditorHandlesUseCase publishDungeonEditorHandles;

    public ApplyDungeonEditorOperationUseCase(
            LoadDungeonMapUseCase loadDungeonMap,
            DungeonMapRepository repository,
            BuildDungeonDerivedStateUseCase deriveState,
            AssembleDungeonSnapshotUseCase assembleDungeonSnapshot,
            PublishDungeonEditorHandlesUseCase publishDungeonEditorHandles
    ) {
        this.loadDungeonMap = Objects.requireNonNull(loadDungeonMap, "loadDungeonMap");
        this.repository = Objects.requireNonNull(repository, "repository");
        this.deriveState = Objects.requireNonNull(deriveState, "deriveState");
        this.assembleDungeonSnapshot = Objects.requireNonNull(assembleDungeonSnapshot, "assembleDungeonSnapshot");
        this.publishDungeonEditorHandles = Objects.requireNonNull(
                publishDungeonEditorHandles,
                "publishDungeonEditorHandles");
    }

    public OperationResultData execute(
            @Nullable DungeonMapIdentity mapId,
            @Nullable Mutation operation
    ) {
        DungeonMap current = currentMap(mapId);
        DungeonMap mutated = applyOperation(current, operation);
        List<String> validationMessages = OPERATION_FEEDBACK_POLICY.validationMessages(current, mutated);
        List<String> reactionMessages = OPERATION_FEEDBACK_POLICY.reactionMessages(current, mutated);
        DungeonDerivedState derived = deriveState.execute(mutated);
        DungeonMap saved = repository.save(mutated);
        var snapshot = snapshot(saved, derived);
        return new OperationResultData(snapshot, validationMessages, reactionMessages);
    }

    public OperationResultData preview(
            @Nullable DungeonMapIdentity mapId,
            @Nullable Mutation operation
    ) {
        DungeonMap current = currentMap(mapId);
        DungeonMap mutated = applyOperation(current, operation);
        DungeonDerivedState derived = deriveState.execute(mutated);
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

    private static DungeonMap applyOperation(
            DungeonMap current,
            @Nullable Mutation operation
    ) {
        return operation == null ? current : operation.apply(current);
    }
}
