package features.sessionplanner.adapter.javafx;

import features.sessionplanner.api.PrepareSessionCommand;
import features.sessionplanner.api.SessionPreparationSnapshot;
import features.sessionplanner.api.SessionPreparationStatus;
import java.util.ArrayList;
import java.util.List;
import java.util.OptionalInt;
import java.util.function.Consumer;
import java.util.function.LongConsumer;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.control.ProgressBar;
import javafx.scene.control.ScrollPane;
import javafx.scene.control.TextField;
import javafx.scene.layout.FlowPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;

/** Compact preparation toolbar. All values come from the single workspace snapshot. */
public final class SessionPlannerControlsView extends ScrollPane {

    private static final long GENERATION_SEED = 179_974L;
    private static final String COMPACT = "compact";
    private static final String FLAT = "flat";
    private static final String ACCENT = "accent";
    private static final String SECONDARY = "text-secondary";

    private final Label authoredStatus = label("", SECONDARY, "session-planner-status");
    private final Button participantDisclosure = button("Teilnehmer (0)", FLAT);
    private final VBox participantDetail = new VBox(6);
    private final ComboBox<SessionPlannerViewModel.ControlsProjection.ParticipantChoiceModel> participantSelector =
            new ComboBox<>();
    private final Button addParticipant = button("Hinzufügen", ACCENT);
    private final VBox participantRows = new VBox(4);
    private final TextField encounterDays = field("Tage", 5);
    private final Button applyDays = button("Übernehmen", FLAT);
    private final Label encounterDaysError = label("", "session-planner-gap-active");
    private final TextField encounterCount = field("Auto", 4);
    private final Button generate = button("Generieren", ACCENT);
    private final Button cancel = button("Abbrechen", FLAT);
    private final ProgressBar progress = new ProgressBar();
    private final Label preparationStatus = label("", SECONDARY);
    private final Label workspaceStatus = label("", SECONDARY, "session-planner-workspace-status");
    private final VBox replacementConfirmation = new VBox(6);

    private LongConsumer addParticipantHandler = ignored -> { };
    private LongConsumer removeParticipantHandler = ignored -> { };
    private Consumer<String> setEncounterDaysHandler = ignored -> { };
    private Consumer<PrepareSessionCommand> prepareHandler = ignored -> { };
    private Runnable cancelHandler = () -> { };
    private boolean participantDetailOpen;
    private boolean sessionDisabled = true;
    private long latestPublicationRevision;
    private long clearEncounterDaysErrorAfterRevision = Long.MAX_VALUE;

