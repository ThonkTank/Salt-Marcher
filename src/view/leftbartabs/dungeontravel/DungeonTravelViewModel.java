package src.view.leftbartabs.dungeontravel;

import java.util.List;
import java.util.Objects;
import javafx.beans.property.IntegerProperty;
import javafx.beans.property.ObjectProperty;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import javafx.beans.property.ReadOnlyStringProperty;
import javafx.beans.property.ReadOnlyStringWrapper;
import javafx.beans.property.SimpleIntegerProperty;
import javafx.beans.property.SimpleObjectProperty;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.DungeonApplicationService;
import src.domain.dungeon.published.DungeonTravelExternalTarget;
import src.domain.dungeon.published.DungeonMapMode;
import src.domain.dungeon.published.DungeonSnapshot;
import src.domain.dungeon.published.DungeonTravelActionSnapshot;
import src.domain.dungeon.published.DungeonTravelHeading;
import src.domain.dungeon.published.DungeonTravelMoveResult;
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
import src.domain.party.published.PartyTravelLocationSnapshot;
import src.domain.party.published.PartyTravelPositionSnapshot;
import src.domain.party.published.PartyTravelPositionsResult;
import src.domain.party.published.PartyTravelTile;
import src.domain.party.published.ReadStatus;
import src.view.slotcontent.main.dungeonmap.DungeonMapDisplayModel;

public final class DungeonTravelViewModel {

    private final DungeonApplicationService dungeon;
    private final PartyApplicationService party;
    private final ReadOnlyObjectWrapper<DungeonSnapshot> snapshot = new ReadOnlyObjectWrapper<>();
    private final ReadOnlyObjectWrapper<List<DungeonTravelActionSnapshot>> actions =
            new ReadOnlyObjectWrapper<>(List.of());
    private final ReadOnlyObjectWrapper<DungeonMapDisplayModel.PartyToken> partyToken = new ReadOnlyObjectWrapper<>();
    private final ReadOnlyStringWrapper state = new ReadOnlyStringWrapper("");
    private final ReadOnlyStringWrapper mapName = new ReadOnlyStringWrapper("Dungeon");
    private final ObjectProperty<DungeonMapDisplayModel.LevelOverlaySettings> overlaySettings =
            new SimpleObjectProperty<>(DungeonMapDisplayModel.LevelOverlaySettings.defaults());
    private final IntegerProperty projectionLevel = new SimpleIntegerProperty(0);
    private @Nullable DungeonTravelSurfaceSnapshot currentSurface;
    private List<Long> partyTokenCharacterIds = List.of();

    public DungeonTravelViewModel(
            DungeonApplicationService dungeon,
            PartyApplicationService party
    ) {
        this.dungeon = Objects.requireNonNull(dungeon, "dungeon");
        this.party = Objects.requireNonNull(party, "party");
        refreshStateText();
    }

    public ReadOnlyObjectProperty<DungeonSnapshot> snapshotProperty() {
        return snapshot.getReadOnlyProperty();
    }

    public ReadOnlyObjectProperty<List<DungeonTravelActionSnapshot>> actionsProperty() {
        return actions.getReadOnlyProperty();
    }

    public ReadOnlyObjectProperty<DungeonMapDisplayModel.PartyToken> partyTokenProperty() {
        return partyToken.getReadOnlyProperty();
    }

    public ReadOnlyStringProperty stateProperty() {
        return state.getReadOnlyProperty();
    }

    public ReadOnlyStringProperty mapNameProperty() {
        return mapName.getReadOnlyProperty();
    }

    public ObjectProperty<DungeonMapDisplayModel.LevelOverlaySettings> overlaySettingsProperty() {
        return overlaySettings;
    }

    public IntegerProperty projectionLevelProperty() {
        return projectionLevel;
    }

    public void selectOverlayMode(DungeonMapDisplayModel.OverlayMode nextOverlayMode) {
        DungeonMapDisplayModel.LevelOverlaySettings current = overlaySettings.get();
        updateOverlay(new DungeonMapDisplayModel.LevelOverlaySettings(
                nextOverlayMode,
                current.levelRange(),
                current.opacity(),
                current.selectedLevels()));
    }

    public void selectOverlayRange(int levelRange) {
        DungeonMapDisplayModel.LevelOverlaySettings current = overlaySettings.get();
        updateOverlay(new DungeonMapDisplayModel.LevelOverlaySettings(
                current.mode(),
                levelRange,
                current.opacity(),
                current.selectedLevels()));
    }

    public void selectOverlayOpacity(double opacity) {
        DungeonMapDisplayModel.LevelOverlaySettings current = overlaySettings.get();
        updateOverlay(new DungeonMapDisplayModel.LevelOverlaySettings(
                current.mode(),
                current.levelRange(),
                opacity,
                current.selectedLevels()));
    }

