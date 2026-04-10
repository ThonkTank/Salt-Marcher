package ui.components;

import java.util.List;
import java.util.function.Consumer;

/**
 * Compatibility seam for the legacy shared control entrypoint.
 * New shared control work belongs in {@code ui.components.control}.
 */
@SuppressWarnings("unused")
public class SearchableFilterButton extends ui.components.control.SearchableFilterButton {

    public SearchableFilterButton(String label, List<String> options, Consumer<List<String>> onChange) {
        super(label, options, onChange);
    }
}
