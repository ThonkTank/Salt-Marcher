package features.sessionplanner.adapter.javafx;

import features.sessionplanner.api.SessionPlannerSelectedSceneSnapshot;
import features.sessionplanner.api.SessionPlannerRoutes;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.function.Function;
import java.util.concurrent.CompletionStage;
import javafx.application.Platform;
import javafx.geometry.Insets;
import javafx.scene.control.Button;
import javafx.scene.control.ButtonType;
import javafx.scene.control.CheckBox;
import javafx.scene.control.Dialog;
import javafx.scene.control.Label;
import javafx.scene.control.ScrollPane;
import javafx.scene.control.TextField;
import javafx.scene.layout.GridPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.VBox;

final class SessionTreasureEditDialog extends Dialog<SessionPlannerSelectedSceneSnapshot.GeneratedReward> {

    private final SessionPlannerSelectedSceneSnapshot.GeneratedReward source;
    private final TextField title;
    private final TextField note;
    private final TextField stockClass;
    private final TextField channel;
    private final TextField theme;
    private final TextField magicType;
    private final TextField targetCp;
    private final TextField nonMagicSlots;
    private final TextField magicSlots;
    private final VBox itemRows = new VBox(6);
    private final VBox packingRows = new VBox(6);
    private final List<ItemEditor> items = new ArrayList<>();
    private final List<PackingEditor> packing = new ArrayList<>();
    private final Function<String, CompletionStage<List<SessionPlannerRoutes.ItemChoice>>> itemSearch;
    private final VBox itemSearchResults = new VBox(4);

    SessionTreasureEditDialog(
            SessionPlannerSelectedSceneSnapshot.GeneratedReward reward,
            Function<String, CompletionStage<List<SessionPlannerRoutes.ItemChoice>>> itemSearch
    ) {
        source = reward;
        this.itemSearch = itemSearch;
        setTitle("Schatz bearbeiten");
        setHeaderText(reward.displayLabel());
        getDialogPane().getButtonTypes().setAll(ButtonType.CANCEL, ButtonType.OK);
        title = field(reward.title());
        note = field(reward.note());
        stockClass = field(reward.stockClass());
        channel = field(reward.channel());
        theme = field(reward.theme());
        magicType = field(reward.magicType());
        targetCp = field(Long.toString(reward.targetCp()));
        nonMagicSlots = field(Integer.toString(reward.nonMagicSlots()));
        magicSlots = field(Integer.toString(reward.magicSlots()));

        GridPane treasure = grid();
        row(treasure, 0, "Titel", title, "Notiz", note);
        row(treasure, 1, "Kanal", channel, "Bestand", stockClass);
        row(treasure, 2, "Thema", theme, "Magietyp", magicType);
        row(treasure, 3, "Ziel (cp)", targetCp, "Slots normal", nonMagicSlots);
        row(treasure, 4, "Slots magisch", magicSlots, "", new Label(""));

        reward.itemLines().forEach(item -> addItem(new ItemEditor(item)));
        reward.packing().forEach(row -> addPacking(new PackingEditor(row)));
        Button addItem = new Button("Item hinzufügen");
        addItem.setOnAction(event -> addItem(new ItemEditor(nextLineId())));
        TextField itemQuery = new TextField();
        itemQuery.setPromptText("Katalog durchsuchen …");
        itemQuery.textProperty().addListener((ignored, before, after) -> searchItems(after));
        Button addPacking = new Button("Packing hinzufügen");
        addPacking.setOnAction(event -> addPacking(new PackingEditor(nextLineId())));

        VBox root = new VBox(12,
                section("Schatz"), treasure,
                section("Items · Reihenfolge von oben nach unten"), itemQuery, itemSearchResults, itemRows, addItem,
                section("Packing · Reihenfolge von oben nach unten"), packingRows, addPacking);
        root.setPadding(new Insets(4));
        ScrollPane scroll = new ScrollPane(root);
        scroll.setFitToWidth(true);
        scroll.setPrefViewportWidth(780);
        scroll.setPrefViewportHeight(620);
        getDialogPane().setContent(scroll);
        setResultConverter(button -> button == ButtonType.OK ? result() : null);
    }

