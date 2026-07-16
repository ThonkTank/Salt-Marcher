package src.domain.scene.published;

public record SceneMutationResult(Status status, String message) {
    public SceneMutationResult {
        status = status == null ? Status.STORAGE_ERROR : status;
        message = message == null ? "" : message;
    }

    public enum Status { SUCCESS, NOT_FOUND, INVALID, DEFAULT_SCENE, STORAGE_ERROR }
}
