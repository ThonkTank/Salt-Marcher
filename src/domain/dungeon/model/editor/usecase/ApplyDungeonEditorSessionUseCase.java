package src.domain.dungeon.model.editor.usecase;

import java.util.Objects;
import java.util.function.Consumer;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonMapId;
import src.domain.dungeon.published.DungeonOperationResult;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSession;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionCommand;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionSnapshot;
import src.domain.dungeon.model.editor.port.DungeonEditorDungeonPort;
import src.domain.dungeon.model.editor.repository.DungeonEditorDungeonRepository;
import src.domain.dungeon.model.editor.helper.DungeonEditorWorkspaceMapBoundaryTranslationHelper;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues;

public final class ApplyDungeonEditorSessionUseCase {
    private final BuildDungeonEditorSnapshotUseCase snapshotBuilder;
    private final DungeonEditorSessionCommandUseCase commandWorkflow;
    private final Consumer<DungeonEditorSessionSnapshot.SnapshotData> snapshotPublisher;
    private DungeonEditorSession session = DungeonEditorSession.empty();

    public ApplyDungeonEditorSessionUseCase(
            DungeonEditorDungeonRepository dungeonRepository,
            DungeonEditorDungeonPort dungeonPort,
            Consumer<DungeonEditorSessionSnapshot.SnapshotData> snapshotPublisher
    ) {
        this.snapshotBuilder = new BuildDungeonEditorSnapshotUseCase(dungeonRepository, dungeonPort);
        this.commandWorkflow = new DungeonEditorSessionCommandUseCase(dungeonRepository, dungeonPort, snapshotBuilder);
        this.snapshotPublisher = Objects.requireNonNull(snapshotPublisher, "snapshotPublisher");
    }

    public void primeSelectedMap(@Nullable DungeonMapId mapId) {
        if (mapId != null) {
            session = session.primeSelectedMap(mapId.value());
            publishSnapshot();
        }
    }

    public void apply(@Nullable DungeonEditorSessionCommand command) {
        session = commandWorkflow.apply(session, command);
        publishSnapshot();
    }

    public DungeonEditorSessionSnapshot.SnapshotData snapshot() {
        DungeonEditorSessionSnapshot.SnapshotData snapshot = snapshotBuilder.execute(session);
        session = session.withSelectedMap(snapshot.selectedMapId())
                .withProjectionLevel(snapshot.projectionLevel());
        return snapshot;
    }

    public void publishSnapshot() {
        snapshotPublisher.accept(snapshot());
    }

    static DungeonMapId requireMapId(DungeonEditorWorkspaceValues.@Nullable MapId mapId) {
        DungeonMapId domainMapId = DungeonEditorWorkspaceMapBoundaryTranslationHelper.toDomainMapId(mapId);
        if (domainMapId == null) {
            throw new IllegalArgumentException("Dungeon-Map-ID fehlt.");
        }
        return domainMapId;
    }

    static String statusFromMessages(@Nullable DungeonOperationResult result) {
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
