package src.domain.travel;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.DungeonApplicationService;
import src.domain.dungeon.published.DungeonAreaSnapshot;
import src.domain.dungeon.published.DungeonBoundarySnapshot;
import src.domain.dungeon.published.DungeonCellRef;
import src.domain.travel.published.TravelDungeonMapProjectionSnapshot;
import src.domain.dungeon.published.DungeonMapSnapshot;
import src.domain.dungeon.published.DungeonTravelActionSnapshot;
import src.domain.dungeon.published.DungeonTravelExternalTarget;
import src.domain.dungeon.published.DungeonTravelMoveResult;
import src.domain.dungeon.published.DungeonTravelMoveStatus;
import src.domain.dungeon.published.DungeonTravelPosition;
import src.domain.dungeon.published.DungeonTravelSurfaceSnapshot;
import src.domain.dungeon.published.LoadDungeonTravelSurfaceQuery;
import src.domain.dungeon.published.MoveDungeonTravelActionCommand;
import src.domain.party.PartyApplicationService;
import src.domain.party.published.ActivePartyResult;
import src.domain.party.published.LoadActivePartyQuery;
import src.domain.party.published.LoadPartyTravelPositionsQuery;
import src.domain.party.published.MovePartyCharactersCommand;
import src.domain.party.published.MutationStatus;
import src.domain.party.published.PartyDungeonTravelLocationKind;
import src.domain.party.published.PartyDungeonTravelLocationSnapshot;
import src.domain.party.published.PartyMemberSummary;
import src.domain.party.published.PartyOverworldTravelLocationSnapshot;
import src.domain.party.published.PartyTravelHeading;
import src.domain.party.published.PartyTravelLocationSnapshot;
import src.domain.party.published.PartyTravelPositionSnapshot;
import src.domain.party.published.PartyTravelPositionsResult;
import src.domain.party.published.PartyTravelTile;
import src.domain.party.published.ReadStatus;
import src.domain.travel.application.ApplyTravelDungeonSessionUseCase;
import src.domain.travel.published.ApplyTravelDungeonSessionCommand;
import src.domain.travel.published.LoadTravelDungeonQuery;
import src.domain.travel.published.TravelDungeonAction;
import src.domain.travel.published.TravelDungeonArea;
import src.domain.travel.published.TravelDungeonBoundary;
import src.domain.travel.published.TravelDungeonCell;
import src.domain.travel.published.TravelDungeonEdge;
import src.domain.travel.published.TravelDungeonFeature;
import src.domain.travel.published.TravelDungeonMapSnapshot;
import src.domain.travel.published.TravelDungeonModel;
import src.domain.travel.published.TravelDungeonPosition;
import src.domain.travel.published.TravelDungeonSnapshot;
import src.domain.travel.published.TravelDungeonSurface;
import src.domain.travel.published.TravelOverlaySettings;

/**
 * Public backend facade for runtime travel composition.
 */
public final class TravelApplicationService {

    private final ApplyTravelDungeonSessionUseCase applyTravelDungeonSessionUseCase;
    private final List<Consumer<TravelDungeonSnapshot>> dungeonTravelListeners = new ArrayList<>();
    private final TravelDungeonModel dungeonTravelModel = new TravelDungeonModel(
            this::currentDungeonTravelSnapshot,
            this::subscribeDungeonTravelListener);

    public TravelApplicationService(
            PartyApplicationService partyApplicationService,
            DungeonApplicationService dungeonApplicationService
    ) {
        PartyApplicationService party = Objects.requireNonNull(partyApplicationService, "partyApplicationService");
        DungeonApplicationService dungeon = Objects.requireNonNull(dungeonApplicationService, "dungeonApplicationService");
        this.applyTravelDungeonSessionUseCase = new ApplyTravelDungeonSessionUseCase(
                new ApplyTravelDungeonSessionUseCase.RuntimeAccess() {
                    @Override
                    public ApplyTravelDungeonSessionUseCase.ActiveTravelStateData loadActiveTravelState() {
                        return TravelApplicationService.loadActiveTravelState(party);
                    }

                    @Override
                    public ApplyTravelDungeonSessionUseCase.SurfaceData loadDungeonSurface(
                            ApplyTravelDungeonSessionUseCase.@Nullable PositionData position
                    ) {
                        return TravelApplicationService.loadDungeonSurface(dungeon, position);
                    }

                    @Override
                    public ApplyTravelDungeonSessionUseCase.MoveResultData moveDungeonAction(
                            ApplyTravelDungeonSessionUseCase.@Nullable PositionData position,
                            String actionId
                    ) {
                        return TravelApplicationService.moveDungeonAction(dungeon, position, actionId);
                    }

                    @Override
                    public void saveDungeonPosition(
                            ApplyTravelDungeonSessionUseCase.PositionData position,
                            List<Long> characterIds
                    ) {
                        TravelApplicationService.saveDungeonPosition(party, position, characterIds);
                    }

                    @Override
                    public boolean saveOverworldPosition(
                            ApplyTravelDungeonSessionUseCase.OverworldTargetData target,
                            List<Long> characterIds
                    ) {
                        return TravelApplicationService.saveOverworldPosition(party, target, characterIds);
                    }
                });
    }

