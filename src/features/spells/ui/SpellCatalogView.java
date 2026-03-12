package features.spells.ui;

import features.spells.api.SpellBrowserPane;
import features.spells.api.SpellCatalogService;
import features.spells.api.SpellFilterPane;
import features.spells.api.SpellSummary;
import javafx.scene.Node;
import ui.shell.AppView;
import ui.shell.DetailsNavigator;

public final class SpellCatalogView implements AppView {
    private final SpellBrowserPane browserPane = new SpellBrowserPane();
    private SpellFilterPane filterPane;
    private DetailsNavigator detailsNavigator;
    private boolean initialLoadDone = false;

    public void setFilterData(SpellCatalogService.FilterOptions data) {
        filterPane = new SpellFilterPane(data);
        filterPane.setOnFilterChanged(browserPane::applyFilters);
    }

    public void setDetailsNavigator(DetailsNavigator detailsNavigator) {
        this.detailsNavigator = detailsNavigator;
        browserPane.setOnRequestSpell(this::showSpellInInspector);
    }

    @Override
    public Node getMainContent() {
        return browserPane;
    }

    @Override
    public String getTitle() {
        return "Zauber";
    }

    @Override
    public String getIconText() {
        return "\u2726";
    }

    @Override
    public Node getControlsContent() {
        return filterPane;
    }

    @Override
    public void onShow() {
        if (!initialLoadDone) {
            browserPane.loadInitial();
            initialLoadDone = true;
        }
    }

    private void showSpellInInspector(Long spellId) {
        if (spellId == null || detailsNavigator == null) return;
        detailsNavigator.showSpell(new SpellSummary(spellId));
    }
}
