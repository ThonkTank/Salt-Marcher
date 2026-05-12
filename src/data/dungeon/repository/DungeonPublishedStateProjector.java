package src.data.dungeon.repository;

import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.application.ApplyDungeonEditorOperationUseCase;
import src.domain.dungeon.application.LoadDungeonSnapshotUseCase;
import src.domain.dungeon.application.SearchDungeonMapsUseCase;
import src.domain.dungeon.model.map.model.DungeonAreaFacts;
import src.domain.dungeon.model.map.model.DungeonAreaType;
import src.domain.dungeon.model.map.model.DungeonCell;
import src.domain.dungeon.model.map.model.DungeonEditorHandle;
import src.domain.dungeon.model.map.model.DungeonEditorHandleFacts;
import src.domain.dungeon.model.map.model.DungeonEdge;
import src.domain.dungeon.model.map.model.DungeonMapFacts;
import src.domain.dungeon.model.map.model.DungeonMapIdentity;
import src.domain.dungeon.model.map.model.DungeonState;
import src.domain.dungeon.model.map.model.DungeonTopology;
import src.domain.dungeon.model.map.model.DungeonTopologyRef;
import src.domain.dungeon.model.map.model.DungeonTravelActionFacts;
import src.domain.dungeon.model.map.model.DungeonTravelExternalTargetFacts;
import src.domain.dungeon.model.map.model.DungeonTravelMoveFacts;
import src.domain.dungeon.model.map.model.DungeonTravelPositionFacts;
import src.domain.dungeon.model.map.model.DungeonTravelSurfaceFacts;
import src.domain.dungeon.published.DungeonAreaKind;
import src.domain.dungeon.published.DungeonAreaSnapshot;
import src.domain.dungeon.published.DungeonAuthoredMutationResult;
import src.domain.dungeon.published.DungeonAuthoredReadResult;
import src.domain.dungeon.published.DungeonBoundarySnapshot;
import src.domain.dungeon.published.DungeonCellRef;
import src.domain.dungeon.published.DungeonEditorHandleKind;
import src.domain.dungeon.published.DungeonEditorHandleRef;
import src.domain.dungeon.published.DungeonEditorHandleSnapshot;
import src.domain.dungeon.published.DungeonEdgeRef;
import src.domain.dungeon.published.DungeonFeatureKind;
import src.domain.dungeon.published.DungeonFeatureSnapshot;
import src.domain.dungeon.published.DungeonInspectorSnapshot;
import src.domain.dungeon.published.DungeonMapCatalogResponse;
import src.domain.dungeon.published.DungeonMapId;
import src.domain.dungeon.published.DungeonMapMode;
import src.domain.dungeon.published.DungeonMapSnapshot;
import src.domain.dungeon.published.DungeonMapSummary;
import src.domain.dungeon.published.DungeonOperationResult;
import src.domain.dungeon.published.DungeonSnapshot;
import src.domain.dungeon.published.DungeonTopologyElementRef;
import src.domain.dungeon.published.DungeonTopologyKind;
import src.domain.dungeon.published.DungeonTravelActionSnapshot;
import src.domain.dungeon.published.DungeonTravelContextKind;
import src.domain.dungeon.published.DungeonTravelExternalTarget;
import src.domain.dungeon.published.DungeonTravelMoveResult;
import src.domain.dungeon.published.DungeonTravelPosition;
import src.domain.dungeon.published.DungeonTravelResponse;
import src.domain.dungeon.published.DungeonTravelSurfaceSnapshot;

final class DungeonPublishedStateProjector {

    DungeonAuthoredReadResult authoredSnapshot(LoadDungeonSnapshotUseCase.DungeonSnapshotData snapshot) {
        return new DungeonAuthoredReadResult.CommittedSnapshot(dungeonSnapshot(snapshot));
    }

    DungeonAuthoredReadResult authoredInspector(LoadDungeonSnapshotUseCase.InspectorSnapshotData snapshot) {
        return new DungeonAuthoredReadResult.SelectionInspector(inspector(snapshot));
    }

