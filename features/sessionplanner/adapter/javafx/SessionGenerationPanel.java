package features.sessionplanner.adapter.javafx;

import features.sessionplanner.api.PrepareSessionCommand;
import features.sessionplanner.api.SessionPreparationModel;
import features.sessionplanner.api.SessionPreparationSnapshot;
import features.sessionplanner.api.SessionPreparationStatus;
import java.util.OptionalInt;
import java.util.function.Consumer;
import javafx.geometry.Pos;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.TextField;
import javafx.scene.layout.HBox;
import javafx.scene.layout.VBox;

final class SessionGenerationPanel extends VBox {

    private static final long DEFAULT_SEED = 179_974L;
    private final TextField encounterCount = new TextField();
    private final TextField seed = new TextField(Long.toString(DEFAULT_SEED));
    private final Label status = label("");
    private final Button generate = button("Session generieren");
    private final Button cancel = button("Abbrechen");
    private final VBox confirmation = new VBox(4);
    private Consumer<PrepareSessionCommand> prepareHandler = ignored -> { };
    private Runnable cancelHandler = () -> { };

    SessionGenerationPanel() {
        super(6);
        getStyleClass().addAll("session-planner-card", "session-generation-panel");
        encounterCount.setPromptText("Auto");
        encounterCount.setPrefColumnCount(4);
        encounterCount.getStyleClass().add("compact");
        seed.setPromptText("Seed");
        seed.setPrefColumnCount(9);
        seed.getStyleClass().add("compact");
        status.getStyleClass().add("text-secondary");
        generate.setOnAction(event -> dispatch(false));
        cancel.setOnAction(event -> cancelHandler.run());
        Button decline = button("Nicht ersetzen");
        decline.setOnAction(event -> cancelHandler.run());
        Button confirm = button("Ersetzen und generieren");
        confirm.getStyleClass().add("accent");
        confirm.setOnAction(event -> dispatch(true));
        confirmation.getChildren().setAll(
                label("Vorhandene Szenen, Rasten, Beutenotizen und Belohnungsreferenzen werden ersetzt."),
                new HBox(6, decline, confirm));
        confirmation.getStyleClass().add("session-generation-confirmation");
        HBox inputs = new HBox(6, label("Encounter"), encounterCount, label("Seed"), seed);
        inputs.setAlignment(Pos.CENTER_LEFT);
        inputs.getStyleClass().add("session-generation-inputs");
        getChildren().setAll(inputs, generate, status, cancel, confirmation);
        show(SessionPreparationSnapshot.idle());
    }

    void onPrepare(Consumer<PrepareSessionCommand> handler) {
        prepareHandler = handler == null ? ignored -> { } : handler;
    }

    void onCancel(Runnable handler) {
        cancelHandler = handler == null ? () -> { } : handler;
    }

    void bind(SessionPreparationModel model) {
        if (model == null) {
            return;
        }
        model.subscribe(this::show);
        show(model.current());
    }

    private void dispatch(boolean replacementConfirmed) {
        OptionalInt count = parseCount(encounterCount.getText());
        if (!encounterCount.getText().isBlank() && count.isEmpty()) {
            status.setText("Encounter-Anzahl muss zwischen 1 und 10 liegen.");
            return;
        }
        long parsedSeed;
        try {
            parsedSeed = Long.parseLong(seed.getText().trim());
        } catch (NumberFormatException exception) {
            status.setText("Seed muss eine nichtnegative Ganzzahl sein.");
            return;
        }
        if (parsedSeed < 0L) {
            status.setText("Seed muss eine nichtnegative Ganzzahl sein.");
            return;
        }
        prepareHandler.accept(new PrepareSessionCommand(count, parsedSeed, replacementConfirmed));
    }

    private void show(SessionPreparationSnapshot snapshot) {
        SessionPreparationSnapshot safe = snapshot == null ? SessionPreparationSnapshot.idle() : snapshot;
        status.setText(safe.message().isBlank() ? defaultMessage(safe.status()) : safe.message());
        boolean confirming = safe.status() == SessionPreparationStatus.CONFIRMING_REPLACEMENT;
        confirmation.setVisible(confirming);
        confirmation.setManaged(confirming);
        cancel.setVisible(safe.cancelEnabled());
        cancel.setManaged(safe.cancelEnabled());
        generate.setDisable(safe.status() == SessionPreparationStatus.GENERATING
                || safe.status() == SessionPreparationStatus.RESOLVING_ENCOUNTERS
                || safe.status() == SessionPreparationStatus.SAVING);
    }

    private static String defaultMessage(SessionPreparationStatus status) {
        return switch (status) {
            case IDLE -> "";
            case CONFIRMING_REPLACEMENT -> "Ersetzen bestätigen.";
            case GENERATING -> "Session wird generiert …";
            case RESOLVING_ENCOUNTERS -> "Encounter werden aufgelöst …";
            case SAVING -> "Session wird gespeichert …";
            case READY -> "Session ist vorbereitet.";
            case INVALID -> "Session-Eingaben sind ungültig.";
            case FAILED -> "Session-Vorbereitung ist fehlgeschlagen.";
        };
    }

    private static OptionalInt parseCount(String text) {
        if (text == null || text.isBlank()) {
            return OptionalInt.empty();
        }
        try {
            int count = Integer.parseInt(text.trim());
            return count >= 1 && count <= 10 ? OptionalInt.of(count) : OptionalInt.empty();
        } catch (NumberFormatException exception) {
            return OptionalInt.empty();
        }
    }

    private static Label label(String text) {
        Label label = new Label(text == null ? "" : text);
        label.setWrapText(true);
        return label;
    }

    private static Button button(String text) {
        Button button = new Button(text);
        button.getStyleClass().add("compact");
        return button;
    }
}
