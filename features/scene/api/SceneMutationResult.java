package features.scene.api;

public record SceneMutationResult(Status status, String message) {

    public SceneMutationResult {
        status = status == null ? Status.STORAGE_ERROR : status;
        message = message == null ? "" : message;
    }

    public enum Status {
        SUCCESS,
        INVALID,
        NOT_FOUND,
        DEFAULT_SCENE_PROTECTED,
        STORAGE_ERROR
    }
}
