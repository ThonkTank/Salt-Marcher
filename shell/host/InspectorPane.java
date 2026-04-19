package shell.host;

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
import org.jspecify.annotations.Nullable;
import java.util.Objects;
import java.util.function.Supplier;
import shell.api.InspectorEntrySpec;
import shell.api.InspectorSink;

/**
 * Top-right shared history-aware inspector for read-mostly detail content.
 */
final class InspectorPane extends VBox implements InspectorSink {

    private final Label detailTitle = new Label();
    private final VBox detailContent = new VBox();
    private final ScrollPane detailScroll = new ScrollPane(detailContent);
    private final VBox footerHost = new VBox();
    private final Label placeholder = new Label("Keine Details ausgewählt");
    private final Node placeholderHost = ShellContentLayout.shellOwned(placeholder);
    private final Button backBtn = new Button("\u2039");
    private final Button forwardBtn = new Button("\u203a");
    private final Button closeBtn = new Button("\u00d7");

    private final InspectorHistory history = new InspectorHistory();

    InspectorPane() {
        setPrefWidth(380);
        setMinWidth(320);
        getStyleClass().add("surface-root");
        setMinHeight(0);
        setMaxSize(Double.MAX_VALUE, Double.MAX_VALUE);

        ShellFx.addStyleClass(detailTitle, "bold");
        ShellFx.addChild(this, createHeader());

        detailScroll.setFitToWidth(true);
        detailScroll.setHbarPolicy(ScrollPane.ScrollBarPolicy.NEVER);
        ShellContentLayout.makeShrinkable(detailScroll);
        ShellContentLayout.makeShrinkable(detailContent);
        setVgrow(detailScroll, Priority.ALWAYS);

        ShellFx.addStyleClass(footerHost, "inspector-footer-host");
        footerHost.setVisible(false);
        footerHost.setManaged(false);
        ShellContentLayout.makeShrinkable(footerHost);

        ShellFx.addStyleClass(placeholder, "text-muted");
        placeholder.setMaxWidth(Double.MAX_VALUE);
        placeholder.setWrapText(true);

        ShellFx.addChildren(this, detailScroll, footerHost);
        showPlaceholder();
    }

    @Override
    public void push(InspectorEntrySpec entry) {
        if (history.open(entry)) {
            renderState();
        }
    }

    @Override
    public void clear() {
        history.clear();
        renderState();
    }

    @Override
    public boolean isShowing(Object entryKey) {
        return history.isShowing(entryKey);
    }

    private void renderState() {
        updateNavigationState();
        InspectorHistory.Entry entry = history.currentEntry();
        if (history.placeholderVisible() || entry == null) {
            showPlaceholder();
            return;
        }
        Node content = Objects.requireNonNull(
                safeNode(entry.contentSupplier(), "Details konnten nicht geladen werden."),
                "Inspector content");
        Node footer = entry.footerSupplier() == null ? null : safeNode(entry.footerSupplier(), null);
        showState(entry.title(), content, footer);
    }

    @SuppressWarnings("PMD.AvoidCatchingGenericException")
    private @Nullable Node safeNode(Supplier<Node> supplier, @Nullable String fallbackText) {
        try {
            Node node = supplier.get();
            if (node != null) {
                return node;
            }
        } catch (RuntimeException ignored) {
            // The shell should stay passive and resilient if a view publishes invalid content.
        }
        if (fallbackText == null) {
            return null;
        }
        Label label = new Label(fallbackText);
        ShellFx.addStyleClass(label, "text-muted");
        label.setWrapText(true);
        VBox box = new VBox(label);
        box.setPadding(new Insets(12));
        return box;
    }

    private void showState(String title, Node content, @Nullable Node footer) {
        detailTitle.setText(title);
        ShellFx.clearChildren(detailContent);
        ShellFx.addChild(detailContent, ShellContentLayout.shellOwned(content));
        detailScroll.setContent(detailContent);

        ShellFx.clearChildren(footerHost);
        if (footer != null) {
            ShellFx.addChild(footerHost, ShellContentLayout.shellOwned(footer));
            footerHost.setVisible(true);
            footerHost.setManaged(true);
        } else {
            footerHost.setVisible(false);
            footerHost.setManaged(false);
        }
    }

    private void showPlaceholder() {
        detailTitle.setText("");
        ShellFx.setChildren(detailContent, placeholderHost);
        detailScroll.setContent(detailContent);
        ShellFx.clearChildren(footerHost);
        footerHost.setVisible(false);
        footerHost.setManaged(false);
    }

    private void updateNavigationState() {
        backBtn.setDisable(!history.canGoBack());
        forwardBtn.setDisable(!history.canGoForward());
        closeBtn.setDisable(history.placeholderVisible());
    }

    private HBox createHeader() {
        ShellFx.addStyleClasses(backBtn, "compact", "flat");
        backBtn.setAccessibleText("Zurück");
        backBtn.setOnAction(event -> {
            history.goBack();
            renderState();
        });

        ShellFx.addStyleClasses(forwardBtn, "compact", "flat");
        forwardBtn.setAccessibleText("Vorwärts");
        forwardBtn.setOnAction(event -> {
            history.goForward();
            renderState();
        });

        ShellFx.addStyleClasses(closeBtn, "compact", "remove-btn");
        closeBtn.setAccessibleText("Details schliessen");
        closeBtn.setOnAction(event -> {
            history.clear();
            renderState();
        });

        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);

        HBox detailHeader = new HBox(4, backBtn, forwardBtn, detailTitle, spacer, closeBtn);
        detailHeader.setAlignment(Pos.CENTER_LEFT);
        detailHeader.setPadding(new Insets(4, 8, 4, 8));
        ShellFx.addStyleClass(detailHeader, "stat-block-fixed-header");
        return detailHeader;
    }
}
