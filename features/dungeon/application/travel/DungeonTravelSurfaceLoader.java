package features.dungeon.application.travel;

import java.util.List;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import features.dungeon.application.travel.DungeonTravelAuthoredReadResult.Loaded;
import features.dungeon.application.travel.projection.TravelAuthoredSurface;
import features.dungeon.application.travel.projection.TravelDungeonSessionProjectionMapper;
import features.dungeon.application.travel.projection.TravelPositionFacts;
import features.dungeon.application.travel.projection.TravelSurfaceFacts;
import features.dungeon.application.travel.projection.TravelSurfaceProjection;
import features.dungeon.application.travel.session.TravelDungeonActiveState;
import features.dungeon.application.travel.session.TravelDungeonActiveState.ActiveTravelStateData;
import features.dungeon.application.travel.session.TravelDungeonActiveState.PartyLocationData;
import features.dungeon.application.travel.session.TravelDungeonSessionSurface;
import features.dungeon.application.travel.session.TravelDungeonSessionSurface.ContextKind;
import features.dungeon.application.travel.session.TravelDungeonSessionSurface.PositionData;
import features.dungeon.application.travel.session.TravelDungeonSessionSurface.SurfaceData;

public final class DungeonTravelSurfaceLoader {

    private final DungeonTravelAuthoredReader authoredReader;
    private final DungeonTravelPartyGateway partyGateway;
    private final TravelSurfaceProjection projector = new TravelSurfaceProjection();

    public DungeonTravelSurfaceLoader(
            DungeonTravelAuthoredReader authoredReader,
            DungeonTravelPartyGateway partyGateway
    ) {
        this.authoredReader = Objects.requireNonNull(authoredReader, "authoredReader");
        this.partyGateway = Objects.requireNonNull(partyGateway, "partyGateway");
    }

    SurfaceData loadCurrentPosition(@Nullable PositionData requestedTravelPosition) {
        return loadOrInitialize(new Input(requestedTravelPosition, 0L));
    }

    SurfaceData loadSelectedMap(long selectedMapId) {
        return loadOrInitialize(Input.selectedMap(selectedMapId));
    }

    SurfaceData currentSurface(@Nullable PositionData effectivePosition) {
        return loadRuntimeSurface(new Input(null, 0L), effectivePosition).surface();
    }

    private SurfaceData loadOrInitialize(Input input) {
        Input safeInput = input == null ? new Input(null, 0L) : input;
        ActiveTravelStateData activeTravel = partyGateway.loadActiveTravelState();
        if (activeTravel.partyLocation() != null && activeTravel.partyLocation().outsideDungeon()) {
            return features.dungeon.application.travel.session.TravelDungeonSessionSurface.outsideDungeonSurface(
                    activeTravel.partyLocation().overworldTileId());
        }
        PositionData effectivePosition =
                effectiveTravelPosition(safeInput, activeTravel.partyLocation());
        SurfaceLoad loaded = loadRuntimeSurface(safeInput, effectivePosition);
        SurfaceData surface = loaded.surface();
        if (loaded.available() && shouldSavePosition(safeInput, activeTravel)) {
            boolean saved = partyGateway.saveDungeonPosition(
                    surface.position(),
                    activeTravel.travelCharacterIds());
            return saved ? surface : failedInitialSaveSurface(surface);
        }
        return surface;
    }

    private SurfaceLoad loadRuntimeSurface(
            Input input,
            @Nullable PositionData effectivePosition
    ) {
        DungeonTravelAuthoredReadResult readResult;
        @Nullable TravelPositionFacts position = null;
        if (effectivePosition != null) {
            position = TravelDungeonSessionProjectionMapper.toRuntimePositionFacts(effectivePosition);
            readResult = authoredReader.readCurrentPosition(position);
        } else if (input.hasSelectedMapId()) {
            readResult = authoredReader.readSelectedMap(input.selectedMapId());
        } else {
            readResult = authoredReader.readFirstCatalogMap();
        }
        if (readResult instanceof Loaded loaded) {
            TravelSurfaceFacts facts = projector.project(
                    loaded.surface(), position, "Token auf der Karte ziehen");
            return new SurfaceLoad(
                    TravelDungeonSessionProjectionMapper.toRuntimeSurface(facts),
                    true);
        }
        long knownMapId = position == null ? input.selectedMapId() : position.mapId();
        if (knownMapId <= 0L) {
            return new SurfaceLoad(TravelDungeonSessionSurface.outsideDungeonSurface(0L), false);
        }
        TravelAuthoredSurface unavailable = new TravelAuthoredSurface(
                new TravelAuthoredSurface.Header(knownMapId, "Dungeon", 0L),
                null);
        TravelSurfaceFacts facts = projector.project(
                unavailable, position, "Dungeon ist nicht verfügbar.");
        return new SurfaceLoad(TravelDungeonSessionProjectionMapper.toRuntimeSurface(facts), false);
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

    private record SurfaceLoad(SurfaceData surface, boolean available) {
        private SurfaceLoad {
            surface = Objects.requireNonNull(surface, "surface");
        }
    }
}
