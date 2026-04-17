package shell.host;

import org.jspecify.annotations.Nullable;
import shell.host.InspectorHistory.Entry;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

final class InspectorEntryTrail {

    private final List<Entry> entries = new ArrayList<>();
    private int currentIndex = -1;

    void replaceOrAppend(Entry entry) {
        Entry current = currentEntry();
        if (current != null && Objects.equals(current.entryKey(), entry.entryKey())) {
            entries.set(currentIndex, entry);
            return;
        }
        trimFutureEntries();
        removeDuplicateEntries(entry.entryKey());
        entries.add(entry);
        currentIndex = entries.size() - 1;
    }

    void goBack() {
        if (currentIndex > 0) {
            currentIndex--;
        }
    }

    void goForward() {
        if (currentIndex >= 0 && currentIndex < entries.size() - 1) {
            currentIndex++;
        }
    }

    boolean canGoBack() {
        return currentIndex > 0;
    }

    boolean canGoForward() {
        return currentIndex >= 0 && currentIndex < entries.size() - 1;
    }

    @Nullable Entry currentEntry() {
        if (currentIndex < 0 || currentIndex >= entries.size()) {
            return null;
        }
        return entries.get(currentIndex);
    }

    private void trimFutureEntries() {
        if (currentIndex < entries.size() - 1) {
            entries.subList(currentIndex + 1, entries.size()).clear();
        }
    }

    private void removeDuplicateEntries(Object entryKey) {
        for (int index = entries.size() - 1; index >= 0; index--) {
            if (!Objects.equals(entries.get(index).entryKey(), entryKey)) {
                continue;
            }
            entries.remove(index);
            if (index <= currentIndex) {
                currentIndex--;
            }
        }
    }
}
