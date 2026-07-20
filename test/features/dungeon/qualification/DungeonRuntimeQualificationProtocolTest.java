package features.dungeon.qualification;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

final class DungeonRuntimeQualificationProtocolTest {

    @Test
    void usesFixedTwentyPlusOneHundredAlternatingInputsAndNearestRankHistogram() {
        List<Integer> inputs = new ArrayList<>();
        var histogram = DungeonRuntimeQualificationProtocol.measureAlternating(inputs::add);

        assertEquals(120, inputs.size());
        assertEquals(100, histogram.samples().size());
        for (int index = 0; index < inputs.size(); index++) {
            assertEquals(index < 20 ? index : index - 20, inputs.get(index));
        }
    }

    @Test
    void runsPreparationOutsideEveryMeasuredSample() {
        List<String> events = new ArrayList<>();
        var histogram = DungeonRuntimeQualificationProtocol.measureAlternating(
                index -> events.add("prepare-" + index),
                index -> events.add("input-" + index));

        assertEquals(240, events.size());
        assertEquals(100, histogram.samples().size());
        for (int index = 0; index < events.size(); index += 2) {
            int invocation = index / 2;
            int sample = invocation < 20 ? invocation : invocation - 20;
            assertEquals("prepare-" + sample, events.get(index));
            assertEquals("input-" + sample, events.get(index + 1));
        }
    }
}
