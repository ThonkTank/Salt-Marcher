package src.view.statetabs.encounter;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.Spinner;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;

public final class EncounterInitiativeStateView extends VBox {

    private final VBox initiativeList = initiativeList();
    private final VBox dialog = buildPane();
    private Consumer<EncounterInitiativeStateViewInputEvent> viewInputEventHandler = ignored -> { };

    public EncounterInitiativeStateView() {
        getChildren().add(dialog);
        setVgrow(dialog, Priority.ALWAYS);
    }

    public void onViewInputEvent(Consumer<EncounterInitiativeStateViewInputEvent> handler) {
        viewInputEventHandler = handler == null ? ignored -> { } : handler;
    }

    public void bind(EncounterInitiativeStateContentModel contentModel) {
        if (contentModel == null) {
            return;
        }
        showPanel(contentModel.panelProperty().get());
        contentModel.panelProperty().addListener((ignored, before, after) -> showPanel(after));
    }

    private void showPanel(EncounterInitiativeStateContentModel.PanelModel panel) {
        if (panel == null) {
            return;
        }
        initiativeList.getChildren().clear();
        String currentKind = "";
        for (EncounterInitiativeStateContentModel.EntryView entry : panel.entries()) {
            if (!entry.kind().equals(currentKind)) {
                currentKind = entry.kind();
                Label header = sectionHeader("SC".equals(currentKind) ? "Spieler" : currentKind);
                initiativeList.getChildren().add(header);
            }
            initiativeList.getChildren().add(buildInitiativeRow(entry));
        }
    }

    private VBox buildPane() {
        Label title = new StyledLabel("Initiative", "title");

        Button backButton = new Button("\u2190 Zurueck");
        backButton.setOnAction(event -> publish(new EncounterInitiativeStateViewInputEvent(true, List.of())));
        Button rollAllButton = new StyledButton("Alle wuerfeln", "neutral-action");
        rollAllButton.setOnAction(event -> rollAllInitiatives());
        Button startButton = new StyledButton("Kampf starten", "accent");
        startButton.setOnAction(event -> publishInitiativeConfirmation());
        HBox footer = new HBox(8, backButton, rollAllButton, footerSpacer(), startButton);
        footer.setAlignment(Pos.CENTER_LEFT);
        VBox nextDialog = new VBox(10, title, initiativeList, footer);
        nextDialog.getStyleClass().add("dialog-surface");
        setVgrow(initiativeList, Priority.ALWAYS);
        return nextDialog;
    }

    private Node buildInitiativeRow(EncounterInitiativeStateContentModel.EntryView entry) {
        InitiativeRow row = new InitiativeRow();
        Label name = new Label(entry.label());
        name.setWrapText(true);
        HBox.setHgrow(name, Priority.ALWAYS);
        ValueSpinner spinner = new ValueSpinner(entry.initiative());
        spinner.setEditable(true);
        spinner.setUserData(entry.id());
        Button reroll = new StyledButton("\u2684", "spinner-btn");
        reroll.setOnAction(event -> spinner.setNumericValue(entry.initiative() + 2));
        row.addContent(name, spinner, reroll);
        return row;
    }

    private void rollAllInitiatives() {
        int seed = 13;
        for (Node rowNode : initiativeList.getChildren()) {
            if (rowNode instanceof HBox row) {
                for (Node rowChild : row.getChildren()) {
                    if (rowChild instanceof ValueSpinner spinner) {
                        spinner.setNumericValue(seed);
                        seed = seed == 19 ? 11 : seed + 2;
                    }
                }
            }
        }
    }

    private void publishInitiativeConfirmation() {
        List<EncounterInitiativeStateViewInputEvent.InitiativeEntry> inputs = new ArrayList<>();
        for (Node rowNode : initiativeList.getChildren()) {
            if (rowNode instanceof HBox row) {
                for (Node rowChild : row.getChildren()) {
                    if (rowChild instanceof Spinner<?> spinner) {
                        spinner.commitValue();
                        inputs.add(new EncounterInitiativeStateViewInputEvent.InitiativeEntry(
                                String.valueOf(spinner.getUserData()),
                                ((Number) spinner.getValue()).intValue()));
                    }
                }
            }
        }
        publish(new EncounterInitiativeStateViewInputEvent(false, inputs));
    }

    private void publish(EncounterInitiativeStateViewInputEvent input) {
        viewInputEventHandler.accept(input);
    }

    private Label sectionHeader(String text) {
        return new StyledLabel(text, "section-header", "text-muted", "encounter-initiative-section-header");
    }

    private static Region footerSpacer() {
        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);
        return spacer;
    }

    private static VBox initiativeList() {
        VBox list = new VBox(6);
        list.getStyleClass().add("encounter-initiative-list");
        return list;
    }

    private static final class StyledLabel extends Label {

        private StyledLabel(String text, String... styleClasses) {
            super(text);
            getStyleClass().addAll(styleClasses);
        }
    }

    private static final class StyledButton extends Button {

        private StyledButton(String text, String... styleClasses) {
            super(text);
            getStyleClass().addAll(styleClasses);
        }
    }

    private static final class ValueSpinner extends Spinner<Integer> {

        private ValueSpinner(int initiative) {
            super(-10, 40, initiative);
            getStyleClass().add("encounter-initiative-spinner");
        }

        private void setNumericValue(int initiative) {
            getValueFactory().setValue(initiative);
        }
    }

    private static final class InitiativeRow extends HBox {

        private InitiativeRow() {
            super(8);
            setAlignment(Pos.CENTER_LEFT);
            getStyleClass().add("encounter-initiative-row");
        }

        private void addContent(Node... nodes) {
            getChildren().addAll(nodes);
        }
    }
}
