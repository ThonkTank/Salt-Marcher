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
                new RelaxationProfile(0.0, 0.0, false, false, false),
                new RelaxationProfile(0.75, 0.0, false, true, false),
                new RelaxationProfile(0.75, 1.75, false, true, true),
                new RelaxationProfile(0.75, 1.75, true, true, true)
        );
    }
}
