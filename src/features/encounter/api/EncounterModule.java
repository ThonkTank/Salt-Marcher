package features.encounter.api;

import features.encounter.builder.application.EncounterBuilderService;
import features.encounter.combat.application.EncounterCombatService;
import features.encounter.internal.wiring.DefaultCreatureCandidateProvider;
import features.encounter.internal.wiring.DefaultEncounterTableProvider;
import features.encounter.internal.wiring.DefaultPartyProvider;
import features.creatures.api.CreatureCatalogService;
import features.partyanalysis.api.PartyAnalysisCacheService;
import features.partyanalysis.api.PartyCacheRefreshPort;
import ui.components.creatures.statblock.StatBlockRequest;
import ui.shell.AppView;
import ui.shell.SceneRegistry;

import java.util.Objects;
import java.util.function.Consumer;

public final class EncounterModule {

    private final EncounterView view;
    private final PartyAnalysisCacheService partyCacheService;

    public EncounterModule(
            Runnable onRefreshToolbar,
            Runnable onRefreshPanels,
            Consumer<StatBlockRequest> onRequestStatBlock,
            Consumer<StatBlockRequest> onEnsureStatBlock,
            SceneRegistry sceneRegistry
    ) {
        Objects.requireNonNull(onRefreshToolbar, "onRefreshToolbar");
        Objects.requireNonNull(onRefreshPanels, "onRefreshPanels");
        Objects.requireNonNull(onRequestStatBlock, "onRequestStatBlock");
        Objects.requireNonNull(onEnsureStatBlock, "onEnsureStatBlock");
        Objects.requireNonNull(sceneRegistry, "sceneRegistry");

        EncounterBuilderService builderService = new EncounterBuilderService(
                new DefaultPartyProvider(),
                new DefaultEncounterTableProvider(),
                new DefaultCreatureCandidateProvider()
        );
        EncounterCombatService combatService = new EncounterCombatService();
        this.partyCacheService = new PartyAnalysisCacheService();
        this.view = new EncounterView(new EncounterViewCallbacks(
                onRefreshToolbar,
                onRefreshPanels,
                onRequestStatBlock,
                sceneRegistry,
                builderService,
                combatService
        ));
        this.view.setOnEnsureStatBlock(onEnsureStatBlock);
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
