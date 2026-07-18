package features.sessionplanner.adapter.javafx;

import java.util.OptionalInt;
import java.util.function.BooleanSupplier;
import java.util.function.Consumer;
import javafx.geometry.Pos;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.TextField;
import javafx.scene.layout.HBox;
import javafx.scene.layout.VBox;
import features.sessionplanner.api.ApplyGeneratedSessionCommand;
import features.sessionplanner.api.PreviewGeneratedSessionCommand;
import features.sessionplanner.api.SessionGenerationPreviewModel;
import features.sessionplanner.api.SessionGenerationPreviewSnapshot;
import features.sessionplanner.api.SessionGenerationPreviewStatus;

/**
 * Ein-Klick-Generierung: „Session generieren" baut in einem Schritt eine vollständige, sofort
 * editierbare Session — ohne sichtbare Vorschau oder Text-Zusammenfassung. Intern wird der
 * bestehende Vertrag unsichtbar verkettet: {@code previewGeneratedSession} liefert Attempt-Token
 * und Generation-Id, danach folgt unmittelbar {@code applyGeneratedSession}. Nur wenn die Session
 * bereits Inhalt hat (destruktives Ersetzen), erscheint genau eine minimale Rückfrage.
 */
final class SessionGenerationPanel extends VBox {

    private final Button generateButton = accentButton("Session generieren");
    private final TextField encounterCount = new TextField();
    private final Label status = label("");
    private final VBox confirmation = new VBox(6);
    private final Button confirmReplace = accentButton("Ersetzen");

    private Consumer<PreviewGeneratedSessionCommand> previewHandler = ignored -> { };
    private Runnable draftChangedHandler = () -> { };
    private Consumer<ApplyGeneratedSessionCommand> applyHandler = ignored -> { };
    private BooleanSupplier existingContentSupplier = () -> false;

    private boolean sessionActive;
    private boolean pendingGenerate;
    private ApplyGeneratedSessionCommand pendingApply;

    SessionGenerationPanel() {
        super(6);
        getStyleClass().addAll("session-planner-card", "session-generation-panel");

        encounterCount.setPromptText("Auto");
        encounterCount.setPrefColumnCount(3);
        encounterCount.getStyleClass().add("compact");

        generateButton.setMaxWidth(Double.MAX_VALUE);
        generateButton.setOnAction(event -> requestGeneration());

        status.getStyleClass().add("text-secondary");
        status.setWrapText(true);

        Button cancel = flatButton("Abbrechen");
        cancel.setOnAction(event -> dismissConfirmation());
        confirmReplace.setOnAction(event -> confirmReplacement());
        confirmation.getChildren().setAll(
                label("Die aktuelle Session (Szenen, Rasten, Loot) wird ersetzt."),
                new HBox(6, cancel, confirmReplace));
        confirmation.getStyleClass().add("session-generation-confirmation");
        setConfirmationVisible(false);

        HBox actionRow = new HBox(6,
                generateButton, label("Anzahl", "text-secondary"), encounterCount);
        actionRow.setAlignment(Pos.CENTER_LEFT);
        HBox.setHgrow(generateButton, javafx.scene.layout.Priority.ALWAYS);

        getChildren().setAll(
                label("Session generieren", "session-planner-card-title"),
                actionRow,
                status,
                confirmation);
        setSessionActive(false);
    }

    void onPreview(Consumer<PreviewGeneratedSessionCommand> handler) {
        previewHandler = handler == null ? ignored -> { } : handler;
    }

    void onApply(Consumer<ApplyGeneratedSessionCommand> handler) {
        applyHandler = handler == null ? ignored -> { } : handler;
    }

    void onDraftChanged(Runnable handler) {
        draftChangedHandler = handler == null ? () -> { } : handler;
    }

    void setExistingContentSupplier(BooleanSupplier supplier) {
        existingContentSupplier = supplier == null ? () -> false : supplier;
    }

    void setSessionActive(boolean active) {
        this.sessionActive = active;
        if (!active) {
            dismissConfirmation();
            pendingGenerate = false;
        }
        updateGenerateEnabled();
    }

