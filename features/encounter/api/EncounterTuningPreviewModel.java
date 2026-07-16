package features.encounter.api;

import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Supplier;

public final class EncounterTuningPreviewModel {

    private final Supplier<EncounterTuningPreviewResult> currentSupplier;
    private final Function<Consumer<EncounterTuningPreviewResult>, Runnable> subscribeAction;

    public EncounterTuningPreviewModel(
            Supplier<EncounterTuningPreviewResult> currentSupplier,
            Function<Consumer<EncounterTuningPreviewResult>, Runnable> subscribeAction
    ) {
        this.currentSupplier = currentSupplier == null
                ? () -> new EncounterTuningPreviewResult(
                        EncounterGenerationStatus.STORAGE_ERROR,
                        new EncounterTuningPreviewLabels(List.of(), List.of(), List.of(), List.of()),
                        "")
                : currentSupplier;
        this.subscribeAction = subscribeAction == null
                ? listener -> () -> { }
                : subscribeAction;
    }

    public EncounterTuningPreviewResult current() {
        return currentSupplier.get();
    }

    public Runnable subscribe(Consumer<EncounterTuningPreviewResult> listener) {
        return subscribeAction.apply(Objects.requireNonNull(listener, "listener"));
    }
}
