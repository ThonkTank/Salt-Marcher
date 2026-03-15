package features.world.dungeonmap.ui.editor;

import features.world.dungeonmap.model.DungeonCorridor;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.DungeonRoom;
import javafx.geometry.Insets;
import javafx.scene.control.Button;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.control.TextField;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;

import java.util.List;
import java.util.function.Consumer;
import java.util.function.Supplier;

public final class DungeonEditorStatePane extends VBox {

    public record CorridorConnectionRequest(long fromRoomId, long toRoomId) {}

    private final TextField mapNameField = new TextField();
    private final Button createMapButton = new Button("Dungeon anlegen");
    private final Button renameMapButton = new Button("Namen speichern");
    private final Button addRoomButton = new Button("Raum anlegen");
    private final Button deleteRoomButton = new Button("Raum löschen");
    private final ComboBox<DungeonRoom> corridorFromSelector = new ComboBox<>();
    private final ComboBox<DungeonRoom> corridorToSelector = new ComboBox<>();
    private final Button addCorridorButton = new Button("Korridor verbinden");
    private final ComboBox<DungeonCorridor> corridorSelector = new ComboBox<>();
    private final Button deleteCorridorButton = new Button("Korridor löschen");
    private final Label roomLabel = new Label("Kein Raum gewählt");

    public DungeonEditorStatePane() {
        setSpacing(10);
        setPadding(new Insets(12));
        corridorFromSelector.setCellFactory(list -> new DungeonRoomCell());
        corridorFromSelector.setButtonCell(new DungeonRoomCell());
        corridorToSelector.setCellFactory(list -> new DungeonRoomCell());
        corridorToSelector.setButtonCell(new DungeonRoomCell());
        corridorSelector.setCellFactory(list -> new DungeonCorridorCell());
        corridorSelector.setButtonCell(new DungeonCorridorCell());
        Label mapLabel = new Label("Dungeon-Name");
        Label roomSection = new Label("Räume");
        Label corridorSection = new Label("Korridore");
        Region spacer = new Region();
        VBox.setVgrow(spacer, Priority.ALWAYS);
        getChildren().addAll(
                mapLabel, mapNameField, createMapButton, renameMapButton,
                roomSection, roomLabel, addRoomButton, deleteRoomButton,
                corridorSection, corridorFromSelector, corridorToSelector, addCorridorButton, corridorSelector, deleteCorridorButton,
                spacer);
    }

    public void bindLayout(DungeonLayout layout, DungeonRoom selectedRoom) {
        mapNameField.setText(layout == null || layout.map() == null ? "" : layout.map().name());
        List<DungeonRoom> rooms = layout == null ? List.of() : layout.rooms();
        corridorFromSelector.getItems().setAll(rooms);
        corridorToSelector.getItems().setAll(rooms);
        List<DungeonCorridor> corridors = layout == null ? List.of() : layout.corridors();
        corridorSelector.getItems().setAll(corridors);
        setSelectedRoom(selectedRoom);
    }

    public void setSelectedRoom(DungeonRoom selectedRoom) {
        roomLabel.setText(selectedRoom == null
                ? "Kein Raum gewählt"
                : selectedRoom.name() + " @ " + selectedRoom.center().x() + "/" + selectedRoom.center().y());
        deleteRoomButton.setDisable(selectedRoom == null);
    }

    public void setOnCreateMap(Consumer<String> onCreateMap) {
        createMapButton.setOnAction(event -> onCreateMap.accept(nonBlankOrFallback(mapNameField.getText(), "Dungeon")));
    }

    public void setOnUpdateMap(java.util.function.BiConsumer<Long, String> onUpdateMap, Supplier<Long> currentMapSupplier) {
        renameMapButton.setOnAction(event -> {
            Long mapId = currentMapSupplier.get();
            if (mapId != null) {
                onUpdateMap.accept(mapId, nonBlankOrFallback(mapNameField.getText(), "Dungeon"));
            }
        });
    }

    public void setOnAddRoom(Runnable onAddRoom) {
        addRoomButton.setOnAction(event -> onAddRoom.run());
    }

    public void setOnDeleteRoom(Consumer<DungeonRoom> onDeleteRoom, java.util.function.Supplier<DungeonRoom> selectedRoomSupplier) {
        deleteRoomButton.setOnAction(event -> {
            DungeonRoom room = selectedRoomSupplier.get();
            if (room != null) {
                onDeleteRoom.accept(room);
            }
        });
    }

    public void setOnAddCorridor(Consumer<CorridorConnectionRequest> onAddCorridor) {
        addCorridorButton.setOnAction(event -> {
            DungeonRoom from = corridorFromSelector.getSelectionModel().getSelectedItem();
            DungeonRoom to = corridorToSelector.getSelectionModel().getSelectedItem();
            if (from != null && to != null && from.roomId() != null && to.roomId() != null && !from.roomId().equals(to.roomId())) {
                onAddCorridor.accept(new CorridorConnectionRequest(from.roomId(), to.roomId()));
            }
        });
    }

    public void setOnDeleteCorridor(Consumer<DungeonCorridor> onDeleteCorridor) {
        deleteCorridorButton.setOnAction(event -> {
            DungeonCorridor corridor = corridorSelector.getSelectionModel().getSelectedItem();
            if (corridor != null) {
                onDeleteCorridor.accept(corridor);
            }
        });
    }

    private static String nonBlankOrFallback(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.trim();
    }
}
