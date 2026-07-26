package app;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

final class CampaignDeskHostReadinessTest {

    @Test
    void positiveBoundsCannotAdmitPublicationBeforeSecondPulse() {
        CampaignDeskHost.PublishedRootReadiness readiness =
                new CampaignDeskHost.PublishedRootReadiness();

        assertFalse(readiness.completion().toCompletableFuture().isDone());
        assertFalse(readiness.observePulse(true, true));
        assertFalse(readiness.completion().toCompletableFuture().isDone(),
                "one positive pulse must remain insufficient");

        assertTrue(readiness.observePulse(true, true));
        assertTrue(readiness.completion().toCompletableFuture().isDone());
        readiness.completion().toCompletableFuture().join();
    }

    @Test
    void falseThenTrueStillNeedsAnotherConsecutivePositivePulse() {
        CampaignDeskHost.PublishedRootReadiness readiness =
                new CampaignDeskHost.PublishedRootReadiness();

        assertFalse(readiness.observePulse(false, true));
        assertFalse(readiness.observePulse(true, true));
        assertFalse(readiness.completion().toCompletableFuture().isDone());
    }

    @Test
    void interruptedPositivePulseSequenceRestartsAtZero() {
        CampaignDeskHost.PublishedRootReadiness readiness =
                new CampaignDeskHost.PublishedRootReadiness();

        assertFalse(readiness.observePulse(true, true));
        assertFalse(readiness.observePulse(false, false));
        assertFalse(readiness.observePulse(true, true));
        assertFalse(readiness.completion().toCompletableFuture().isDone());
        assertTrue(readiness.observePulse(true, true));
        assertTrue(readiness.completion().toCompletableFuture().isDone());
        readiness.completion().toCompletableFuture().join();
    }
}
