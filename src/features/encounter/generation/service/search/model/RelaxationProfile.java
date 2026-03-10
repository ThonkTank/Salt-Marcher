package features.encounter.generation.service.search.model;

/**
 * Ordered search relaxation stage for encounter generation.
 */
public record RelaxationProfile(
        double pacingSlackRounds,
        double complexitySlack,
        boolean allowRoleRepeat,
        boolean pacingRelaxed,
        boolean complexityRelaxed
) {}
