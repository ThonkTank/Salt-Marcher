package src.view.leftbartabs.dungeontravel;

import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Supplier;
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
import src.domain.dungeon.published.DungeonMapMode;
import src.domain.dungeon.published.DungeonSnapshot;
import src.domain.dungeon.published.DungeonTravelActionSnapshot;
import src.domain.dungeon.published.DungeonTravelHeading;
import src.domain.dungeon.published.DungeonTravelMoveResult;
import src.domain.dungeon.published.DungeonTravelPosition;
import src.domain.dungeon.published.DungeonTravelSurfaceSnapshot;
import src.domain.dungeon.published.LoadDungeonTravelSurfaceQuery;
import src.domain.dungeon.published.MoveDungeonTravelActionCommand;
import src.view.slotcontent.main.dungeonmap.DungeonMapDisplayModel;

public final class DungeonTravelViewModel {

    private final DungeonApplicationService dungeon;
    private final Supplier<@Nullable DungeonTravelPosition> positionSupplier;
    private final Consumer<DungeonTravelPosition> positionConsumer;
    private final ReadOnlyObjectWrapper<DungeonSnapshot> snapshot = new ReadOnlyObjectWrapper<>();
    private final ReadOnlyObjectWrapper<List<DungeonTravelActionSnapshot>> actions =
            new ReadOnlyObjectWrapper<>(List.of());
    private final ReadOnlyObjectWrapper<DungeonMapDisplayModel.PartyToken> partyToken = new ReadOnlyObjectWrapper<>();
    private final ReadOnlyStringWrapper state = new ReadOnlyStringWrapper("");
    private final ReadOnlyStringWrapper mapName = new ReadOnlyStringWrapper("Dungeon");
    private final ObjectProperty<DungeonMapDisplayModel.OverlayMode> overlayMode =
            new SimpleObjectProperty<>(DungeonMapDisplayModel.OverlayMode.NEARBY);
    private final IntegerProperty projectionLevel = new SimpleIntegerProperty(0);
    private @Nullable DungeonTravelSurfaceSnapshot currentSurface;

    public DungeonTravelViewModel(
            DungeonApplicationService dungeon,
            Supplier<@Nullable DungeonTravelPosition> positionSupplier,
            Consumer<DungeonTravelPosition> positionConsumer
    ) {
        this.dungeon = Objects.requireNonNull(dungeon, "dungeon");
        this.positionSupplier = Objects.requireNonNull(positionSupplier, "positionSupplier");
        this.positionConsumer = Objects.requireNonNull(positionConsumer, "positionConsumer");
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

    public ObjectProperty<DungeonMapDisplayModel.OverlayMode> overlayModeProperty() {
        return overlayMode;
    }

    public IntegerProperty projectionLevelProperty() {
        return projectionLevel;
    }

    public void selectOverlayMode(DungeonMapDisplayModel.OverlayMode nextOverlayMode) {
        updateOverlay(nextOverlayMode);
    }

    public void previousLevel() {
        moveProjectionLevel(-1);
    }

    public void nextLevel() {
        moveProjectionLevel(1);
    }

    public void refresh() {
        applySurface(dungeon.loadTravelSurface(new LoadDungeonTravelSurfaceQuery(positionSupplier.get())));
    }

    public void performAction(String actionId) {
        DungeonTravelMoveResult result = dungeon.moveTravelAction(new MoveDungeonTravelActionCommand(
                positionSupplier.get(),
                actionId));
        applySurface(result.surface());
    }

    private void updateOverlay(DungeonMapDisplayModel.OverlayMode nextOverlayMode) {
        DungeonMapDisplayModel.OverlayMode resolved =
                nextOverlayMode == null ? DungeonMapDisplayModel.OverlayMode.OFF : nextOverlayMode;
        overlayMode.set(resolved);
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
        positionConsumer.accept(surface.position());
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

    private void refreshStateText() {
        state.set("Position: Kein Standort\n"
                + "Tile: z=" + projectionLevel.get() + "\n"
                + "Heading: Sueden\n"
                + "Status: Token auf der Karte ziehen\n"
                + overlayMode.get().label());
    }

    private void refreshStateText(DungeonTravelSurfaceSnapshot surface) {
        state.set("Position: " + surface.areaLabel() + "\n"
                + "Tile: " + surface.tileLabel() + "\n"
                + "Heading: " + surface.headingLabel() + "\n"
                + "Status: " + (surface.statusLabel().isBlank() ? "Token auf der Karte ziehen" : surface.statusLabel()) + "\n"
                + overlayMode.get().label());
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
}
