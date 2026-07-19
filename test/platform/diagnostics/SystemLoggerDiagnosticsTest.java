package platform.diagnostics;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

final class SystemLoggerDiagnosticsTest {

    @Test
    void emitsOnlyStableIdAndFailureType() {
        List<String> messages = new ArrayList<>();
        List<String> measurements = new ArrayList<>();
        SystemLoggerDiagnostics diagnostics = new SystemLoggerDiagnostics(messages::add, measurements::add);
        String sensitive = "/home/user/game.db secret authored SQL";

        diagnostics.failure(new DiagnosticId("worldplanner.load-failure"),
                new IllegalStateException(sensitive).getClass());

        assertTrue(messages.getFirst().contains("worldplanner.load-failure"));
        assertTrue(messages.getFirst().contains(IllegalStateException.class.getName()));
        assertFalse(messages.getFirst().contains(sensitive));
        assertTrue(measurements.isEmpty(), "failures must not enter the measurement sink");
    }

    @Test
    void emitsMeasurementsAtTheSeparateNonWarningSink() {
        List<String> warnings = new ArrayList<>();
        List<String> measurements = new ArrayList<>();
        SystemLoggerDiagnostics diagnostics = new SystemLoggerDiagnostics(warnings::add, measurements::add);

        diagnostics.measurement(new Measurement(
                new DiagnosticId("sessionplanner.preparation.party-read"), 7L, 42L, 4, 1));

        assertTrue(warnings.isEmpty(), "normal stage measurements must not flood warning logs");
        assertEquals(1, measurements.size());
        assertTrue(measurements.getFirst().contains("sessionplanner.preparation.party-read"));
        assertTrue(measurements.getFirst().contains("operation=7"));
        assertTrue(measurements.getFirst().contains("durationNanos=42"));
        assertTrue(measurements.getFirst().contains("cardinality=4"));
        assertTrue(measurements.getFirst().contains("queryCount=1"));
    }

    @Test
    void measurementRejectsNegativeOrUnboundedValues() {
        DiagnosticId id = new DiagnosticId("sessionplanner.workspace.assembly");
        assertThrows(IllegalArgumentException.class, () -> new Measurement(id, -1L, 0L, 0, 0));
        assertThrows(IllegalArgumentException.class, () -> new Measurement(id, 1L, -1L, 0, 0));
        assertThrows(IllegalArgumentException.class, () -> new Measurement(id, 1L, 0L, -1, 0));
        assertThrows(IllegalArgumentException.class, () -> new Measurement(id, 1L, 0L, 0, -1));
        assertThrows(IllegalArgumentException.class, () -> new Measurement(id, 1L, 0L, 1_000_001, 0));
    }
}
