package features.sessiongeneration.domain.generation;

public final class GenerationRunIdentityConflictException extends IllegalStateException {

    public GenerationRunIdentityConflictException(String runId) {
        super("generation run identity already denotes different semantic content: " + runId);
    }
}
