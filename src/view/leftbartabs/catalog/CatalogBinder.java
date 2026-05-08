package src.view.leftbartabs.catalog;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import javafx.scene.Node;
import shell.api.InspectorSink;
import shell.api.ShellBinding;
import shell.api.ShellRuntimeContext;
import shell.api.ShellSlot;
import src.domain.creatures.CreaturesApplicationService;
import src.domain.creatures.published.CreatureCatalogModel;
import src.domain.creatures.published.CreatureDetailModel;
import src.domain.creatures.published.CreatureCatalogSortField;
import src.domain.creatures.published.CreatureFilterOptionsModel;
import src.domain.creatures.published.CreatureSortDirection;
import src.domain.creatures.published.RefreshCreatureCatalogCommand;
import src.domain.creatures.published.RefreshCreatureFilterOptionsCommand;
import src.domain.creatures.published.SelectCreatureDetailCommand;
import src.domain.encounter.EncounterApplicationService;
import src.domain.encounter.published.ApplyEncounterStateCommand;
import src.domain.encounter.published.EncounterBuilderInputs;
import src.domain.encounter.published.EncounterBuilderInputsModel;
import src.domain.encounter.published.EncounterTuningPreviewModel;
import src.domain.encounter.published.UpdateEncounterBuilderInputsCommand;
import src.domain.encountertable.EncounterTableApplicationService;
import src.domain.encountertable.published.EncounterTableCatalogModel;
import src.domain.encountertable.published.RefreshEncounterTableCatalogCommand;
import src.view.slotcontent.details.creature.CreatureDetailsInspectorEntry;

@SuppressWarnings("PMD.TooManyMethods")
final class CatalogBinder {

    private static final int MIN_DIFFICULTY_LEVEL = 1;
    private static final int DEFAULT_DIFFICULTY_LEVEL = 2;
    private static final int NEUTRAL_DIFFICULTY_LEVEL = 3;
    private static final int MAX_DIFFICULTY_LEVEL = 4;

    private final ShellRuntimeContext runtimeContext;

    CatalogBinder(ShellRuntimeContext runtimeContext) {
        this.runtimeContext = Objects.requireNonNull(runtimeContext, "runtimeContext");
    }

    ShellBinding bind() {
        CreaturesApplicationService creatures = runtimeContext.services().require(CreaturesApplicationService.class);
        EncounterTableApplicationService encounterTables =
                runtimeContext.services().require(EncounterTableApplicationService.class);
        EncounterApplicationService encounters = runtimeContext.services().require(EncounterApplicationService.class);
        EncounterBuilderInputsModel builderInputsModel =
                runtimeContext.services().require(EncounterBuilderInputsModel.class);
        CreatureFilterOptionsModel filterOptionsModel =
                runtimeContext.services().require(CreatureFilterOptionsModel.class);
        CreatureCatalogModel catalogModel = runtimeContext.services().require(CreatureCatalogModel.class);
        CreatureDetailModel detailModel = runtimeContext.services().require(CreatureDetailModel.class);
        EncounterTableCatalogModel encounterTableModel =
                runtimeContext.services().require(EncounterTableCatalogModel.class);
        EncounterTuningPreviewModel tuningPreviewModel =
                runtimeContext.services().require(EncounterTuningPreviewModel.class);

        CatalogContributionModel presentationModel = new CatalogContributionModel();
        CatalogIntentHandler intentHandler = new CatalogIntentHandler(presentationModel);
        CatalogControlsView controls = new CatalogControlsView(presentationModel);
        CatalogMainView main = new CatalogMainView();

        bindControls(intentHandler, controls, encounters, creatures);
        bindMain(main, presentationModel, intentHandler);
        presentationModel.creatureDetailSelectionProperty().addListener((obs, before, after) -> {
            if (after == null || after.longValue() <= 0L) {
                return;
            }
            openCreatureDetails(runtimeContext.inspector(), creatures, detailModel, after.longValue());
            presentationModel.setCreatureDetailSelection(0L);
        });

        filterOptionsModel.subscribe(presentationModel::applyCreatureFilterOptions);
        catalogModel.subscribe(presentationModel::applySearchResult);
        encounterTableModel.subscribe(presentationModel::applyEncounterTables);
        tuningPreviewModel.subscribe(result -> presentationModel.applyEncounterTuningPreview(result.labels()));
        builderInputsModel.subscribe(builderInputs -> {
            if (presentationModel.applyEncounterBuilderInputs(builderInputs)) {
                runSearch(creatures, presentationModel.searchEvent());
            }
        });

        presentationModel.applyCreatureFilterOptions(filterOptionsModel.current());
        presentationModel.applyEncounterTables(encounterTableModel.current());
        presentationModel.applyEncounterTuningPreview(tuningPreviewModel.current().labels());
        presentationModel.applyEncounterBuilderInputs(builderInputsModel.current());

        creatures.refreshFilterOptions(new RefreshCreatureFilterOptionsCommand());
        encounterTables.refreshCatalog(new RefreshEncounterTableCatalogCommand());
        runSearch(creatures, presentationModel.searchEvent());
        return new Binding(controls, main);
    }

