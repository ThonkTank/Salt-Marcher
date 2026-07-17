package features.sessionplanner.adapter.javafx;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;
import java.util.function.LongConsumer;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.control.ScrollPane;
import javafx.scene.control.TextField;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;

/**
 * Linke Steuerspalte: Session-Setup (Teilnehmer hinzufügen/entfernen, Encounter-Tage),
 * Generierungs-Panel und die Liste gespeicherter Encounter-Pläne. Die Setup-Eingabefelder sind
 * persistent, damit Combobox-Auswahl und Tippen nicht bei jedem Readback zurückgesetzt werden.
 */
public final class SessionPlannerControlsView extends ScrollPane {

    private static final String STYLE_COMPACT = "compact";
    private static final String STYLE_ACCENT = "accent";
    private static final String STYLE_FLAT = "flat";
    private static final String STYLE_TEXT_SECONDARY = "text-secondary";

    private final Label statusLabel = statusLabel();
    private final ComboBox<SessionPlannerViewModel.ControlsProjection.ParticipantChoiceModel> partyMemberSelector =
            new ComboBox<>();
    private final Button addParticipantButton = button("Hinzufuegen", STYLE_ACCENT);
    private final TextField encounterDaysField = new TextField();
    private final Button setEncounterDaysButton = button("Setzen", STYLE_FLAT);
    private final VBox participantRows = new VBox(4);
    private final VBox plansBox = new VBox(6);

    private LongConsumer addParticipantHandler = ignored -> { };
    private LongConsumer removeParticipantHandler = ignored -> { };
    private Consumer<String> setEncounterDaysHandler = ignored -> { };
    private Consumer<Long> attachPlanHandler = ignored -> { };

    public SessionPlannerControlsView() {
        this(null);
    }

    SessionPlannerControlsView(Node generationPanel) {
        partyMemberSelector.setPromptText("Spieler");
        HBox.setHgrow(partyMemberSelector, Priority.ALWAYS);
        addParticipantButton.setOnAction(event -> {
            var choice = partyMemberSelector.getValue();
            if (choice != null) {
                addParticipantHandler.accept(choice.characterId());
            }
        });
        encounterDaysField.setPromptText("Tage");
        encounterDaysField.getStyleClass().add(STYLE_COMPACT);
        HBox.setHgrow(encounterDaysField, Priority.ALWAYS);
        setEncounterDaysButton.setOnAction(event -> setEncounterDaysHandler.accept(encounterDaysField.getText()));

        setContent(content(generationPanel));
        getStyleClass().add("session-planner-controls-scroll");
        setFitToWidth(true);
        setHbarPolicy(ScrollPane.ScrollBarPolicy.NEVER);
    }

    public void onAddParticipant(LongConsumer handler) {
        addParticipantHandler = handler == null ? ignored -> { } : handler;
    }

    public void onRemoveParticipant(LongConsumer handler) {
        removeParticipantHandler = handler == null ? ignored -> { } : handler;
    }

    public void onSetEncounterDays(Consumer<String> handler) {
        setEncounterDaysHandler = handler == null ? ignored -> { } : handler;
    }

    public void onAttachPlan(Consumer<Long> handler) {
        attachPlanHandler = handler == null ? ignored -> { } : handler;
    }

    void bind(SessionPlannerViewModel viewModel) {
        if (viewModel == null) {
            return;
        }
        viewModel.controlsProjectionProperty().addListener((ignored, before, after) -> show(after));
        show(viewModel.controlsProjectionProperty().get());
    }

    private VBox content(Node generationPanel) {
        VBox content = new VBox(12);
        content.getStyleClass().add("session-planner-controls");
        content.getChildren().add(statusLabel);
        content.getChildren().add(setupSection());
        if (generationPanel != null) {
            content.getChildren().add(generationPanel);
        }
        content.getChildren().add(sectionCard("Gespeicherte Encounter", plansBox));
        return content;
    }

    private Node setupSection() {
        HBox participantRow = new HBox(6, partyMemberSelector, addParticipantButton);
        participantRow.setAlignment(Pos.CENTER_LEFT);
        HBox daysRow = new HBox(6, label("Tage", "session-planner-card-title"), encounterDaysField, setEncounterDaysButton);
        daysRow.setAlignment(Pos.CENTER_LEFT);
        return sectionCard("Session-Setup", participantRow, participantRows, daysRow);
    }

    private void show(SessionPlannerViewModel.ControlsProjection projection) {
        if (projection == null) {
            return;
        }
        statusLabel.setText(projection.statusText());
        applySetup(projection.setup());
        showPlans(projection.availablePlans());
    }

