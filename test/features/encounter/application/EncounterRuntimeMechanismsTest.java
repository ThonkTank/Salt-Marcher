package features.encounter.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import platform.execution.ExecutionLane;
import platform.ui.UiDispatcher;
import features.encounter.domain.plan.SavedEncounterPlansLoadResult;
import features.encounter.api.ApplyEncounterStateCommand;
import features.encounter.api.EncounterBuilderInputs;
import features.encounter.api.RefreshEncounterPlanBudgetCommand;
import features.encounter.api.SavedEncounterPlanStatus;
import features.encounter.api.UpdateEncounterBuilderInputsCommand;

final class EncounterRuntimeMechanismsTest {

    @Test
    void commandsEnterLaneAndStateBuilderTuningCallbacksKeepPublicationOrder() {
        RecordingLane lane = new RecordingLane();
        RecordingActions actions = new RecordingActions();
        EncounterApplicationService application = new EncounterApplicationService(actions, lane);
        application.initialize();

        assertEquals(1, lane.pending());
        assertTrue(actions.calls.isEmpty());
        lane.runNext();
        assertEquals(List.of("initialize"), actions.calls);

        application.applyState(ApplyEncounterStateCommand.action(ApplyEncounterStateCommand.Action.REFRESH));
        application.updateBuilderInputs(new UpdateEncounterBuilderInputsCommand(EncounterBuilderInputs.empty()));
        application.refreshPlanBudget(new RefreshEncounterPlanBudgetCommand(1L));
        assertEquals(3, lane.pending());
        lane.runAll();
        assertEquals(List.of("initialize", "state", "builder", "budget"), actions.calls);

        RecordingDispatcher dispatcher = new RecordingDispatcher();
        EncounterPublishedState publishedState = new EncounterPublishedState(dispatcher);
        List<String> callbackOrder = new ArrayList<>();
        publishedState.stateModel().subscribe(ignored -> callbackOrder.add("state"));
        publishedState.builderInputsModel().subscribe(ignored -> callbackOrder.add("builder"));
        publishedState.tuningPreviewModel().subscribe(ignored -> callbackOrder.add("tuning"));

        lane.execute(() -> publishedState.publishCurrentSession(null, null));
        lane.runNext();
        assertTrue(callbackOrder.isEmpty());
        assertEquals(3, dispatcher.pending());
        dispatcher.runAll();
        assertEquals(List.of("state", "builder", "tuning"), callbackOrder);
    }

    @Test
    void savedPlanCallbackUsesSuppliedUiDispatcher() {
        RecordingDispatcher dispatcher = new RecordingDispatcher();
        EncounterPublishedState publishedState = new EncounterPublishedState(dispatcher);
        List<Boolean> observed = new ArrayList<>();
        publishedState.savedPlansModel().subscribe(
                result -> observed.add(result.status() == SavedEncounterPlanStatus.SUCCESS));

        publishedState.publishSavedPlans(SavedEncounterPlansLoadResult.success(List.of()));

        assertTrue(observed.isEmpty());
        assertEquals(1, dispatcher.pending());
        dispatcher.runAll();
        assertEquals(List.of(true), observed);
    }

    private static final class RecordingActions implements EncounterApplicationService.CommandActions {

        private final List<String> calls = new ArrayList<>();

        @Override
        public void initialize() {
            calls.add("initialize");
        }

        @Override
        public void applyState(ApplyEncounterStateCommand command) {
            calls.add("state");
        }

        @Override
        public void updateBuilderInputs(UpdateEncounterBuilderInputsCommand command) {
            calls.add("builder");
        }

        @Override
        public void refreshPlanBudget(RefreshEncounterPlanBudgetCommand command) {
            calls.add("budget");
        }
    }

    private static final class RecordingLane implements ExecutionLane {

        private final ArrayDeque<Runnable> work = new ArrayDeque<>();

        @Override
        public void execute(Runnable task) {
            work.addLast(task);
        }

        int pending() {
            return work.size();
        }

        void runNext() {
            work.removeFirst().run();
        }

        void runAll() {
            while (!work.isEmpty()) {
                runNext();
            }
        }

        @Override
        public void close() {
            work.clear();
        }
    }

    private static final class RecordingDispatcher implements UiDispatcher {

        private final ArrayDeque<Runnable> updates = new ArrayDeque<>();

        @Override
        public void dispatch(Runnable update) {
            updates.addLast(update);
        }

        int pending() {
            return updates.size();
        }

        void runAll() {
            while (!updates.isEmpty()) {
                updates.removeFirst().run();
            }
        }
    }
}