    public void selectOverlayLevels(List<Integer> levels) {
        DungeonMapDisplayModel.LevelOverlaySettings current = overlaySettings.get();
        updateOverlay(new DungeonMapDisplayModel.LevelOverlaySettings(
                current.mode(),
                current.levelRange(),
                current.opacity(),
                levels));
    }

    public void previousLevel() {
        moveProjectionLevel(-1);
    }

    public void nextLevel() {
        moveProjectionLevel(1);
    }

    public void refresh() {
        ActiveTravelState activeTravel = loadActiveTravelState();
        if (activeTravel.partyLocation() instanceof PartyOverworldTravelLocationSnapshot overworld) {
            partyTokenCharacterIds = activeTravel.attachedCharacterIds();
            applyOutsideDungeon("Position: Overworld-Feld " + overworld.tileId() + "\n"
                    + "Tile: -\n"
                    + "Heading: -\n"
                    + "Status: Gruppe befindet sich ausserhalb des Dungeons\n"
                    + overlaySettings.get().mode().label());
            return;
        }
        DungeonTravelPosition position = toDungeonPosition(activeTravel.partyLocation());
        DungeonTravelSurfaceSnapshot surface = dungeon.loadTravelSurface(new LoadDungeonTravelSurfaceQuery(position));
        partyTokenCharacterIds = activeTravel.attachedCharacterIds();
        if (position == null && !activeTravel.activeCharacterIds().isEmpty()) {
            partyTokenCharacterIds = activeTravel.activeCharacterIds();
            saveDungeonPosition(surface.position(), partyTokenCharacterIds);
        }
        applySurface(surface);
    }

    public void performAction(String actionId) {
        DungeonTravelPosition position = currentSurface == null ? null : currentSurface.position();
        DungeonTravelMoveResult result = dungeon.moveTravelAction(new MoveDungeonTravelActionCommand(
                position,
                actionId));
        if (result.status() == src.domain.dungeon.published.DungeonTravelMoveStatus.EXTERNAL_TARGET
                && result.externalTarget() instanceof DungeonTravelExternalTarget.OverworldTile overworld) {
            saveOverworldPosition(overworld, partyTokenCharacterIds);
            applyOutsideDungeon("Position: Overworld-Feld " + overworld.tileId() + "\n"
                    + "Tile: -\n"
                    + "Heading: -\n"
                    + "Status: " + result.message() + "\n"
                    + overlaySettings.get().mode().label());
            return;
        }
        if (result.status() == src.domain.dungeon.published.DungeonTravelMoveStatus.SUCCESS) {
            saveDungeonPosition(result.surface().position(), partyTokenCharacterIds);
        }
        applySurface(result.surface());
    }

    private void updateOverlay(DungeonMapDisplayModel.LevelOverlaySettings nextOverlaySettings) {
        overlaySettings.set(nextOverlaySettings == null
                ? DungeonMapDisplayModel.LevelOverlaySettings.off()
                : nextOverlaySettings);
        if (currentSurface == null) {
            refreshStateText();
        } else {
            refreshStateText(currentSurface);
        }
    }

    private void moveProjectionLevel(int delta) {
        projectionLevel.set(projectionLevel.get() + delta);
        refreshStateText();
    }

    private void applySurface(DungeonTravelSurfaceSnapshot surface) {
        if (surface == null) {
            currentSurface = null;
            snapshot.set(null);
            actions.set(List.of());
            partyToken.set(null);
            refreshStateText();
            return;
        }
        currentSurface = surface;
        mapName.set(surface.mapName());
        projectionLevel.set(surface.position().tile().level());
        snapshot.set(new DungeonSnapshot(
                surface.mapName(),
                DungeonMapMode.TRAVEL,
                surface.map(),
                List.of(),
                List.of(),
                surface.revision()));
        actions.set(surface.actions());
        partyToken.set(toPartyToken(surface.position()));
        refreshStateText(surface);
    }

    private void applyOutsideDungeon(String stateText) {
        currentSurface = null;
        snapshot.set(null);
        actions.set(List.of());
        partyToken.set(null);
        mapName.set("Overworld");
        state.set(stateText);
    }

    private ActiveTravelState loadActiveTravelState() {
        ActivePartyResult activeParty = party.loadActiveParty(new LoadActivePartyQuery());
        List<Long> activeIds = activeParty.status() == ReadStatus.SUCCESS
                ? activeParty.members().stream()
                .map(PartyMemberSummary::id)
                .filter(id -> id != null && id > 0L)
                .toList()
                : List.of();
        PartyTravelPositionsResult travel = party.loadTravelPositions(new LoadPartyTravelPositionsQuery(activeIds));
        List<Long> attachedIds = travel.status() == ReadStatus.SUCCESS
                ? attachedCharacterIds(travel.positions(), activeIds)
                : activeIds;
        return new ActiveTravelState(activeIds, attachedIds, travel.partyTokenLocation());
    }

