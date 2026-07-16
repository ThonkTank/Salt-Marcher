package features.encounter.application;

public final class EncounterApplicationServiceFakes {

    private EncounterApplicationServiceFakes() {
    }

    public static EncounterApplicationService noOp() {
        return new EncounterApplicationService(new EncounterApplicationService.CommandActions() {
            @Override
            public void applyState(features.encounter.api.ApplyEncounterStateCommand command) {
            }

            @Override
            public void updateBuilderInputs(
                    features.encounter.api.UpdateEncounterBuilderInputsCommand command
            ) {
            }

            @Override
            public void refreshPlanBudget(features.encounter.api.RefreshEncounterPlanBudgetCommand command) {
            }
        });
    }

}