    public TravelDungeonModel loadDungeonTravel(LoadTravelDungeonQuery query) {
        LoadTravelDungeonQuery effectiveQuery = query == null
                ? new LoadTravelDungeonQuery(null)
                : query;
        applyTravelDungeonSessionUseCase.primeRequestedPosition(toInternalPosition(effectiveQuery.position()));
        return dungeonTravelModel;
    }

    public TravelDungeonSnapshot applyDungeonTravelSession(ApplyTravelDungeonSessionCommand command) {
        applyTravelDungeonSessionUseCase.apply(toInternalCommand(command));
        TravelDungeonSnapshot snapshot = currentDungeonTravelSnapshot();
        notifyDungeonTravelListeners(snapshot);
        return snapshot;
    }

    private TravelDungeonSnapshot currentDungeonTravelSnapshot() {
        return toPublishedSnapshot(applyTravelDungeonSessionUseCase.snapshot());
    }

    private Runnable subscribeDungeonTravelListener(Consumer<TravelDungeonSnapshot> listener) {
        Consumer<TravelDungeonSnapshot> safeListener = Objects.requireNonNull(listener, "listener");
        dungeonTravelListeners.add(safeListener);
        return () -> dungeonTravelListeners.remove(safeListener);
    }

    private void notifyDungeonTravelListeners(TravelDungeonSnapshot snapshot) {
        List<Consumer<TravelDungeonSnapshot>> listeners = List.copyOf(dungeonTravelListeners);
        for (Consumer<TravelDungeonSnapshot> listener : listeners) {
            listener.accept(snapshot);
        }
    }

    private static ApplyTravelDungeonSessionUseCase.Command toInternalCommand(
            @Nullable ApplyTravelDungeonSessionCommand command
    ) {
        ApplyTravelDungeonSessionCommand effectiveCommand = command == null
                ? new ApplyTravelDungeonSessionCommand(
                ApplyTravelDungeonSessionCommand.Action.REFRESH,
                "",
                0,
                TravelOverlaySettings.defaults())
                : command;
        return new ApplyTravelDungeonSessionUseCase.Command(
                ApplyTravelDungeonSessionUseCase.Action.valueOf(effectiveCommand.action().name()),
                effectiveCommand.actionId(),
                effectiveCommand.projectionLevel(),
                toInternalOverlay(effectiveCommand.overlaySettings()));
    }

    private static ApplyTravelDungeonSessionUseCase.OverlayData toInternalOverlay(
            @Nullable TravelOverlaySettings overlaySettings
    ) {
        TravelOverlaySettings safeOverlay = overlaySettings == null
                ? TravelOverlaySettings.defaults()
                : overlaySettings;
        return new ApplyTravelDungeonSessionUseCase.OverlayData(
                safeOverlay.modeKey(),
                safeOverlay.levelRange(),
                safeOverlay.opacity(),
                safeOverlay.selectedLevels());
    }

    private static TravelDungeonSnapshot toPublishedSnapshot(
            ApplyTravelDungeonSessionUseCase.SnapshotData snapshot
    ) {
        ApplyTravelDungeonSessionUseCase.SnapshotData safeSnapshot = snapshot == null
                ? new ApplyTravelDungeonSessionUseCase.SnapshotData(
                null,
                ApplyTravelDungeonSessionUseCase.OverlayData.defaults(),
                0)
                : snapshot;
        return new TravelDungeonSnapshot(
                toPublishedSurface(safeSnapshot.surface()),
                toPublishedProjection(safeSnapshot.surface()),
                toPublishedOverlay(safeSnapshot.overlaySettings()),
                safeSnapshot.projectionLevel());
    }

    private static TravelOverlaySettings toPublishedOverlay(
            ApplyTravelDungeonSessionUseCase.OverlayData overlaySettings
    ) {
        ApplyTravelDungeonSessionUseCase.OverlayData safeOverlay = overlaySettings == null
                ? ApplyTravelDungeonSessionUseCase.OverlayData.defaults()
                : overlaySettings;
        return new TravelOverlaySettings(
                safeOverlay.modeKey(),
                safeOverlay.levelRange(),
                safeOverlay.opacity(),
                safeOverlay.selectedLevels());
    }

    private static @Nullable TravelDungeonSurface toPublishedSurface(
            ApplyTravelDungeonSessionUseCase.@Nullable SurfaceData surface
    ) {
        if (surface == null) {
            return null;
        }
        return new TravelDungeonSurface(
                TravelDungeonSurface.ContextKind.valueOf(surface.contextKind().name()),
                surface.mapName(),
                surface.revision(),
                toPublishedMap(surface.map()),
                toPublishedPosition(surface.position()),
                surface.surfaceTitle(),
                surface.areaLabel(),
                surface.tileLabel(),
                surface.headingLabel(),
                surface.statusLabel(),
                surface.visualDescription(),
                surface.actions().stream().map(TravelApplicationService::toPublishedAction).toList());
    }

    private static @Nullable TravelDungeonMapProjectionSnapshot toPublishedProjection(
            ApplyTravelDungeonSessionUseCase.@Nullable SurfaceData surface
    ) {
        if (surface == null || surface.contextKind() != ApplyTravelDungeonSessionUseCase.ContextKind.DUNGEON) {
            return null;
        }
        return TravelMapProjectionPublication.projection(surface);
    }

