package src.domain.dungeon.model.editor.helper;

import java.util.ArrayList;
import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorDungeonState;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.MapSnapshot;
import src.domain.dungeon.model.map.model.DungeonAreaFacts;
import src.domain.dungeon.model.map.model.DungeonBoundaryFacts;
import src.domain.dungeon.model.map.model.DungeonCell;
import src.domain.dungeon.model.map.model.DungeonDerivedState;
import src.domain.dungeon.model.map.model.DungeonEdge;
import src.domain.dungeon.model.map.model.DungeonEditorHandle;
import src.domain.dungeon.model.map.model.DungeonEditorHandleFacts;
import src.domain.dungeon.model.map.model.DungeonFeatureFacts;
import src.domain.dungeon.model.map.model.DungeonMapFacts;
import src.domain.dungeon.model.map.model.DungeonTopology;

public final class DungeonEditorAuthoredPublicationProjectionHelper {

    private DungeonEditorAuthoredPublicationProjectionHelper() {
    }

    public static SnapshotPublication snapshotPublication(
            String mapName,
            @Nullable DungeonDerivedState derived,
            List<DungeonEditorHandleFacts> editorHandles,
            long revision
    ) {
        return new SnapshotPublication(mapName, derived, editorHandles, revision);
    }

    public static DungeonEditorDungeonState.SnapshotFacts stateFacts(SnapshotPublication publication) {
        return publication.stateFacts();
    }

    public record SnapshotPublication(
            String mapName,
            @Nullable DungeonDerivedState derived,
            List<DungeonEditorHandleFacts> editorHandles,
            long repositoryRevision
    ) {
        public SnapshotPublication {
            editorHandles = editorHandles == null ? List.of() : List.copyOf(editorHandles);
        }

        private DungeonEditorDungeonState.SnapshotFacts stateFacts() {
            return new DungeonEditorDungeonState.SnapshotFacts(
                    mapName,
                    stateRevision(repositoryRevision),
                    mapSnapshot(derived, editorHandles));
        }
    }

    private static int stateRevision(long revision) {
        if (revision > Integer.MAX_VALUE) {
            return Integer.MAX_VALUE;
        }
        return Math.max(0, (int) revision);
    }

    private static MapSnapshot mapSnapshot(DungeonDerivedState derived, List<DungeonEditorHandleFacts> handles) {
        DungeonMapFacts safeFacts = derived == null || derived.map() == null
                ? new DungeonMapFacts(DungeonTopology.SQUARE, 1, 1, List.of(), List.of())
                : derived.map();
        List<DungeonEditorHandleFacts> safeHandles = handles == null ? List.of() : List.copyOf(handles);
        return new MapSnapshot(
                safeFacts.topology(),
                safeFacts.width(),
                safeFacts.height(),
                areas(safeFacts.areas()),
                boundaries(safeFacts.boundaries()),
                features(safeFacts.features()),
                handles(safeHandles));
    }

    private static DungeonEditorWorkspaceValues.Area area(DungeonAreaFacts area) {
        return new DungeonEditorWorkspaceValues.Area(
                area.kind(),
                area.id(),
                area.clusterId(),
                area.label(),
                cells(area.cells()),
                area.topologyRef());
    }

    private static DungeonEditorWorkspaceValues.Boundary boundary(DungeonBoundaryFacts boundary) {
        return new DungeonEditorWorkspaceValues.Boundary(
                DungeonEditorWorkspaceValues.BoundaryKind.fromExternalKind(boundary.kind()),
                boundary.id(),
                boundary.label(),
                edge(boundary.edge()),
                boundary.topologyRef());
    }

    private static DungeonEditorWorkspaceValues.Feature feature(DungeonFeatureFacts feature) {
        return new DungeonEditorWorkspaceValues.Feature(
                feature.kind(),
                feature.id(),
                feature.label(),
                cells(feature.cells()),
                feature.description(),
                feature.destinationLabel(),
                feature.topologyRef());
    }

    private static DungeonEditorWorkspaceValues.Handle handle(DungeonEditorHandleFacts handleFacts) {
        DungeonEditorHandle handle = handleFacts.handle();
        DungeonEditorWorkspaceValues.HandleRef ref = new DungeonEditorWorkspaceValues.HandleRef(
                handle.type(),
                handle.topologyRef(),
                handle.ownerId(),
                handle.clusterId(),
                handle.corridorId(),
                handle.roomId(),
                handle.index(),
                cell(handle.cell()),
                handle.direction().name());
        return new DungeonEditorWorkspaceValues.Handle(ref, handleFacts.label(), cell(handle.cell()));
    }

    private static List<DungeonEditorWorkspaceValues.Area> areas(List<DungeonAreaFacts> areas) {
        List<DungeonEditorWorkspaceValues.Area> result = new ArrayList<>();
        for (DungeonAreaFacts area : areas) {
            result.add(area(area));
        }
        return List.copyOf(result);
    }

    private static List<DungeonEditorWorkspaceValues.Boundary> boundaries(List<DungeonBoundaryFacts> boundaries) {
        List<DungeonEditorWorkspaceValues.Boundary> result = new ArrayList<>();
        for (DungeonBoundaryFacts boundary : boundaries) {
            result.add(boundary(boundary));
        }
        return List.copyOf(result);
    }

    private static List<DungeonEditorWorkspaceValues.Feature> features(List<DungeonFeatureFacts> features) {
        List<DungeonEditorWorkspaceValues.Feature> result = new ArrayList<>();
        for (DungeonFeatureFacts feature : features) {
            result.add(feature(feature));
        }
        return List.copyOf(result);
    }

    private static List<DungeonEditorWorkspaceValues.Handle> handles(List<DungeonEditorHandleFacts> handles) {
        List<DungeonEditorWorkspaceValues.Handle> result = new ArrayList<>();
        for (DungeonEditorHandleFacts handle : handles) {
            result.add(handle(handle));
        }
        return List.copyOf(result);
    }

    private static List<DungeonEditorWorkspaceValues.Cell> cells(List<DungeonCell> cells) {
        List<DungeonEditorWorkspaceValues.Cell> result = new ArrayList<>();
        for (DungeonCell cell : cells) {
            result.add(cell(cell));
        }
        return List.copyOf(result);
    }

    private static DungeonEditorWorkspaceValues.Edge edge(@Nullable DungeonEdge edge) {
        if (edge == null) {
            return new DungeonEditorWorkspaceValues.Edge(cell(null), cell(null));
        }
        return new DungeonEditorWorkspaceValues.Edge(cell(edge.from()), cell(edge.to()));
    }

    private static DungeonEditorWorkspaceValues.Cell cell(@Nullable DungeonCell cell) {
        return cell == null
                ? DungeonEditorWorkspaceValues.Cell.empty()
                : new DungeonEditorWorkspaceValues.Cell(cell.q(), cell.r(), cell.level());
    }
}
