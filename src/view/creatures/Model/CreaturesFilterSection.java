package src.view.creatures.Model;

public final class CreaturesFilterSection {

    private final CreaturesFilterOptionsModel options = new CreaturesFilterOptionsModel();
    private final CreaturesFilterSelectionModel selection = new CreaturesFilterSelectionModel();

    public void applyOptions(CreatureFilterOptionsViewData options) {
        this.options.apply(options);
    }

    public void reset() {
        selection.reset();
    }

    public CreaturesFilterOptionsModel options() {
        return options;
    }

    public CreaturesFilterSelectionModel selection() {
        return selection;
    }
}