    private static void bindControls(
            CatalogIntentHandler intentHandler,
            CatalogControlsView controls,
            EncounterApplicationService encounters,
            CreaturesApplicationService creatures
    ) {
        controls.onViewInputEvent(intentHandler::consume);
        intentHandler.onPublishedEventRequested(event -> applyPublishedEvent(encounters, creatures, event));
    }

    private static void bindMain(
            CatalogMainView main,
            CatalogContributionModel presentationModel,
            CatalogIntentHandler intentHandler
    ) {
        main.bind(presentationModel);
        main.onViewInputEvent(intentHandler::consume);
    }

    private static void openCreatureDetails(
            InspectorSink inspector,
            CreaturesApplicationService creatures,
            CreatureDetailModel detailModel,
            long creatureId
    ) {
        creatures.selectCreatureDetail(new SelectCreatureDetailCommand(creatureId));
        inspector.push(CreatureDetailsInspectorEntry.create(
                creatureId,
                detailModel.current()));
    }

    private static void runSearch(
            CreaturesApplicationService creatures,
            CatalogPublishedEvent event
    ) {
        creatures.refreshCatalog(new RefreshCreatureCatalogCommand(
                event.nameQuery(),
                event.challengeRatingMin(),
                event.challengeRatingMax(),
                event.sizes(),
                event.creatureTypes(),
                event.creatureSubtypes(),
                event.biomes(),
                event.alignments(),
                sortField(event.sortKey()),
                sortDirection(event.sortKey()),
                50,
                event.pageOffset()));
    }

    private static void updateBuilderInputs(
            EncounterApplicationService encounters,
            CatalogPublishedEvent event
    ) {
        encounters.updateBuilderInputs(new UpdateEncounterBuilderInputsCommand(
                new EncounterBuilderInputs(
                        event.creatureTypes(),
                        event.creatureSubtypes(),
                        event.biomes(),
                        event.difficultyAuto(),
                        toDifficultyLevel(event.difficultyValue()),
                        event.balanceAuto(),
                        toBalanceLevel(event.balanceValue()),
                        event.amountAuto(),
                        event.amountValue(),
                        event.diversityAuto(),
                        toDiversityLevel(event.diversityValue()),
                        event.encounterTableIds())));
    }

    private static void applyPublishedEvent(
            EncounterApplicationService encounters,
            CreaturesApplicationService creatures,
            CatalogPublishedEvent event
    ) {
        if (event == null) {
            return;
        }
        switch (event.kind()) {
            case SEARCH -> runSearch(creatures, event);
            case UPDATE_BUILDER_INPUTS -> updateBuilderInputs(encounters, event);
            case ADD_CREATURE -> encounters.applyState(new ApplyEncounterStateCommand(
                    ApplyEncounterStateCommand.Action.ADD_CREATURE,
                    event.creatureId(),
                    0L,
                    0,
                    0L,
                    List.of(),
                    "",
                    0,
                    0L,
                    0,
                    false));
            default -> {
            }
        }
    }

    private static CreatureCatalogSortField sortField(String sortKey) {
        return switch (sortKey == null ? "" : sortKey) {
            case "cr-asc", "cr-desc" -> CreatureCatalogSortField.CHALLENGE_RATING;
            case "xp-asc", "xp-desc" -> CreatureCatalogSortField.XP;
            default -> CreatureCatalogSortField.NAME;
        };
    }

    private static CreatureSortDirection sortDirection(String sortKey) {
        return switch (sortKey == null ? "" : sortKey) {
            case "name-desc", "cr-desc", "xp-desc" -> CreatureSortDirection.DESCENDING;
            default -> CreatureSortDirection.ASCENDING;
        };
    }

    private static int toDifficultyLevel(double value) {
        int rounded = (int) Math.round(value);
        if (rounded <= MIN_DIFFICULTY_LEVEL) {
            return MIN_DIFFICULTY_LEVEL;
        }
        if (rounded == NEUTRAL_DIFFICULTY_LEVEL) {
            return NEUTRAL_DIFFICULTY_LEVEL;
        }
        if (rounded >= MAX_DIFFICULTY_LEVEL) {
            return MAX_DIFFICULTY_LEVEL;
        }
        return DEFAULT_DIFFICULTY_LEVEL;
    }

    private static int toBalanceLevel(double value) {
        return (int) Math.round(value);
    }

    private static int toDiversityLevel(double value) {
        return (int) Math.round(value);
    }

    private record Binding(Node controls, Node main) implements ShellBinding {

        @Override
        public String title() {
            return "Encounter-Planer";
        }

        @Override
        public String navigationLabel() {
            return "";
        }

        @Override
        public Map<ShellSlot, Node> slotContent() {
            return Map.of(
                    ShellSlot.COCKPIT_CONTROLS, controls,
                    ShellSlot.COCKPIT_MAIN, main);
        }
    }
}
