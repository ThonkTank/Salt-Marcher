package features.encounter.api;

public record UpdateEncounterPoolFiltersCommand(EncounterPoolFilters filters) {

    public UpdateEncounterPoolFiltersCommand {
        filters = filters == null ? EncounterPoolFilters.empty() : filters;
    }
}
