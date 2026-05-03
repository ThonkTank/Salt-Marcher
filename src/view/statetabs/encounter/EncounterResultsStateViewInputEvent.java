package src.view.statetabs.encounter;

public record EncounterResultsStateViewInputEvent(
        boolean awardRequested,
        boolean returnToBuilderRequested
) {
}
