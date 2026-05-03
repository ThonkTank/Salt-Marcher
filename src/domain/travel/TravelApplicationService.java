package src.domain.travel;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.DungeonApplicationService;
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
        this.applyTravelDungeonSessionUseCase = new ApplyTravelDungeonSessionUseCase(
                Objects.requireNonNull(partyApplicationService, "partyApplicationService"),
                Objects.requireNonNull(dungeonApplicationService, "dungeonApplicationService"));
    }

    public TravelDungeonModel loadDungeonTravel(LoadTravelDungeonQuery query) {
        LoadTravelDungeonQuery effectiveQuery = query == null
                ? new LoadTravelDungeonQuery(null)
                : query;
        applyTravelDungeonSessionUseCase.primeRequestedPosition(effectiveQuery.position());
        return dungeonTravelModel;
    }

    public TravelDungeonSnapshot applyDungeonTravelSession(ApplyTravelDungeonSessionCommand command) {
        applyTravelDungeonSessionUseCase.apply(command);
        TravelDungeonSnapshot snapshot = currentDungeonTravelSnapshot();
        notifyDungeonTravelListeners(snapshot);
        return snapshot;
    }

    private TravelDungeonSnapshot currentDungeonTravelSnapshot() {
        return applyTravelDungeonSessionUseCase.snapshot();
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
}

final class ApplyTravelDungeonSessionUseCase {

    private final PartyApplicationService partyApplicationService;
    private final DungeonApplicationService dungeonApplicationService;
    private TravelOverlaySettings overlaySettings = TravelOverlaySettings.defaults();
    private int projectionLevel;
    private boolean projectionLevelInitialized;
    private @Nullable TravelDungeonPosition requestedPosition;
    private @Nullable TravelDungeonSurface currentSurface;

    ApplyTravelDungeonSessionUseCase(
            PartyApplicationService partyApplicationService,
            DungeonApplicationService dungeonApplicationService
    ) {
        this.partyApplicationService = partyApplicationService;
        this.dungeonApplicationService = dungeonApplicationService;
    }

    void primeRequestedPosition(@Nullable TravelDungeonPosition position) {
        if (currentSurface == null && requestedPosition == null && position != null) {
            requestedPosition = position;
        }
    }

    void apply(@Nullable ApplyTravelDungeonSessionCommand command) {
        ApplyTravelDungeonSessionCommand effective = command == null
                ? new ApplyTravelDungeonSessionCommand(
                ApplyTravelDungeonSessionCommand.Action.REFRESH,
                "",
                projectionLevel,
                overlaySettings)
                : command;
        switch (effective.action()) {
            case REFRESH -> currentSurface = loadPartyAwareSurface(currentPosition());
            case ACTION -> currentSurface = movePartyAwareSurface(currentPosition(), effective.actionId());
            case SET_PROJECTION_LEVEL -> projectionLevel = effective.projectionLevel();
            case SET_OVERLAY -> overlaySettings = effective.overlaySettings();
        }
        stabilizeProjectionLevel();
    }

    TravelDungeonSnapshot snapshot() {
        if (currentSurface == null) {
            currentSurface = loadPartyAwareSurface(requestedPosition);
        }
        stabilizeProjectionLevel();
        return new TravelDungeonSnapshot(
                currentSurface,
                copyOverlaySettings(overlaySettings),
                projectionLevel);
    }

    private @Nullable TravelDungeonPosition currentPosition() {
        if (currentSurface == null || currentSurface.contextKind() != TravelDungeonSurface.ContextKind.DUNGEON) {
            return requestedPosition;
        }
        return currentSurface.position();
    }

    private TravelDungeonSurface loadPartyAwareSurface(@Nullable TravelDungeonPosition requestedTravelPosition) {
        ActiveTravelState activeTravel = loadActiveTravelState();
        if (activeTravel.partyLocation() instanceof PartyOverworldTravelLocationSnapshot overworld) {
            return outsideDungeonSurface(overworld.tileId());
        }
        TravelDungeonPosition effectivePosition = requestedTravelPosition != null
                ? requestedTravelPosition
                : toTravelPosition(activeTravel.partyLocation());
        DungeonTravelSurfaceSnapshot surface = dungeonApplicationService.loadTravelSurface(
                new LoadDungeonTravelSurfaceQuery(toDungeonPosition(effectivePosition)));
        if (requestedTravelPosition == null
                && activeTravel.partyLocation() == null
                && !activeTravel.travelCharacterIds().isEmpty()) {
            saveDungeonPosition(surface.position(), activeTravel.travelCharacterIds());
        }
        return toTravelSurface(surface);
    }

