package ui.components;

import javafx.util.StringConverter;

import java.util.function.Function;

/**
 * Compatibility seam for the legacy shared control entrypoint.
 * New shared control work belongs in {@code ui.components.control}.
 */
@SuppressWarnings("unused")
public class SliderControl extends ui.components.control.SliderControl {

    public SliderControl(
            String title,
            double min,
            double max,
            double defaultVal,
            boolean snapToTicks,
            String tooltip,
            StringConverter<Double> labelFormatter,
            Function<Double, String> valueLabelFormatter
    ) {
        super(title, min, max, defaultVal, snapToTicks, tooltip, labelFormatter, valueLabelFormatter);
    }

    public SliderControl(
            String title,
            double min,
            double max,
            double defaultVal,
            boolean snapToTicks,
            String tooltip,
            StringConverter<Double> labelFormatter,
            Function<Double, String> valueLabelFormatter,
            Double majorTickUnitOverride
    ) {
        super(title, min, max, defaultVal, snapToTicks, tooltip, labelFormatter, valueLabelFormatter,
                majorTickUnitOverride);
    }
}
