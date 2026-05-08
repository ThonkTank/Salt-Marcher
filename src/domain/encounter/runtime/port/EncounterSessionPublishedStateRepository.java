package src.domain.encounter.runtime.port;

import org.jspecify.annotations.Nullable;
import src.domain.encounter.application.LoadEncounterBudgetUseCase;
import src.domain.encounter.session.entity.EncounterSession;

public interface EncounterSessionPublishedStateRepository {

    void publishCurrentSession(
            @Nullable EncounterSession session,
            LoadEncounterBudgetUseCase.Result budgetResult
    );
}