    private TravelDungeonSurface movePartyAwareSurface(
            @Nullable TravelDungeonPosition requestedTravelPosition,
            String actionId
    ) {
        ActiveTravelState activeTravel = loadActiveTravelState();
        TravelDungeonPosition effectivePosition = requestedTravelPosition != null
                ? requestedTravelPosition
                : toTravelPosition(activeTravel.partyLocation());
        DungeonTravelMoveResult result = dungeonApplicationService.moveTravelAction(
                new MoveDungeonTravelActionCommand(toDungeonPosition(effectivePosition), actionId));
        if (result.status() == DungeonTravelMoveStatus.EXTERNAL_TARGET
                && result.externalTarget() instanceof DungeonTravelExternalTarget.OverworldTile overworld) {
            boolean saved = saveOverworldPosition(overworld, activeTravel.travelCharacterIds());
            return saved ? outsideDungeonSurface(overworld.tileId()) : toTravelSurface(result.surface());
        }
        if (result.status() == DungeonTravelMoveStatus.SUCCESS) {
            saveDungeonPosition(result.surface().position(), activeTravel.travelCharacterIds());
        }
        return toTravelSurface(result.surface());
    }

    private ActiveTravelState loadActiveTravelState() {
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
        return new ActiveTravelState(travelCharacterIds, travelPositions.partyTokenLocation());
    }

    private void stabilizeProjectionLevel() {
        if (currentSurface == null) {
            return;
        }
        if (!projectionLevelInitialized) {
            projectionLevel = defaultProjectionLevel(currentSurface, projectionLevel);
            projectionLevelInitialized = true;
        }
        projectionLevel = clampProjectionLevel(currentSurface, projectionLevel);
    }

    private static int defaultProjectionLevel(TravelDungeonSurface surface, int fallbackLevel) {
        return surface.contextKind() == TravelDungeonSurface.ContextKind.DUNGEON
                ? surface.position().tile().level()
                : fallbackLevel;
    }

    private static int clampProjectionLevel(TravelDungeonSurface surface, int fallbackLevel) {
        List<Integer> levels = levelsFrom(surface, fallbackLevel);
        if (levels.isEmpty()) {
            return fallbackLevel;
        }
        return Math.max(levels.getFirst(), Math.min(levels.getLast(), fallbackLevel));
    }

