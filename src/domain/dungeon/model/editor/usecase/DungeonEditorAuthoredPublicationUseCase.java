package src.domain.dungeon.model.editor.usecase;

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
import src.domain.dungeon.model.map.repository.DungeonAuthoredPublishedStateRepository;

public final class DungeonEditorAuthoredPublicationUseCase {

    public Publication execute(
            String mapName,
            @Nullable DungeonDerivedState derived,
            List<DungeonEditorHandleFacts> editorHandles,
            long revision
    ) {
        List<DungeonEditorHandleFacts> safeEditorHandles = editorHandles == null
                ? List.of()
                : List.copyOf(editorHandles);
        return new Publication(
                stateFacts(mapName, derived, safeEditorHandles, revision),
                repositoryPublication(mapName, derived, safeEditorHandles, revision));
    }

    public record Publication(
            DungeonEditorDungeonState.SnapshotFacts stateFacts,
            DungeonAuthoredPublishedStateRepository.SnapshotPublication repositoryPublication
    ) {
    }

    private DungeonEditorDungeonState.SnapshotFacts stateFacts(
            String mapName,
            @Nullable DungeonDerivedState derived,
            List<DungeonEditorHandleFacts> editorHandles,
            long revision
    ) {
        return new DungeonEditorDungeonState.SnapshotFacts(
                mapName,
                stateRevision(revision),
                mapSnapshot(derived, editorHandles));
    }

    private static DungeonAuthoredPublishedStateRepository.SnapshotPublication repositoryPublication(
            String mapName,
            @Nullable DungeonDerivedState derived,
            List<DungeonEditorHandleFacts> editorHandles,
            long revision
    ) {
        return new DungeonAuthoredPublishedStateRepository.SnapshotPublication(
                mapName,
                derived,
                editorHandles,
                revision);
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
        List<DungeonEditorWorkspaceValues.Area> areas = new ArrayList<>();
        for (DungeonAreaFacts area : safeFacts.areas()) {
            areas.add(area(area));
        }
        List<DungeonEditorWorkspaceValues.Boundary> boundaries = new ArrayList<>();
        for (DungeonBoundaryFacts boundary : safeFacts.boundaries()) {
            boundaries.add(boundary(boundary));
        }
        List<DungeonEditorWorkspaceValues.Feature> features = new ArrayList<>();
        for (DungeonFeatureFacts feature : safeFacts.features()) {
            features.add(feature(feature));
        }
        List<DungeonEditorWorkspaceValues.Handle> workspaceHandles = new ArrayList<>();
        List<DungeonEditorHandleFacts> safeHandles = handles == null ? List.of() : List.copyOf(handles);
        for (DungeonEditorHandleFacts handle : safeHandles) {
            workspaceHandles.add(handle(handle));
        }
        return new MapSnapshot(
                safeFacts.topology(),
                safeFacts.width(),
                safeFacts.height(),
                List.copyOf(areas),
                List.copyOf(boundaries),
                List.copyOf(features),
                List.copyOf(workspaceHandles));
    }

    private static DungeonEditorWorkspaceValues.Area area(DungeonAreaFacts area) {
        List<DungeonEditorWorkspaceValues.Cell> cells = new ArrayList<>();
        for (DungeonCell cell : area.cells()) {
            cells.add(cell(cell));
        }
        return new DungeonEditorWorkspaceValues.Area(
                area.kind(),
                area.id(),
                area.clusterId(),
                area.label(),
                List.copyOf(cells),
                area.topologyRef());
    }

    private static DungeonEditorWorkspaceValues.Boundary boundary(DungeonBoundaryFacts boundary) {
        DungeonEdge edge = boundary.edge();
        DungeonEditorWorkspaceValues.Edge workspaceEdge = edge == null
                ? new DungeonEditorWorkspaceValues.Edge(cell(null), cell(null))
                : new DungeonEditorWorkspaceValues.Edge(cell(edge.from()), cell(edge.to()));
        return new DungeonEditorWorkspaceValues.Boundary(
                DungeonEditorWorkspaceValues.BoundaryKind.fromExternalKind(boundary.kind()),
                boundary.id(),
                boundary.label(),
                workspaceEdge,
                boundary.topologyRef());
    }

    private static DungeonEditorWorkspaceValues.Feature feature(DungeonFeatureFacts feature) {
        List<DungeonEditorWorkspaceValues.Cell> cells = new ArrayList<>();
        for (DungeonCell cell : feature.cells()) {
            cells.add(cell(cell));
        }
        return new DungeonEditorWorkspaceValues.Feature(
                feature.kind(),
                feature.id(),
                feature.label(),
                List.copyOf(cells),
                feature.description(),
                feature.destinationLabel(),
                feature.topologyRef());
    }

    private static DungeonEditorWorkspaceValues.Handle handle(DungeonEditorHandleFacts handleFacts) {
        DungeonEditorHandle handle = handleFacts.handle();
        DungeonEditorWorkspaceValues.Cell cell = cell(handle.cell());
        DungeonEditorWorkspaceValues.HandleRef ref = new DungeonEditorWorkspaceValues.HandleRef(
                handle.type(),
                handle.topologyRef(),
                handle.ownerId(),
                handle.clusterId(),
                handle.corridorId(),
                handle.roomId(),
                handle.index(),
                cell,
                handle.direction().name());
        return new DungeonEditorWorkspaceValues.Handle(ref, handleFacts.label(), cell);
    }

    private static DungeonEditorWorkspaceValues.Cell cell(@Nullable DungeonCell cell) {
        return cell == null
                ? DungeonEditorWorkspaceValues.Cell.empty()
                : new DungeonEditorWorkspaceValues.Cell(cell.q(), cell.r(), cell.level());
    }
}
