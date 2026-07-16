package features.sessionplanner.api;

public record AddSessionLootPlaceholderCommand(long encounterId) {

    public AddSessionLootPlaceholderCommand {
        encounterId = Math.max(0L, encounterId);
    }
}
