package src.domain.creatures.api;

public record CreatureFilterOptionsResult(
        CreatureReadStatus status,
        CreatureFilterOptions options
) {
    public CreatureFilterOptionsResult {
        options = options == null ? CreatureFilterOptions.empty() : options;
    }
}
