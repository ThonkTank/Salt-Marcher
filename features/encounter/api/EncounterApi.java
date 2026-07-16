package features.encounter.api;

public interface EncounterApi {

    void applyState(ApplyEncounterStateCommand command);

    void updateBuilderInputs(UpdateEncounterBuilderInputsCommand command);

    void refreshPlanBudget(RefreshEncounterPlanBudgetCommand command);
}
