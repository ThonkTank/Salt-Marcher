package features.encounter.generation.service.search.policy;

import features.encounter.generation.service.search.model.RelaxationProfile;

import java.util.List;

/**
 * Defines the ordered relaxation stages for the V2 search.
 */
public final class EncounterSearchRelaxationPolicy {
    public static final int ATTEMPTS_PER_RELAXATION = 12;

    private EncounterSearchRelaxationPolicy() {
        throw new AssertionError("No instances");
    }

    public static List<RelaxationProfile> orderedRelaxations() {
        return List.of(
                new RelaxationProfile(0.0, false, false),
                new RelaxationProfile(0.75, false, true),
                new RelaxationProfile(0.75, true, true)
        );
    }
}
