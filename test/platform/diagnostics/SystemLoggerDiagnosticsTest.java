package platform.diagnostics;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

final class SystemLoggerDiagnosticsTest {

    @Test
    void emitsOnlyStableIdAndFailureType() {
        List<String> messages = new ArrayList<>();
        SystemLoggerDiagnostics diagnostics = new SystemLoggerDiagnostics(messages::add);
        String sensitive = "/home/user/game.db secret authored SQL";

        diagnostics.failure(new DiagnosticId("worldplanner.load-failure"),
                new IllegalStateException(sensitive).getClass());

        assertTrue(messages.getFirst().contains("worldplanner.load-failure"));
        assertTrue(messages.getFirst().contains(IllegalStateException.class.getName()));
        assertFalse(messages.getFirst().contains(sensitive));
    }
}
