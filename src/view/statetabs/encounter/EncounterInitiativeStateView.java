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
import src.view.slotcontent.primitives.dialog.DialogSurfaceView;
import src.view.slotcontent.primitives.dialog.DialogSurfaceView.BodyPolicy;

public final class EncounterInitiativeStateView extends VBox {

    private final Map<String, Spinner<Integer>> initiativeSpinnerById = new LinkedHashMap<>();
    private final VBox initiativeList = new VBox(6);
    private final DialogSurfaceView dialog = buildPane();
    private Consumer<EncounterInitiativeStateViewInputEvent> viewInputEventHandler = ignored -> { };

    public EncounterInitiativeStateView() {
        getChildren().add(dialog);
        VBox.setVgrow(dialog, Priority.ALWAYS);
    }

    public void onViewInputEvent(Consumer<EncounterInitiativeStateViewInputEvent> handler) {
        viewInputEventHandler = handler == null ? ignored -> { } : handler;
    }

    public void showInitiative(EncounterStateContributionModel.InitiativeStateView state) {
        EncounterStateContributionModel.InitiativeStateView safeState = state == null
                ? EncounterStateContributionModel.InitiativeStateView.empty()
                : state;
        initiativeSpinnerById.clear();
        initiativeList.getChildren().clear();
        String currentKind = "";
        for (EncounterStateContributionModel.InitiativeEntryView entry : safeState.entries()) {
            if (!entry.kind().equals(currentKind)) {
                currentKind = entry.kind();
                Label header = sectionHeader("SC".equals(currentKind) ? "Spieler" : currentKind);
                header.setPadding(new Insets(8, 0, 0, 0));
                initiativeList.getChildren().add(header);
            }
            initiativeList.getChildren().add(buildInitiativeRow(entry));
        }
    }

    private DialogSurfaceView buildPane() {
        DialogSurfaceView nextDialog = new DialogSurfaceView();
        Label title = new Label("Initiative");
        title.getStyleClass().add("title");
        initiativeList.setPadding(DialogSurfaceView.contentInsets());

        Button backButton = new Button("\u2190 Zurueck");
        backButton.setOnAction(event -> publish(new EncounterInitiativeStateViewInputEvent.BackNavigationInteraction()));
        Button rollAllButton = new Button("Alle wuerfeln");
        rollAllButton.getStyleClass().add("neutral-action");
        rollAllButton.setOnAction(event -> rollAllInitiatives());
        Button startButton = new Button("Kampf starten");
        startButton.getStyleClass().add("accent");
        startButton.setOnAction(event -> publish(new EncounterInitiativeStateViewInputEvent.SubmissionInteraction(readInitiatives())));
        nextDialog.setHeader(title);
        nextDialog.setBody(initiativeList, BodyPolicy.SCROLL);
        nextDialog.setFooter(backButton, rollAllButton, DialogSurfaceView.spacer(), startButton);
        return nextDialog;
    }

    private Node buildInitiativeRow(EncounterStateContributionModel.InitiativeEntryView entry) {
        HBox row = new HBox(8);
        row.setAlignment(Pos.CENTER_LEFT);
        row.setPadding(new Insets(0, 0, 0, 12));
        Label name = new Label(entry.label());
        name.setWrapText(true);
        HBox.setHgrow(name, Priority.ALWAYS);
        Spinner<Integer> spinner = new Spinner<>(-10, 40, entry.initiative());
        spinner.setEditable(true);
        spinner.setPrefWidth(84);
        initiativeSpinnerById.put(entry.id(), spinner);
        Button reroll = new Button("\u2684");
        reroll.getStyleClass().add("spinner-btn");
        reroll.setOnAction(event -> spinner.getValueFactory().setValue(entry.initiative() + 2));
        row.getChildren().addAll(name, spinner, reroll);
        return row;
    }

    private void rollAllInitiatives() {
        int seed = 13;
        for (Spinner<Integer> spinner : initiativeSpinnerById.values()) {
            spinner.getValueFactory().setValue(seed);
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

    private void publish(EncounterInitiativeStateViewInputEvent.Interaction interaction) {
        viewInputEventHandler.accept(new EncounterInitiativeStateViewInputEvent(interaction));
    }

    private Label sectionHeader(String text) {
        Label label = new Label(text);
        label.getStyleClass().addAll("section-header", "text-muted");
        return label;
    }
}
