package platform.ui.searchfilter;

import java.util.List;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;

public final class SearchFilterControlsContentModel {

    private final ReadOnlyObjectWrapper<Projection> projection =
            new ReadOnlyObjectWrapper<>(Projection.empty());

    public ReadOnlyObjectProperty<Projection> projectionProperty() {
        return projection.getReadOnlyProperty();
    }

    public void applyProjection(Projection nextProjection) {
        projection.set(nextProjection == null ? Projection.empty() : nextProjection);
    }

    public record Projection(
            String searchPrompt,
            String searchQuery,
            List<FilterGroup> groups,
            List<FilterChip> chips
    ) {

        public Projection {
            searchPrompt = text(searchPrompt);
            searchQuery = text(searchQuery);
            groups = groups == null ? List.of() : List.copyOf(groups);
            chips = chips == null ? List.of() : List.copyOf(chips);
        }

        public static Projection empty() {
            return new Projection("Suchen", "", List.of(), List.of());
        }
    }

    public record FilterGroup(String key, String label, List<FilterOption> options) {

        public FilterGroup {
            key = text(key);
            label = text(label);
            options = options == null ? List.of() : List.copyOf(options);
        }
    }

    public record FilterOption(String key, String label, boolean selected) {

        public FilterOption {
            key = text(key);
            label = text(label);
        }
    }

    public record FilterChip(String groupKey, String optionKey, String label) {

        public FilterChip {
            groupKey = text(groupKey);
            optionKey = text(optionKey);
            label = text(label);
        }
    }

    private static String text(String value) {
        return value == null ? "" : value;
    }
}
