package features.encounter.generation.service.search.model;

/**
 * One selected candidate and count inside the current search state.
 */
public record StateEntry(CandidateEntry entry, int count) {}