    DungeonAuthoredMutationResult authoredMutation(ApplyDungeonEditorOperationUseCase.OperationResultData result) {
        return new DungeonAuthoredMutationResult.Operation(new DungeonOperationResult(
                dungeonSnapshot(result.snapshot()),
                result.validationMessages(),
                result.reactionMessages()));
    }

    DungeonMapCatalogResponse mapCatalog(List<SearchDungeonMapsUseCase.MapSummary> maps) {
        return new DungeonMapCatalogResponse.MapList((maps == null ? List.<SearchDungeonMapsUseCase.MapSummary>of() : maps)
                .stream()
                .map(summary -> new DungeonMapSummary(id(summary.mapId()), summary.mapName(), revision(summary.revision())))
                .toList());
    }

    DungeonMapCatalogResponse mapMutation(
            DungeonMapCatalogResponse.MutationKind mutationKind,
            @Nullable DungeonMapIdentity mapId
    ) {
        return new DungeonMapCatalogResponse.MapMutation(mutationKind, id(mapId));
    }

    DungeonTravelResponse travelSurface(DungeonTravelSurfaceFacts surface) {
        return new DungeonTravelResponse.Surface(surface(surface));
    }

    DungeonTravelResponse travelMove(DungeonTravelMoveFacts result) {
        return new DungeonTravelResponse.Move(new DungeonTravelMoveResult(
                src.domain.dungeon.published.DungeonTravelMoveStatus.valueOf(result.status().name()),
                result.message(),
                surface(result.surface()),
                externalTarget(result.externalTarget())));
    }

    private DungeonSnapshot dungeonSnapshot(LoadDungeonSnapshotUseCase.DungeonSnapshotData snapshot) {
        return new DungeonSnapshot(
                snapshot.mapName(),
                DungeonMapMode.EDITOR,
                mapSnapshot(snapshot.derived().map(), snapshot.editorHandles()),
                snapshot.derived().aggregates().stream().map(DungeonPublishedStateProjector::aggregateSummary).toList(),
                snapshot.derived().relations().summaries(),
                revision(snapshot.revision()));
    }

    private DungeonInspectorSnapshot inspector(LoadDungeonSnapshotUseCase.InspectorSnapshotData snapshot) {
        return new DungeonInspectorSnapshot(
                snapshot.title(),
                snapshot.description(),
                snapshot.facts(),
                snapshot.roomNarrations().stream()
                        .map(roomNarration -> new DungeonInspectorSnapshot.RoomNarrationCard(
                                roomNarration.roomId(),
                                roomNarration.roomName(),
                                roomNarration.visualDescription(),
                                roomNarration.exits().stream()
                                        .map(exit -> new DungeonInspectorSnapshot.RoomExitNarration(
                                                exit.label(),
                                                cell(exit.cell()),
                                                exit.direction().name(),
                                                exit.description()))
                                        .toList()))
                        .toList());
    }

    private DungeonTravelSurfaceSnapshot surface(DungeonTravelSurfaceFacts surface) {
        return new DungeonTravelSurfaceSnapshot(
                DungeonTravelContextKind.DUNGEON,
                surface.mapName(),
                revision(surface.revision()),
                mapSnapshot(surface.map(), List.of()),
                travelPosition(surface.position()),
                surface.surfaceTitle(),
                surface.areaLabel(),
                surface.tileLabel(),
                surface.headingLabel(),
                surface.statusLabel(),
                surface.visualDescription(),
                surface.actions().stream().map(this::travelAction).toList());
    }

