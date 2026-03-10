package features.encounter.generation.service.search.model;

/**
 * Ordered search relaxation stage for encounter generation.
 */
public record RelaxationProfile(
        double pacingSlackRounds,
        boolean allowRoleRepeat,
        boolean pacingRelaxed
) {}
