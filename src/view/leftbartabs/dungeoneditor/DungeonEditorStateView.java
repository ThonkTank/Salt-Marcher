package src.view.leftbartabs.dungeoneditor;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;
import javafx.beans.property.StringProperty;
import javafx.geometry.Insets;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.TextArea;
import javafx.scene.layout.VBox;

public final class DungeonEditorStateView extends VBox {

    private final Label body = new Label();
    private final VBox narrationCards = new VBox(8);
    private Consumer<DungeonEditorStateViewInputEvent> viewInputEventHandler = ignored -> {};

    public DungeonEditorStateView() {
        setSpacing(12);
        setPadding(new Insets(12));
        getStyleClass().addAll("surface-root", "control-stack");

        Label title = new Label("Editor state");
        title.getStyleClass().add("panel-title");
        body.setWrapText(true);
        VBox card = new VBox(6, title, body);
        card.getStyleClass().addAll("card-surface", "content-card");
        getChildren().addAll(card, narrationCards);
    }

    public StringProperty stateTextProperty() {
        return body.textProperty();
    }

    public void onViewInputEvent(Consumer<DungeonEditorStateViewInputEvent> handler) {
        viewInputEventHandler = handler == null ? ignored -> {} : handler;
    }

    public void bind(DungeonEditorContributionModel contributionModel) {
        if (contributionModel == null) {
            return;
        }
        contributionModel.stateProjectionProperty().addListener((ignored, before, after) -> showProjection(after));
        showProjection(contributionModel.stateProjectionProperty().get());
    }

    public void showNarrationCards(List<RoomNarrationCard> cards, boolean busy, String statusText) {
        narrationCards.getChildren().clear();
        for (RoomNarrationCard card : cards == null ? List.<RoomNarrationCard>of() : cards) {
            narrationCards.getChildren().add(narrationCard(card, busy, statusText));
        }
    }

    private void showProjection(DungeonEditorStateProjection projection) {
        DungeonEditorStateProjection resolvedProjection = projection == null
                ? DungeonEditorStateProjection.initial()
                : projection;
        stateTextProperty().set(resolvedProjection.stateText());
        showNarrationCards(
                resolvedProjection.narrationCards().stream().map(DungeonEditorStateView::toCard).toList(),
                resolvedProjection.busy(),
                resolvedProjection.statusText());
    }

    private static RoomNarrationCard toCard(DungeonEditorRoomNarrationCardProjection card) {
        return new RoomNarrationCard(
                card.roomId(),
                card.roomName(),
                card.visualDescription(),
                card.exits().stream().map(DungeonEditorStateView::toExit).toList());
    }

    private static RoomExitNarration toExit(DungeonEditorRoomExitNarrationProjection exit) {
        return new RoomExitNarration(
                exit.label(),
                exit.q(),
                exit.r(),
                exit.level(),
                exit.direction(),
                exit.description());
    }

    private VBox narrationCard(RoomNarrationCard card, boolean busy, String statusText) {
        Label title = new Label(card.roomName());
        title.getStyleClass().add("panel-title");
        Label visualTitle = muted("Visueller Eindruck");
        TextArea visualArea = textArea(card.visualDescription());
        VBox content = new VBox(6, title, visualTitle, visualArea);
        List<ExitTextArea> exitAreas = new ArrayList<>();
        for (RoomExitNarration exit : card.exits()) {
            Label exitTitle = muted(exit.label());
            TextArea exitArea = textArea(exit.description());
            exitAreas.add(new ExitTextArea(exit, exitArea));
            content.getChildren().addAll(exitTitle, exitArea);
        }
        Label status = muted(statusText);
        status.setVisible(statusText != null && !statusText.isBlank());
        status.setManaged(status.isVisible());
        Button save = new Button("Speichern");
        save.getStyleClass().add("toolbar-action-button");
        save.setDisable(busy);
        save.setOnAction(event -> viewInputEventHandler.accept(new DungeonEditorStateViewInputEvent(
                card.roomId(),
                visualArea.getText(),
                exitAreas.stream()
                        .map(exit -> new DungeonEditorStateViewInputEvent.RoomExitNarrationSnapshot(
                                exit.exit().label(),
                                exit.exit().q(),
                                exit.exit().r(),
                                exit.exit().level(),
                                exit.exit().direction(),
                                exit.area().getText()))
                        .toList())));
        content.getChildren().addAll(status, save);
        content.getStyleClass().addAll("card-surface", "content-card");
        return content;
    }

    private static Label muted(String text) {
        Label label = new Label(text == null ? "" : text);
        label.getStyleClass().add("text-muted");
        label.setWrapText(true);
        return label;
    }

    private static TextArea textArea(String text) {
        TextArea area = new TextArea(text == null ? "" : text);
        area.setWrapText(true);
        area.setPrefRowCount(3);
        return area;
    }

    public record RoomNarrationCard(
            long roomId,
            String roomName,
            String visualDescription,
            List<RoomExitNarration> exits
    ) {
        public RoomNarrationCard {
            roomName = roomName == null || roomName.isBlank() ? "Raum" : roomName.trim();
            visualDescription = visualDescription == null ? "" : visualDescription;
            exits = exits == null ? List.of() : List.copyOf(exits);
        }
    }

    public record RoomExitNarration(
            String label,
            int q,
            int r,
            int level,
            String direction,
            String description
    ) {
        public RoomExitNarration {
            label = label == null || label.isBlank() ? "Ausgang" : label.trim();
            direction = direction == null || direction.isBlank() ? "NORTH" : direction.trim();
            description = description == null ? "" : description;
        }
    }

    private record ExitTextArea(RoomExitNarration exit, TextArea area) {
    }
}
