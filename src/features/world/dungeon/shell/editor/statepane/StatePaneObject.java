package features.world.dungeon.shell.editor.statepane;

import features.world.dungeon.dungeonmap.application.DungeonMapLoadingService;
import features.world.dungeon.dungeonmap.cluster.model.Cluster;
import features.world.dungeon.dungeonmap.connections.input.ConnectionEndpoint;
import features.world.dungeon.dungeonmap.connections.input.DoorExitCatalog;
import features.world.dungeon.dungeonmap.model.DungeonMap;
import features.world.dungeon.dungeonmap.state.DungeonMapState;
import features.world.dungeon.geometry.CardinalDirection;
import features.world.dungeon.geometry.GridPoint;
import features.world.dungeon.model.interaction.DungeonSelectionRef;
import features.world.dungeon.model.structures.room.Room;
import features.world.dungeon.room.RoomObject;
import features.world.dungeon.room.input.SaveNarrationInput;
import features.world.dungeon.shell.editor.statepane.input.ComposeStatePaneInput;
import features.world.dungeon.shell.editor.statepane.input.ShowStatePaneInput;
import features.world.dungeon.state.EditorInteractionState;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.TextArea;
import javafx.scene.layout.VBox;
import ui.async.UiErrorReporter;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.BiConsumer;
import java.util.function.Function;

/**
 * Editor-owned lower-right pane surface for room narration editing.
 */
public final class StatePaneObject extends VBox {

    private final VBox narrationContent = new VBox(8);
    private final Map<Long, Button> narrationSaveButtons = new LinkedHashMap<>();
    private final Map<Long, Label> narrationStatusLabels = new LinkedHashMap<>();

