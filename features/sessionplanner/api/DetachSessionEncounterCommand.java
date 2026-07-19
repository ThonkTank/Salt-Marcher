package features.sessionplanner.api;

public record DetachSessionEncounterCommand(long sceneToken) {

    public DetachSessionEncounterCommand {
        sceneToken = Math.max(0L, sceneToken);
    }
}
