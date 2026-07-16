package features.sessionplanner.adapter.javafx;

import java.util.List;
import java.util.OptionalInt;
import java.util.function.Consumer;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.TextField;
import javafx.scene.layout.HBox;
import javafx.scene.layout.VBox;
import javafx.geometry.Pos;
import features.sessionplanner.api.PreviewGeneratedSessionCommand;
import features.sessionplanner.api.ApplyGeneratedSessionCommand;
import features.sessionplanner.api.SessionGenerationPreviewModel;
import features.sessionplanner.api.SessionGenerationPreviewSnapshot;
import features.sessionplanner.api.SessionGenerationPreviewStatus;

final class SessionGenerationPanel extends VBox {

    private static final long DEFAULT_SEED = 179_974L;
    private final TextField encounterCount = new TextField();
    private final TextField seed = new TextField(Long.toString(DEFAULT_SEED));
    private final Label status = label("");
    private final Label summary = label("");
    private final VBox encounters = new VBox(4);
    private final VBox treasures = new VBox(4);
    private final VBox audits = new VBox(2);
    private final Button preview = button("Vorschau erzeugen");
    private final Button apply = button("Anwenden");
    private final VBox confirmation = new VBox(4);
    private Consumer<PreviewGeneratedSessionCommand> previewHandler = ignored -> { };
    private Runnable draftChangedHandler = () -> { };
    private Consumer<ApplyGeneratedSessionCommand> applyHandler = ignored -> { };
    private SessionGenerationPreviewSnapshot renderedPreview = SessionGenerationPreviewSnapshot.idle();
    private ApplyGeneratedSessionCommand confirmationCommand;