    public SessionPlannerControlsView() {
        FlowPane toolbar = new FlowPane(8, 6);
        toolbar.getStyleClass().add("session-planner-preparation-toolbar");
        toolbar.setAlignment(Pos.CENTER_LEFT);
        toolbar.getChildren().setAll(
                participantDisclosure,
                encounterDaysInput(),
                labelledInput("Encounter-Anzahl", encounterCount),
                generate,
                cancel,
                workspaceStatus);

        participantSelector.setPromptText("Party-Mitglied");
        participantSelector.setMaxWidth(Double.MAX_VALUE);
        HBox.setHgrow(participantSelector, Priority.ALWAYS);
        addParticipant.setOnAction(event -> {
            var selected = participantSelector.getValue();
            if (selected != null) {
                addParticipantHandler.accept(selected.characterId());
            }
        });
        participantDetail.getChildren().setAll(
                new HBox(6, participantSelector, addParticipant), participantRows);
        participantDetail.getStyleClass().add("session-planner-participant-disclosure");
        show(participantDetail, false);

        participantDisclosure.setOnAction(event -> {
            participantDetailOpen = !participantDetailOpen;
            show(participantDetail, participantDetailOpen);
        });
        encounterDays.setAccessibleText("Encounter-Tage");
        encounterDays.setAccessibleHelp("Positive Dezimalzahl für die Abenteuer-Tage eingeben.");
        applyDays.setOnAction(event -> dispatchEncounterDays());
        encounterDays.setOnAction(event -> dispatchEncounterDays());
        generate.setOnAction(event -> dispatchPreparation(false));
        cancel.setOnAction(event -> cancelHandler.run());

        Button keep = button("Nicht ersetzen", FLAT);
        keep.setOnAction(event -> cancelHandler.run());
        Button replace = button("Ersetzen und generieren", ACCENT);
        replace.setOnAction(event -> dispatchPreparation(true));
        replacementConfirmation.getStyleClass().add("session-planner-replacement-confirmation");
        replacementConfirmation.getChildren().setAll(
                label("Szenen, Rasten, manuelle Notizen und generierte Referenzen dieser Session werden ersetzt."),
                new HBox(6, keep, replace));

        progress.setMaxWidth(Double.MAX_VALUE);
        progress.getStyleClass().add("session-planner-preparation-progress");
        VBox content = new VBox(8, authoredStatus, toolbar, participantDetail,
                replacementConfirmation, preparationStatus, progress);
        content.setPadding(new Insets(2));
        content.getStyleClass().add("session-planner-controls");
        setContent(content);
        getStyleClass().add("session-planner-controls-scroll");
        setFitToWidth(true);
        setHbarPolicy(ScrollBarPolicy.NEVER);
        show(replacementConfirmation, false);
        show(cancel, false);
        show(progress, false);
        show(encounterDaysError, false);
        show(workspaceStatus, false);
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

    public void onPrepare(Consumer<PrepareSessionCommand> handler) {
        prepareHandler = handler == null ? ignored -> { } : handler;
    }

    public void onCancel(Runnable handler) {
        cancelHandler = handler == null ? () -> { } : handler;
    }

    void bind(SessionPlannerViewModel viewModel) {
        if (viewModel == null) {
            return;
        }
        viewModel.controlsProjectionProperty().addListener((ignored, before, after) -> show(after));
        show(viewModel.controlsProjectionProperty().get());
    }

    private void show(SessionPlannerViewModel.ControlsProjection projection) {
        if (projection == null) {
            return;
        }
        authoredStatus.setText(projection.statusText());
        show(authoredStatus, !projection.statusText().isBlank());
        latestPublicationRevision = projection.publicationRevision();
        showWorkspaceStatus(projection.workspaceStatus());
        clearEncounterDaysErrorIfAuthoritativePublication();
        applySetup(projection.setup());
        applyPreparation(projection.preparation());
    }

    private HBox encounterDaysInput() {
        VBox input = new VBox(2, labelledInput("Encounter-Tage", encounterDays, applyDays), encounterDaysError);
        return new HBox(input);
    }

    private void showWorkspaceStatus(SessionPlannerViewModel.WorkspaceStatusProjection status) {
        String message = status == null ? "" : status.message();
        workspaceStatus.setText(message);
        workspaceStatus.setAccessibleText(message.isBlank() ? "" : "Workspace-Status: " + message);
        workspaceStatus.setAccessibleHelp(message.isBlank()
                ? "" : "Kompakter Hinweis zum aktuellen Session-Planner-Workspace.");
        show(workspaceStatus, !message.isBlank());
    }

    private void applySetup(SessionPlannerViewModel.ControlsProjection.SetupModel setup) {
        sessionDisabled = setup.sessionActionsDisabled();
        participantDisclosure.setText("Teilnehmer (" + setup.sessionParticipants().size() + ")");
        participantDisclosure.setDisable(sessionDisabled);
        long previous = participantSelector.getValue() == null
                ? 0L : participantSelector.getValue().characterId();
        participantSelector.getItems().setAll(setup.partyMemberChoices());
        participantSelector.getItems().stream()
                .filter(choice -> choice.characterId() == previous)
                .findFirst().ifPresentOrElse(
                        participantSelector.getSelectionModel()::select,
                        participantSelector.getSelectionModel()::clearSelection);
        participantSelector.setDisable(sessionDisabled || setup.partyMemberChoices().isEmpty());
        addParticipant.setDisable(sessionDisabled || setup.partyMemberChoices().isEmpty());
        if (!encounterDays.isFocused()) {
            encounterDays.setText(setup.encounterDaysText());
        }
        encounterDays.setDisable(sessionDisabled);
        applyDays.setDisable(sessionDisabled);
        encounterCount.setDisable(sessionDisabled);
        renderParticipants(setup.sessionParticipants());
    }

    private void dispatchEncounterDays() {
        String text = encounterDays.getText();
        if (SessionPlannerVocabulary.parsePositiveDecimal(text) == null) {
            showEncounterDaysError("Encounter-Tage muss eine positive Dezimalzahl sein.");
            return;
        }
        clearEncounterDaysErrorAfterRevision = latestPublicationRevision;
        setEncounterDaysHandler.accept(text);
    }

    private void clearEncounterDaysErrorIfAuthoritativePublication() {
        if (latestPublicationRevision > clearEncounterDaysErrorAfterRevision) {
            clearEncounterDaysErrorAfterRevision = Long.MAX_VALUE;
            showEncounterDaysError("");
        }
    }

    private void showEncounterDaysError(String message) {
        encounterDaysError.setText(message);
        encounterDaysError.setAccessibleText(message);
        encounterDaysError.setAccessibleHelp(message);
        encounterDays.setAccessibleHelp(message.isBlank()
                ? "Positive Dezimalzahl für die Abenteuer-Tage eingeben."
                : message);
        show(encounterDaysError, !message.isBlank());
    }

    private void renderParticipants(
            List<SessionPlannerViewModel.ControlsProjection.SessionParticipantModel> participants
    ) {
        List<Node> rows = new ArrayList<>();
        if (participants.isEmpty()) {
            rows.add(label("Noch keine Session-Teilnehmer.", SECONDARY, "session-planner-empty"));
        } else {
            for (var participant : participants) {
                Button remove = button("Entfernen", FLAT);
                remove.setDisable(sessionDisabled);
                remove.setOnAction(event -> removeParticipantHandler.accept(participant.characterId()));
                rows.add(new HBox(6,
                        label(participant.name(), "session-planner-plan-name"),
                        label(participant.detail(), participant.detailStyleClass()), spacer(), remove));
            }
        }
        participantRows.getChildren().setAll(rows);
    }

    private void applyPreparation(SessionPreparationSnapshot snapshot) {
        SessionPreparationSnapshot safe = snapshot == null ? SessionPreparationSnapshot.idle() : snapshot;
        boolean busy = switch (safe.status()) {
            case GENERATING, RESOLVING_ENCOUNTERS, SAVING -> true;
            default -> false;
        };
        boolean confirming = safe.status() == SessionPreparationStatus.CONFIRMING_REPLACEMENT;
        String message = safe.message().isBlank() ? defaultMessage(safe.status()) : safe.message();
        preparationStatus.setText(message);
        show(preparationStatus, !message.isBlank());
        show(replacementConfirmation, confirming);
        show(cancel, safe.cancelEnabled());
        show(progress, busy);
        progress.setProgress(busy ? ProgressBar.INDETERMINATE_PROGRESS : 0);
        generate.setDisable(sessionDisabled || busy || confirming);
    }

    private void dispatchPreparation(boolean confirmed) {
        OptionalInt count = parseCount(encounterCount.getText());
        if (!encounterCount.getText().isBlank() && count.isEmpty()) {
            preparationStatus.setText("Encounter-Anzahl muss zwischen 1 und 10 liegen.");
            show(preparationStatus, true);
            return;
        }
        prepareHandler.accept(new PrepareSessionCommand(count, GENERATION_SEED, confirmed));
    }

    private static OptionalInt parseCount(String text) {
        if (text == null || text.isBlank()) {
            return OptionalInt.empty();
        }
        try {
            int parsed = Integer.parseInt(text.trim());
            return parsed >= 1 && parsed <= 10 ? OptionalInt.of(parsed) : OptionalInt.empty();
        } catch (NumberFormatException failure) {
            return OptionalInt.empty();
        }
    }

    private static String defaultMessage(SessionPreparationStatus status) {
        return switch (status) {
            case IDLE -> "";
            case CONFIRMING_REPLACEMENT -> "Ersetzung bestätigen.";
            case GENERATING -> "Generierung läuft …";
            case RESOLVING_ENCOUNTERS -> "Encounter werden aufgelöst …";
            case SAVING -> "Vorbereitete Session wird gespeichert …";
            case READY -> "Session ist vorbereitet.";
            case INVALID -> "Eingaben prüfen und erneut generieren.";
            case FAILED -> "Vorbereitung fehlgeschlagen. Eingaben prüfen und erneut versuchen.";
            case CANCELLED -> "Vorbereitung abgebrochen.";
        };
    }

    private static HBox labelledInput(String title, Node... input) {
        HBox row = new HBox(5);
        row.setAlignment(Pos.CENTER_LEFT);
        row.getChildren().add(label(title, SECONDARY));
        row.getChildren().addAll(input);
        return row;
    }

    private static TextField field(String prompt, int columns) {
        TextField field = new TextField();
        field.setPromptText(prompt);
        field.setPrefColumnCount(columns);
        field.getStyleClass().add(COMPACT);
        return field;
    }

    private static Button button(String text, String... styles) {
        Button button = new Button(text);
        button.getStyleClass().add(COMPACT);
        button.getStyleClass().addAll(styles);
        return button;
    }

    private static Label label(String text, String... styles) {
        Label label = new Label(text == null ? "" : text);
        label.setWrapText(true);
        label.getStyleClass().addAll(styles);
        return label;
    }

    private static Region spacer() {
        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);
        return spacer;
    }

    private static void show(Node node, boolean visible) {
        node.setVisible(visible);
        node.setManaged(visible);
    }
}