    private void searchItems(String query) {
        String safe = query == null ? "" : query.trim();
        if (safe.length() < 2) {
            itemSearchResults.getChildren().clear();
            return;
        }
        itemSearch.apply(safe).whenComplete((choices, failure) -> Platform.runLater(() -> {
            if (failure != null || choices == null) {
                itemSearchResults.getChildren().setAll(new Label("Katalogsuche fehlgeschlagen."));
                return;
            }
            itemSearchResults.getChildren().setAll(choices.stream().map(choice -> {
                Button add = new Button(choice.name() + (choice.rarity().isBlank() ? "" : " · " + choice.rarity()));
                add.setMaxWidth(Double.MAX_VALUE);
                add.setOnAction(event -> addItem(new ItemEditor(nextLineId(), choice)));
                return add;
            }).toList());
        }));
    }

    private SessionPlannerSelectedSceneSnapshot.GeneratedReward result() {
        return new SessionPlannerSelectedSceneSnapshot.GeneratedReward(
                source.treasureId(), title.getText(), note.getText(), stockClass.getText(), channel.getText(),
                theme.getText(), magicType.getText(), number(targetCp, source.targetCp()),
                integer(nonMagicSlots, source.nonMagicSlots()), integer(magicSlots, source.magicSlots()),
                items.stream().map(ItemEditor::value).toList(), packing.stream().map(PackingEditor::value).toList());
    }

    private void addItem(ItemEditor editor) {
        items.add(editor);
        itemRows.getChildren().add(editor.root);
    }

    private void addPacking(PackingEditor editor) {
        packing.add(editor);
        packingRows.getChildren().add(editor.root);
    }

    private int nextLineId() {
        return Math.max(items.stream().mapToInt(editor -> integer(editor.lineId, 0)).max().orElse(0),
                packing.stream().mapToInt(editor -> integer(editor.lineId, 0)).max().orElse(0)) + 1;
    }

    private final class ItemEditor {
        private final VBox root = new VBox(4);
        private final TextField lineId;
        private final TextField role;
        private final TextField itemId;
        private final TextField text;
        private final TextField quantity;
        private final TextField unitCp;
        private final TextField actualCp;
        private final TextField capacity;
        private final TextField containers;
        private final TextField rarity;
        private final CheckBox cursed = new CheckBox("Verflucht");

        private ItemEditor(int nextId) {
            this(new SessionPlannerSelectedSceneSnapshot.ItemLine(
                    nextId, "", "", "Neues Item", 1, 0, 0, BigDecimal.ZERO, "", "", false));
        }

        private ItemEditor(int nextId, SessionPlannerRoutes.ItemChoice choice) {
            this(new SessionPlannerSelectedSceneSnapshot.ItemLine(
                    nextId, "USEFUL", choice.sourceKey(), choice.name(), 1, choice.costCp(), choice.costCp(),
                    BigDecimal.ZERO, "", choice.rarity(), false));
        }

        private ItemEditor(SessionPlannerSelectedSceneSnapshot.ItemLine item) {
            lineId = field(Integer.toString(item.lineId()));
            lineId.setEditable(false);
            role = field(item.role());
            itemId = field(item.itemId());
            text = field(item.text());
            quantity = field(Long.toString(item.quantity()));
            unitCp = field(Long.toString(item.unitCp()));
            actualCp = field(Long.toString(item.actualCp()));
            capacity = field(item.totalCapacity().toPlainString());
            containers = field(item.allowedContainers());
            rarity = field(item.magicRarity());
            cursed.setSelected(item.cursed());
            GridPane fields = grid();
            row(fields, 0, "Zeile", lineId, "Rolle", role);
            row(fields, 1, "Katalog-ID", itemId, "Name", text);
            row(fields, 2, "Menge", quantity, "Einheit cp", unitCp);
            row(fields, 3, "Ist cp", actualCp, "Kapazität", capacity);
            row(fields, 4, "Behälter", containers, "Seltenheit", rarity);
            Button up = new Button("↑");
            Button down = new Button("↓");
            Button remove = new Button("Entfernen");
            up.setOnAction(event -> move(items, this, -1, itemRows));
            down.setOnAction(event -> move(items, this, 1, itemRows));
            remove.setOnAction(event -> { items.remove(this); itemRows.getChildren().remove(root); });
            root.getStyleClass().add("session-planner-generated-reward");
            root.getChildren().setAll(new HBox(6, cursed, up, down, remove), fields);
        }