    SessionGenerationPanel() {
        super(6);
        getStyleClass().addAll("session-planner-card", "session-generation-panel");
        encounterCount.setPromptText("Auto");
        encounterCount.setPrefColumnCount(4);
        encounterCount.getStyleClass().add("compact");
        seed.setPromptText("Seed");
        seed.setPrefColumnCount(9);
        seed.getStyleClass().add("compact");
        encounterCount.textProperty().addListener((observable, previous, current) -> draftChanged());
        seed.textProperty().addListener((observable, previous, current) -> draftChanged());
        status.getStyleClass().add("text-secondary");
        summary.getStyleClass().add("session-generation-summary");
        preview.setOnAction(event -> publishPreview());
        apply.setOnAction(event -> openConfirmation());
        Button cancel = button("Abbrechen");
        cancel.setOnAction(event -> showConfirmation(false));
        Button confirm = button("Ersetzen bestätigen");
        confirm.getStyleClass().add("accent");
        confirm.setOnAction(event -> {
            ApplyGeneratedSessionCommand command = confirmationCommand;
            showConfirmation(false);
            if (command != null) {
                applyHandler.accept(command);
            }
        });
        confirmation.getChildren().setAll(
                label("Alle aktuellen Szenen, Rasten und Loot-Einträge werden ersetzt. Gespeicherte Encounter-Pläne bleiben erhalten."),
                new HBox(6, cancel, confirm));
        confirmation.getStyleClass().add("session-generation-confirmation");
        showConfirmation(false);
        HBox inputs = new HBox(6,
                label("Encounter"), encounterCount,
                label("Seed"), seed);
        inputs.setAlignment(Pos.CENTER_LEFT);
        inputs.getStyleClass().add("session-generation-inputs");
        getChildren().setAll(
                label("Session generieren", "session-planner-card-title"),
                inputs,
                preview,
                status,
                summary,
                section("Encounter", encounters),
                section("Schätze", treasures),
                section("Audits", audits),
                apply,
                confirmation);
        show(SessionGenerationPreviewSnapshot.idle());
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

    void bind(SessionGenerationPreviewModel model) {
        if (model == null) {
            return;
        }
        model.subscribe(this::show);
        show(model.current());
    }

    private void publishPreview() {
        OptionalInt count = parseCount(encounterCount.getText());
        if (!encounterCount.getText().isBlank() && count.isEmpty()) {
            showLocalError("Encounter-Anzahl muss zwischen 1 und 10 liegen.");
            return;
        }
        long parsedSeed;
        try {
            parsedSeed = Long.parseLong(seed.getText().trim());
        } catch (NumberFormatException exception) {
            showLocalError("Seed muss eine nichtnegative Ganzzahl sein.");
            return;
        }
        if (parsedSeed < 0L) {
            showLocalError("Seed muss eine nichtnegative Ganzzahl sein.");
            return;
        }
        apply.setDisable(true);
        showConfirmation(false);
        previewHandler.accept(new PreviewGeneratedSessionCommand(count, parsedSeed));
    }

    private void show(SessionGenerationPreviewSnapshot snapshot) {
        SessionGenerationPreviewSnapshot safe = snapshot == null
                ? SessionGenerationPreviewSnapshot.idle()
                : snapshot;
        renderedPreview = safe;
        showConfirmation(false);
        status.setText(statusText(safe));
        summary.setText(summaryText(safe));
        encounters.getChildren().setAll(encounterCards(safe));
        treasures.getChildren().setAll(treasureCards(safe));
        audits.getChildren().setAll(auditLines(safe));
        apply.setDisable(!safe.applyEnabled());
        boolean applying = safe.status() == SessionGenerationPreviewStatus.APPLYING;
        encounterCount.setDisable(applying);
        seed.setDisable(applying);
        preview.setDisable(safe.status() == SessionGenerationPreviewStatus.GENERATING
                || applying);
    }

    private void showLocalError(String message) {
        status.setText(message);
        apply.setDisable(true);
        showConfirmation(false);
    }

    private void draftChanged() {
        if (renderedPreview.status() == SessionGenerationPreviewStatus.APPLYING) {
            return;
        }
        apply.setDisable(true);
        showConfirmation(false);
        draftChangedHandler.run();
    }

    private static String statusText(SessionGenerationPreviewSnapshot snapshot) {
        if (!snapshot.message().isBlank()) {
            return snapshot.message();
        }
        return switch (snapshot.status()) {
            case IDLE -> "Teilnehmer und Session-Tage bestimmen die Vorschau.";
            case GENERATING -> "Vorschau wird erzeugt …";
            case READY -> "Vorschau ist bereit.";
            case STALE -> "Die Session wurde geändert. Bitte Vorschau neu erzeugen.";
            case APPLYING -> "Generierte Session wird angewandt …";
            case APPLIED -> "Generierte Session wurde angewandt.";
            case ERROR -> "Vorschau konnte nicht erzeugt werden.";
        };
    }

    private static String summaryText(SessionGenerationPreviewSnapshot snapshot) {
        if (snapshot.generationId().isBlank()) {
            return "";
        }
        var value = snapshot.summary();
        return value.partyCount() + " Spieler · "
                + value.encounterCount() + " Encounter · "
                + value.sessionXpTarget() + " Ziel-XP · "
                + value.treasureCount() + " Schätze · Seed "
                + snapshot.seed() + " · Katalog " + shortHash(snapshot.catalogHash());
    }

    private static List<Node> encounterCards(SessionGenerationPreviewSnapshot snapshot) {
        return snapshot.encounters().stream()
                .map(encounter -> (Node) label(
                        "#" + encounter.encounterNumber() + " · "
                                + encounter.targetXp() + " XP · "
                                + encounter.difficulty() + " · "
                                + encounter.roleSummary() + "\n"
                                + encounter.monsterSummary(),
                        "session-planner-plan-card", "session-generation-result-card"))
                .toList();
    }

    private static List<Node> treasureCards(SessionGenerationPreviewSnapshot snapshot) {
        return snapshot.treasures().stream()
                .map(treasure -> (Node) label(
                        "#" + treasure.treasureId() + " · "
                                + treasure.channel() + " · "
                                + treasure.stockClass() + " · "
                                + treasure.targetCp() + " CP\n"
                                + treasure.title() + "\n"
                                + String.join("\n", treasure.lines()),
                        "session-planner-plan-card", "session-generation-result-card"))
                .toList();
    }

    private static List<Node> auditLines(SessionGenerationPreviewSnapshot snapshot) {
        return snapshot.audits().stream()
                .map(audit -> (Node) label(
                        audit.status() + " · " + audit.code() + " · " + audit.detail(),
                        "session-generation-audit",
                        "session-generation-audit-" + audit.status().toLowerCase(java.util.Locale.ROOT)))
                .toList();
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

    private void showConfirmation(boolean visible) {
        if (!visible) {
            confirmationCommand = null;
        }
        confirmation.setVisible(visible);
        confirmation.setManaged(visible);
    }

    private void openConfirmation() {
        if (!renderedPreview.applyEnabled()) {
            return;
        }
        confirmationCommand = new ApplyGeneratedSessionCommand(
                renderedPreview.attemptToken(),
                renderedPreview.sessionId(),
                renderedPreview.generationId());
        confirmation.setVisible(true);
        confirmation.setManaged(true);
    }

    private static String shortHash(String hash) {
        return hash == null || hash.length() <= 12 ? String.valueOf(hash) : hash.substring(0, 12);
    }

    private static VBox section(String title, Node content) {
        return new VBox(3, label(title, "session-planner-card-title"), content);
    }

    private static Label label(String text, String... styles) {
        Label label = new Label(text == null ? "" : text);
        label.setWrapText(true);
        label.getStyleClass().addAll(styles);
        return label;
    }

    private static Button button(String text) {
        Button button = new Button(text);
        button.getStyleClass().add("compact");
        return button;
    }
}
