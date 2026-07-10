package src.domain.encounter;

public final class EncounterApplicationServiceFakes {

    private EncounterApplicationServiceFakes() {
    }

    public static EncounterApplicationService noOp() {
        return new EncounterApplicationService(new EncounterApplicationService.CommandActions() {
            @Override
            public void applyState(src.domain.encounter.published.ApplyEncounterStateCommand command) {
            }

            @Override
            public void updateBuilderInputs(
                    src.domain.encounter.published.UpdateEncounterBuilderInputsCommand command
            ) {
            }

            @Override
            public void refreshPlanBudget(src.domain.encounter.published.RefreshEncounterPlanBudgetCommand command) {
            }
        });
    }

}
