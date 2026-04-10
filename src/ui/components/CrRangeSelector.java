package ui.components;

import java.util.List;
import java.util.function.BiConsumer;

/**
 * Compatibility seam for the legacy shared control entrypoint.
 * New shared control work belongs in {@code ui.components.control}.
 */
@SuppressWarnings("unused")
public class CrRangeSelector extends ui.components.control.CrRangeSelector {

    public CrRangeSelector(List<String> crValues, BiConsumer<String, String> onChange) {
        super(crValues, onChange);
    }
}
