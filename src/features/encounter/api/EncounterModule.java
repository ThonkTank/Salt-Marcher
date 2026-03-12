package features.encounter.api;

import features.encounter.builder.application.EncounterBuilderService;
import features.encounter.combat.application.EncounterCombatService;
import features.encounter.internal.wiring.DefaultCreatureCandidateProvider;
import features.encounter.internal.wiring.DefaultEncounterLootProvider;
import features.encounter.internal.wiring.DefaultEncounterTableProvider;
import features.encounter.internal.wiring.DefaultPartyAnalysisProvider;
import features.encounter.internal.wiring.DefaultPartyProvider;
import features.encounter.ui.EncounterView;
import features.encounter.ui.EncounterViewCallbacks;
import features.creatures.api.CreatureCatalogService;
import features.partyanalysis.api.PartyAnalysisCacheService;
import features.partyanalysis.api.PartyCacheRefreshPort;
import ui.shell.AppView;
import ui.shell.DetailsNavigator;
import ui.shell.SceneRegistry;

import java.util.Objects;

public final class EncounterModule {

    private final EncounterView view;
    private final PartyAnalysisCacheService partyCacheService;

    public EncounterModule(
            Runnable onRefreshToolbar,
            Runnable onRefreshPanels,
            DetailsNavigator detailsNavigator,
            SceneRegistry sceneRegistry
    ) {
        Objects.requireNonNull(onRefreshToolbar, "onRefreshToolbar");
        Objects.requireNonNull(onRefreshPanels, "onRefreshPanels");
        Objects.requireNonNull(detailsNavigator, "detailsNavigator");
        Objects.requireNonNull(sceneRegistry, "sceneRegistry");

        EncounterBuilderService builderService = new EncounterBuilderService(
                new DefaultPartyProvider(),
                new DefaultPartyAnalysisProvider(),
                new DefaultEncounterTableProvider(),
                new DefaultCreatureCandidateProvider()
        );
        EncounterCombatService combatService = new EncounterCombatService(new DefaultEncounterLootProvider());
        this.partyCacheService = new PartyAnalysisCacheService();
        this.view = new EncounterView(new EncounterViewCallbacks(
                onRefreshToolbar,
                onRefreshPanels,
                detailsNavigator,
                sceneRegistry,
                builderService,
                combatService
        ));
    }

    public AppView view() {
        return view;
    }

    public PartyCacheRefreshPort partyCacheRefreshPort() {
        return partyCacheService;
    }

    public void setFilterData(CreatureCatalogService.FilterOptions data) {
        view.setFilterData(data);
    }

    public void refreshPartyState() {
        view.refreshPartyState();
    }
}
