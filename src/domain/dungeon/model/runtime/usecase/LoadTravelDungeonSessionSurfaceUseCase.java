package src.domain.dungeon.model.runtime.usecase;

import java.util.List;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.runtime.repository.TravelPartyStateRepository;
import src.domain.dungeon.model.runtime.repository.TravelPartyPositionRepository;
import src.domain.dungeon.model.runtime.travel.projection.TravelDungeonSessionProjectionMapper;
import src.domain.dungeon.model.runtime.travel.projection.TravelPositionFacts;
import src.domain.dungeon.model.runtime.travel.projection.TravelSurfaceFacts;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonActiveState;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonActiveState.ActiveTravelStateData;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonActiveState.PartyLocationData;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionSurface;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionSurface.PositionData;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionSurface.SurfaceData;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionValues.ContextKind;

public final class LoadTravelDungeonSessionSurfaceUseCase {

    public static final class Input {
        private final @Nullable PositionData requestedTravelPosition;
        private final long selectedMapId;

        public Input(@Nullable PositionData requestedTravelPosition) {
            this(requestedTravelPosition, 0L);
        }

        private Input(@Nullable PositionData requestedTravelPosition, long selectedMapId) {
            this.requestedTravelPosition = requestedTravelPosition;
            this.selectedMapId = Math.max(0L, selectedMapId);
        }

        public static Input selectedMap(long selectedMapId) {
            return new Input(null, selectedMapId);
        }

        public @Nullable PositionData requestedTravelPosition() {
            return requestedTravelPosition;
        }

        public long selectedMapId() {
            return selectedMapId;
        }

        public boolean hasSelectedMapId() {
            return selectedMapId > 0L;
        }
    }

    private final TravelPartyStateRepository partyStateRepository;
    private final TravelPartyPositionRepository partyPositionRepository;
    private final LoadDungeonTravelSurfaceUseCase loadDungeonTravelSurfaceUseCase;

    public LoadTravelDungeonSessionSurfaceUseCase(
            TravelPartyStateRepository partyStateRepository,
            TravelPartyPositionRepository partyPositionRepository,
            LoadDungeonTravelSurfaceUseCase loadDungeonTravelSurfaceUseCase
    ) {
        this.partyStateRepository = Objects.requireNonNull(partyStateRepository, "partyStateRepository");
        this.partyPositionRepository = Objects.requireNonNull(partyPositionRepository, "partyPositionRepository");
        this.loadDungeonTravelSurfaceUseCase =
                Objects.requireNonNull(loadDungeonTravelSurfaceUseCase, "loadDungeonTravelSurfaceUseCase");
    }

    public SurfaceData loadOrInitialize(
            @Nullable PositionData requestedTravelPosition
    ) {
        return loadOrInitialize(new Input(requestedTravelPosition));
    }

    public SurfaceData loadOrInitialize(Input input) {
        Input safeInput = input == null ? new Input(null) : input;
        ActiveTravelStateData activeTravel = partyStateRepository.loadActiveTravelState();
        if (activeTravel.partyLocation() != null && activeTravel.partyLocation().outsideDungeon()) {
            return TravelDungeonSessionSurface.outsideDungeonSurface(activeTravel.partyLocation().overworldTileId());
        }
        PositionData effectivePosition =
                effectiveTravelPosition(safeInput, activeTravel.partyLocation());
        SurfaceData surface = TravelDungeonSessionProjectionMapper.toRuntimeSurface(
                loadSurface(safeInput, effectivePosition));
        if (shouldSavePosition(safeInput, activeTravel)) {
            boolean saved = partyPositionRepository.saveDungeonPosition(
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
            return loadDungeonTravelSurfaceUseCase.execute(new LoadDungeonTravelSurfaceUseCase.Input(
                    TravelDungeonSessionProjectionMapper.toRuntimePositionFacts(effectivePosition)));
        }
        if (input.hasSelectedMapId()) {
            return loadDungeonTravelSurfaceUseCase.execute(new LoadDungeonTravelSurfaceUseCase.Input(
                    input.selectedMapId()));
        }
        return loadDungeonTravelSurfaceUseCase.execute(new LoadDungeonTravelSurfaceUseCase.Input((TravelPositionFacts) null));
    }

    private static @Nullable PositionData effectiveTravelPosition(
            Input input,
            PartyLocationData partyLocation
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
}