    private static TravelDungeonMapSnapshot toPublishedMap(ApplyTravelDungeonSessionUseCase.MapData map) {
        ApplyTravelDungeonSessionUseCase.MapData safeMap = map == null
                ? ApplyTravelDungeonSessionUseCase.MapData.empty()
                : map;
        return new TravelDungeonMapSnapshot(
                TravelDungeonMapSnapshot.TopologyKind.valueOf(safeMap.topology().name()),
                safeMap.width(),
                safeMap.height(),
                safeMap.areas().stream().map(TravelApplicationService::toPublishedArea).toList(),
                safeMap.boundaries().stream().map(TravelApplicationService::toPublishedBoundary).toList(),
                safeMap.features().stream().map(TravelApplicationService::toPublishedFeature).toList());
    }

    private static TravelDungeonArea toPublishedArea(ApplyTravelDungeonSessionUseCase.AreaData area) {
        ApplyTravelDungeonSessionUseCase.AreaData safeArea = area == null
                ? new ApplyTravelDungeonSessionUseCase.AreaData(
                ApplyTravelDungeonSessionUseCase.AreaKind.ROOM,
                1L,
                "ROOM",
                List.of())
                : area;
        return new TravelDungeonArea(
                TravelDungeonArea.Kind.valueOf(safeArea.kind().name()),
                safeArea.id(),
                safeArea.label(),
                safeArea.cells().stream().map(TravelApplicationService::toPublishedCell).toList());
    }

    private static TravelDungeonBoundary toPublishedBoundary(ApplyTravelDungeonSessionUseCase.BoundaryData boundary) {
        ApplyTravelDungeonSessionUseCase.BoundaryData safeBoundary = boundary == null
                ? new ApplyTravelDungeonSessionUseCase.BoundaryData(
                "boundary",
                1L,
                "boundary",
                new ApplyTravelDungeonSessionUseCase.EdgeData(
                        new ApplyTravelDungeonSessionUseCase.CellData(0, 0, 0),
                        new ApplyTravelDungeonSessionUseCase.CellData(0, 0, 0)))
                : boundary;
        return new TravelDungeonBoundary(
                safeBoundary.kind(),
                safeBoundary.id(),
                safeBoundary.label(),
                toPublishedEdge(safeBoundary.edge()));
    }

    private static TravelDungeonFeature toPublishedFeature(ApplyTravelDungeonSessionUseCase.FeatureData feature) {
        ApplyTravelDungeonSessionUseCase.FeatureData safeFeature = feature == null
                ? new ApplyTravelDungeonSessionUseCase.FeatureData(
                ApplyTravelDungeonSessionUseCase.FeatureKind.STAIR,
                1L,
                "STAIR",
                List.of(),
                "",
                "")
                : feature;
        return new TravelDungeonFeature(
                TravelDungeonFeature.Kind.valueOf(safeFeature.kind().name()),
                safeFeature.id(),
                safeFeature.label(),
                safeFeature.cells().stream().map(TravelApplicationService::toPublishedCell).toList(),
                safeFeature.description(),
                safeFeature.destinationLabel());
    }

    private static TravelDungeonAction toPublishedAction(ApplyTravelDungeonSessionUseCase.ActionData action) {
        ApplyTravelDungeonSessionUseCase.ActionData safeAction = action == null
                ? new ApplyTravelDungeonSessionUseCase.ActionData("", "Aktion", "")
                : action;
        return new TravelDungeonAction(
                safeAction.actionId(),
                safeAction.label(),
                safeAction.description());
    }

    private static TravelDungeonPosition toPublishedPosition(ApplyTravelDungeonSessionUseCase.PositionData position) {
        ApplyTravelDungeonSessionUseCase.PositionData safePosition = position == null
                ? new ApplyTravelDungeonSessionUseCase.PositionData(
                1L,
                ApplyTravelDungeonSessionUseCase.LocationKind.TILE,
                0L,
                new ApplyTravelDungeonSessionUseCase.CellData(0, 0, 0),
                ApplyTravelDungeonSessionUseCase.Heading.SOUTH)
                : position;
        return new TravelDungeonPosition(
                safePosition.mapId(),
                TravelDungeonPosition.LocationKind.valueOf(safePosition.locationKind().name()),
                safePosition.ownerId(),
                toPublishedCell(safePosition.tile()),
                TravelDungeonPosition.Heading.valueOf(safePosition.heading().name()));
    }

    private static TravelDungeonCell toPublishedCell(ApplyTravelDungeonSessionUseCase.CellData cell) {
        ApplyTravelDungeonSessionUseCase.CellData safeCell = cell == null
                ? new ApplyTravelDungeonSessionUseCase.CellData(0, 0, 0)
                : cell;
        return new TravelDungeonCell(safeCell.q(), safeCell.r(), safeCell.level());
    }