    private static List<Integer> levelsFrom(TravelDungeonSurface surface, int fallbackLevel) {
        java.util.TreeSet<Integer> levels = new java.util.TreeSet<>();
        TravelDungeonMapSnapshot map = surface == null ? null : surface.map();
        if (map != null) {
            map.areas().forEach(area -> area.cells().forEach(cell -> levels.add(cell.level())));
            map.features().forEach(feature -> feature.cells().forEach(cell -> levels.add(cell.level())));
        }
        if (levels.isEmpty()) {
            levels.add(fallbackLevel);
        }
        return new ArrayList<>(levels);
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

    private void saveDungeonPosition(
            DungeonTravelPosition position,
            List<Long> characterIds
    ) {
        if (position == null || characterIds == null || characterIds.isEmpty()) {
            return;
        }
        partyApplicationService.moveCharacters(new MovePartyCharactersCommand(
                characterIds,
                new PartyDungeonTravelLocationSnapshot(
                        position.mapId().value(),
                        position.locationKind() == src.domain.dungeon.published.DungeonTravelLocationKind.TRANSITION
                                ? PartyDungeonTravelLocationKind.TRANSITION
                                : PartyDungeonTravelLocationKind.TILE,
                        position.ownerId(),
                        new PartyTravelTile(
                                position.tile().q(),
                                position.tile().r(),
                                position.tile().level()),
                        PartyTravelHeading.valueOf(position.heading().name())),
                true));
    }

    private boolean saveOverworldPosition(
            DungeonTravelExternalTarget.OverworldTile target,
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

    private static TravelDungeonSurface outsideDungeonSurface(long tileId) {
        return new TravelDungeonSurface(
                TravelDungeonSurface.ContextKind.OVERWORLD,
                "Overworld",
                0,
                TravelDungeonMapSnapshot.empty(),
                new TravelDungeonPosition(
                        1L,
                        TravelDungeonPosition.LocationKind.TILE,
                        0L,
                        new TravelDungeonCell(0, 0, 0),
                        TravelDungeonPosition.Heading.SOUTH),
                "Overworld",
                "Overworld-Feld " + tileId,
                "-",
                "-",
                "Gruppe befindet sich ausserhalb des Dungeons",
                "",
                List.of());
    }

    private static TravelDungeonSurface toTravelSurface(@Nullable DungeonTravelSurfaceSnapshot surface) {
        if (surface == null) {
            return outsideDungeonSurface(0L);
        }
        return new TravelDungeonSurface(
                TravelDungeonSurface.ContextKind.valueOf(surface.contextKind().name()),
                surface.mapName(),
                surface.revision(),
                toMapSnapshot(surface.map()),
                toTravelPosition(surface.position()),
                surface.surfaceTitle(),
                surface.areaLabel(),
                surface.tileLabel(),
                surface.headingLabel(),
                surface.statusLabel(),
                surface.visualDescription(),
                surface.actions().stream()
                        .map(ApplyTravelDungeonSessionUseCase::toAction)
                        .toList());
    }

    private static TravelDungeonAction toAction(DungeonTravelActionSnapshot action) {
        return new TravelDungeonAction(
                action == null ? "" : action.actionId(),
                action == null ? "" : action.displayLabel(),
                action == null ? "" : action.description());
    }

    private static TravelDungeonMapSnapshot toMapSnapshot(DungeonMapSnapshot map) {
        DungeonMapSnapshot safeMap = map == null ? DungeonMapSnapshot.empty() : map;
        return new TravelDungeonMapSnapshot(
                TravelDungeonMapSnapshot.TopologyKind.valueOf(safeMap.topology().name()),
                safeMap.width(),
                safeMap.height(),
                safeMap.areas().stream()
                        .map(area -> new TravelDungeonArea(
                                TravelDungeonArea.Kind.valueOf(area.kind().name()),
                                area.id(),
                                area.label(),
                                area.cells().stream().map(ApplyTravelDungeonSessionUseCase::toCell).toList()))
                        .toList(),
                safeMap.boundaries().stream()
                        .map(boundary -> new TravelDungeonBoundary(
                                boundary.kind(),
                                boundary.id(),
                                boundary.label(),
                                new TravelDungeonEdge(
                                        toCell(boundary.edge().from()),
                                        toCell(boundary.edge().to()))))
                        .toList(),
                safeMap.features().stream()
                        .map(feature -> new TravelDungeonFeature(
                                TravelDungeonFeature.Kind.valueOf(feature.kind().name()),
                                feature.id(),
                                feature.label(),
                                feature.cells().stream().map(ApplyTravelDungeonSessionUseCase::toCell).toList(),
                                feature.description(),
                                feature.destinationLabel()))
                        .toList());
    }

    private static TravelDungeonCell toCell(src.domain.dungeon.published.DungeonCellRef cell) {
        return new TravelDungeonCell(
                cell == null ? 0 : cell.q(),
                cell == null ? 0 : cell.r(),
                cell == null ? 0 : cell.level());
    }

    private static @Nullable TravelDungeonPosition toTravelPosition(@Nullable PartyTravelLocationSnapshot location) {
        if (!(location instanceof PartyDungeonTravelLocationSnapshot dungeonLocation)) {
            return null;
        }
        return new TravelDungeonPosition(
                dungeonLocation.mapId(),
                TravelDungeonPosition.LocationKind.valueOf(dungeonLocation.locationKind().name()),
                dungeonLocation.ownerId(),
                new TravelDungeonCell(
                        dungeonLocation.tile().q(),
                        dungeonLocation.tile().r(),
                        dungeonLocation.tile().level()),
                TravelDungeonPosition.Heading.valueOf(dungeonLocation.heading().name()));
    }

    private static TravelDungeonPosition toTravelPosition(@Nullable DungeonTravelPosition position) {
        return new TravelDungeonPosition(
                position == null ? 1L : position.mapId().value(),
                position == null
                        ? TravelDungeonPosition.LocationKind.TILE
                        : TravelDungeonPosition.LocationKind.valueOf(position.locationKind().name()),
                position == null ? 0L : position.ownerId(),
                new TravelDungeonCell(
                        position == null ? 0 : position.tile().q(),
                        position == null ? 0 : position.tile().r(),
                        position == null ? 0 : position.tile().level()),
                position == null
                        ? TravelDungeonPosition.Heading.SOUTH
                        : TravelDungeonPosition.Heading.valueOf(position.heading().name()));
    }

    private static @Nullable DungeonTravelPosition toDungeonPosition(@Nullable TravelDungeonPosition position) {
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

    private static TravelOverlaySettings copyOverlaySettings(TravelOverlaySettings overlaySettings) {
        TravelOverlaySettings safeOverlay = overlaySettings == null
                ? TravelOverlaySettings.defaults()
                : overlaySettings;
        return new TravelOverlaySettings(
                safeOverlay.modeKey(),
                safeOverlay.levelRange(),
                safeOverlay.opacity(),
                safeOverlay.selectedLevels());
    }

    private record ActiveTravelState(
            List<Long> travelCharacterIds,
            @Nullable PartyTravelLocationSnapshot partyLocation
    ) {
        private ActiveTravelState {
            travelCharacterIds = travelCharacterIds == null ? List.of() : List.copyOf(travelCharacterIds);
        }
    }
}
