package src.view.leftbartabs.dungeoneditor;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;
import javafx.beans.property.StringProperty;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.TextArea;
import javafx.scene.layout.VBox;

public final class DungeonEditorStateView extends VBox {

    private static final String PMD_LAW_OF_DEMETER = "PMD.LawOfDemeter";
    private static final String VISUAL_DESCRIPTION_LABEL = "Visueller Eindruck";

    private final Label body = new Label();
    private final VBox narrationCards = new VBox(8);
    private Consumer<DungeonEditorStateViewInputEvent> viewInputEventHandler = ignored -> {};

    public DungeonEditorStateView() {
        getStyleClass().addAll("surface-root", "control-stack", "dungeon-state-panel");
        getChildren().addAll(createStateCard(), narrationCards);
    }

    public StringProperty stateTextProperty() {
        return body.textProperty();
    }

    public void onViewInputEvent(Consumer<DungeonEditorStateViewInputEvent> handler) {
        viewInputEventHandler = handler == null ? ignored -> {} : handler;
    }

    public void bind(DungeonEditorStateContentModel contentModel) {
        if (contentModel == null) {
            return;
        }
        contentModel.stateProjectionProperty().addListener((ignored, before, after) -> showProjection(after));
        showProjection(contentModel.stateProjectionProperty().get());
    }

    @SuppressWarnings(PMD_LAW_OF_DEMETER)
    public void showNarrationCards(
            List<DungeonEditorStateContentModel.RoomNarrationCardProjection> cards,
            boolean busy,
            String statusText
    ) {
        narrationCards.getChildren().clear();
        for (DungeonEditorStateContentModel.RoomNarrationCardProjection card
                : cards == null ? List.<DungeonEditorStateContentModel.RoomNarrationCardProjection>of() : cards) {
            narrationCards.getChildren().add(narrationCard(card, busy, statusText));
        }
    }

    private void showProjection(DungeonEditorStateContentModel.StateProjection projection) {
        DungeonEditorStateContentModel.StateProjection resolvedProjection = projection == null
                ? DungeonEditorStateContentModel.StateProjection.initial()
                : projection;
        stateTextProperty().set(resolvedProjection.stateText());
        showNarrationCards(resolvedProjection.narrationCards(), resolvedProjection.busy(), resolvedProjection.statusText());
    }

    @SuppressWarnings(PMD_LAW_OF_DEMETER)
    private VBox narrationCard(
            DungeonEditorStateContentModel.RoomNarrationCardProjection card,
            boolean busy,
            String statusText
    ) {
        Label title = new Label(card.roomName());
        title.getStyleClass().add("panel-title");
        Label visualTitle = muted(VISUAL_DESCRIPTION_LABEL);
        TextArea visualArea = textArea(card.visualDescription());
        visualTitle.setLabelFor(visualArea);
        visualArea.setAccessibleText(VISUAL_DESCRIPTION_LABEL);
        VBox content = new VBox(6, title, visualTitle, visualArea);
        List<ExitEditor> exitAreas = new ArrayList<>();
        for (DungeonEditorStateContentModel.RoomExitNarrationProjection exit : card.exits()) {
            Label exitTitle = muted(exit.label());
            TextArea exitArea = textArea(exit.description());
            exitTitle.setLabelFor(exitArea);
            exitArea.setAccessibleText(exit.label());
            exitAreas.add(new ExitEditor(exit, exitArea));
            content.getChildren().addAll(exitTitle, exitArea);
        }
        visualArea.textProperty().addListener((ignored, before, after) -> emitNarrationInput(
                card.roomId(),
                visualArea,
                exitAreas,
                false));
        for (ExitEditor exitEditor : exitAreas) {
            exitEditor.area().textProperty().addListener((ignored, before, after) -> emitNarrationInput(
                    card.roomId(),
                    visualArea,
                    exitAreas,
                    false));
        }
        Label status = muted(statusText);
        status.setVisible(statusText != null && !statusText.isBlank());
        status.setManaged(status.isVisible());
        Button save = new Button("Speichern");
        save.setAccessibleText("Narration fuer " + card.roomName() + " speichern");
        save.getStyleClass().add("toolbar-action-button");
        save.setDisable(busy);
        save.setOnAction(event -> emitNarrationInput(card.roomId(), visualArea, exitAreas, true));
        content.getChildren().addAll(status, save);
        content.getStyleClass().addAll("card-surface", "content-card");
        return content;
    }

    @SuppressWarnings(PMD_LAW_OF_DEMETER)
    private VBox createStateCard() {
        Label title = new Label("Editor state");
        title.getStyleClass().add("panel-title");
        body.setWrapText(true);
        VBox card = new VBox(6, title, body);
        card.getStyleClass().addAll("card-surface", "content-card");
        return card;
    }

    @SuppressWarnings(PMD_LAW_OF_DEMETER)
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

    private void emitNarrationInput(
            long roomId,
            TextArea visualArea,
            List<ExitEditor> exitAreas,
            boolean saveRequested
    ) {
        viewInputEventHandler.accept(new DungeonEditorStateViewInputEvent(
                roomId,
                visualArea.getText(),
                exitAreas.stream()
                        .map(exit -> exit.area().getText())
                        .toList(),
                saveRequested));
    }

    private record ExitEditor(
            DungeonEditorStateContentModel.RoomExitNarrationProjection exit,
            TextArea area
    ) {
    }

}
