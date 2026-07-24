package features.sessionplanner.api;

public interface SessionPlannerRoutes {

    record ItemChoice(String sourceKey, String name, long costCp, String rarity) { }

    void editEncounter(long planId);
    void inspectCreature(long creatureId);
    void inspectItem(String itemId);
    void inspectLocation(long locationId);
    java.util.concurrent.CompletionStage<java.util.List<ItemChoice>> searchItems(String query);

    static SessionPlannerRoutes none() {
        return new SessionPlannerRoutes() {
            @Override public void editEncounter(long planId) { }
            @Override public void inspectCreature(long creatureId) { }
            @Override public void inspectItem(String itemId) { }
            @Override public void inspectLocation(long locationId) { }
            @Override public java.util.concurrent.CompletionStage<java.util.List<ItemChoice>> searchItems(String query) {
                return java.util.concurrent.CompletableFuture.completedFuture(java.util.List.of());
            }
        };
    }
}