    private static TravelDungeonEdge toPublishedEdge(ApplyTravelDungeonSessionUseCase.EdgeData edge) {
        ApplyTravelDungeonSessionUseCase.EdgeData safeEdge = edge == null
                ? new ApplyTravelDungeonSessionUseCase.EdgeData(
                new ApplyTravelDungeonSessionUseCase.CellData(0, 0, 0),
                new ApplyTravelDungeonSessionUseCase.CellData(0, 0, 0))
                : edge;
        return new TravelDungeonEdge(toPublishedCell(safeEdge.from()), toPublishedCell(safeEdge.to()));
    }

    private static final class TravelMapProjectionPublication {

        private TravelMapProjectionPublication() {
        }

        private static TravelDungeonMapProjectionSnapshot projection(
                ApplyTravelDungeonSessionUseCase.SurfaceData surface
        ) {
            ApplyTravelDungeonSessionUseCase.MapData map = surface.map();
            List<TravelDungeonMapProjectionSnapshot.CellProjection> cells = new ArrayList<>();
            List<TravelDungeonMapProjectionSnapshot.EdgeProjection> edges = new ArrayList<>();
            List<TravelDungeonMapProjectionSnapshot.LabelProjection> labels = new ArrayList<>();
            List<TravelDungeonMapProjectionSnapshot.MarkerProjection> markers = new ArrayList<>();
            List<TravelDungeonMapProjectionSnapshot.GraphNodeProjection> graphNodes = new ArrayList<>();
            List<TravelDungeonMapProjectionSnapshot.GraphLinkProjection> graphLinks = new ArrayList<>();
            renderAreas(map, cells, graphNodes);
            renderBoundaries(map, edges);
            renderFeatures(map, cells, labels, markers);
            addFallbackGraphLinks(graphNodes, graphLinks);
            return new TravelDungeonMapProjectionSnapshot(
                    surface.mapName(),
                    topology(map.topology()),
                    map.width(),
                    map.height(),
                    cells,
                    edges,
                    labels,
                    markers,
                    graphNodes,
                    graphLinks,
                    partyToken(surface.position()));
        }

        private static void renderAreas(
                ApplyTravelDungeonSessionUseCase.MapData map,
                List<TravelDungeonMapProjectionSnapshot.CellProjection> cells,
                List<TravelDungeonMapProjectionSnapshot.GraphNodeProjection> graphNodes
        ) {
            for (ApplyTravelDungeonSessionUseCase.AreaData area : map.areas()) {
                List<TravelDungeonMapProjectionSnapshot.CellProjection> areaCells = area.cells().stream()
                        .map(cell -> cell(area, cell))
                        .toList();
                cells.addAll(areaCells);
                if (areaCells.isEmpty()) {
                    continue;
                }
                CellCenter center = centerOf(areaCells);
                graphNodes.add(new TravelDungeonMapProjectionSnapshot.GraphNodeProjection(
                        area.id(),
                        0L,
                        area.label(),
                        center.q(),
                        center.r(),
                        false));
            }
        }

        private static void renderBoundaries(
                ApplyTravelDungeonSessionUseCase.MapData map,
                List<TravelDungeonMapProjectionSnapshot.EdgeProjection> edges
        ) {
            for (ApplyTravelDungeonSessionUseCase.BoundaryData boundary : map.boundaries()) {
                edges.add(edge(boundary));
            }
        }

        private static void renderFeatures(
                ApplyTravelDungeonSessionUseCase.MapData map,
                List<TravelDungeonMapProjectionSnapshot.CellProjection> cells,
                List<TravelDungeonMapProjectionSnapshot.LabelProjection> labels,
                List<TravelDungeonMapProjectionSnapshot.MarkerProjection> markers
        ) {
            for (ApplyTravelDungeonSessionUseCase.FeatureData feature : map.features()) {
                List<TravelDungeonMapProjectionSnapshot.CellProjection> featureCells = feature.cells().stream()
                        .map(cell -> featureCell(feature, cell))
                        .toList();
                cells.addAll(featureCells);
                if (featureCells.isEmpty()) {
                    continue;
                }
                CellCenter center = centerOf(featureCells);
                int level = featureCells.getFirst().level();
                TravelDungeonMapProjectionSnapshot.TopologyRef topologyRef = featureTopologyRef(feature);
                labels.add(new TravelDungeonMapProjectionSnapshot.LabelProjection(
                        feature.label(),
                        center.q(),
                        center.r(),
                        level,
                        feature.id(),
                        0L,
                        topologyRef,
                        false,
                        false));
                markers.add(featureMarker(feature, center, level, topologyRef));
            }
        }

        private static void addFallbackGraphLinks(
                List<TravelDungeonMapProjectionSnapshot.GraphNodeProjection> graphNodes,
                List<TravelDungeonMapProjectionSnapshot.GraphLinkProjection> graphLinks
        ) {
            if (!graphLinks.isEmpty() || graphNodes.size() <= 1) {
                return;
            }
            for (int index = 1; index < graphNodes.size(); index++) {
                graphLinks.add(new TravelDungeonMapProjectionSnapshot.GraphLinkProjection(
                        graphNodes.get(index - 1).id(),
                        graphNodes.get(index).id(),
                        false));
            }
        }

