package src.view.leftbartabs.dungeontravel;

import java.util.List;
import javafx.beans.property.IntegerProperty;
import javafx.beans.property.ObjectProperty;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import javafx.beans.property.ReadOnlyStringProperty;
import javafx.beans.property.ReadOnlyStringWrapper;
import javafx.beans.property.SimpleIntegerProperty;
import javafx.beans.property.SimpleObjectProperty;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonTravelExternalTarget;
import src.domain.dungeon.published.DungeonTravelActionSnapshot;
import src.domain.dungeon.published.DungeonTravelHeading;
import src.domain.dungeon.published.DungeonTravelPosition;
import src.domain.dungeon.published.DungeonSurfacePayload;
import src.domain.dungeon.published.DungeonSurfaceTravel;
import src.domain.party.published.PartyDungeonTravelLocationKind;
import src.domain.party.published.PartyDungeonTravelLocationSnapshot;
import src.domain.party.published.PartyOverworldTravelLocationSnapshot;
import src.domain.party.published.PartyTravelLocationSnapshot;
import src.domain.party.published.PartyTravelTile;
import src.view.slotcontent.main.dungeonmap.DungeonMapPresentationModel;

public final class DungeonTravelPresentationModel {

    private final ReadOnlyObjectWrapper<List<DungeonTravelActionSnapshot>> actions =
            new ReadOnlyObjectWrapper<>(List.of());
    private final ReadOnlyStringWrapper state = new ReadOnlyStringWrapper("");
    private final ReadOnlyStringWrapper mapName = new ReadOnlyStringWrapper("Dungeon");
    private final ObjectProperty<DungeonMapPresentationModel.RenderState.LevelOverlaySettings> overlaySettings =
            new SimpleObjectProperty<>(DungeonMapPresentationModel.RenderState.LevelOverlaySettings.defaults());
    private final IntegerProperty projectionLevel = new SimpleIntegerProperty(0);
    private @Nullable DungeonSurfacePayload currentSurface;
    private List<Long> partyTokenCharacterIds = List.of();

    public DungeonTravelPresentationModel() {
        refreshStateText();
    }

    public ReadOnlyObjectProperty<List<DungeonTravelActionSnapshot>> actionsProperty() {
        return actions.getReadOnlyProperty();
    }

    public ReadOnlyStringProperty stateProperty() {
        return state.getReadOnlyProperty();
    }

    public ReadOnlyStringProperty mapNameProperty() {
        return mapName.getReadOnlyProperty();
    }

    public ObjectProperty<DungeonMapPresentationModel.RenderState.LevelOverlaySettings> overlaySettingsProperty() {
        return overlaySettings;
    }

    public IntegerProperty projectionLevelProperty() {
        return projectionLevel;
    }

    public void selectOverlayMode(DungeonMapPresentationModel.RenderState.OverlayMode nextOverlayMode) {
        DungeonMapPresentationModel.RenderState.LevelOverlaySettings current = overlaySettings.get();
        updateOverlay(new DungeonMapPresentationModel.RenderState.LevelOverlaySettings(
                nextOverlayMode,
                current.levelRange(),
                current.opacity(),
                current.selectedLevels()));
    }

    public void selectOverlayMode(String modeKey) {
        DungeonMapPresentationModel.RenderState.OverlayMode nextOverlayMode;
        try {
            nextOverlayMode = DungeonMapPresentationModel.RenderState.OverlayMode.valueOf(
                    modeKey == null ? "OFF" : modeKey);
        } catch (IllegalArgumentException ignored) {
            nextOverlayMode = DungeonMapPresentationModel.RenderState.OverlayMode.OFF;
        }
        selectOverlayMode(nextOverlayMode);
    }

    public void selectOverlayRange(int levelRange) {
        DungeonMapPresentationModel.RenderState.LevelOverlaySettings current = overlaySettings.get();
        updateOverlay(new DungeonMapPresentationModel.RenderState.LevelOverlaySettings(
                current.mode(),
                levelRange,
                current.opacity(),
                current.selectedLevels()));
    }

