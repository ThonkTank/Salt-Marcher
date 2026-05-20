package src.domain.dungeon.model.map.helper;

import java.util.List;
import src.domain.dungeon.model.map.model.DungeonCell;
import src.domain.dungeon.model.map.model.DungeonDerivedState;
import src.domain.dungeon.model.map.model.DungeonEdgeDirection;
import src.domain.dungeon.model.map.model.DungeonEditorHandleFacts;
import src.domain.dungeon.model.map.model.DungeonState;
import src.domain.dungeon.published.DungeonInspectorSnapshot;
import src.domain.dungeon.published.DungeonMapMode;
import src.domain.dungeon.published.DungeonOperationResult;
import src.domain.dungeon.published.DungeonSnapshot;
import src.domain.dungeon.published.DungeonAuthoredMutationResult;
import src.domain.dungeon.published.DungeonAuthoredReadResult;

public final class DungeonAuthoredPublishedProjectionHelper {

    private final DungeonPublishedMapSnapshotProjectionHelper mapProjectionHelper;

    public DungeonAuthoredPublishedProjectionHelper(DungeonPublishedMapSnapshotProjectionHelper mapProjectionHelper) {
        this.mapProjectionHelper = mapProjectionHelper;
    }

    public DungeonAuthoredReadResult snapshot(
            String mapName,
            DungeonDerivedState derived,
            List<DungeonEditorHandleFacts> editorHandles,
            long revision
    ) {
        return new DungeonAuthoredReadResult.CommittedSnapshot(
                dungeonSnapshot(mapName, derived, editorHandles, revision));
    }

    public DungeonAuthoredReadResult inspector(
            String title,
            String description,
            List<String> facts,
            List<DungeonInspectorSnapshot.RoomNarrationCard> roomNarrations
    ) {
        return new DungeonAuthoredReadResult.SelectionInspector(
                new DungeonInspectorSnapshot(title, description, facts, roomNarrations));
    }

    public DungeonAuthoredMutationResult mutation(
            String mapName,
            DungeonDerivedState derived,
            List<DungeonEditorHandleFacts> editorHandles,
            long revision,
            List<String> validationMessages,
            List<String> reactionMessages
    ) {
        return new DungeonAuthoredMutationResult.Operation(new DungeonOperationResult(
                dungeonSnapshot(mapName, derived, editorHandles, revision),
                validationMessages,
                reactionMessages));
    }

    public DungeonInspectorSnapshot.RoomNarrationCard roomNarration(
            long roomId,
            String roomName,
            String visualDescription,
            List<DungeonInspectorSnapshot.RoomExitNarration> exits
    ) {
        return new DungeonInspectorSnapshot.RoomNarrationCard(roomId, roomName, visualDescription, exits);
    }

    public DungeonInspectorSnapshot.RoomExitNarration roomExit(
            String label,
            DungeonCell cell,
            DungeonEdgeDirection direction,
            String description
    ) {
        return new DungeonInspectorSnapshot.RoomExitNarration(
                label,
                DungeonPublishedStateValueHelper.cell(cell),
                direction.name(),
                description);
    }

    private DungeonSnapshot dungeonSnapshot(
            String mapName,
            DungeonDerivedState derived,
            List<DungeonEditorHandleFacts> editorHandles,
            long revision
    ) {
        return new DungeonSnapshot(
                mapName,
                DungeonMapMode.EDITOR,
                mapProjectionHelper.snapshot(derived.map(), editorHandles),
                derived.aggregates().stream().map(DungeonAuthoredPublishedProjectionHelper::aggregateSummary).toList(),
                derived.relations().summaries(),
                DungeonPublishedStateValueHelper.revision(revision));
    }

    private static String aggregateSummary(DungeonState aggregate) {
        return aggregate.label() + " #" + aggregate.id();
    }
}
