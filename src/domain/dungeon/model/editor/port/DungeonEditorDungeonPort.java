package src.domain.dungeon.model.editor.port;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorDungeonFacts;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorDungeonState;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionSnapshot;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionValues;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.MapId;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.MapSnapshot;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.MapSummary;
import src.domain.dungeon.model.map.model.DungeonAreaFacts;
import src.domain.dungeon.model.map.model.DungeonBoundaryFacts;
import src.domain.dungeon.model.map.model.DungeonCell;
import src.domain.dungeon.model.map.model.DungeonDerivedState;
import src.domain.dungeon.model.map.model.DungeonEdge;
import src.domain.dungeon.model.map.model.DungeonEditorHandle;
import src.domain.dungeon.model.map.model.DungeonEditorHandleFacts;
import src.domain.dungeon.model.map.model.DungeonFeatureFacts;
import src.domain.dungeon.model.map.model.DungeonMapFacts;
import src.domain.dungeon.model.map.model.DungeonMapIdentity;
import src.domain.dungeon.model.map.model.DungeonTopology;
import src.domain.dungeon.model.map.repository.DungeonAuthoredPublishedStateRepository;

public final class DungeonEditorDungeonPort {

    private final DungeonEditorDungeonState state;

    public DungeonEditorDungeonPort(DungeonEditorDungeonState state) {
        this.state = Objects.requireNonNull(state, "state");
    }

    public DungeonEditorDungeonFacts currentFacts(
            @Nullable MapId mapId,
            DungeonEditorSessionValues.Selection selection,
            DungeonEditorSessionValues.Preview preview
    ) {
        return facts(mapId, selection, preview);
    }

    public DungeonEditorDungeonFacts committedFacts(@Nullable MapId mapId) {
        return facts(mapId, DungeonEditorSessionValues.Selection.empty(), DungeonEditorSessionValues.Preview.none());
    }

    private DungeonEditorDungeonFacts facts(
            @Nullable MapId mapId,
            DungeonEditorSessionValues.Selection selection,
            DungeonEditorSessionValues.Preview preview
    ) {
        DungeonAuthoredPublishedStateRepository.MutationPublication mutation = state.mutation();
        return new DungeonEditorDungeonFacts(
                mapSummaries(state.catalog()),
                mapId(state.mutationMapId()),
                committedSnapshot(state.snapshot()),
                currentSurface(mapId, selection, preview, state.snapshot(), state.inspector(), mutation),
                statusText(mutation),
                preview == DungeonEditorSessionValues.Preview.none() ? "" : statusText(mutation));
    }

    private static List<MapSummary> mapSummaries(
            DungeonAuthoredPublishedStateRepository.CatalogPublication catalog
    ) {
        if (catalog == null) {
            return List.of();
        }
        List<MapSummary> result = new ArrayList<>();
        for (DungeonAuthoredPublishedStateRepository.MapSummaryPublication map : catalog.maps()) {
            result.add(mapSummary(map));
        }
        return List.copyOf(result);
    }

    private static MapSummary mapSummary(DungeonAuthoredPublishedStateRepository.MapSummaryPublication map) {
        return map == null
                ? new MapSummary(new MapId(1L), "Dungeon Map", 0L)
                : new MapSummary(mapId(map.mapId()), map.mapName(), map.revision());
    }

    private static @Nullable MapSnapshot committedSnapshot(
            DungeonAuthoredPublishedStateRepository.@Nullable SnapshotPublication snapshot
    ) {
        return snapshot == null ? null : mapSnapshot(snapshot.derived(), snapshot.editorHandles());
    }

    private static DungeonEditorSessionSnapshot.@Nullable SurfaceData currentSurface(
            @Nullable MapId mapId,
            DungeonEditorSessionValues.Selection selection,
            DungeonEditorSessionValues.Preview preview,
            DungeonAuthoredPublishedStateRepository.@Nullable SnapshotPublication snapshot,
            DungeonAuthoredPublishedStateRepository.@Nullable InspectorPublication inspector,
            DungeonAuthoredPublishedStateRepository.@Nullable MutationPublication mutation
    ) {
        if (mapId == null || snapshot == null) {
            return null;
        }
        MapSnapshot committedMap = mapSnapshot(snapshot.derived(), snapshot.editorHandles());
        return new DungeonEditorSessionSnapshot.SurfaceData(
                snapshot.mapName(),
                revision(snapshot.revision()),
                committedMap,
                previewMap(preview, committedMap, mutation),
                inspector(selection, inspector(inspector)));
    }

