package features.appshell.inspector;

import features.appshell.inspector.input.ComposeInspectorInput;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.ScrollPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.StackPane;
import javafx.scene.layout.VBox;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.function.Supplier;

/**
 * Clean shell-owned inspector with shared history-aware details navigation.
 */
@SuppressWarnings("unused")
public final class InspectorObject {

    private final ComposeInspectorInput.InspectorInput inspector;

    public InspectorObject(ComposeInspectorInput input) {
        ComposeInspectorInput resolvedInput = Objects.requireNonNull(input, "input");
        this.inspector = new InspectorAssembly(resolvedInput).composeInspector();
    }

    public ComposeInspectorInput.InspectorInput composeInspector(ComposeInspectorInput input) {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        return inspector;
    }

    private static final class InspectorAssembly {

        private final List<EntryModel> history = new ArrayList<>();
        private final Label titleLabel = new Label();
        private final Button backButton = new Button("\u2039");
        private final Button forwardButton = new Button("\u203a");
        private final Button closeButton = new Button("\u00d7");
        private final StackPane contentHost = new StackPane();
        private final VBox root = new VBox();
        private final VBox placeholder = createPlaceholder();
        private int historyIndex = -1;

        private InspectorAssembly(ComposeInspectorInput input) {
        }

        private ComposeInspectorInput.InspectorInput composeInspector() {
            root.setPrefWidth(380);
            root.setMinWidth(320);
            root.getStyleClass().add("inspector-pane");

            titleLabel.getStyleClass().add("bold");
            backButton.getStyleClass().addAll("compact", "flat");
            backButton.setAccessibleText("Zurueck");
            backButton.setOnAction(event -> goBack());

            forwardButton.getStyleClass().addAll("compact", "flat");
            forwardButton.setAccessibleText("Vorwaerts");
            forwardButton.setOnAction(event -> goForward());

            closeButton.getStyleClass().addAll("compact", "remove-btn");
            closeButton.setAccessibleText("Details schliessen");
            closeButton.setOnAction(event -> clear());

            Region spacer = new Region();
            HBox.setHgrow(spacer, Priority.ALWAYS);
            HBox header = new HBox(4, backButton, forwardButton, titleLabel, spacer, closeButton);
            header.setAlignment(Pos.CENTER_LEFT);
            header.setPadding(new Insets(4, 8, 4, 8));
            header.getStyleClass().add("stat-block-fixed-header");

            contentHost.getChildren().setAll(placeholder);
            ScrollPane scrollPane = new ScrollPane(contentHost);
            scrollPane.setFitToWidth(true);
            scrollPane.setHbarPolicy(ScrollPane.ScrollBarPolicy.NEVER);
            VBox.setVgrow(scrollPane, Priority.ALWAYS);

            root.getChildren().setAll(header, scrollPane);
            updateNavigationState();

            ComposeInspectorInput.NavigatorInput navigator = new ComposeInspectorInput.NavigatorInput(
                    this::showInfo,
                    this::showContent,
                    this::clear,
                    this::isShowing);
            return new ComposeInspectorInput.InspectorInput(root, navigator);
        }

        private void showInfo(ComposeInspectorInput.InfoEntryInput input) {
            if (input == null) {
                return;
            }
            String title = normalizeText(input.title());
            String message = normalizeText(input.message());
            if (title.isEmpty() || message.isEmpty()) {
                return;
            }
            openEntry(new EntryModel(
                    title,
                    input.entryKey(),
                    () -> {
                        Label label = new Label(message);
                        label.setWrapText(true);
                        VBox content = new VBox(10, label);
                        content.setPadding(new Insets(12));
                        return content;
                    }));
        }

        private void showContent(ComposeInspectorInput.HostedEntryInput input) {
            if (input == null) {
                return;
            }
            String title = normalizeText(input.title());
            Supplier<Node> contentSupplier = input.contentSupplier();
            if (title.isEmpty() || contentSupplier == null) {
                return;
            }
            openEntry(new EntryModel(title, input.entryKey(), contentSupplier));
        }

        private void clear() {
            historyIndex = -1;
            history.clear();
            showPlaceholder();
        }

        private boolean isShowing(Object entryKey) {
            if (historyIndex < 0 || historyIndex >= history.size()) {
                return false;
            }
            return Objects.equals(history.get(historyIndex).entryKey(), entryKey);
        }

        private void openEntry(EntryModel entry) {
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
            renderCurrentEntry();
        }

        private void removeDuplicateEntries(Object entryKey) {
            for (int index = history.size() - 1; index >= 0; index--) {
                if (!Objects.equals(history.get(index).entryKey(), entryKey)) {
                    continue;
                }
                history.remove(index);
                if (index <= historyIndex) {
                    historyIndex--;
                }
            }
        }

        private void goBack() {
            if (historyIndex <= 0) {
                return;
            }
            historyIndex--;
            renderCurrentEntry();
        }

        private void goForward() {
            if (historyIndex < 0 || historyIndex >= history.size() - 1) {
                return;
            }
            historyIndex++;
            renderCurrentEntry();
        }

        private void renderCurrentEntry() {
            if (historyIndex < 0 || historyIndex >= history.size()) {
                showPlaceholder();
                return;
            }
            EntryModel entry = history.get(historyIndex);
            titleLabel.setText(entry.title());
            Node content = entry.contentSupplier().get();
            contentHost.getChildren().setAll(content == null ? createErrorContent() : content);
            updateNavigationState();
        }

        private void showPlaceholder() {
            titleLabel.setText("Details");
            contentHost.getChildren().setAll(placeholder);
            updateNavigationState();
        }

        private void updateNavigationState() {
            backButton.setDisable(historyIndex <= 0);
            forwardButton.setDisable(historyIndex < 0 || historyIndex >= history.size() - 1);
            closeButton.setDisable(historyIndex < 0);
        }

        private static VBox createPlaceholder() {
            Label label = new Label("Keine Details ausgewaehlt");
            label.getStyleClass().add("text-muted");
            label.setWrapText(true);
            VBox placeholder = new VBox(label);
            placeholder.setPadding(new Insets(12));
            return placeholder;
        }

        private static Node createErrorContent() {
            Label label = new Label("Der Inspector-Inhalt konnte nicht geladen werden.");
            label.setWrapText(true);
            VBox content = new VBox(label);
            content.setPadding(new Insets(12));
            return content;
        }

        private static String normalizeText(String value) {
            return value == null ? "" : value.trim();
        }

        private record EntryModel(
                String title,
                Object entryKey,
                Supplier<Node> contentSupplier
        ) {
        }
    }
}
