package src.domain.encounter.published;

import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Supplier;

public record EncounterTuningPreviewModel(
        Supplier<EncounterTuningPreviewResult> currentSupplier,
        Function<Consumer<EncounterTuningPreviewResult>, Runnable> subscribeAction
) {

    public EncounterTuningPreviewModel {
        currentSupplier = currentSupplier == null
                ? () -> new EncounterTuningPreviewResult(
                        EncounterGenerationStatus.STORAGE_ERROR,
                        new EncounterTuningPreviewLabels(List.of(), List.of(), List.of(), List.of()),
                        "")
                : currentSupplier;
        subscribeAction = subscribeAction == null
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