    public void selectOverlayOpacity(double opacity) {
        DungeonMapPresentationModel.RenderState.LevelOverlaySettings current = overlaySettings.get();
        updateOverlay(new DungeonMapPresentationModel.RenderState.LevelOverlaySettings(
                current.mode(),
                current.levelRange(),
                opacity,
                current.selectedLevels()));
    }

    public void selectOverlayLevels(List<Integer> levels) {
        DungeonMapPresentationModel.RenderState.LevelOverlaySettings current = overlaySettings.get();
        updateOverlay(new DungeonMapPresentationModel.RenderState.LevelOverlaySettings(
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
    }

    public void performAction(String actionId) {
    }

    @Nullable DungeonTravelPosition currentPosition() {
        DungeonSurfaceTravel currentTravel = currentSurface == null ? null : currentSurface.travel();
        return currentTravel == null ? null : currentTravel.position();
    }

    List<Long> partyTokenCharacterIds() {
        return List.copyOf(partyTokenCharacterIds);
    }

    private void updateOverlay(DungeonMapPresentationModel.RenderState.LevelOverlaySettings nextOverlaySettings) {
        overlaySettings.set(nextOverlaySettings == null
                ? DungeonMapPresentationModel.RenderState.LevelOverlaySettings.off()
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

    void applySurfaceState(DungeonSurfacePayload surface, List<Long> characterIds) {
        partyTokenCharacterIds = characterIds == null ? List.of() : List.copyOf(characterIds);
        if (surface == null) {
            currentSurface = null;
            actions.set(List.of());
            refreshStateText();
            return;
        }
        currentSurface = surface;
        DungeonSurfaceTravel travel = surface.travel();
        mapName.set(surface.mapName());
        projectionLevel.set(travel == null ? 0 : travel.position().tile().level());
        actions.set(travel == null ? List.of() : travel.actions());
        refreshStateText(surface);
    }

    void applyOutsideDungeonState(String stateText, List<Long> characterIds) {
        partyTokenCharacterIds = characterIds == null ? List.of() : List.copyOf(characterIds);
        currentSurface = null;
        actions.set(List.of());
        mapName.set("Overworld");
        state.set(stateText);
    }

    DungeonMapPresentationModel.RenderState.@Nullable PartyToken currentPartyToken() {
        DungeonSurfaceTravel travel = currentSurface == null ? null : currentSurface.travel();
        return travel == null ? null : toPartyToken(travel.position());
    }

    public static @Nullable DungeonTravelPosition toDungeonPosition(@Nullable PartyTravelLocationSnapshot location) {
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

    public static PartyDungeonTravelLocationKind toPartyDungeonLocationKind(DungeonTravelPosition position) {
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

    private void refreshStateText(DungeonSurfacePayload surface) {
        DungeonSurfaceTravel travel = surface == null ? null : surface.travel();
        if (travel == null) {
            refreshStateText();
            return;
        }
        state.set("Position: " + travel.areaLabel() + "\n"
                + "Tile: " + travel.tileLabel() + "\n"
                + "Heading: " + travel.headingLabel() + "\n"
                + "Status: " + (travel.statusLabel().isBlank() ? "Token auf der Karte ziehen" : travel.statusLabel()) + "\n"
                + overlaySettings.get().mode().label());
    }

    private static DungeonMapPresentationModel.RenderState.PartyToken toPartyToken(DungeonTravelPosition position) {
        return new DungeonMapPresentationModel.RenderState.PartyToken(
                position.tile().q() + 0.5,
                position.tile().r() + 0.5,
                position.tile().level(),
                toDisplayHeading(position.heading()),
                true);
    }

    private static DungeonMapPresentationModel.RenderState.Heading toDisplayHeading(DungeonTravelHeading heading) {
        return switch (heading == null ? DungeonTravelHeading.defaultHeading() : heading) {
            case NORTH -> DungeonMapPresentationModel.RenderState.Heading.NORTH;
            case EAST -> DungeonMapPresentationModel.RenderState.Heading.EAST;
            case SOUTH -> DungeonMapPresentationModel.RenderState.Heading.SOUTH;
            case WEST -> DungeonMapPresentationModel.RenderState.Heading.WEST;
        };
    }

}
