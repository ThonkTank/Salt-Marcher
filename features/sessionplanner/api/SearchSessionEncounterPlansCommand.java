package features.sessionplanner.api;

public record SearchSessionEncounterPlansCommand(long sceneToken, String query) {

    public SearchSessionEncounterPlansCommand {
        if (sceneToken <= 0L) {
            throw new IllegalArgumentException("sceneToken must be positive");
        }
        query = query == null ? "" : query;
    }
}
