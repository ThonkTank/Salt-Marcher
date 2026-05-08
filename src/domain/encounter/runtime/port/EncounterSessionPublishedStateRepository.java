package src.domain.encounter.runtime.port;

public interface EncounterSessionPublishedStateRepository<S, B, T> {

    void publishCurrentSession(S state, B builderInputs, T tuningPreview);
}
