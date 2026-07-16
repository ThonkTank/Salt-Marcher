package features.encounter.api;

/** Opaque Scene-owned identity used to address one independent Encounter runtime. */
public record EncounterRuntimeContextId(String value) {

    public EncounterRuntimeContextId {
        value = value == null ? "" : value.trim();
        if (value.isBlank()) {
            throw new IllegalArgumentException("Encounter runtime context id must not be blank.");
        }
    }
}