    private static List<Long> attachedCharacterIds(
            List<PartyTravelPositionSnapshot> positions,
            List<Long> fallbackIds
    ) {
        List<Long> result = (positions == null ? List.<PartyTravelPositionSnapshot>of() : positions).stream()
                .filter(PartyTravelPositionSnapshot::attachedToPartyToken)
                .map(PartyTravelPositionSnapshot::characterId)
                .toList();
        return result.isEmpty() ? fallbackIds : result;
    }

    private void saveDungeonPosition(DungeonTravelPosition position, List<Long> characterIds) {
        if (position == null || characterIds == null || characterIds.isEmpty()) {
            return;
        }
        party.moveCharacters(new MovePartyCharactersCommand(
                characterIds,
                new PartyDungeonTravelLocationSnapshot(
                        position.mapId().value(),
                        toPartyDungeonLocationKind(position),
                        position.ownerId(),
                        new PartyTravelTile(
                                position.tile().q(),
                                position.tile().r(),
                                position.tile().level()),
                        src.domain.party.published.PartyTravelHeading.valueOf(position.heading().name())),
                true));
    }

    private void saveOverworldPosition(DungeonTravelExternalTarget.OverworldTile target, List<Long> characterIds) {
        if (target == null || characterIds == null || characterIds.isEmpty()) {
            return;
        }
        MutationStatus status = party.moveCharacters(new MovePartyCharactersCommand(
                characterIds,
                new PartyOverworldTravelLocationSnapshot(target.mapId(), target.tileId()),
                true)).status();
        if (status != MutationStatus.SUCCESS) {
            state.set("Position: Unbekannt\n"
                    + "Tile: -\n"
                    + "Heading: -\n"
                    + "Status: Overworld-Ziel konnte nicht gespeichert werden\n"
                    + overlaySettings.get().mode().label());
        }
    }

    private static @Nullable DungeonTravelPosition toDungeonPosition(@Nullable PartyTravelLocationSnapshot location) {
        if (!(location instanceof PartyDungeonTravelLocationSnapshot dungeonLocation)) {
            return null;
        }
        return new DungeonTravelPosition(
                new src.domain.dungeon.published.DungeonMapId(dungeonLocation.mapId()),
                src.domain.dungeon.published.DungeonTravelLocationKind.valueOf(dungeonLocation.locationKind().name()),
                dungeonLocation.ownerId(),
                new src.domain.dungeon.published.DungeonCellRef(
                        dungeonLocation.tile().q(),
                        dungeonLocation.tile().r(),
                        dungeonLocation.tile().level()),
                DungeonTravelHeading.valueOf(dungeonLocation.heading().name()));
    }

    private static PartyDungeonTravelLocationKind toPartyDungeonLocationKind(DungeonTravelPosition position) {
        if (position == null || position.locationKind() == null) {
            return PartyDungeonTravelLocationKind.TILE;
        }
        return position.locationKind() == src.domain.dungeon.published.DungeonTravelLocationKind.TRANSITION
                ? PartyDungeonTravelLocationKind.TRANSITION
                : PartyDungeonTravelLocationKind.TILE;
    }

    private void refreshStateText() {
        state.set("Position: Kein Standort\n"
                + "Tile: z=" + projectionLevel.get() + "\n"
                + "Heading: Sueden\n"
                + "Status: Token auf der Karte ziehen\n"
                + overlaySettings.get().mode().label());
    }

    private void refreshStateText(DungeonTravelSurfaceSnapshot surface) {
        state.set("Position: " + surface.areaLabel() + "\n"
                + "Tile: " + surface.tileLabel() + "\n"
                + "Heading: " + surface.headingLabel() + "\n"
                + "Status: " + (surface.statusLabel().isBlank() ? "Token auf der Karte ziehen" : surface.statusLabel()) + "\n"
                + overlaySettings.get().mode().label());
    }

    private static DungeonMapDisplayModel.PartyToken toPartyToken(DungeonTravelPosition position) {
        return new DungeonMapDisplayModel.PartyToken(
                position.tile().q() + 0.5,
                position.tile().r() + 0.5,
                position.tile().level(),
                toDisplayHeading(position.heading()),
                true);
    }

    private static DungeonMapDisplayModel.Heading toDisplayHeading(DungeonTravelHeading heading) {
        return switch (heading == null ? DungeonTravelHeading.defaultHeading() : heading) {
            case NORTH -> DungeonMapDisplayModel.Heading.NORTH;
            case EAST -> DungeonMapDisplayModel.Heading.EAST;
            case SOUTH -> DungeonMapDisplayModel.Heading.SOUTH;
            case WEST -> DungeonMapDisplayModel.Heading.WEST;
        };
    }

    private record ActiveTravelState(
            List<Long> activeCharacterIds,
            List<Long> attachedCharacterIds,
            @Nullable PartyTravelLocationSnapshot partyLocation
    ) {
        private ActiveTravelState {
            activeCharacterIds = activeCharacterIds == null ? List.of() : List.copyOf(activeCharacterIds);
            attachedCharacterIds = attachedCharacterIds == null ? List.of() : List.copyOf(attachedCharacterIds);
        }
    }
}
