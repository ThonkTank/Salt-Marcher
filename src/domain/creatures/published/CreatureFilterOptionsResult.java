package src.domain.creatures.published;

public record CreatureFilterOptionsResult(
        CreatureReadStatus status,
        CreatureFilterOptions options
) {
    public CreatureFilterOptionsResult {
        options = options == null ? CreatureFilterOptions.empty() : options;
    }
}
