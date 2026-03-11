package features.encounter.generation.service.search.model;

/**
 * Allowed candidate expansion for a single search step.
 */
public record CandidateChoice(CandidateEntry entry, int count, SearchState nextState) {}
