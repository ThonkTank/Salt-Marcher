package src.domain.encounter.model.session.repository;

public interface EncounterSessionPublishedStateRepository<S, B, T> {

    void publishCurrentSession(S state, B builderInputs, T tuningPreview);
}
