package features.encounter.generation.service.search.model;

/**
 * Ranked candidate expansion for a single search step.
 */
public record CandidateChoice(CandidateEntry entry, int count, SearchState nextState, double score) {}
