package src.view.slotcontent.controls.searchfilter;

import java.util.List;

public record SearchFilterControlsViewInputEvent(
        String searchQuery,
        List<SelectedFilter> selectedFilters
) {

    public SearchFilterControlsViewInputEvent {
        searchQuery = searchQuery == null ? "" : searchQuery;
        selectedFilters = selectedFilters == null ? List.of() : List.copyOf(selectedFilters);
    }

    public record SelectedFilter(String groupKey, String optionKey) {

        public SelectedFilter {
            groupKey = groupKey == null ? "" : groupKey;
            optionKey = optionKey == null ? "" : optionKey;
        }
    }
}
