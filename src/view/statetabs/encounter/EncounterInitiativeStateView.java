package src.view.statetabs.encounter;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.Spinner;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.VBox;
import src.view.slotcontent.primitives.dialog.DialogSurfaceContentModel;
import src.view.slotcontent.primitives.dialog.DialogSurfaceView;

public final class EncounterInitiativeStateView extends VBox {

    private final Map<String, Spinner<Integer>> initiativeSpinnerById = new LinkedHashMap<>();
    private final InitiativeList initiativeList = new InitiativeList();
    private final DialogSurfaceContentModel dialogContentModel = new DialogSurfaceContentModel();
    private final DialogSurfaceView dialog = buildPane();
    private Consumer<EncounterInitiativeStateViewInputEvent> viewInputEventHandler = ignored -> { };

    public EncounterInitiativeStateView() {
        getChildren().add(dialog);
        setVgrow(dialog, Priority.ALWAYS);
    }

    public void onViewInputEvent(Consumer<EncounterInitiativeStateViewInputEvent> handler) {
        viewInputEventHandler = handler == null ? ignored -> { } : handler;
    }

    public void showInitiative(EncounterStateContributionModel.InitiativeStateView state) {
        EncounterStateContributionModel.InitiativeStateView safeState = state == null
                ? EncounterStateContributionModel.InitiativeStateView.empty()
                : state;
        initiativeSpinnerById.clear();
        initiativeList.clearEntries();
        String currentKind = "";
        for (EncounterStateContributionModel.InitiativeEntryView entry : safeState.entries()) {
            if (!entry.kind().equals(currentKind)) {
                currentKind = entry.kind();
                Label header = sectionHeader("SC".equals(currentKind) ? "Spieler" : currentKind);
                header.setPadding(new Insets(8, 0, 0, 0));
                initiativeList.addEntry(header);
            }
            initiativeList.addEntry(buildInitiativeRow(entry));
        }
    }

    private DialogSurfaceView buildPane() {
        Label title = new StyledLabel("Initiative", "title");
        initiativeList.setPadding(DialogSurfaceView.contentInsets());

        Button backButton = new Button("\u2190 Zurueck");
        backButton.setOnAction(event -> publish(new EncounterInitiativeStateViewInputEvent(true, List.of())));
        Button rollAllButton = new StyledButton("Alle wuerfeln", "neutral-action");
        rollAllButton.setOnAction(event -> rollAllInitiatives());
        Button startButton = new StyledButton("Kampf starten", "accent");
        startButton.setOnAction(event -> publish(new EncounterInitiativeStateViewInputEvent(false, readInitiatives())));
        HBox footer = new HBox(8, backButton, rollAllButton, DialogSurfaceView.spacer(), startButton);
        footer.setAlignment(Pos.CENTER_LEFT);
        DialogSurfaceView nextDialog = new DialogSurfaceView(title, initiativeList, footer);
        nextDialog.bind(dialogContentModel);
        dialogContentModel.showLayout(DialogSurfaceContentModel.BodyPolicy.SCROLL, true, true);
        return nextDialog;
    }

    private Node buildInitiativeRow(EncounterStateContributionModel.InitiativeEntryView entry) {
        InitiativeRow row = new InitiativeRow();
        Label name = new Label(entry.label());
        name.setWrapText(true);
        HBox.setHgrow(name, Priority.ALWAYS);
        ValueSpinner spinner = new ValueSpinner(entry.initiative());
        spinner.setEditable(true);
        spinner.setPrefWidth(84);
        initiativeSpinnerById.put(entry.id(), spinner);
        Button reroll = new StyledButton("\u2684", "spinner-btn");
        reroll.setOnAction(event -> spinner.setNumericValue(entry.initiative() + 2));
        row.addContent(name, spinner, reroll);
        return row;
    }

    private void rollAllInitiatives() {
        int seed = 13;
        for (Spinner<Integer> spinner : initiativeSpinnerById.values()) {
            ((ValueSpinner) spinner).setNumericValue(seed);
            seed = seed == 19 ? 11 : seed + 2;
        }
    }

    private List<EncounterInitiativeStateViewInputEvent.InitiativeEntry> readInitiatives() {
        List<EncounterInitiativeStateViewInputEvent.InitiativeEntry> inputs = new ArrayList<>();
        for (Map.Entry<String, Spinner<Integer>> entry : initiativeSpinnerById.entrySet()) {
            Spinner<Integer> spinner = entry.getValue();
            spinner.commitValue();
            inputs.add(new EncounterInitiativeStateViewInputEvent.InitiativeEntry(entry.getKey(), spinner.getValue()));
        }
        return inputs;
    }

    private void publish(EncounterInitiativeStateViewInputEvent input) {
        viewInputEventHandler.accept(input);
    }

    private Label sectionHeader(String text) {
        return new StyledLabel(text, "section-header", "text-muted");
    }

    private static final class InitiativeList extends VBox {

        private InitiativeList() {
            super(6);
        }

        private void clearEntries() {
            getChildren().clear();
        }

        private void addEntry(Node node) {
            getChildren().add(node);
        }
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
        }

        private void setNumericValue(int initiative) {
            getValueFactory().setValue(initiative);
        }
    }

    private static final class InitiativeRow extends HBox {

        private InitiativeRow() {
            super(8);
            setAlignment(Pos.CENTER_LEFT);
            setPadding(new Insets(0, 0, 0, 12));
        }

        private void addContent(Node... nodes) {
            getChildren().addAll(nodes);
        }
    }
}