    private static DungeonEditorWorkspaceValues.@Nullable Inspector inspector(
            DungeonAuthoredPublishedStateRepository.@Nullable InspectorPublication inspector
    ) {
        if (inspector == null) {
            return null;
        }
        return new DungeonEditorWorkspaceValues.Inspector(
                inspector.title(),
                inspector.description(),
                inspector.facts(),
                roomNarrations(inspector.roomNarrations()));
    }

    private static DungeonEditorWorkspaceValues.RoomNarrationCard roomNarration(
            DungeonAuthoredPublishedStateRepository.RoomNarrationPublication roomNarration
    ) {
        return new DungeonEditorWorkspaceValues.RoomNarrationCard(
                roomNarration.roomId(),
                roomNarration.roomName(),
                roomNarration.visualDescription(),
                roomExits(roomNarration.exits()));
    }

    private static DungeonEditorWorkspaceValues.RoomExitNarration roomExit(
            DungeonAuthoredPublishedStateRepository.RoomExitNarrationPublication exit
    ) {
        return new DungeonEditorWorkspaceValues.RoomExitNarration(
                exit.label(),
                cell(exit.cell()),
                exit.direction().name(),
                exit.description());
    }

    private static @Nullable MapSnapshot previewMap(
            DungeonEditorSessionValues.Preview preview,
            MapSnapshot committedMap,
            DungeonAuthoredPublishedStateRepository.@Nullable MutationPublication mutation
    ) {
        MapSnapshot candidate = preview == DungeonEditorSessionValues.Preview.none() || mutation == null
                ? null
                : mapSnapshot(mutation.snapshot().derived(), mutation.snapshot().editorHandles());
        return candidate != null && candidate.equals(committedMap) ? null : candidate;
    }

    private static DungeonEditorWorkspaceValues.@Nullable Inspector inspector(
            DungeonEditorSessionValues.Selection selection,
            DungeonEditorWorkspaceValues.@Nullable Inspector inspector
    ) {
        DungeonEditorSessionValues.Selection safeSelection = selection == null
                ? DungeonEditorSessionValues.Selection.empty()
                : selection;
        if (safeSelection.topologyRef().equals(src.domain.dungeon.model.map.model.DungeonTopologyRef.empty())
                && !safeSelection.clusterSelection()) {
            return null;
        }
        return inspector;
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

    private static List<DungeonEditorWorkspaceValues.RoomNarrationCard> roomNarrations(
            List<DungeonAuthoredPublishedStateRepository.RoomNarrationPublication> roomNarrations
    ) {
        List<DungeonEditorWorkspaceValues.RoomNarrationCard> result = new ArrayList<>();
        for (DungeonAuthoredPublishedStateRepository.RoomNarrationPublication roomNarration : roomNarrations) {
            result.add(roomNarration(roomNarration));
        }
        return List.copyOf(result);
    }

    private static List<DungeonEditorWorkspaceValues.RoomExitNarration> roomExits(
            List<DungeonAuthoredPublishedStateRepository.RoomExitNarrationPublication> exits
    ) {
        List<DungeonEditorWorkspaceValues.RoomExitNarration> result = new ArrayList<>();
        for (DungeonAuthoredPublishedStateRepository.RoomExitNarrationPublication exit : exits) {
            result.add(roomExit(exit));
        }
        return List.copyOf(result);
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

    private static DungeonEditorWorkspaceValues.Boundary boundary(DungeonBoundaryFacts boundary) {
        return new DungeonEditorWorkspaceValues.Boundary(
                DungeonEditorWorkspaceValues.BoundaryKind.fromExternalKind(boundary.kind()),
                boundary.id(),
                boundary.label(),
                edge(boundary.edge()),
                boundary.topologyRef());
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

    private static @Nullable MapId mapId(@Nullable DungeonMapIdentity mapId) {
        return mapId == null ? null : new MapId(mapId.value());
    }

    private static String statusText(
            DungeonAuthoredPublishedStateRepository.@Nullable MutationPublication mutation
    ) {
        if (mutation == null) {
            return "";
        }
        if (!mutation.reactionMessages().isEmpty()) {
            return mutation.reactionMessages().getFirst();
        }
        if (!mutation.validationMessages().isEmpty()) {
            return mutation.validationMessages().getFirst();
        }
        return "";
    }

    private static int revision(long revision) {
        if (revision > Integer.MAX_VALUE) {
            return Integer.MAX_VALUE;
        }
        return Math.max(0, (int) revision);
    }
}
