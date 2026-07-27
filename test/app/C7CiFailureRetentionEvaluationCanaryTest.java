package app;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

final class C7CiFailureRetentionEvaluationCanaryTest {
    @Test
    void retainsLiteralOrdinaryJUnitFailure() {
        assertEquals(
                "C7_EVAL_EXPECTED_VALUE",
                "C7_EVAL_ACTUAL_VALUE",
                "C7 evaluation deterministic ordinary JUnit failure");
    }
}
