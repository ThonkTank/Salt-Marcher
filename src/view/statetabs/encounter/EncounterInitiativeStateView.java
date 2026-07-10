package src.view.statetabs.encounter;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;
import javafx.beans.property.ReadOnlyObjectProperty;
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

    private final VBox initiativeList = new InitiativeListPane();
    private final VBox dialog = buildPane();
    private Runnable backToBuilderHandler = () -> { };
    private Consumer<List<EncounterStateViewModel.InitiativeEntry>> confirmInitiativeHandler = ignored -> { };

    public EncounterInitiativeStateView() {
        getChildren().add(dialog);
        setVgrow(dialog, Priority.ALWAYS);
    }

    public void onBackToBuilder(Runnable handler) {
        backToBuilderHandler = handler == null ? () -> { } : handler;
    }

    public void onConfirmInitiative(Consumer<List<EncounterStateViewModel.InitiativeEntry>> handler) {
        confirmInitiativeHandler = handler == null ? ignored -> { } : handler;
    }

    public void bind(ReadOnlyObjectProperty<EncounterStateViewModel.InitiativePanel> panelProperty) {
        if (panelProperty == null) {
            return;
        }
        showPanel(panelProperty.get());
        panelProperty.addListener((ignored, before, after) -> showPanel(after));
    }

    private void showPanel(EncounterStateViewModel.InitiativePanel panel) {
        EncounterStateViewModel.InitiativePanel safePanel =
                panel == null ? EncounterStateViewModel.InitiativePanel.empty() : panel;
        ((InitiativeListPane) initiativeList).showPanel(safePanel);
    }

    private VBox buildPane() {
        Label title = new StyledLabel("Initiative", "title");

        Button backButton = new Button("\u2190 Zurueck");
        backButton.setOnAction(event -> backToBuilderHandler.run());
        Button rollAllButton = new StyledButton("Alle wuerfeln", "neutral-action");
        rollAllButton.setOnAction(event -> rollAllInitiatives());
        Button startButton = new StyledButton("Kampf starten", "accent");
        startButton.setOnAction(event -> publishInitiativeConfirmation());
        HBox footer = new HBox(8, backButton, rollAllButton, footerSpacer(), startButton);
        footer.setAlignment(Pos.CENTER_LEFT);
        VBox nextDialog = new StyledVBox(10, "dialog-surface", title, initiativeList, footer);
        setVgrow(initiativeList, Priority.ALWAYS);
        return nextDialog;
    }

    private static Node buildInitiativeRow(EncounterStateViewModel.InitiativeEntry entry) {
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
        for (ValueSpinner spinner : ((InitiativeListPane) initiativeList).spinners()) {
            spinner.setNumericValue(seed);
            seed = seed == 19 ? 11 : seed + 2;
        }
    }

    private void publishInitiativeConfirmation() {
        List<EncounterStateViewModel.InitiativeEntry> inputs = new ArrayList<>();
        for (ValueSpinner spinner : ((InitiativeListPane) initiativeList).spinners()) {
            inputs.add(spinner.confirmedInput());
        }
        confirmInitiativeHandler.accept(List.copyOf(inputs));
    }

    private static Label sectionHeader(String text) {
        return new StyledLabel(text, "section-header", "text-muted", "encounter-initiative-section-header");
    }

    private static Region footerSpacer() {
        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);
        return spacer;
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

    private static final class StyledVBox extends VBox {

        private StyledVBox(double spacing, String styleClass, Node... nodes) {
            super(spacing, nodes);
            getStyleClass().add(styleClass);
        }
    }

    private static final class InitiativeListPane extends VBox {

        InitiativeListPane() {
            super(6);
            getStyleClass().add("encounter-initiative-list");
        }

        void showPanel(EncounterStateViewModel.InitiativePanel panel) {
            getChildren().clear();
            String currentKind = "";
            for (EncounterStateViewModel.InitiativeEntry entry : panel.entries()) {
                if (!entry.kind().equals(currentKind)) {
                    currentKind = entry.kind();
                    getChildren().add(sectionHeader(EncounterStateVocabulary.initiativeSectionLabel(currentKind)));
                }
                getChildren().add(buildInitiativeRow(entry));
            }
        }

        List<ValueSpinner> spinners() {
            List<ValueSpinner> values = new ArrayList<>();
            for (Node rowNode : getChildren()) {
                if (rowNode instanceof InitiativeRow row) {
                    values.addAll(row.spinners());
                }
            }
            return values;
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

        private EncounterStateViewModel.InitiativeEntry confirmedInput() {
            commitValue();
            return new EncounterStateViewModel.InitiativeEntry(
                    String.valueOf(getUserData()),
                    "",
                    "",
                    getValue().intValue());
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

        private List<ValueSpinner> spinners() {
            List<ValueSpinner> values = new ArrayList<>();
            for (Node rowChild : getChildren()) {
                if (rowChild instanceof ValueSpinner spinner) {
                    values.add(spinner);
                }
            }
            return values;
        }
    }

}
