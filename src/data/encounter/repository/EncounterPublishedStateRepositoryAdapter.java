package src.data.encounter.repository;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
import src.domain.encounter.runtime.port.EncounterSessionPublishedStateRepository;
import src.domain.encounter.published.EncounterBuilderInputs;
import src.domain.encounter.published.EncounterBuilderInputsModel;
import src.domain.encounter.published.EncounterGenerationStatus;
import src.domain.encounter.published.EncounterStateModel;
import src.domain.encounter.published.EncounterStateSnapshot;
import src.domain.encounter.published.EncounterTuningPreviewLabels;
import src.domain.encounter.published.EncounterTuningPreviewModel;
import src.domain.encounter.published.EncounterTuningPreviewResult;

public final class EncounterPublishedStateRepositoryAdapter
        implements EncounterSessionPublishedStateRepository {

    private static final String LISTENER_PARAMETER = "listener";

    private final List<Consumer<EncounterStateSnapshot>> stateListeners = new ArrayList<>();
    private final List<Consumer<EncounterBuilderInputs>> builderInputsListeners = new ArrayList<>();
    private final List<Consumer<EncounterTuningPreviewResult>> tuningPreviewListeners = new ArrayList<>();
    public final EncounterStateModel stateModel = new EncounterStateModel(
            this::currentState,
            this::subscribeStateListener);
    public final EncounterBuilderInputsModel builderInputsModel = new EncounterBuilderInputsModel(
            this::currentBuilderInputs,
            this::subscribeBuilderInputsListener);
    public final EncounterTuningPreviewModel tuningPreviewModel = new EncounterTuningPreviewModel(
            this::currentTuningPreview,
            this::subscribeTuningPreviewListener);
    private EncounterStateSnapshot currentState = EncounterStateSnapshot.empty("Encounter state is not registered.");
    private EncounterBuilderInputs currentBuilderInputs = EncounterBuilderInputs.empty();
    private EncounterTuningPreviewResult currentTuningPreview = emptyTuningPreview();

    @Override
    public void publishCurrentSession(
            EncounterStateSnapshot state,
            EncounterBuilderInputs builderInputs,
            EncounterTuningPreviewResult tuningPreview
    ) {
        currentState = state == null ? EncounterStateSnapshot.empty("Encounter state is not registered.") : state;
        currentBuilderInputs = builderInputs == null ? EncounterBuilderInputs.empty() : builderInputs;
        currentTuningPreview = tuningPreview == null ? emptyTuningPreview() : tuningPreview;
        notifyStateListeners(currentState);
        notifyBuilderInputsListeners(currentBuilderInputs);
        notifyTuningPreviewListeners(currentTuningPreview);
    }

    @Override
    public EncounterStateModel stateModel() {
        return stateModel;
    }

    @Override
    public EncounterBuilderInputsModel builderInputsModel() {
        return builderInputsModel;
    }

    @Override
    public EncounterTuningPreviewModel tuningPreviewModel() {
        return tuningPreviewModel;
    }

    private EncounterStateSnapshot currentState() {
        return currentState;
    }

    private EncounterBuilderInputs currentBuilderInputs() {
        return currentBuilderInputs;
    }

    private EncounterTuningPreviewResult currentTuningPreview() {
        return currentTuningPreview;
    }

    private Runnable subscribeStateListener(Consumer<EncounterStateSnapshot> listener) {
        Consumer<EncounterStateSnapshot> safeListener = Objects.requireNonNull(listener, LISTENER_PARAMETER);
        stateListeners.add(safeListener);
        return () -> stateListeners.remove(safeListener);
    }

    private Runnable subscribeBuilderInputsListener(Consumer<EncounterBuilderInputs> listener) {
        Consumer<EncounterBuilderInputs> safeListener = Objects.requireNonNull(listener, LISTENER_PARAMETER);
        builderInputsListeners.add(safeListener);
        return () -> builderInputsListeners.remove(safeListener);
    }

    private Runnable subscribeTuningPreviewListener(Consumer<EncounterTuningPreviewResult> listener) {
        Consumer<EncounterTuningPreviewResult> safeListener = Objects.requireNonNull(listener, LISTENER_PARAMETER);
        tuningPreviewListeners.add(safeListener);
        return () -> tuningPreviewListeners.remove(safeListener);
    }

    private void notifyStateListeners(EncounterStateSnapshot state) {
        for (Consumer<EncounterStateSnapshot> listener : List.copyOf(stateListeners)) {
            listener.accept(state);
        }
    }

    private void notifyBuilderInputsListeners(EncounterBuilderInputs builderInputs) {
        for (Consumer<EncounterBuilderInputs> listener : List.copyOf(builderInputsListeners)) {
            listener.accept(builderInputs);
        }
    }

    private void notifyTuningPreviewListeners(EncounterTuningPreviewResult tuningPreview) {
        for (Consumer<EncounterTuningPreviewResult> listener : List.copyOf(tuningPreviewListeners)) {
            listener.accept(tuningPreview);
        }
    }

    private static EncounterTuningPreviewResult emptyTuningPreview() {
        return new EncounterTuningPreviewResult(
                EncounterGenerationStatus.STORAGE_ERROR,
                new EncounterTuningPreviewLabels(List.of(), List.of(), List.of(), List.of()),
                "");
    }
}
