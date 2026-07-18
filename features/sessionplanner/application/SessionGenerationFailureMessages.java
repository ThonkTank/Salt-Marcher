package features.sessionplanner.application;

import features.sessiongeneration.api.GenerationResponse;

final class SessionGenerationFailureMessages {

    private SessionGenerationFailureMessages() {
    }

    static String forPreview(GenerationResponse response) {
        if (response == null) {
            return "Vorschau konnte nicht erzeugt werden. Bitte erneut versuchen.";
        }
        return switch (response.status()) {
            case INVALID_REQUEST -> "Die Generierungsanfrage ist ungültig. Bitte Session-Eingaben prüfen.";
            case CATALOG_FAILURE -> "Der Generierungskatalog konnte nicht geladen werden. Bitte erneut versuchen.";
            case GENERATION_FAILURE -> "Vorschau konnte nicht erzeugt werden. Bitte erneut versuchen.";
            case IDENTITY_CONFLICT -> "Die Generierungsidentität ist bereits belegt. Bitte Vorschau neu erzeugen.";
            case STORAGE_FAILURE -> "Vorschau konnte nicht gespeichert werden. Bitte erneut versuchen.";
            case NOT_FOUND -> "Generierungsergebnis wurde nicht gefunden. Bitte Vorschau neu erzeugen.";
            case SUCCESS -> "Vorschau konnte nicht erzeugt werden. Bitte erneut versuchen.";
        };
    }

    static String forLoad(GenerationResponse response) {
        if (response == null) {
            return "Persistierte Vorschau konnte nicht geladen werden. Bitte erneut versuchen.";
        }
        return switch (response.status()) {
            case NOT_FOUND -> "Persistierte Vorschau wurde nicht gefunden. Bitte Vorschau neu erzeugen.";
            case INVALID_REQUEST -> "Persistierte Vorschau ist ungültig. Bitte Vorschau neu erzeugen.";
            case CATALOG_FAILURE -> "Der Generierungskatalog konnte nicht geladen werden. Bitte erneut versuchen.";
            case GENERATION_FAILURE -> "Persistierte Vorschau konnte nicht verarbeitet werden. Bitte erneut versuchen.";
            case IDENTITY_CONFLICT -> "Persistierte Vorschau hat einen Identitätskonflikt. Bitte neu erzeugen.";
            case STORAGE_FAILURE -> "Persistierte Vorschau konnte nicht geladen werden. Bitte erneut versuchen.";
            case SUCCESS -> "Persistierte Vorschau konnte nicht geladen werden. Bitte erneut versuchen.";
        };
    }

}
