package app;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

final class C7CiFailureRetentionCanaryTest {
    @Test
    void retainsLiteralOrdinaryJUnitFailure() {
        assertEquals(
                "C7_EXPECTED_VALUE",
                "C7_ACTUAL_VALUE",
                "C7_FAKE_CREDENTIAL_SENTINEL_DO_NOT_RETAIN_91A7F0C4");
    }
}