    void bind(SessionGenerationPreviewModel model) {
        if (model == null) {
            return;
        }
        model.subscribe(this::onSnapshot);
        onSnapshot(model.current());
    }

    private void requestGeneration() {
        if (!sessionActive) {
            return;
        }
        OptionalInt count;
        try {
            count = parseCount(encounterCount.getText());
        } catch (IllegalArgumentException invalid) {
            status.setText("Encounter-Anzahl muss zwischen 1 und 10 liegen.");
            return;
        }
        dismissConfirmation();
        pendingGenerate = true;
        status.setText("Session wird generiert …");
        updateGenerateEnabled();
        long seed = System.nanoTime() & Long.MAX_VALUE;
        previewHandler.accept(new PreviewGeneratedSessionCommand(count, seed));
    }

    private void onSnapshot(SessionGenerationPreviewSnapshot snapshot) {
        SessionGenerationPreviewSnapshot safe =
                snapshot == null ? SessionGenerationPreviewSnapshot.idle() : snapshot;
        SessionGenerationPreviewStatus state = safe.status();

        if (pendingGenerate) {
            if (state == SessionGenerationPreviewStatus.READY && safe.applyEnabled()) {
                pendingGenerate = false;
                ApplyGeneratedSessionCommand command = new ApplyGeneratedSessionCommand(
                        safe.attemptToken(), safe.sessionId(), safe.generationId());
                if (existingContentSupplier.getAsBoolean()) {
                    pendingApply = command;
                    setConfirmationVisible(true);
                    status.setText("Session vorhanden — Ersetzen bestätigen.");
                } else {
                    applyHandler.accept(command);
                    status.setText("Session wird angewandt …");
                }
            } else if (state == SessionGenerationPreviewStatus.ERROR) {
                pendingGenerate = false;
                status.setText(safe.message().isBlank()
                        ? "Session konnte nicht generiert werden." : safe.message());
            }
        } else if (state == SessionGenerationPreviewStatus.APPLIED) {
            status.setText("Session generiert.");
        } else if (state == SessionGenerationPreviewStatus.ERROR && !safe.message().isBlank()) {
            status.setText(safe.message());
        }
        updateGenerateEnabled(state);
    }

    private void confirmReplacement() {
        ApplyGeneratedSessionCommand command = pendingApply;
        dismissConfirmation();
        if (command != null) {
            status.setText("Session wird angewandt …");
            applyHandler.accept(command);
        }
    }

    private void dismissConfirmation() {
        pendingApply = null;
        setConfirmationVisible(false);
    }

    private void setConfirmationVisible(boolean visible) {
        confirmation.setVisible(visible);
        confirmation.setManaged(visible);
    }

    private void updateGenerateEnabled() {
        updateGenerateEnabled(SessionGenerationPreviewStatus.IDLE);
    }

    private void updateGenerateEnabled(SessionGenerationPreviewStatus state) {
        boolean busy = pendingGenerate
                || state == SessionGenerationPreviewStatus.GENERATING
                || state == SessionGenerationPreviewStatus.APPLYING;
        generateButton.setDisable(!sessionActive || busy);
        encounterCount.setDisable(!sessionActive || busy);
    }

    private static OptionalInt parseCount(String text) {
        if (text == null || text.isBlank()) {
            return OptionalInt.empty();
        }
        int count = Integer.parseInt(text.trim());
        if (count < 1 || count > 10) {
            throw new IllegalArgumentException("Encounter count must be between 1 and 10");
        }
        return OptionalInt.of(count);
    }

    private static Label label(String text, String... styles) {
        Label label = new Label(text == null ? "" : text);
        label.getStyleClass().addAll(styles);
        return label;
    }

    private static Button accentButton(String text) {
        Button button = new Button(text);
        button.getStyleClass().addAll("compact", "accent");
        return button;
    }

    private static Button flatButton(String text) {
        Button button = new Button(text);
        button.getStyleClass().addAll("compact", "flat");
        return button;
    }
}
