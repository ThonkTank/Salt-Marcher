package shell.panel;

import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.ScrollPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;
import shell.host.InspectorEntrySpec;
import shell.host.InspectorSink;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.function.Supplier;

/**
 * Top-right shared history-aware inspector for read-mostly detail content.
 */
public class InspectorPane extends VBox implements InspectorSink {

    private final Label detailTitle = new Label();
    private final VBox detailContent = new VBox();
    private final ScrollPane detailScroll = new ScrollPane(detailContent);
    private final VBox footerHost = new VBox();
    private final Label placeholder = new Label("Keine Details ausgewählt");
    private final Button backBtn = new Button("\u2039");
    private final Button forwardBtn = new Button("\u203a");
    private final Button closeBtn = new Button("\u00d7");

    private final List<HistoryEntry> history = new ArrayList<>();
    private int historyIndex = -1;
    private boolean placeholderVisible = true;

    public InspectorPane() {
        setPrefWidth(380);
        setMinWidth(320);
        getStyleClass().add("inspector-pane");

        detailTitle.getStyleClass().add("bold");

        backBtn.getStyleClass().addAll("compact", "flat");
        backBtn.setAccessibleText("Zurück");
        backBtn.setOnAction(event -> goBack());

        forwardBtn.getStyleClass().addAll("compact", "flat");
        forwardBtn.setAccessibleText("Vorwärts");
        forwardBtn.setOnAction(event -> goForward());

        closeBtn.getStyleClass().addAll("compact", "remove-btn");
        closeBtn.setAccessibleText("Details schliessen");
        closeBtn.setOnAction(event -> hideCurrent());

        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);

        HBox detailHeader = new HBox(4, backBtn, forwardBtn, detailTitle, spacer, closeBtn);
        detailHeader.setAlignment(Pos.CENTER_LEFT);
        detailHeader.setPadding(new Insets(4, 8, 4, 8));
        detailHeader.getStyleClass().add("stat-block-fixed-header");

        detailScroll.setFitToWidth(true);
        detailScroll.setHbarPolicy(ScrollPane.ScrollBarPolicy.NEVER);
        VBox.setVgrow(detailScroll, Priority.ALWAYS);

        footerHost.getStyleClass().add("inspector-footer-host");
        footerHost.setVisible(false);
        footerHost.setManaged(false);

        placeholder.getStyleClass().add("text-muted");
        placeholder.setMaxWidth(Double.MAX_VALUE);
        placeholder.setWrapText(true);

        getChildren().addAll(detailHeader, detailScroll, footerHost);
        showPlaceholder();
    }

    @Override
    public void push(InspectorEntrySpec entry) {
        if (entry == null || entry.title() == null || entry.title().isBlank() || entry.contentSupplier() == null) {
            return;
        }
        HistoryEntry historyEntry = new HistoryEntry(
                entry.title(),
                entry.entryKey(),
                entry.contentSupplier(),
                entry.footerSupplier());
        if (!placeholderVisible && isCurrentEntry(historyEntry)) {
            hideCurrent();
            return;
        }
        openEntry(historyEntry);
    }

    @Override
    public void clear() {
        hideCurrent();
    }

    @Override
    public boolean isShowing(Object entryKey) {
        if (placeholderVisible || historyIndex < 0 || historyIndex >= history.size()) {
            return false;
        }
        return Objects.equals(history.get(historyIndex).entryKey(), entryKey);
    }

    private void openEntry(HistoryEntry entry) {
        if (historyIndex >= 0
                && historyIndex < history.size()
                && Objects.equals(history.get(historyIndex).entryKey(), entry.entryKey())) {
            history.set(historyIndex, entry);
        } else {
            if (historyIndex < history.size() - 1) {
                history.subList(historyIndex + 1, history.size()).clear();
            }
            removeDuplicateEntries(entry.entryKey());
            history.add(entry);
            historyIndex = history.size() - 1;
        }
        placeholderVisible = false;
        renderCurrentEntry();
    }

    private void removeDuplicateEntries(Object entryKey) {
        for (int i = history.size() - 1; i >= 0; i--) {
            if (!Objects.equals(history.get(i).entryKey(), entryKey)) {
                continue;
            }
            history.remove(i);
            if (i <= historyIndex) {
                historyIndex--;
            }
        }
    }

    private void goBack() {
        if (historyIndex <= 0) {
            return;
        }
        historyIndex--;
        placeholderVisible = false;
        renderCurrentEntry();
    }

    private void goForward() {
        if (historyIndex < 0 || historyIndex >= history.size() - 1) {
            return;
        }
        historyIndex++;
        placeholderVisible = false;
        renderCurrentEntry();
    }

    private void hideCurrent() {
        placeholderVisible = true;
        renderCurrentEntry();
    }

    private boolean isCurrentEntry(HistoryEntry candidate) {
        return historyIndex >= 0
                && historyIndex < history.size()
                && history.get(historyIndex).sameEntry(candidate);
    }

    private void renderCurrentEntry() {
        updateNavigationState();
        if (placeholderVisible || historyIndex < 0 || historyIndex >= history.size()) {
            showPlaceholder();
            return;
        }

        HistoryEntry entry = history.get(historyIndex);
        Node content = safeNode(entry.contentSupplier(), "Details konnten nicht geladen werden.");
        Node footer = entry.footerSupplier() == null ? null : safeNode(entry.footerSupplier(), null);
        showEntry(entry.title(), content, footer);
    }

    private Node safeNode(Supplier<Node> supplier, String fallbackText) {
        try {
            Node node = supplier.get();
            if (node != null) {
                return node;
            }
        } catch (RuntimeException ignored) {
            // The shell should stay passive and resilient if a view publishes invalid content.
        }
        return fallbackText == null ? null : fallbackNode(fallbackText);
    }

    private void showEntry(String title, Node content, Node footer) {
        detailTitle.setText(title);
        detailContent.getChildren().setAll(content);
        detailScroll.setContent(detailContent);

        footerHost.getChildren().clear();
        if (footer != null) {
            footerHost.getChildren().add(footer);
            footerHost.setVisible(true);
            footerHost.setManaged(true);
        } else {
            footerHost.setVisible(false);
            footerHost.setManaged(false);
        }
    }

    private void showPlaceholder() {
        detailTitle.setText("");
        detailContent.getChildren().setAll(placeholder);
        detailScroll.setContent(detailContent);
        footerHost.getChildren().clear();
        footerHost.setVisible(false);
        footerHost.setManaged(false);
    }

    private void updateNavigationState() {
        backBtn.setDisable(historyIndex <= 0);
        forwardBtn.setDisable(historyIndex < 0 || historyIndex >= history.size() - 1);
        closeBtn.setDisable(placeholderVisible);
    }

    private static Node fallbackNode(String message) {
        Label label = new Label(message);
        label.getStyleClass().add("text-muted");
        label.setWrapText(true);
        VBox box = new VBox(label);
        box.setPadding(new Insets(12));
        return box;
    }

    private record HistoryEntry(
            String title,
            Object entryKey,
            Supplier<Node> contentSupplier,
            Supplier<Node> footerSupplier
    ) {
        private boolean sameEntry(HistoryEntry other) {
            return other != null && Objects.equals(entryKey, other.entryKey);
        }
    }
}
