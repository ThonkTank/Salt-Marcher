package clean.shell.inspector;

import clean.shell.inspector.input.ComposeInspectorInput;
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

/**
 * Clean shell-owned global inspector owner.
 */
@SuppressWarnings("unused")
public final class InspectorObject {

    private final ComposeInspectorInput.InspectorInput inspector;

    public InspectorObject(ComposeInspectorInput input) {
        ComposeInspectorInput resolvedInput = java.util.Objects.requireNonNull(input, "input");
        this.inspector = new InspectorAssembly(resolvedInput).composeInspector();
    }

    public ComposeInspectorInput.InspectorInput composeInspector(ComposeInspectorInput input) {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        return inspector;
    }

    private static final class InspectorAssembly {

        private final java.util.List<EntryModel> history = new java.util.ArrayList<>();
        private final Label titleLabel = new Label("Details");
        private final Button backButton = new Button("Zurueck");
        private final Button forwardButton = new Button("Vor");
        private final Button clearButton = new Button("Leeren");
        private final StackPane contentHost = new StackPane();
        private final VBox placeholder = createPlaceholder();
        private final VBox root = new VBox();
        private int historyIndex = -1;

        private InspectorAssembly(ComposeInspectorInput input) {
        }

        private ComposeInspectorInput.InspectorInput composeInspector() {
            titleLabel.getStyleClass().add("bold");
            backButton.getStyleClass().addAll("compact", "flat");
            forwardButton.getStyleClass().addAll("compact", "flat");
            clearButton.getStyleClass().addAll("compact", "remove-btn");
            backButton.setAccessibleText("Zurueck");
            forwardButton.setAccessibleText("Vorwaerts");
            clearButton.setAccessibleText("Details schliessen");

            Region spacer = new Region();
            HBox.setHgrow(spacer, Priority.ALWAYS);
            HBox header = new HBox(8, backButton, forwardButton, titleLabel, spacer, clearButton);
            header.setAlignment(Pos.CENTER_LEFT);
            header.getStyleClass().add("stat-block-fixed-header");

            contentHost.getChildren().setAll(placeholder);

            ScrollPane scrollPane = new ScrollPane(contentHost);
            scrollPane.setFitToWidth(true);
            scrollPane.setHbarPolicy(ScrollPane.ScrollBarPolicy.NEVER);
            VBox.setVgrow(scrollPane, Priority.ALWAYS);

            root.getStyleClass().add("inspector-pane");
            root.getChildren().setAll(header, scrollPane);

            backButton.setOnAction(event -> goBack());
            forwardButton.setOnAction(event -> goForward());
            clearButton.setOnAction(event -> clear());
            renderCurrentEntry();

            ComposeInspectorInput.NavigatorInput navigator = new ComposeInspectorInput.NavigatorInput(
                    this::showInfo,
                    this::showContent,
                    this::clear,
                    this::isShowing
            );
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
                        Label messageLabel = new Label(message);
                        messageLabel.getStyleClass().add("text-muted");
                        messageLabel.setWrapText(true);
                        VBox content = new VBox(12, messageLabel);
                        content.setPadding(new Insets(12));
                        return content;
                    }
            ));
        }

        private void showContent(ComposeInspectorInput.HostedEntryInput input) {
            if (input == null) {
                return;
            }
            String title = normalizeText(input.title());
            if (title.isEmpty() || input.contentSupplier() == null) {
                return;
            }
            openEntry(new EntryModel(title, input.entryKey(), input.contentSupplier()));
        }

        private void clear() {
            history.clear();
            historyIndex = -1;
            renderCurrentEntry();
        }

        private boolean isShowing(Object entryKey) {
            if (historyIndex < 0 || historyIndex >= history.size()) {
                return false;
            }
            return java.util.Objects.equals(history.get(historyIndex).entryKey(), entryKey);
        }

        private void openEntry(EntryModel entry) {
            if (historyIndex >= 0
                    && historyIndex < history.size()
                    && java.util.Objects.equals(history.get(historyIndex).entryKey(), entry.entryKey())) {
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
                if (!java.util.Objects.equals(history.get(index).entryKey(), entryKey)) {
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
                titleLabel.setText("Details");
                contentHost.getChildren().setAll(placeholder);
                updateNavigationState();
                return;
            }
            EntryModel entry = history.get(historyIndex);
            titleLabel.setText(entry.title());
            Node content = entry.contentSupplier().get();
            contentHost.getChildren().setAll(content == null ? placeholder : content);
            updateNavigationState();
        }

        private void updateNavigationState() {
            backButton.setDisable(historyIndex <= 0);
            forwardButton.setDisable(historyIndex < 0 || historyIndex >= history.size() - 1);
            clearButton.setDisable(historyIndex < 0);
        }

        private static VBox createPlaceholder() {
            Label placeholderLabel = new Label("Keine Details ausgewaehlt");
            placeholderLabel.getStyleClass().add("text-muted");
            placeholderLabel.setWrapText(true);
            VBox placeholder = new VBox(placeholderLabel);
            placeholder.setPadding(new Insets(12));
            return placeholder;
        }

        private static String normalizeText(String value) {
            return value == null ? "" : value.trim();
        }

        private record EntryModel(
                String title,
                Object entryKey,
                java.util.function.Supplier<Node> contentSupplier
        ) {
        }
    }
}
