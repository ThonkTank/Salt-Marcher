package features.catalog.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import features.catalog.application.CatalogApplicationRoutes.EncounterHandoff;
import features.encounter.api.EncounterPoolFilters;
import features.encounter.api.OpenSavedEncounterPlanResult;
import features.encounter.api.SavedEncounterPlanListModel;
import features.encounter.api.SavedEncounterPlanListResult;
import features.encounter.api.SavedEncounterPlanStatus;
import features.encounter.api.SavedEncounterPlanSummary;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.function.Consumer;
import org.junit.jupiter.api.Test;
import platform.ui.DirectUiDispatcher;

final class SavedEncounterCatalogControllerTest {

    @Test
    void subscriptionIsCurrentFirstBalancedAndPreservesStableSelection() {
        PlanSource source = new PlanSource(plans(plan(1L, "One"), plan(2L, "Two")));
        RecordingEncounter encounter = new RecordingEncounter();
        SavedEncounterCatalogController controller = controller(source, encounter);

        controller.activate();
        assertEquals(1, source.subscriptions);
        assertEquals(1, source.activeSubscriptions);
        assertEquals(List.of(1L, 2L), ids(controller));
        controller.accept(new SavedEncounterCatalogIntent.SelectPlan(2L));
        source.publish(plans(plan(2L, "Two renamed"), plan(3L, "Three")));
        assertEquals(2L, controller.state().selectedPlanId());
        source.publish(plans(plan(3L, "Three")));
        assertEquals(0L, controller.state().selectedPlanId());

        controller.deactivate();
        assertEquals(0, source.activeSubscriptions);
        source.publish(plans(plan(99L, "Late")));
        assertEquals(List.of(3L), ids(controller));
        controller.activate();
        assertEquals(2, source.subscriptions);
        assertEquals(1, source.activeSubscriptions);
        controller.close();
        assertEquals(0, source.activeSubscriptions);
    }

    @Test
    void providerAloneRequestsConfirmationAndConfirmRunsExactlyOnce() {
        PlanSource source = new PlanSource(plans(plan(7L, "Seven")));
        RecordingEncounter encounter = new RecordingEncounter();
        SavedEncounterCatalogController controller = controller(source, encounter);
        controller.activate();
        controller.accept(new SavedEncounterCatalogIntent.SelectPlan(7L));
        controller.accept(new SavedEncounterCatalogIntent.OpenPlan(7L));
        assertEquals(List.of(new OpenCall(7L, false)), encounter.calls());

        encounter.requests.getFirst().future.complete(new OpenSavedEncounterPlanResult(
                OpenSavedEncounterPlanResult.Status.CONFIRMATION_REQUIRED, 7L, "Discard?"));
        SavedEncounterCatalogState.Confirmation pending = controller.state().confirmation();
        assertTrue(pending.required());
        SavedEncounterCatalogIntent.ConfirmOpen confirm =
                new SavedEncounterCatalogIntent.ConfirmOpen(pending.revision(), pending.planId());
        controller.accept(confirm);
        controller.accept(confirm);
        assertEquals(List.of(new OpenCall(7L, false), new OpenCall(7L, true)), encounter.calls());
        assertFalse(controller.state().confirmation().required());
        encounter.requests.get(1).future.complete(new OpenSavedEncounterPlanResult(
                OpenSavedEncounterPlanResult.Status.OPENED, 7L, "Opened"));
        assertEquals("Opened", controller.state().actionMessage());
    }

