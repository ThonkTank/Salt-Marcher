package src.view.creatures.Model;

public final class CreaturesModel {

    private final CreaturesFilterSection filters = new CreaturesFilterSection();
    private final CreaturesCatalogSection catalog = new CreaturesCatalogSection();
    private final CreaturesStatusSection status = new CreaturesStatusSection();

    public CreaturesFilterSection filters() {
        return filters;
    }

    public CreaturesCatalogSection catalog() {
        return catalog;
    }

    public CreaturesStatusSection status() {
        return status;
    }
}
