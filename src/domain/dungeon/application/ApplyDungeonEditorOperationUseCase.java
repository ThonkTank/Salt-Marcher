package src.domain.dungeon.application;

import src.domain.dungeon.map.aggregate.DungeonMap;
import src.domain.dungeon.map.port.DungeonMapRepository;
import src.domain.dungeon.map.port.DungeonMapSearch;
import src.domain.dungeon.map.value.DungeonDerivedState;
import src.domain.dungeon.map.value.DungeonCell;
import src.domain.dungeon.map.value.DungeonEditorHandle;
import src.domain.dungeon.map.value.DungeonMapIdentity;
import src.domain.dungeon.map.value.DungeonRoomExitDescription;
import src.domain.dungeon.map.value.DungeonRoomNarration;
import src.domain.dungeon.map.value.DungeonTopologyRef;

import java.util.List;
import java.util.Optional;
import org.jspecify.annotations.Nullable;

/**
 * Owns the fixed dungeon editor mutation pipeline.
 */
public final class ApplyDungeonEditorOperationUseCase {

    public sealed interface OperationInput permits
            OperationInput.MoveTopologyElement,
            OperationInput.MoveEditorHandle,
            OperationInput.MoveRoomAnchor,
            OperationInput.PaintRoomRectangle,
            OperationInput.DeleteRoomRectangle,
            OperationInput.SaveRoomNarration,
            OperationInput.ResetDemoLayout,
            OperationInput.NoChange {

        record MoveTopologyElement(DungeonTopologyRef ref, int deltaQ, int deltaR, int deltaLevel)
                implements OperationInput {
        }

        record MoveEditorHandle(DungeonEditorHandle handle, int deltaQ, int deltaR, int deltaLevel)
                implements OperationInput {
        }

        record MoveRoomAnchor(int deltaQ, int deltaR) implements OperationInput {
        }

        record PaintRoomRectangle(DungeonCell start, DungeonCell end) implements OperationInput {
        }

        record DeleteRoomRectangle(DungeonCell start, DungeonCell end) implements OperationInput {
        }

        record SaveRoomNarration(
                long roomId,
                String visualDescription,
                List<DungeonRoomExitDescription> exits
        ) implements OperationInput {
            public SaveRoomNarration {
                visualDescription = visualDescription == null ? "" : visualDescription;
                exits = exits == null ? List.of() : List.copyOf(exits);
            }
        }

        record ResetDemoLayout() implements OperationInput {
        }

        record NoChange() implements OperationInput {
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

    private final DungeonMapRepository repository;
    private final DungeonMapSearch search;
    private final BuildDungeonDerivedStateUseCase derive;

    public ApplyDungeonEditorOperationUseCase(
            DungeonMapRepository repository,
            DungeonMapSearch search,
            BuildDungeonDerivedStateUseCase derive
    ) {
        this.repository = repository;
        this.search = search;
        this.derive = derive;
    }

    public OperationResultData execute(OperationInput operation) {
        return execute(null, operation);
    }

    public OperationResultData execute(@Nullable DungeonMapIdentity mapId, OperationInput operation) {
        DungeonMap current = currentMap(mapId);
        DungeonMap mutated = apply(current, operation);
        List<String> validationMessages = mutated.validationMessages();
        List<String> reactionMessages = current.reactionMessages(mutated);
        DungeonDerivedState derived = derive.execute(mutated);
        DungeonMap saved = repository.save(mutated);
        var snapshot = snapshot(saved, derived);
        return new OperationResultData(snapshot, validationMessages, reactionMessages);
    }

    public OperationResultData preview(@Nullable DungeonMapIdentity mapId, OperationInput operation) {
        DungeonMap current = currentMap(mapId);
        DungeonMap mutated = apply(current, operation);
        return new OperationResultData(
                snapshot(mutated, derive.execute(mutated)),
                mutated.validationMessages(),
                current.reactionMessages(mutated));
    }

    private DungeonMap apply(DungeonMap current, OperationInput operation) {
        if (operation instanceof OperationInput.MoveTopologyElement moveTopologyElement) {
            return current.moveTopologyElement(
                    moveTopologyElement.ref(),
                    moveTopologyElement.deltaQ(),
                    moveTopologyElement.deltaR(),
                    moveTopologyElement.deltaLevel());
        }
        if (operation instanceof OperationInput.MoveEditorHandle moveEditorHandle) {
            return current.moveEditorHandle(
                    moveEditorHandle.handle(),
                    moveEditorHandle.deltaQ(),
                    moveEditorHandle.deltaR(),
                    moveEditorHandle.deltaLevel());
        }
        if (operation instanceof OperationInput.MoveRoomAnchor moveRoomAnchor) {
            return current.moveRoomAnchor(moveRoomAnchor.deltaQ(), moveRoomAnchor.deltaR());
        }
        if (operation instanceof OperationInput.PaintRoomRectangle paintRoomRectangle) {
            DungeonCell start = paintRoomRectangle.start();
            DungeonCell end = paintRoomRectangle.end();
            return start == null || end == null ? current : current.paintRoomRectangle(start, end);
        }
        if (operation instanceof OperationInput.DeleteRoomRectangle deleteRoomRectangle) {
            DungeonCell start = deleteRoomRectangle.start();
            DungeonCell end = deleteRoomRectangle.end();
            return start == null || end == null ? current : current.deleteRoomRectangle(start, end);
        }
        if (operation instanceof OperationInput.SaveRoomNarration saveRoomNarration) {
            return current.saveRoomNarration(
                    saveRoomNarration.roomId(),
                    new DungeonRoomNarration(
                            saveRoomNarration.visualDescription(),
                            saveRoomNarration.exits()));
        }
        if (operation instanceof OperationInput.ResetDemoLayout) {
            return current.resetDemoLayout();
        }
        return current;
    }

    private LoadDungeonSnapshotUseCase.DungeonSnapshotData snapshot(DungeonMap dungeonMap, DungeonDerivedState derived) {
        return new LoadDungeonSnapshotUseCase.DungeonSnapshotData(
                dungeonMap.metadata().mapName(),
                derived,
                LoadDungeonSnapshotUseCase.editorHandles(dungeonMap),
                dungeonMap.revision());
    }

    private DungeonMap currentMap(@Nullable DungeonMapIdentity mapId) {
        Optional<DungeonMap> selectedMap = mapId == null ? Optional.empty() : repository.findById(mapId);
        return selectedMap.or(() -> search.firstMap())
                .orElseGet(() -> DungeonMap.empty(repository.nextMapId(), "Dungeon Bastion"));
    }
}