        private static TravelDungeonMapProjectionSnapshot.@Nullable PartyTokenProjection partyToken(
                ApplyTravelDungeonSessionUseCase.@Nullable PositionData position
        ) {
            if (position == null) {
                return null;
            }
            return new TravelDungeonMapProjectionSnapshot.PartyTokenProjection(
                    position.tile().q() + 0.5,
                    position.tile().r() + 0.5,
                    position.tile().level(),
                    heading(position.heading()),
                    true);
        }

        private static TravelDungeonMapProjectionSnapshot.CellProjection cell(
                ApplyTravelDungeonSessionUseCase.AreaData area,
                ApplyTravelDungeonSessionUseCase.CellData cell
        ) {
            return new TravelDungeonMapProjectionSnapshot.CellProjection(
                    cell.q(),
                    cell.r(),
                    cell.level(),
                    area.label(),
                    area.kind() == ApplyTravelDungeonSessionUseCase.AreaKind.CORRIDOR
                            ? TravelDungeonMapProjectionSnapshot.CellKind.CORRIDOR
                            : TravelDungeonMapProjectionSnapshot.CellKind.ROOM,
                    area.id(),
                    0L,
                    areaTopologyRef(area),
                    false,
                    false,
                    false,
                    false);
        }

        private static TravelDungeonMapProjectionSnapshot.CellProjection featureCell(
                ApplyTravelDungeonSessionUseCase.FeatureData feature,
                ApplyTravelDungeonSessionUseCase.CellData cell
        ) {
            return new TravelDungeonMapProjectionSnapshot.CellProjection(
                    cell.q(),
                    cell.r(),
                    cell.level(),
                    feature.label(),
                    feature.kind() == ApplyTravelDungeonSessionUseCase.FeatureKind.TRANSITION
                            ? TravelDungeonMapProjectionSnapshot.CellKind.TRANSITION
                            : TravelDungeonMapProjectionSnapshot.CellKind.STAIR,
                    feature.id(),
                    0L,
                    featureTopologyRef(feature),
                    false,
                    false,
                    false,
                    false);
        }

        private static TravelDungeonMapProjectionSnapshot.EdgeProjection edge(
                ApplyTravelDungeonSessionUseCase.BoundaryData boundary
        ) {
            ApplyTravelDungeonSessionUseCase.EdgeData edge = boundary.edge();
            return new TravelDungeonMapProjectionSnapshot.EdgeProjection(
                    edge.from().q(),
                    edge.from().r(),
                    edge.to().q(),
                    edge.to().r(),
                    edge.from().level(),
                    "door".equalsIgnoreCase(boundary.kind())
                            ? TravelDungeonMapProjectionSnapshot.EdgeKind.DOOR
                            : TravelDungeonMapProjectionSnapshot.EdgeKind.WALL,
                    boundary.label(),
                    boundary.id(),
                    TravelDungeonMapProjectionSnapshot.TopologyRef.empty(),
                    false,
                    false);
        }

        private static TravelDungeonMapProjectionSnapshot.MarkerProjection featureMarker(
                ApplyTravelDungeonSessionUseCase.FeatureData feature,
                CellCenter center,
                int level,
                TravelDungeonMapProjectionSnapshot.TopologyRef topologyRef
        ) {
            boolean transition = feature.kind() == ApplyTravelDungeonSessionUseCase.FeatureKind.TRANSITION;
            return new TravelDungeonMapProjectionSnapshot.MarkerProjection(
                    transition ? "->" : "z",
                    center.q(),
                    center.r(),
                    level,
                    transition
                            ? TravelDungeonMapProjectionSnapshot.MarkerKind.WAYPOINT
                            : TravelDungeonMapProjectionSnapshot.MarkerKind.STAIR,
                    false,
                    new TravelDungeonMapProjectionSnapshot.MarkerHandle(
                            transition ? "CORRIDOR_WAYPOINT" : "STAIR_ANCHOR",
                            topologyRef,
                            feature.id(),
                            0L,
                            0L,
                            0L,
                            0,
                            (int) Math.floor(center.q()),
                            (int) Math.floor(center.r()),
                            level,
                            ""),
                    false);
        }

        private static TravelDungeonMapProjectionSnapshot.TopologyKind topology(
                ApplyTravelDungeonSessionUseCase.TopologyKind topologyKind
        ) {
            return topologyKind == ApplyTravelDungeonSessionUseCase.TopologyKind.HEX
                    ? TravelDungeonMapProjectionSnapshot.TopologyKind.HEX
                    : TravelDungeonMapProjectionSnapshot.TopologyKind.SQUARE;
        }

        private static TravelDungeonMapProjectionSnapshot.TopologyRef areaTopologyRef(
                ApplyTravelDungeonSessionUseCase.AreaData area
        ) {
            return new TravelDungeonMapProjectionSnapshot.TopologyRef(
                    area.kind() == ApplyTravelDungeonSessionUseCase.AreaKind.CORRIDOR ? "CORRIDOR" : "ROOM",
                    area.id());
        }

        private static TravelDungeonMapProjectionSnapshot.TopologyRef featureTopologyRef(
                ApplyTravelDungeonSessionUseCase.FeatureData feature
        ) {
            return new TravelDungeonMapProjectionSnapshot.TopologyRef(
                    feature.kind() == ApplyTravelDungeonSessionUseCase.FeatureKind.TRANSITION
                            ? "TRANSITION"
                            : "STAIR",
                    feature.id());
        }