    private DungeonMapSnapshot mapSnapshot(DungeonMapFacts facts, List<DungeonEditorHandleFacts> handles) {
        DungeonMapFacts safeFacts = facts == null
                ? new DungeonMapFacts(DungeonTopology.SQUARE, 1, 1, List.of(), List.of())
                : facts;
        List<DungeonEditorHandleFacts> safeHandles = handles == null ? List.of() : List.copyOf(handles);
        return new DungeonMapSnapshot(
                safeFacts.topology() == DungeonTopology.HEX ? DungeonTopologyKind.HEX : DungeonTopologyKind.SQUARE,
                safeFacts.width(),
                safeFacts.height(),
                safeFacts.areas().stream().map(this::area).toList(),
                safeFacts.boundaries().stream().map(boundary -> new DungeonBoundarySnapshot(
                        boundary.kind(),
                        boundary.id(),
                        boundary.label(),
                        edge(boundary.edge()),
                        topologyRef(boundary.topologyRef()))).toList(),
                safeFacts.features().stream().map(feature -> new DungeonFeatureSnapshot(
                        DungeonFeatureKind.valueOf(feature.kind().name()),
                        feature.id(),
                        feature.label(),
                        feature.cells().stream().map(DungeonPublishedStateProjector::cell).toList(),
                        feature.description(),
                        feature.destinationLabel(),
                        topologyRef(feature.topologyRef()))).toList(),
                safeHandles.stream().map(this::handle).toList());
    }

    private DungeonAreaSnapshot area(DungeonAreaFacts area) {
        return new DungeonAreaSnapshot(
                area.kind() == DungeonAreaType.CORRIDOR ? DungeonAreaKind.CORRIDOR : DungeonAreaKind.ROOM,
                area.id(),
                area.clusterId(),
                area.label(),
                area.cells().stream().map(DungeonPublishedStateProjector::cell).toList(),
                topologyRef(area.topologyRef()));
    }

    private DungeonEditorHandleSnapshot handle(DungeonEditorHandleFacts handle) {
        return new DungeonEditorHandleSnapshot(
                handleRef(handle.handle()),
                handle.label(),
                cell(handle.handle().cell()));
    }

    private DungeonTravelActionSnapshot travelAction(DungeonTravelActionFacts action) {
        return new DungeonTravelActionSnapshot(
                action.actionId(),
                src.domain.dungeon.published.DungeonTravelActionKind.valueOf(action.kind().name()),
                action.label(),
                action.destinationLabel(),
                action.description());
    }

    private DungeonTravelPosition travelPosition(DungeonTravelPositionFacts position) {
        return new DungeonTravelPosition(
                id(position.mapId()),
                src.domain.dungeon.published.DungeonTravelLocationKind.valueOf(position.locationKind().name()),
                position.ownerId(),
                cell(position.tile()),
                src.domain.dungeon.published.DungeonTravelHeading.valueOf(position.heading().name()));
    }

    private @Nullable DungeonTravelExternalTarget externalTarget(@Nullable DungeonTravelExternalTargetFacts externalTarget) {
        if (externalTarget != null && externalTarget.isOverworldTile()) {
            return new DungeonTravelExternalTarget.OverworldTile(externalTarget.mapId(), externalTarget.tileId());
        }
        return null;
    }

    private static DungeonEditorHandleRef handleRef(DungeonEditorHandle handle) {
        return new DungeonEditorHandleRef(
                DungeonEditorHandleKind.valueOf(handle.type().name()),
                topologyRef(handle.topologyRef()),
                handle.ownerId(),
                handle.clusterId(),
                handle.corridorId(),
                handle.roomId(),
                handle.index(),
                cell(handle.cell()),
                handle.direction().name());
    }

    private static DungeonTopologyElementRef topologyRef(@Nullable DungeonTopologyRef ref) {
        if (ref == null) {
            return DungeonTopologyElementRef.empty();
        }
        return new DungeonTopologyElementRef(
                src.domain.dungeon.published.DungeonTopologyElementKind.valueOf(ref.kind().name()),
                ref.id());
    }

    private static DungeonMapId id(@Nullable DungeonMapIdentity identity) {
        return new DungeonMapId(identity == null ? 1L : identity.value());
    }

    private static DungeonCellRef cell(DungeonCell cell) {
        return new DungeonCellRef(cell.q(), cell.r(), cell.level());
    }

    private static DungeonEdgeRef edge(DungeonEdge edge) {
        return new DungeonEdgeRef(cell(edge.from()), cell(edge.to()));
    }

    private static int revision(long revision) {
        if (revision > Integer.MAX_VALUE) {
            return Integer.MAX_VALUE;
        }
        return Math.max(0, (int) revision);
    }

    private static String aggregateSummary(DungeonState aggregate) {
        return aggregate.label() + " #" + aggregate.id();
    }
}
