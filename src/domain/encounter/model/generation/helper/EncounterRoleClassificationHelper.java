package src.domain.encounter.model.generation.helper;

import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.encounter.model.generation.model.EncounterCreatureFacts;
import src.domain.encounter.model.generation.model.EncounterRole;
import src.domain.encounter.model.generation.model.EncounterRoleClassification;

public final class EncounterRoleClassificationHelper {

    private EncounterRoleClassificationHelper() {
    }

    public static Classification classify(EncounterCreatureFacts candidate) {
        EncounterRole role = EncounterRoleClassification.classify(candidate).role();
        return new Classification(role, EncounterTagBuildHelper.tagsFor(candidate, defaultTag(role)));
    }

    private static @Nullable String defaultTag(EncounterRole role) {
        return switch (role) {
            case BOSS -> "legendary threat";
            case BRUTE -> "durable body";
            case SKIRMISHER -> "fast opener";
            case ELITE -> "hard to remove";
            case MINION -> "light filler";
            case STANDARD -> null;
        };
    }

    public record Classification(
            EncounterRole role,
            List<String> tags
    ) {

        public Classification {
            tags = tags == null ? List.of() : List.copyOf(tags);
        }

        @Override
        public List<String> tags() {
            return List.copyOf(tags);
        }
    }
}
