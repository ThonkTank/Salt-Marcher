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
import src.domain.dungeon.published.DungeonFeatureSnapshot;
import src.domain.dungeon.published.DungeonMapSnapshot;
import src.domain.dungeon.published.DungeonTravelActionSnapshot;
import src.domain.dungeon.published.DungeonTravelCommand;
import src.domain.dungeon.published.DungeonTravelExternalTarget;
import src.domain.dungeon.published.DungeonTravelMoveResult;
import src.domain.dungeon.published.DungeonTravelPosition;
import src.domain.dungeon.published.DungeonTravelResponse;
import src.domain.dungeon.published.DungeonTravelSurfaceSnapshot;
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
import src.domain.travel.published.TravelDungeonMapProjectionSnapshot;
import src.domain.travel.published.TravelDungeonModel;
import src.domain.travel.published.TravelDungeonSnapshot;
import src.domain.travel.published.TravelDungeonWorkspaceState;
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
                        return PartyBoundaryTranslation.loadActiveTravelState(party);
                    }

                    @Override
                    public ApplyTravelDungeonSessionUseCase.SurfaceData loadDungeonSurface(
                            ApplyTravelDungeonSessionUseCase.@Nullable PositionData position
                    ) {
                        return DungeonBoundaryTranslation.loadDungeonSurface(dungeon, position);
                    }

                    @Override
                    public ApplyTravelDungeonSessionUseCase.MoveResultData moveDungeonAction(
                            ApplyTravelDungeonSessionUseCase.@Nullable PositionData position,
                            String actionId
                    ) {
                        return DungeonBoundaryTranslation.moveDungeonAction(dungeon, position, actionId);
                    }

                    @Override
                    public void saveDungeonPosition(
                            ApplyTravelDungeonSessionUseCase.PositionData position,
                            List<Long> characterIds
                    ) {
                        PartyBoundaryTranslation.saveDungeonPosition(party, position, characterIds);
                    }

                    @Override
                    public boolean saveOverworldPosition(
                            ApplyTravelDungeonSessionUseCase.OverworldTargetData target,
                            List<Long> characterIds
                    ) {
                        return PartyBoundaryTranslation.saveOverworldPosition(party, target, characterIds);
                    }
                });
    }

    public TravelDungeonModel loadDungeonTravel(LoadTravelDungeonQuery query) {
        Objects.requireNonNullElse(query, new LoadTravelDungeonQuery());
        return dungeonTravelModel;
    }

    public TravelDungeonSnapshot applyDungeonTravelSession(ApplyTravelDungeonSessionCommand command) {
        ApplyTravelDungeonSessionCommand effectiveCommand = command == null
                ? new ApplyTravelDungeonSessionCommand(
                ApplyTravelDungeonSessionCommand.Action.REFRESH,
                "",
                0,
                TravelOverlaySettings.defaults())
                : command;
        switch (effectiveCommand.action()) {
            case REFRESH -> applyTravelDungeonSessionUseCase.refresh();
            case ACTION -> applyTravelDungeonSessionUseCase.move(effectiveCommand.actionId());
            case SET_PROJECTION_LEVEL ->
                    applyTravelDungeonSessionUseCase.setProjectionLevel(effectiveCommand.projectionLevel());
            case SET_OVERLAY -> {
                TravelOverlaySettings overlaySettings = effectiveCommand.overlaySettings();
                applyTravelDungeonSessionUseCase.setOverlay(
                        overlaySettings.modeKey(),
                        overlaySettings.levelRange(),
                        overlaySettings.opacity(),
                        overlaySettings.selectedLevels());
            }
        }
        TravelDungeonSnapshot snapshot = currentDungeonTravelSnapshot();
        notifyDungeonTravelListeners(snapshot);
        return snapshot;
    }

    private TravelDungeonSnapshot currentDungeonTravelSnapshot() {
        return SnapshotTranslation.toPublishedSnapshot(applyTravelDungeonSessionUseCase.snapshot());
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

    private static final class SnapshotTranslation {

        private SnapshotTranslation() {
        }

        private static TravelDungeonSnapshot toPublishedSnapshot(
                ApplyTravelDungeonSessionUseCase.@Nullable SnapshotData snapshot
        ) {
            ApplyTravelDungeonSessionUseCase.SnapshotData safeSnapshot = snapshot == null
                    ? new ApplyTravelDungeonSessionUseCase.SnapshotData(
                    null,
                    ApplyTravelDungeonSessionUseCase.TravelOverlayState.defaults(),
                    0)
                    : snapshot;
            ApplyTravelDungeonSessionUseCase.SurfaceData surface = safeSnapshot.surface();
            return new TravelDungeonSnapshot(
                    toPublishedWorkspaceState(surface),
                    ProjectionTranslation.projection(surface),
                    toPublishedOverlay(safeSnapshot.overlayState()),
                    safeSnapshot.projectionLevel());
        }

        private static TravelOverlaySettings toPublishedOverlay(
                ApplyTravelDungeonSessionUseCase.TravelOverlayState overlayState
        ) {
            ApplyTravelDungeonSessionUseCase.TravelOverlayState safeOverlay = overlayState == null
                    ? ApplyTravelDungeonSessionUseCase.TravelOverlayState.defaults()
                    : overlayState;
            return new TravelOverlaySettings(
                    safeOverlay.modeKey(),
                    safeOverlay.levelRange(),
                    safeOverlay.opacity(),
                    safeOverlay.selectedLevels());
        }

        private static @Nullable TravelDungeonWorkspaceState toPublishedWorkspaceState(
                ApplyTravelDungeonSessionUseCase.@Nullable SurfaceData surface
        ) {
            if (surface == null) {
                return null;
            }
            return new TravelDungeonWorkspaceState(
                    surface.mapName(),
                    surface.areaLabel(),
                    surface.tileLabel(),
                    surface.headingLabel(),
                    surface.statusLabel(),
                    surface.contextKind() == ApplyTravelDungeonSessionUseCase.ContextKind.OVERWORLD,
                    surface.actions().stream().map(SnapshotTranslation::toPublishedAction).toList());
        }

        private static TravelDungeonAction toPublishedAction(
                ApplyTravelDungeonSessionUseCase.@Nullable AvailableAction action
        ) {
            ApplyTravelDungeonSessionUseCase.AvailableAction safeAction = action == null
                    ? new ApplyTravelDungeonSessionUseCase.AvailableAction("", "Aktion", "")
                    : action;
            return new TravelDungeonAction(
                    safeAction.id(),
                    safeAction.displayLabel(),
                    safeAction.helpText());
        }
    }

    private static final class ProjectionTranslation {

        private ProjectionTranslation() {
        }

        private static @Nullable TravelDungeonMapProjectionSnapshot projection(
                ApplyTravelDungeonSessionUseCase.@Nullable SurfaceData surface
        ) {
            if (surface == null || surface.contextKind() != ApplyTravelDungeonSessionUseCase.ContextKind.DUNGEON) {
                return null;
            }
            ProjectionAccumulator projection = ProjectionAssembler.assemble(surface);
            ApplyTravelDungeonSessionUseCase.MapData map = surface.map();
            return new TravelDungeonMapProjectionSnapshot(
                    surface.mapName(),
                    ProjectionSupport.topology(map.topology()),
                    map.width(),
                    map.height(),
                    projection.cells(),
                    projection.edges(),
                    projection.labels(),
                    projection.markers(),
                    projection.graphNodes(),
                    projection.graphLinks(),
                    ProjectionSupport.partyToken(surface.position()));
        }
    }

    private static final class ProjectionAssembler {

        private ProjectionAssembler() {
        }

        private static ProjectionAccumulator assemble(ApplyTravelDungeonSessionUseCase.SurfaceData surface) {
            ProjectionAccumulator projection = new ProjectionAccumulator(
                    new ArrayList<>(),
                    new ArrayList<>(),
                    new ArrayList<>(),
                    new ArrayList<>(),
                    new ArrayList<>(),
                    new ArrayList<>());
            ApplyTravelDungeonSessionUseCase.MapData map = surface.map();
            renderAreas(map, projection.cells(), projection.graphNodes());
            renderBoundaries(map, projection.edges());
            renderFeatures(map, projection.cells(), projection.labels(), projection.markers());
            addFallbackGraphLinks(projection.graphNodes(), projection.graphLinks());
            return projection;
        }

        private static void renderAreas(
                ApplyTravelDungeonSessionUseCase.MapData map,
                List<TravelDungeonMapProjectionSnapshot.CellProjection> cells,
                List<TravelDungeonMapProjectionSnapshot.GraphNodeProjection> graphNodes
        ) {
            for (ApplyTravelDungeonSessionUseCase.AreaData area : map.areas()) {
                List<TravelDungeonMapProjectionSnapshot.CellProjection> areaCells = area.cells().stream()
                        .map(cell -> ProjectionSupport.cell(area, cell))
                        .toList();
                cells.addAll(areaCells);
                if (areaCells.isEmpty()) {
                    continue;
                }
                CellCenter center = ProjectionSupport.centerOf(areaCells);
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
                edges.add(ProjectionSupport.edge(boundary));
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
                        .map(cell -> ProjectionSupport.featureCell(feature, cell))
                        .toList();
                cells.addAll(featureCells);
                if (featureCells.isEmpty()) {
                    continue;
                }
                CellCenter center = ProjectionSupport.centerOf(featureCells);
                int level = featureCells.getFirst().level();
                TravelDungeonMapProjectionSnapshot.TopologyRef topologyRef = ProjectionSupport.featureTopologyRef(feature);
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
                markers.add(ProjectionSupport.featureMarker(feature, center, level, topologyRef));
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
    }

    private static final class ProjectionSupport {

        private ProjectionSupport() {
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
                    edgeKind(boundary.kind()),
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
                ApplyTravelDungeonSessionUseCase.GridTopology topology
        ) {
            return ApplyTravelDungeonSessionUseCase.GridTopology.HEX.equals(topology)
                    ? TravelDungeonMapProjectionSnapshot.TopologyKind.HEX
                    : TravelDungeonMapProjectionSnapshot.TopologyKind.SQUARE;
        }

        private static TravelDungeonMapProjectionSnapshot.EdgeKind edgeKind(
                ApplyTravelDungeonSessionUseCase.BoundaryKind boundaryKind
        ) {
            return boundaryKind == ApplyTravelDungeonSessionUseCase.BoundaryKind.DOOR
                    ? TravelDungeonMapProjectionSnapshot.EdgeKind.DOOR
                    : TravelDungeonMapProjectionSnapshot.EdgeKind.WALL;
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
                ApplyTravelDungeonSessionUseCase.@Nullable Direction heading
        ) {
            String directionName = heading == null
                    ? ApplyTravelDungeonSessionUseCase.Direction.SOUTH.name()
                    : heading.name();
            return switch (directionName) {
                case "NORTH" -> TravelDungeonMapProjectionSnapshot.Heading.NORTH;
                case "EAST" -> TravelDungeonMapProjectionSnapshot.Heading.EAST;
                case "WEST" -> TravelDungeonMapProjectionSnapshot.Heading.WEST;
                default -> TravelDungeonMapProjectionSnapshot.Heading.SOUTH;
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
    }

    private static final class PartyBoundaryTranslation {

        private PartyBoundaryTranslation() {
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
                return new ApplyTravelDungeonSessionUseCase.PartyLocationData(
                        new ApplyTravelDungeonSessionUseCase.PositionData(
                                dungeonLocation.mapId(),
                                ApplyTravelDungeonSessionUseCase.LocationKind.valueOf(dungeonLocation.locationKind().name()),
                                dungeonLocation.ownerId(),
                                new ApplyTravelDungeonSessionUseCase.CellData(
                                        dungeonLocation.tile().q(),
                                        dungeonLocation.tile().r(),
                                        dungeonLocation.tile().level()),
                                ApplyTravelDungeonSessionUseCase.Direction.fromName(dungeonLocation.heading().name())),
                        0L,
                        false);
            }
            if (location instanceof PartyOverworldTravelLocationSnapshot overworldLocation) {
                return new ApplyTravelDungeonSessionUseCase.PartyLocationData(
                        null,
                        overworldLocation.tileId(),
                        true);
            }
            return null;
        }
    }

    private static final class DungeonBoundaryTranslation {

        private DungeonBoundaryTranslation() {
        }

        private static ApplyTravelDungeonSessionUseCase.SurfaceData loadDungeonSurface(
                DungeonApplicationService dungeonApplicationService,
                ApplyTravelDungeonSessionUseCase.@Nullable PositionData position
        ) {
            return toInternalSurface(surfaceResponse(dungeonApplicationService.travel(
                    new DungeonTravelCommand.LoadSurface(toDungeonPosition(position)))));
        }

        private static ApplyTravelDungeonSessionUseCase.MoveResultData moveDungeonAction(
                DungeonApplicationService dungeonApplicationService,
                ApplyTravelDungeonSessionUseCase.@Nullable PositionData position,
                String actionId
        ) {
            return toInternalMoveResult(moveResponse(dungeonApplicationService.travel(
                    new DungeonTravelCommand.MoveAction(toDungeonPosition(position), actionId))));
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
                    surface.actions().stream().map(DungeonBoundaryTranslation::toInternalAction).toList());
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
                            ? new ApplyTravelDungeonSessionUseCase.OverworldTargetData(
                            overworld.mapId(),
                            overworld.tileId())
                            : null;
            return new ApplyTravelDungeonSessionUseCase.MoveResultData(
                    ApplyTravelDungeonSessionUseCase.MoveStatus.valueOf(result.status().name()),
                    toInternalSurface(result.surface()),
                    externalTarget);
        }

        private static ApplyTravelDungeonSessionUseCase.AvailableAction toInternalAction(
                @Nullable DungeonTravelActionSnapshot action
        ) {
            return new ApplyTravelDungeonSessionUseCase.AvailableAction(
                    action == null ? "" : action.actionId(),
                    action == null ? "" : action.displayLabel(),
                    action == null ? "" : action.description());
        }

        private static ApplyTravelDungeonSessionUseCase.MapData toInternalMap(@Nullable DungeonMapSnapshot map) {
            DungeonMapSnapshot safeMap = map == null ? DungeonMapSnapshot.empty() : map;
            return new ApplyTravelDungeonSessionUseCase.MapData(
                    ApplyTravelDungeonSessionUseCase.GridTopology.fromName(safeMap.topology().name()),
                    safeMap.width(),
                    safeMap.height(),
                    safeMap.areas().stream().map(DungeonBoundaryTranslation::toInternalArea).toList(),
                    safeMap.boundaries().stream().map(DungeonBoundaryTranslation::toInternalBoundary).toList(),
                    safeMap.features().stream().map(DungeonBoundaryTranslation::toInternalFeature).toList());
        }

        private static ApplyTravelDungeonSessionUseCase.AreaData toInternalArea(@Nullable DungeonAreaSnapshot area) {
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
                    safeArea.cells().stream().map(DungeonBoundaryTranslation::toInternalCell).toList());
        }

        private static ApplyTravelDungeonSessionUseCase.BoundaryData toInternalBoundary(
                @Nullable DungeonBoundarySnapshot boundary
        ) {
            DungeonBoundarySnapshot safeBoundary = boundary == null ? null : boundary;
            if (safeBoundary == null) {
                return new ApplyTravelDungeonSessionUseCase.BoundaryData(
                        ApplyTravelDungeonSessionUseCase.BoundaryKind.WALL,
                        1L,
                        "wall",
                        new ApplyTravelDungeonSessionUseCase.EdgeData(
                                new ApplyTravelDungeonSessionUseCase.CellData(0, 0, 0),
                                new ApplyTravelDungeonSessionUseCase.CellData(0, 0, 0)));
            }
            return new ApplyTravelDungeonSessionUseCase.BoundaryData(
                    ApplyTravelDungeonSessionUseCase.BoundaryKind.fromExternalKind(safeBoundary.kind()),
                    safeBoundary.id(),
                    safeBoundary.label(),
                    new ApplyTravelDungeonSessionUseCase.EdgeData(
                            toInternalCell(safeBoundary.edge().from()),
                            toInternalCell(safeBoundary.edge().to())));
        }

        private static ApplyTravelDungeonSessionUseCase.FeatureData toInternalFeature(
                @Nullable DungeonFeatureSnapshot feature
        ) {
            DungeonFeatureSnapshot safeFeature = feature == null ? null : feature;
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
                    safeFeature.cells().stream().map(DungeonBoundaryTranslation::toInternalCell).toList(),
                    safeFeature.description(),
                    safeFeature.destinationLabel());
        }

        private static ApplyTravelDungeonSessionUseCase.CellData toInternalCell(@Nullable DungeonCellRef cell) {
            return new ApplyTravelDungeonSessionUseCase.CellData(
                    cell == null ? 0 : cell.q(),
                    cell == null ? 0 : cell.r(),
                    cell == null ? 0 : cell.level());
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
                            ? ApplyTravelDungeonSessionUseCase.Direction.SOUTH
                            : ApplyTravelDungeonSessionUseCase.Direction.fromName(position.heading().name()));
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
                    new DungeonCellRef(
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
                            ApplyTravelDungeonSessionUseCase.Direction.SOUTH),
                    "Overworld",
                    "Overworld-Feld " + tileId,
                    "-",
                    "-",
                    "Gruppe befindet sich ausserhalb des Dungeons",
                    "",
                    List.of());
        }

        private static @Nullable DungeonTravelSurfaceSnapshot surfaceResponse(@Nullable DungeonTravelResponse response) {
            if (response instanceof DungeonTravelResponse.Surface surface) {
                return surface.surface();
            }
            return null;
        }

        private static @Nullable DungeonTravelMoveResult moveResponse(@Nullable DungeonTravelResponse response) {
            if (response instanceof DungeonTravelResponse.Move move) {
                return move.result();
            }
            return null;
        }
    }

    private record ProjectionAccumulator(
            List<TravelDungeonMapProjectionSnapshot.CellProjection> cells,
            List<TravelDungeonMapProjectionSnapshot.EdgeProjection> edges,
            List<TravelDungeonMapProjectionSnapshot.LabelProjection> labels,
            List<TravelDungeonMapProjectionSnapshot.MarkerProjection> markers,
            List<TravelDungeonMapProjectionSnapshot.GraphNodeProjection> graphNodes,
            List<TravelDungeonMapProjectionSnapshot.GraphLinkProjection> graphLinks
    ) {
    }

    private record CellCenter(double q, double r) {
    }
}