        private static TravelDungeonMapProjectionSnapshot.Heading heading(
                ApplyTravelDungeonSessionUseCase.Heading heading
        ) {
            return switch (heading == null ? ApplyTravelDungeonSessionUseCase.Heading.SOUTH : heading) {
                case NORTH -> TravelDungeonMapProjectionSnapshot.Heading.NORTH;
                case EAST -> TravelDungeonMapProjectionSnapshot.Heading.EAST;
                case SOUTH -> TravelDungeonMapProjectionSnapshot.Heading.SOUTH;
                case WEST -> TravelDungeonMapProjectionSnapshot.Heading.WEST;
            };
        }

        private static CellCenter centerOf(List<TravelDungeonMapProjectionSnapshot.CellProjection> cells) {
            double q = 0.0;
            double r = 0.0;
            for (TravelDungeonMapProjectionSnapshot.CellProjection cell : cells) {
                q += cell.q() + 0.5;
                r += cell.r() + 0.5;
            }
            int count = Math.max(1, cells.size());
            return new CellCenter(q / count, r / count);
        }

        private record CellCenter(double q, double r) {
        }
    }

    private static ApplyTravelDungeonSessionUseCase.ActiveTravelStateData loadActiveTravelState(
            PartyApplicationService partyApplicationService
    ) {
        ActivePartyResult activeParty = partyApplicationService.loadActiveParty(new LoadActivePartyQuery());
        List<Long> activeCharacterIds = activeParty.status() == ReadStatus.SUCCESS
                ? activeParty.members().stream()
                .map(PartyMemberSummary::id)
                .filter(id -> id != null && id > 0L)
                .toList()
                : List.of();
        PartyTravelPositionsResult travelPositions = partyApplicationService.loadTravelPositions(
                new LoadPartyTravelPositionsQuery(activeCharacterIds));
        List<Long> travelCharacterIds = travelPositions.status() == ReadStatus.SUCCESS
                ? attachedCharacterIds(travelPositions.positions(), activeCharacterIds)
                : activeCharacterIds;
        return new ApplyTravelDungeonSessionUseCase.ActiveTravelStateData(
                travelCharacterIds,
                toInternalPartyLocation(travelPositions.partyTokenLocation()));
    }

    private static List<Long> attachedCharacterIds(
            List<PartyTravelPositionSnapshot> positions,
            List<Long> fallbackIds
    ) {
        List<Long> attachedIds = (positions == null ? List.<PartyTravelPositionSnapshot>of() : positions).stream()
                .filter(PartyTravelPositionSnapshot::attachedToPartyToken)
                .map(PartyTravelPositionSnapshot::characterId)
                .toList();
        return attachedIds.isEmpty() ? fallbackIds : attachedIds;
    }

    private static ApplyTravelDungeonSessionUseCase.SurfaceData loadDungeonSurface(
            DungeonApplicationService dungeonApplicationService,
            ApplyTravelDungeonSessionUseCase.@Nullable PositionData position
    ) {
        return toInternalSurface(dungeonApplicationService.loadTravelSurface(
                new LoadDungeonTravelSurfaceQuery(toDungeonPosition(position))));
    }

    private static ApplyTravelDungeonSessionUseCase.MoveResultData moveDungeonAction(
            DungeonApplicationService dungeonApplicationService,
            ApplyTravelDungeonSessionUseCase.@Nullable PositionData position,
            String actionId
    ) {
        return toInternalMoveResult(dungeonApplicationService.moveTravelAction(
                new MoveDungeonTravelActionCommand(toDungeonPosition(position), actionId)));
    }

    private static void saveDungeonPosition(
            PartyApplicationService partyApplicationService,
            ApplyTravelDungeonSessionUseCase.PositionData position,
            List<Long> characterIds
    ) {
        if (position == null || characterIds == null || characterIds.isEmpty()) {
            return;
        }
        partyApplicationService.moveCharacters(new MovePartyCharactersCommand(
                characterIds,
                new PartyDungeonTravelLocationSnapshot(
                        position.mapId(),
                        position.locationKind() == ApplyTravelDungeonSessionUseCase.LocationKind.TRANSITION
                                ? PartyDungeonTravelLocationKind.TRANSITION
                                : PartyDungeonTravelLocationKind.TILE,
                        position.ownerId(),
                        new PartyTravelTile(position.tile().q(), position.tile().r(), position.tile().level()),
                        PartyTravelHeading.valueOf(position.heading().name())),
                true));
    }

    private static boolean saveOverworldPosition(
            PartyApplicationService partyApplicationService,
            ApplyTravelDungeonSessionUseCase.OverworldTargetData target,
            List<Long> characterIds
    ) {
        if (target == null || characterIds == null || characterIds.isEmpty()) {
            return false;
        }
        return partyApplicationService.moveCharacters(new MovePartyCharactersCommand(
                characterIds,
                new PartyOverworldTravelLocationSnapshot(target.mapId(), target.tileId()),
                true)).status() == MutationStatus.SUCCESS;
    }

