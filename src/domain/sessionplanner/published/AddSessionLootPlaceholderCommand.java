package src.domain.sessionplanner.published;

public record AddSessionLootPlaceholderCommand(long encounterId) {

    public AddSessionLootPlaceholderCommand {
        encounterId = Math.max(0L, encounterId);
    }
}