    public StatePaneObject(ComposeStatePaneInput input) {
        ComposeStatePaneInput resolvedInput = Objects.requireNonNull(input, "input");
        DungeonMapState mapState = Objects.requireNonNull(resolvedInput.mapState(), "mapState");
        DungeonMapLoadingService loadingService = Objects.requireNonNull(resolvedInput.loadingService(), "loadingService");
        RoomObject roomObject = Objects.requireNonNull(resolvedInput.roomObject(), "roomObject");
        EditorInteractionState interactionState = Objects.requireNonNull(resolvedInput.interactionState(), "interactionState");

        record RoomExitCard(
                String label,
                int levelZ,
                GridPoint roomCell,
                CardinalDirection direction,
                String description
        ) {
        }

        record RoomNarrationCard(
                long roomId,
                String roomName,
                String visualDescription,
                List<RoomExitCard> exits
        ) {
        }

        record SaveUiState(boolean busy, String status) {
        }

        Label titleLabel = new Label("Raumbeschreibung");
        titleLabel.getStyleClass().add("editor-panel-title");
        getStyleClass().add("editor-card");
        setSpacing(6);
        getChildren().addAll(titleLabel, narrationContent);

        Function<String, TextArea> createTextArea = text -> {
            TextArea area = new TextArea(text == null ? "" : text);
            area.setWrapText(true);
            area.setPrefRowCount(3);
            return area;
        };

        BiConsumer<Long, SaveUiState> setSaveState = (roomId, saveState) -> {
            Button saveButton = narrationSaveButtons.get(roomId);
            if (saveButton != null) {
                saveButton.setDisable(saveState.busy());
                saveButton.setText(saveState.busy() ? "Speichert..." : "Speichern");
            }
            Label statusLabel = narrationStatusLabels.get(roomId);
            if (statusLabel != null) {
                statusLabel.setText(saveState.status() == null ? "" : saveState.status());
            }
        };

        Runnable refresh = () -> {
            DungeonMap layout = mapState.activeMap();
            DungeonSelectionRef selectedRef = interactionState.selectedRef();
            Room selectedRoom = null;
            if (layout != null && selectedRef instanceof DungeonSelectionRef.RoomRef roomRef) {
                for (Cluster cluster : layout.clusters()) {
                    Room room = cluster == null ? null : cluster.roomTopology().findRoom(roomRef.roomId());
                    if (room != null) {
                        selectedRoom = room;
                        break;
                    }
                }
            }

            java.util.function.BiFunction<Cluster, Room, RoomNarrationCard> buildCard = (cluster, room) -> new RoomNarrationCard(
                    room.roomId() == null ? 0L : room.roomId(),
                    room.name(),
                    room.narration().visualDescription(),
                    (layout == null || cluster == null || room == null || room.roomId() == null
                            ? List.<features.world.dungeon.dungeonmap.connections.input.DoorExitDescriptor>of()
                            : cluster.roomTopology().roomLevels(room).stream()
                            .sorted()
                            .flatMap(levelZ -> DoorExitCatalog.describe(
                                    layout,
                                    cluster.roomTopology().structureFor(room).surfaceAtLevel(levelZ).floor().cellFootprint(),
                                    levelZ,
                                    layout.connectionsForEndpoint(ConnectionEndpoint.room(room.roomId()))).stream())
                            .toList()).stream()
                            .map(exit -> new RoomExitCard(
                                    exit.label(),
                                    exit.levelZ(),
                                    exit.localCell(),
                                    exit.direction(),
                                    room.narration().exitDescription(exit.levelZ(), exit.localCell(), exit.direction())))
                            .toList());

            List<RoomNarrationCard> cards;
            if (selectedRoom != null) {
                Cluster cluster = layout.findCluster(selectedRoom.clusterId());
                cards = List.of(buildCard.apply(cluster, selectedRoom));
            } else {
                Cluster cluster = layout == null ? null : layout.clusterOnLevel(selectedRef, mapState.activeProjectionLevel());
                if (cluster == null) {
                    cards = List.of();
                } else {
                    cards = cluster.roomTopology().rooms().stream()
                            .filter(Objects::nonNull)
                            .sorted(Comparator
                                    .comparing(Room::name, Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER))
                                    .thenComparing(Room::roomId, Comparator.nullsLast(Long::compareTo)))
                            .map(room -> buildCard.apply(cluster, room))
                            .toList();
                }
            }

            narrationContent.getChildren().clear();
            narrationSaveButtons.clear();
            narrationStatusLabels.clear();
            setManaged(!cards.isEmpty());
            setVisible(!cards.isEmpty());
            for (RoomNarrationCard card : cards) {
                TextArea visualArea = createTextArea.apply(card.visualDescription());
                Label visualTitle = new Label("Visueller Eindruck");
                visualTitle.getStyleClass().add("text-muted");

                VBox roomBox = new VBox(6, visualTitle, visualArea);
                List<TextArea> exitAreas = new ArrayList<>();
                for (RoomExitCard exit : card.exits()) {
                    Label exitTitle = new Label(exit.label());
                    exitTitle.getStyleClass().add("text-muted");
                    TextArea exitArea = createTextArea.apply(exit.description());
                    exitAreas.add(exitArea);
                    roomBox.getChildren().addAll(exitTitle, exitArea);
                }

                Label statusLabel = new Label();
                statusLabel.setWrapText(true);
                Button saveButton = new Button("Speichern");
                narrationSaveButtons.put(card.roomId(), saveButton);
                narrationStatusLabels.put(card.roomId(), statusLabel);
                saveButton.setOnAction(event -> {
                    if (card.roomId() <= 0) {
                        return;
                    }
                    List<SaveNarrationInput.ExitNarrationInput> exitNarrations = new ArrayList<>();
                    for (int index = 0; index < card.exits().size(); index++) {
                        RoomExitCard exit = card.exits().get(index);
                        GridPoint roomCell = exit.roomCell() == null ? GridPoint.cell(0, 0, 0) : exit.roomCell();
                        CardinalDirection direction = exit.direction() == null
                                ? CardinalDirection.defaultDirection()
                                : exit.direction();
                        exitNarrations.add(new SaveNarrationInput.ExitNarrationInput(
                                exit.levelZ(),
                                roomCell.x2() / 2,
                                roomCell.y2() / 2,
                                roomCell.z(),
                                direction.name(),
                                exitAreas.get(index).getText()));
                    }
                    setSaveState.accept(card.roomId(), new SaveUiState(true, "Speichert..."));
                    loadingService.submitMutation(
                            () -> {
                                roomObject.saveNarration(new SaveNarrationInput(
                                        card.roomId(),
                                        visualArea.getText(),
                                        exitNarrations));
                                return mapState.activeMapId();
                            },
                            updatedMapId -> updatedMapId,
                            ignored -> setSaveState.accept(card.roomId(), new SaveUiState(false, "Gespeichert")),
                            throwable -> {
                                UiErrorReporter.reportBackgroundFailure("StatePaneObject.saveRoomNarration()", throwable);
                                setSaveState.accept(
                                        card.roomId(),
                                        new SaveUiState(false, "Raumbeschreibung konnte nicht gespeichert werden."));
                            });
                });
                roomBox.getChildren().addAll(statusLabel, saveButton);

                Label roomTitle = new Label(card.roomName());
                roomTitle.getStyleClass().add("editor-panel-title");
                VBox roomCard = new VBox(6);
                roomCard.getStyleClass().add("editor-card");
                roomCard.getChildren().addAll(roomTitle, roomBox);
                narrationContent.getChildren().add(roomCard);
            }
        };

        interactionState.addListener(refresh);
        mapState.addListener(refresh);
        refresh.run();
    }

    public void showStatePane(ShowStatePaneInput input) {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
    }
}
