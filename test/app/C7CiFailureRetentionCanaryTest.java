package app;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

final class C7CiFailureRetentionCanaryTest {
    @Test
    void retainsLiteralOrdinaryJUnitFailure() {
        assertEquals(
                "C7_EXPECTED_VALUE",
                "C7_ACTUAL_VALUE",
                "C7 deterministic ordinary JUnit failure");
    }
}