    @Test
    void cancelNewOpenAndLifecycleInvalidatePendingOrLateResults() {
        PlanSource source = new PlanSource(plans(plan(5L, "Five")));
        RecordingEncounter encounter = new RecordingEncounter();
        SavedEncounterCatalogController controller = controller(source, encounter);
        controller.activate();
        controller.accept(new SavedEncounterCatalogIntent.SelectPlan(5L));
        controller.accept(new SavedEncounterCatalogIntent.OpenPlan(5L));
        PendingOpen first = encounter.requests.getFirst();
        controller.accept(new SavedEncounterCatalogIntent.OpenPlan(5L));
        PendingOpen newer = encounter.requests.getLast();
        first.future.complete(new OpenSavedEncounterPlanResult(
                OpenSavedEncounterPlanResult.Status.CONFIRMATION_REQUIRED, 5L, "Stale"));
        assertFalse(controller.state().confirmation().required());
        newer.future.complete(new OpenSavedEncounterPlanResult(
                OpenSavedEncounterPlanResult.Status.CONFIRMATION_REQUIRED, 5L, "Current"));
        SavedEncounterCatalogState.Confirmation pending = controller.state().confirmation();
        assertTrue(pending.required());
        controller.accept(new SavedEncounterCatalogIntent.CancelOpen(pending.revision(), pending.planId()));
        assertFalse(controller.state().confirmation().required());

        controller.accept(new SavedEncounterCatalogIntent.OpenPlan(5L));
        PendingOpen postDeactivate = encounter.requests.getLast();
        controller.deactivate();
        postDeactivate.future.complete(new OpenSavedEncounterPlanResult(
                OpenSavedEncounterPlanResult.Status.CONFIRMATION_REQUIRED, 5L, "Late"));
        assertFalse(controller.state().confirmation().required());
    }

    private static SavedEncounterCatalogController controller(PlanSource source, RecordingEncounter encounter) {
        return new SavedEncounterCatalogController(
                new SavedEncounterPlanListModel(source::current, source::subscribe), encounter,
                DirectUiDispatcher.INSTANCE, () -> { });
    }

    private static List<Long> ids(SavedEncounterCatalogController controller) {
        return controller.state().results().rows().stream().map(SavedEncounterPlanSummary::planId).toList();
    }

    private static SavedEncounterPlanSummary plan(long id, String name) {
        return new SavedEncounterPlanSummary(id, name, "Summary");
    }

    private static SavedEncounterPlanListResult plans(SavedEncounterPlanSummary... plans) {
        return new SavedEncounterPlanListResult(
                SavedEncounterPlanStatus.SUCCESS, List.of(plans), "");
    }

    private static final class PlanSource {
        private SavedEncounterPlanListResult current;
        private Consumer<SavedEncounterPlanListResult> listener = ignored -> { };
        private int subscriptions;
        private int activeSubscriptions;

        private PlanSource(SavedEncounterPlanListResult current) {
            this.current = current;
        }

        private SavedEncounterPlanListResult current() {
            return current;
        }

        private Runnable subscribe(Consumer<SavedEncounterPlanListResult> next) {
            subscriptions++;
            activeSubscriptions++;
            listener = next;
            return () -> {
                activeSubscriptions--;
                listener = ignored -> { };
            };
        }

        private void publish(SavedEncounterPlanListResult next) {
            current = next;
            listener.accept(next);
        }
    }

    private static final class RecordingEncounter implements EncounterHandoff {
        private final List<PendingOpen> requests = new ArrayList<>();

        private List<OpenCall> calls() {
            return requests.stream().map(request -> request.call).toList();
        }

        @Override public CompletionStage<OpenSavedEncounterPlanResult> openSavedEncounter(
                long planId,
                boolean discardUnsavedChanges
        ) {
            CompletableFuture<OpenSavedEncounterPlanResult> future = new CompletableFuture<>();
            requests.add(new PendingOpen(new OpenCall(planId, discardUnsavedChanges), future));
            return future;
        }

        @Override public void updatePoolFilters(EncounterPoolFilters filters) { }
        @Override public void addCreature(long creatureId) { }
        @Override public void addWorldNpc(long creatureId, long npcId) { }
        @Override public void useFactionSource(long factionId) { }
        @Override public void useLocationSource(long locationId) { }
        @Override public void useEncounterTableSource(long tableId) { }
    }

    private record OpenCall(long planId, boolean discard) {
    }

    private record PendingOpen(OpenCall call, CompletableFuture<OpenSavedEncounterPlanResult> future) {
    }
}
