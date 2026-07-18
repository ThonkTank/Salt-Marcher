package features.creatures.api;

import java.util.concurrent.CompletionStage;

/** Request-local creature detail read for exactly one stable creature id. */
@FunctionalInterface
public interface CreatureDetailQueryApi {

    CompletionStage<CreatureDetailResult> load(long creatureId);
}