        private SessionPlannerSelectedSceneSnapshot.ItemLine value() {
            return new SessionPlannerSelectedSceneSnapshot.ItemLine(
                    integer(lineId, 1), role.getText(), itemId.getText(), text.getText(), number(quantity, 0),
                    number(unitCp, 0), number(actualCp, 0), decimal(capacity), containers.getText(), rarity.getText(),
                    cursed.isSelected());
        }
    }

    private final class PackingEditor {
        private final VBox root = new VBox(4);
        private final TextField lineId;
        private final TextField type;
        private final TextField count;
        private final TextField containerId;
        private final CheckBox valid = new CheckBox("Gültig");

        private PackingEditor(int nextId) {
            this(new SessionPlannerSelectedSceneSnapshot.Packing(nextId, "none", 0, "none", true));
        }

        private PackingEditor(SessionPlannerSelectedSceneSnapshot.Packing row) {
            lineId = field(Integer.toString(row.lineId()));
            lineId.setEditable(false);
            type = field(row.containerType());
            count = field(Integer.toString(row.containerCount()));
            containerId = field(row.containerId());
            valid.setSelected(row.valid());
            GridPane fields = grid();
            row(fields, 0, "Zeile", lineId, "Typ", type);
            row(fields, 1, "Anzahl", count, "Container-ID", containerId);
            Button up = new Button("↑");
            Button down = new Button("↓");
            Button remove = new Button("Entfernen");
            up.setOnAction(event -> move(packing, this, -1, packingRows));
            down.setOnAction(event -> move(packing, this, 1, packingRows));
            remove.setOnAction(event -> { packing.remove(this); packingRows.getChildren().remove(root); });
            root.getStyleClass().add("session-planner-generated-reward");
            root.getChildren().setAll(new HBox(6, valid, up, down, remove), fields);
        }

        private SessionPlannerSelectedSceneSnapshot.Packing value() {
            return new SessionPlannerSelectedSceneSnapshot.Packing(
                    integer(lineId, 1), type.getText(), integer(count, 0), containerId.getText(), valid.isSelected());
        }
    }

    private static <T> void move(List<T> values, T value, int delta, VBox rows) {
        int from = values.indexOf(value);
        int to = from + delta;
        if (from < 0 || to < 0 || to >= values.size()) {
            return;
        }
        values.remove(from);
        values.add(to, value);
        javafx.scene.Node node = rows.getChildren().remove(from);
        rows.getChildren().add(to, node);
    }

    private static GridPane grid() {
        GridPane grid = new GridPane();
        grid.setHgap(8);
        grid.setVgap(5);
        return grid;
    }

    private static void row(GridPane grid, int row, String leftLabel, javafx.scene.Node left,
            String rightLabel, javafx.scene.Node right) {
        grid.add(new Label(leftLabel), 0, row);
        grid.add(left, 1, row);
        grid.add(new Label(rightLabel), 2, row);
        grid.add(right, 3, row);
        GridPane.setHgrow(left, Priority.ALWAYS);
        GridPane.setHgrow(right, Priority.ALWAYS);
    }

    private static Label section(String text) {
        Label label = new Label(text);
        label.getStyleClass().add("session-planner-plan-name");
        return label;
    }

    private static TextField field(String value) {
        TextField field = new TextField(value == null ? "" : value);
        field.setMaxWidth(Double.MAX_VALUE);
        return field;
    }

    private static long number(TextField field, long fallback) {
        try { return Math.max(0L, Long.parseLong(field.getText().trim())); }
        catch (NumberFormatException ignored) { return Math.max(0L, fallback); }
    }

    private static int integer(TextField field, int fallback) {
        return (int) Math.min(Integer.MAX_VALUE, number(field, fallback));
    }

    private static BigDecimal decimal(TextField field) {
        try { return new BigDecimal(field.getText().trim()).max(BigDecimal.ZERO); }
        catch (NumberFormatException ignored) { return BigDecimal.ZERO; }
    }
}