    private static ApplyTravelDungeonSessionUseCase.@Nullable PartyLocationData toInternalPartyLocation(
            @Nullable PartyTravelLocationSnapshot location
    ) {
        if (location instanceof PartyDungeonTravelLocationSnapshot dungeonLocation) {
            return new ApplyTravelDungeonSessionUseCase.DungeonPartyLocationData(
                    dungeonLocation.mapId(),
                    ApplyTravelDungeonSessionUseCase.LocationKind.valueOf(dungeonLocation.locationKind().name()),
                    dungeonLocation.ownerId(),
                    new ApplyTravelDungeonSessionUseCase.CellData(
                            dungeonLocation.tile().q(),
                            dungeonLocation.tile().r(),
                            dungeonLocation.tile().level()),
                    ApplyTravelDungeonSessionUseCase.Heading.valueOf(dungeonLocation.heading().name()));
        }
        if (location instanceof PartyOverworldTravelLocationSnapshot overworldLocation) {
            return new ApplyTravelDungeonSessionUseCase.OverworldPartyLocationData(
                    overworldLocation.mapId(),
                    overworldLocation.tileId());
        }
        return null;
    }

    private static ApplyTravelDungeonSessionUseCase.SurfaceData toInternalSurface(
            @Nullable DungeonTravelSurfaceSnapshot surface
    ) {
        if (surface == null) {
            return outsideDungeonSurfaceData(0L);
        }
        return new ApplyTravelDungeonSessionUseCase.SurfaceData(
                ApplyTravelDungeonSessionUseCase.ContextKind.valueOf(surface.contextKind().name()),
                surface.mapName(),
                surface.revision(),
                toInternalMap(surface.map()),
                toInternalPosition(surface.position()),
                surface.surfaceTitle(),
                surface.areaLabel(),
                surface.tileLabel(),
                surface.headingLabel(),
                surface.statusLabel(),
                surface.visualDescription(),
                surface.actions().stream().map(TravelApplicationService::toInternalAction).toList());
    }

    private static ApplyTravelDungeonSessionUseCase.MoveResultData toInternalMoveResult(
            @Nullable DungeonTravelMoveResult result
    ) {
        if (result == null) {
            return new ApplyTravelDungeonSessionUseCase.MoveResultData(
                    ApplyTravelDungeonSessionUseCase.MoveStatus.NO_MAP,
                    outsideDungeonSurfaceData(0L),
                    null);
        }
        ApplyTravelDungeonSessionUseCase.OverworldTargetData externalTarget =
                result.externalTarget() instanceof DungeonTravelExternalTarget.OverworldTile overworld
                        ? new ApplyTravelDungeonSessionUseCase.OverworldTargetData(overworld.mapId(), overworld.tileId())
                        : null;
        return new ApplyTravelDungeonSessionUseCase.MoveResultData(
                ApplyTravelDungeonSessionUseCase.MoveStatus.valueOf(result.status().name()),
                toInternalSurface(result.surface()),
                externalTarget);
    }

    private static ApplyTravelDungeonSessionUseCase.ActionData toInternalAction(DungeonTravelActionSnapshot action) {
        return new ApplyTravelDungeonSessionUseCase.ActionData(
                action == null ? "" : action.actionId(),
                action == null ? "" : action.displayLabel(),
                action == null ? "" : action.description());
    }

    private static ApplyTravelDungeonSessionUseCase.MapData toInternalMap(DungeonMapSnapshot map) {
        DungeonMapSnapshot safeMap = map == null ? DungeonMapSnapshot.empty() : map;
        return new ApplyTravelDungeonSessionUseCase.MapData(
                ApplyTravelDungeonSessionUseCase.TopologyKind.valueOf(safeMap.topology().name()),
                safeMap.width(),
                safeMap.height(),
                safeMap.areas().stream().map(TravelApplicationService::toInternalArea).toList(),
                safeMap.boundaries().stream().map(TravelApplicationService::toInternalBoundary).toList(),
                safeMap.features().stream().map(TravelApplicationService::toInternalFeature).toList());
    }

    private static ApplyTravelDungeonSessionUseCase.AreaData toInternalArea(DungeonAreaSnapshot area) {
        DungeonAreaSnapshot safeArea = area == null ? null : area;
        if (safeArea == null) {
            return new ApplyTravelDungeonSessionUseCase.AreaData(
                    ApplyTravelDungeonSessionUseCase.AreaKind.ROOM,
                    1L,
                    "ROOM",
                    List.of());
        }
        return new ApplyTravelDungeonSessionUseCase.AreaData(
                ApplyTravelDungeonSessionUseCase.AreaKind.valueOf(safeArea.kind().name()),
                safeArea.id(),
                safeArea.label(),
                safeArea.cells().stream().map(TravelApplicationService::toInternalCell).toList());
    }

