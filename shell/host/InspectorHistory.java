package shell.host;

import javafx.scene.Node;
import org.jspecify.annotations.Nullable;
import java.util.Objects;
import java.util.function.Supplier;
import shell.api.InspectorEntrySpec;

final class InspectorHistory {

    private final InspectorEntryTrail trail = new InspectorEntryTrail();
    private boolean placeholderVisible = true;

    boolean open(InspectorEntrySpec spec) {
        if (!isValid(spec)) {
            return false;
        }
        Entry entry = new Entry(spec.title(), spec.entryKey(), spec.contentSupplier(), spec.footerSupplier());
        if (!placeholderVisible && isCurrentEntry(entry)) {
            placeholderVisible = true;
            return true;
        }
        trail.replaceOrAppend(entry);
        placeholderVisible = false;
        return true;
    }

    void clear() {
        placeholderVisible = true;
    }

    boolean isShowing(Object entryKey) {
        return currentEntry() != null && Objects.equals(currentEntry().entryKey(), entryKey);
    }

    void goBack() {
        trail.goBack();
        placeholderVisible = false;
    }

    void goForward() {
        trail.goForward();
        placeholderVisible = false;
    }

    boolean placeholderVisible() {
        return placeholderVisible || currentEntry() == null;
    }

    boolean canGoBack() {
        return trail.canGoBack();
    }

    boolean canGoForward() {
        return trail.canGoForward();
    }

    @Nullable Entry currentEntry() {
        return trail.currentEntry();
    }

    private boolean isCurrentEntry(Entry candidate) {
        Entry current = currentEntry();
        return current != null && Objects.equals(current.entryKey(), candidate.entryKey());
    }

    private static boolean isValid(@Nullable InspectorEntrySpec spec) {
        return spec != null
                && spec.title() != null
                && !spec.title().isBlank()
                && spec.contentSupplier() != null;
    }

    record Entry(
            String title,
            Object entryKey,
            Supplier<Node> contentSupplier,
            @Nullable Supplier<Node> footerSupplier
    ) {
    }
}
