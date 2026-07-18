package features.catalog.application;

/** Typed user intents for the three World Reference Catalog sections. */
public sealed interface WorldReferenceCatalogIntent {

    record ChangeNpcQuery(String query) implements WorldReferenceCatalogIntent { }
    record SelectNpc(long npcId) implements WorldReferenceCatalogIntent { }
    record OpenNpc(long npcId) implements WorldReferenceCatalogIntent { }
    record CreateNpc() implements WorldReferenceCatalogIntent { }
    record AddNpcToEncounter(long npcId) implements WorldReferenceCatalogIntent { }
    record AddNpcToScene(long npcId) implements WorldReferenceCatalogIntent { }

    record ChangeFactionQuery(String query) implements WorldReferenceCatalogIntent { }
    record SelectFaction(long factionId) implements WorldReferenceCatalogIntent { }
    record OpenFaction(long factionId) implements WorldReferenceCatalogIntent { }
    record CreateFaction() implements WorldReferenceCatalogIntent { }
    record UseFactionAsEncounterSource(long factionId) implements WorldReferenceCatalogIntent { }

    record ChangeLocationQuery(String query) implements WorldReferenceCatalogIntent { }
    record SelectLocation(long locationId) implements WorldReferenceCatalogIntent { }
    record OpenLocation(long locationId) implements WorldReferenceCatalogIntent { }
    record CreateLocation() implements WorldReferenceCatalogIntent { }
    record UseLocationAsEncounterSource(long locationId) implements WorldReferenceCatalogIntent { }
    record SetFocusedSceneLocation(long locationId) implements WorldReferenceCatalogIntent { }
}
