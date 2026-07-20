package features.sessiongeneration.api;

public enum GenerationStatus {
    SUCCESS,
    NOT_FOUND,
    INVALID_REQUEST,
    CATALOG_FAILURE,
    GENERATION_FAILURE,
    IDENTITY_CONFLICT,
    STORAGE_FAILURE
}