    private void applySetup(SessionPlannerViewModel.ControlsProjection.SetupModel setup) {
        boolean disabled = setup.sessionActionsDisabled();

        long previousSelection = partyMemberSelector.getValue() == null ? 0L : partyMemberSelector.getValue().characterId();
        partyMemberSelector.getItems().setAll(setup.partyMemberChoices());
        reselectParticipantChoice(previousSelection);
        boolean noChoices = setup.partyMemberChoices().isEmpty();
        partyMemberSelector.setDisable(disabled || noChoices);
        addParticipantButton.setDisable(disabled || noChoices);

        if (!encounterDaysField.isFocused()) {
            encounterDaysField.setText(setup.encounterDaysText());
        }
        encounterDaysField.setDisable(disabled);
        setEncounterDaysButton.setDisable(disabled);

        showParticipants(setup.sessionParticipants(), disabled);
    }

    private void reselectParticipantChoice(long previousSelection) {
        for (var choice : partyMemberSelector.getItems()) {
            if (choice.characterId() == previousSelection && previousSelection > 0L) {
                partyMemberSelector.getSelectionModel().select(choice);
                return;
            }
        }
        partyMemberSelector.getSelectionModel().clearSelection();
    }

    private void showParticipants(
            List<SessionPlannerViewModel.ControlsProjection.SessionParticipantModel> participants,
            boolean disabled
    ) {
        List<Node> rows = new ArrayList<>();
        if (participants.isEmpty()) {
            rows.add(label("Keine Session-Teilnehmer.", STYLE_TEXT_SECONDARY, "session-planner-empty"));
        } else {
            for (var participant : participants) {
                Button remove = button("X", STYLE_FLAT);
                remove.setDisable(disabled);
                remove.setOnAction(event -> removeParticipantHandler.accept(participant.characterId()));
                Label name = label(participant.name(), "session-planner-plan-name");
                Label detail = label(participant.detail(), participant.detailStyleClass());
                HBox row = new HBox(6, name, detail, spacer(), remove);
                row.setAlignment(Pos.CENTER_LEFT);
                rows.add(row);
            }
        }
        participantRows.getChildren().setAll(rows);
    }

    private void showPlans(List<SessionPlannerViewModel.ControlsProjection.AvailablePlanModel> plans) {
        if (plans.isEmpty()) {
            plansBox.getChildren().setAll(label(
                    "Keine gespeicherten Encounter-Plaene.",
                    STYLE_TEXT_SECONDARY,
                    "session-planner-empty"));
            return;
        }
        List<Node> cards = new ArrayList<>();
        for (var plan : plans) {
            cards.add(planCard(plan));
        }
        plansBox.getChildren().setAll(cards);
    }

    private Node planCard(SessionPlannerViewModel.ControlsProjection.AvailablePlanModel plan) {
        Button importButton = button(plan.actionText(), plan.actionStyleClass());
        importButton.setDisable(plan.actionDisabled());
        importButton.setOnAction(event -> attachPlanHandler.accept(plan.planId()));
        VBox card = new VBox(4,
                label(plan.name(), "session-planner-plan-name"),
                label(plan.summaryText(), STYLE_TEXT_SECONDARY),
                label(plan.statusText(), STYLE_TEXT_SECONDARY),
                importButton);
        card.getStyleClass().add("session-planner-plan-card");
        return card;
    }

    private static Label statusLabel() {
        Label label = label("", STYLE_TEXT_SECONDARY, "session-planner-status");
        label.setVisible(false);
        label.textProperty().addListener((ignored, before, after) -> label.setVisible(after != null && !after.isBlank()));
        label.managedProperty().bind(label.visibleProperty());
        return label;
    }

    private static VBox sectionCard(String title, Node... body) {
        VBox card = new VBox(6);
        card.getChildren().add(label(title, "session-planner-card-title"));
        card.getChildren().addAll(body);
        card.getStyleClass().add("session-planner-card");
        return card;
    }

    private static Region spacer() {
        Region region = new Region();
        HBox.setHgrow(region, Priority.ALWAYS);
        return region;
    }

    private static Label label(String text, String... styleClasses) {
        Label label = new Label(text);
        label.setWrapText(true);
        label.getStyleClass().addAll(styleClasses);
        return label;
    }

    private static Button button(String text, String... styleClasses) {
        Button button = new Button(text);
        button.getStyleClass().add(STYLE_COMPACT);
        button.getStyleClass().addAll(styleClasses);
        return button;
    }
}
