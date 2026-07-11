package src.domain.dungeon;

import java.util.List;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.structure.DungeonMap;
import src.domain.dungeon.model.core.structure.DungeonMapIdentity;
import src.domain.dungeon.model.runtime.travel.projection.TravelAuthoredSurfaceProjectionMapper;
import src.domain.dungeon.model.runtime.travel.projection.TravelDungeonSessionProjectionMapper;
import src.domain.dungeon.model.runtime.travel.projection.TravelPositionFacts;
import src.domain.dungeon.model.runtime.travel.projection.TravelSurfaceFacts;
import src.domain.dungeon.model.runtime.travel.projection.TravelSurfaceProjection;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonActiveState;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonActiveState.ActiveTravelStateData;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonActiveState.PartyLocationData;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionSurface.ContextKind;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionSurface.PositionData;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionSurface.SurfaceData;

final class DungeonTravelSurfaceLoader {

    private final DungeonAuthoredApplicationService authoredMaps;
    private final DungeonTravelPartyGateway partyGateway;
    private final TravelSurfaceProjection projector = new TravelSurfaceProjection();

    DungeonTravelSurfaceLoader(
            DungeonAuthoredApplicationService authoredMaps,
            DungeonTravelPartyGateway partyGateway
    ) {
        this.authoredMaps = Objects.requireNonNull(authoredMaps, "authoredMaps");
        this.partyGateway = Objects.requireNonNull(partyGateway, "partyGateway");
    }

    SurfaceData loadCurrentPosition(@Nullable PositionData requestedTravelPosition) {
        return loadOrInitialize(new Input(requestedTravelPosition, 0L));
    }

    SurfaceData loadSelectedMap(long selectedMapId) {
        return loadOrInitialize(Input.selectedMap(selectedMapId));
    }

    SurfaceData currentSurface(@Nullable PositionData effectivePosition) {
        return TravelDungeonSessionProjectionMapper.toRuntimeSurface(
                loadSurface(new Input(null, 0L), effectivePosition));
    }

    private SurfaceData loadOrInitialize(Input input) {
        Input safeInput = input == null ? new Input(null, 0L) : input;
        ActiveTravelStateData activeTravel = partyGateway.loadActiveTravelState();
        if (activeTravel.partyLocation() != null && activeTravel.partyLocation().outsideDungeon()) {
            return src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionSurface.outsideDungeonSurface(
                    activeTravel.partyLocation().overworldTileId());
        }
        PositionData effectivePosition =
                effectiveTravelPosition(safeInput, activeTravel.partyLocation());
        SurfaceData surface = TravelDungeonSessionProjectionMapper.toRuntimeSurface(
                loadSurface(safeInput, effectivePosition));
        if (shouldSavePosition(safeInput, activeTravel)) {
            boolean saved = partyGateway.saveDungeonPosition(
                    surface.position(),
                    activeTravel.travelCharacterIds());
            return saved ? surface : failedInitialSaveSurface(surface);
        }
        return surface;
    }

    private TravelSurfaceFacts loadSurface(
            Input input,
            @Nullable PositionData effectivePosition
    ) {
        if (effectivePosition != null) {
            return loadSurface(TravelDungeonSessionProjectionMapper.toRuntimePositionFacts(effectivePosition), null);
        }
        if (input.hasSelectedMapId()) {
            return loadSurface(null, input.selectedMapId());
        }
        return loadSurface((TravelPositionFacts) null, null);
    }

    private TravelSurfaceFacts loadSurface(
            @Nullable TravelPositionFacts position,
            @Nullable Long selectedMapId
    ) {
        DungeonMap dungeonMap = loadMap(selectedMapId, position);
        return projector.project(
                TravelAuthoredSurfaceProjectionMapper.from(dungeonMap, authoredMaps.derive(dungeonMap)),
                position,
                "Token auf der Karte ziehen");
    }

    private DungeonMap loadMap(@Nullable Long requestedMapId, @Nullable TravelPositionFacts position) {
        if (position != null) {
            return authoredMaps.loadMap(new DungeonMapIdentity(position.mapId()));
        }
        if (requestedMapId != null && requestedMapId > 0L) {
            return authoredMaps.loadMap(new DungeonMapIdentity(requestedMapId));
        }
        return authoredMaps.loadMap(null);
    }

    private static @Nullable PositionData effectiveTravelPosition(
            Input input,
            @Nullable PartyLocationData partyLocation
    ) {
        PositionData effectivePosition =
                TravelDungeonActiveState.effectiveTravelPosition(input.requestedTravelPosition(), partyLocation);
        if (!input.hasSelectedMapId()
                || effectivePosition == null
                || effectivePosition.mapId() == input.selectedMapId()) {
            return effectivePosition;
        }
        return null;
    }

    private static boolean shouldSavePosition(
            Input input,
            ActiveTravelStateData activeTravel
    ) {
        if (activeTravel.travelCharacterIds().isEmpty()) {
            return false;
        }
        return input.requestedTravelPosition() != null
                || input.hasSelectedMapId()
                || activeTravel.partyLocation() == null;
    }

    private static SurfaceData failedInitialSaveSurface(SurfaceData surface) {
        return new SurfaceData(
                ContextKind.DUNGEON,
                surface.mapName(),
                surface.revision(),
                surface.map(),
                surface.position(),
                surface.surfaceTitle(),
                surface.areaLabel(),
                surface.tileLabel(),
                surface.headingLabel(),
                "Position could not be saved.",
                surface.visualDescription(),
                List.of(),
                false);
    }

    private record Input(
            @Nullable PositionData requestedTravelPosition,
            long selectedMapId
    ) {
        private Input {
            selectedMapId = Math.max(0L, selectedMapId);
        }

        private static Input selectedMap(long selectedMapId) {
            return new Input(null, selectedMapId);
        }

        private boolean hasSelectedMapId() {
            return selectedMapId > 0L;
        }
    }
}
