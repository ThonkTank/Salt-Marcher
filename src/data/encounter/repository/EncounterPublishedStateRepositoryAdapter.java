package src.data.encounter.repository;

import java.util.List;
import src.domain.encounter.model.plan.model.EncounterPlanBudgetLoadResult;
import src.domain.encounter.model.plan.model.SavedEncounterPlansLoadResult;
import src.domain.encounter.model.session.model.EncounterSessionPublicationData;
import src.domain.encounter.published.EncounterBuilderInputs;
import src.domain.encounter.published.EncounterBuilderInputsModel;
import src.domain.encounter.published.EncounterGenerationStatus;
import src.domain.encounter.published.EncounterPlanBudgetModel;
import src.domain.encounter.published.EncounterPlanBudgetResult;
import src.domain.encounter.published.EncounterPlanBudgetStatus;
import src.domain.encounter.published.EncounterStateModel;
import src.domain.encounter.published.EncounterStateSnapshot;
import src.domain.encounter.published.EncounterTuningPreviewLabels;
import src.domain.encounter.published.EncounterTuningPreviewModel;
import src.domain.encounter.published.EncounterTuningPreviewResult;
import src.domain.encounter.published.SavedEncounterPlanListModel;
import src.domain.encounter.published.SavedEncounterPlanListResult;
import src.domain.encounter.published.SavedEncounterPlanStatus;
import src.domain.encounter.model.plan.repository.EncounterPlanPublishedStateRepository;
import src.domain.encounter.model.session.repository.EncounterSessionPublishedStateRepository;

public final class EncounterPublishedStateRepositoryAdapter
        implements EncounterSessionPublishedStateRepository, EncounterPlanPublishedStateRepository {

    private static final String SESSION_NOT_REGISTERED = "Encounter session is not registered.";
    private static final String PLAN_STORAGE_NOT_REGISTERED = "Encounter plan storage is not registered.";
    private static final String PLAN_BUDGET_NOT_REGISTERED = "Encounter plan budget service is not registered.";

    private final EncounterPublishedStateChannel<EncounterStateSnapshot> state =
            new EncounterPublishedStateChannel<>(EncounterStateSnapshot.empty(SESSION_NOT_REGISTERED));
    private final EncounterPublishedStateChannel<EncounterBuilderInputs> builderInputs =
            new EncounterPublishedStateChannel<>(EncounterBuilderInputs.empty());
    private final EncounterPublishedStateChannel<EncounterTuningPreviewResult> tuningPreview =
            new EncounterPublishedStateChannel<>(emptyTuningPreview());
    private final EncounterPublishedStateChannel<SavedEncounterPlanListResult> savedPlans =
            new EncounterPublishedStateChannel<>(emptySavedPlans());
    private final EncounterPublishedStateChannel<EncounterPlanBudgetResult> planBudget =
            new EncounterPublishedStateChannel<>(emptyPlanBudget());
    public final EncounterStateModel stateModel = new EncounterStateModel(
            state::current,
            state::subscribe);
    public final EncounterBuilderInputsModel builderInputsModel = new EncounterBuilderInputsModel(
            builderInputs::current,
            builderInputs::subscribe);
    public final EncounterTuningPreviewModel tuningPreviewModel = new EncounterTuningPreviewModel(
            tuningPreview::current,
            tuningPreview::subscribe);
    public final SavedEncounterPlanListModel savedPlansModel = new SavedEncounterPlanListModel(
            savedPlans::current,
            savedPlans::subscribe);
    public final EncounterPlanBudgetModel planBudgetModel = new EncounterPlanBudgetModel(
            planBudget::current,
            planBudget::subscribe);

    @Override
    public void publishCurrentSession(EncounterSessionPublicationData publication) {
        EncounterSessionPublicationData effective = publication == null
                ? EncounterSessionPublicationData.unavailable(SESSION_NOT_REGISTERED)
                : publication;
        this.state.publish(EncounterSessionPublishedStateMapper.toPublishedSnapshot(effective));
        this.builderInputs.publish(EncounterSessionPublishedStateMapper.toPublishedBuilderInputs(effective.builderInputs()));
        this.tuningPreview.publish(EncounterSessionPublishedStateMapper.toPublishedTuningPreview(effective.tuningPreview()));
    }

    @Override
    public void publishSavedPlans(SavedEncounterPlansLoadResult result) {
        savedPlans.publish(result == null
                ? EncounterPlanPublishedStateMapper.storageUnavailable(PLAN_STORAGE_NOT_REGISTERED)
                : EncounterPlanPublishedStateMapper.toPublishedSavedPlans(result));
    }

    @Override
    public void publishPlanBudget(EncounterPlanBudgetLoadResult result) {
        planBudget.publish(result == null
                ? EncounterPlanPublishedStateMapper.budgetUnavailable(PLAN_BUDGET_NOT_REGISTERED)
                : EncounterPlanPublishedStateMapper.toPublishedPlanBudget(result));
    }

    private static EncounterTuningPreviewResult emptyTuningPreview() {
        return new EncounterTuningPreviewResult(
                EncounterGenerationStatus.STORAGE_ERROR,
                new EncounterTuningPreviewLabels(List.of(), List.of(), List.of(), List.of()),
                "");
    }

    private static SavedEncounterPlanListResult emptySavedPlans() {
        return new SavedEncounterPlanListResult(SavedEncounterPlanStatus.STORAGE_ERROR, List.of(), "");
    }

    private static EncounterPlanBudgetResult emptyPlanBudget() {
        return new EncounterPlanBudgetResult(EncounterPlanBudgetStatus.STORAGE_ERROR, null, "");
    }
}