    private static ApplyTravelDungeonSessionUseCase.BoundaryData toInternalBoundary(DungeonBoundarySnapshot boundary) {
        DungeonBoundarySnapshot safeBoundary = boundary == null ? null : boundary;
        if (safeBoundary == null) {
            return new ApplyTravelDungeonSessionUseCase.BoundaryData(
                    "boundary",
                    1L,
                    "boundary",
                    new ApplyTravelDungeonSessionUseCase.EdgeData(
                            new ApplyTravelDungeonSessionUseCase.CellData(0, 0, 0),
                            new ApplyTravelDungeonSessionUseCase.CellData(0, 0, 0)));
        }
        return new ApplyTravelDungeonSessionUseCase.BoundaryData(
                safeBoundary.kind(),
                safeBoundary.id(),
                safeBoundary.label(),
                new ApplyTravelDungeonSessionUseCase.EdgeData(
                        toInternalCell(safeBoundary.edge().from()),
                        toInternalCell(safeBoundary.edge().to())));
    }

    private static ApplyTravelDungeonSessionUseCase.FeatureData toInternalFeature(
            src.domain.dungeon.published.DungeonFeatureSnapshot feature
    ) {
        src.domain.dungeon.published.DungeonFeatureSnapshot safeFeature = feature == null ? null : feature;
        if (safeFeature == null) {
            return new ApplyTravelDungeonSessionUseCase.FeatureData(
                    ApplyTravelDungeonSessionUseCase.FeatureKind.STAIR,
                    1L,
                    "STAIR",
                    List.of(),
                    "",
                    "");
        }
        return new ApplyTravelDungeonSessionUseCase.FeatureData(
                ApplyTravelDungeonSessionUseCase.FeatureKind.valueOf(safeFeature.kind().name()),
                safeFeature.id(),
                safeFeature.label(),
                safeFeature.cells().stream().map(TravelApplicationService::toInternalCell).toList(),
                safeFeature.description(),
                safeFeature.destinationLabel());
    }

    private static ApplyTravelDungeonSessionUseCase.CellData toInternalCell(DungeonCellRef cell) {
        return new ApplyTravelDungeonSessionUseCase.CellData(
                cell == null ? 0 : cell.q(),
                cell == null ? 0 : cell.r(),
                cell == null ? 0 : cell.level());
    }

    private static ApplyTravelDungeonSessionUseCase.@Nullable PositionData toInternalPosition(
            @Nullable TravelDungeonPosition position
    ) {
        if (position == null) {
            return null;
        }
        return new ApplyTravelDungeonSessionUseCase.PositionData(
                position.mapId(),
                ApplyTravelDungeonSessionUseCase.LocationKind.valueOf(position.locationKind().name()),
                position.ownerId(),
                new ApplyTravelDungeonSessionUseCase.CellData(
                        position.tile().q(),
                        position.tile().r(),
                        position.tile().level()),
                ApplyTravelDungeonSessionUseCase.Heading.valueOf(position.heading().name()));
    }

    private static ApplyTravelDungeonSessionUseCase.PositionData toInternalPosition(
            @Nullable DungeonTravelPosition position
    ) {
        return new ApplyTravelDungeonSessionUseCase.PositionData(
                position == null ? 1L : position.mapId().value(),
                position == null
                        ? ApplyTravelDungeonSessionUseCase.LocationKind.TILE
                        : ApplyTravelDungeonSessionUseCase.LocationKind.valueOf(position.locationKind().name()),
                position == null ? 0L : position.ownerId(),
                new ApplyTravelDungeonSessionUseCase.CellData(
                        position == null ? 0 : position.tile().q(),
                        position == null ? 0 : position.tile().r(),
                        position == null ? 0 : position.tile().level()),
                position == null
                        ? ApplyTravelDungeonSessionUseCase.Heading.SOUTH
                        : ApplyTravelDungeonSessionUseCase.Heading.valueOf(position.heading().name()));
    }

    private static @Nullable DungeonTravelPosition toDungeonPosition(
            ApplyTravelDungeonSessionUseCase.@Nullable PositionData position
    ) {
        if (position == null) {
            return null;
        }
        return new DungeonTravelPosition(
                new src.domain.dungeon.published.DungeonMapId(position.mapId()),
                src.domain.dungeon.published.DungeonTravelLocationKind.valueOf(position.locationKind().name()),
                position.ownerId(),
                new src.domain.dungeon.published.DungeonCellRef(
                        position.tile().q(),
                        position.tile().r(),
                        position.tile().level()),
                src.domain.dungeon.published.DungeonTravelHeading.valueOf(position.heading().name()));
    }

    private static ApplyTravelDungeonSessionUseCase.SurfaceData outsideDungeonSurfaceData(long tileId) {
        return new ApplyTravelDungeonSessionUseCase.SurfaceData(
                ApplyTravelDungeonSessionUseCase.ContextKind.OVERWORLD,
                "Overworld",
                0,
                ApplyTravelDungeonSessionUseCase.MapData.empty(),
                new ApplyTravelDungeonSessionUseCase.PositionData(
                        1L,
                        ApplyTravelDungeonSessionUseCase.LocationKind.TILE,
                        0L,
                        new ApplyTravelDungeonSessionUseCase.CellData(0, 0, 0),
                        ApplyTravelDungeonSessionUseCase.Heading.SOUTH),
                "Overworld",
                "Overworld-Feld " + tileId,
                "-",
                "-",
                "Gruppe befindet sich ausserhalb des Dungeons",
                "",
                List.of());
    }
}
