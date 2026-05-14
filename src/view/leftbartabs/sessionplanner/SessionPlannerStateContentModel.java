package src.view.leftbartabs.sessionplanner;

import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import src.domain.sessionplanner.published.SessionPlannerStatePanelProjection;

public final class SessionPlannerStateContentModel {

    private final ReadOnlyObjectWrapper<Projection> projection =
            new ReadOnlyObjectWrapper<>(Projection.empty());

    ReadOnlyObjectProperty<Projection> projectionProperty() {
        return projection.getReadOnlyProperty();
    }

    void applyStatePanel(SessionPlannerStatePanelProjection statePanelProjection) {
        projection.set(Projection.from(statePanelProjection));
    }

    record Projection(
            boolean selectedEncounterAvailable,
            String selectedEncounterTitle,
            String selectedEncounterDetail,
            String selectedEncounterXpSummary,
            String stateContextLabel,
            String placeholderTitle,
            String placeholderDetail
    ) {

        Projection {
            selectedEncounterTitle = safeText(selectedEncounterTitle);
            selectedEncounterDetail = safeText(selectedEncounterDetail);
            selectedEncounterXpSummary = safeText(selectedEncounterXpSummary);
            stateContextLabel = safeText(stateContextLabel);
            placeholderTitle = safeText(placeholderTitle);
            placeholderDetail = safeText(placeholderDetail);
        }

        static Projection empty() {
            return new Projection(
                    false,
                    "Kein Session-Encounter ausgewaehlt",
                    "Waehle im Planner einen Encounter aus, um den vorbereitenden State-Kontext zu sehen.",
                    "",
                    "",
                    "Katalog-Vorbereitung",
                    "Planner-owned read-only Placeholder.");
        }

        static Projection from(SessionPlannerStatePanelProjection projection) {
            SessionPlannerStatePanelProjection safe =
                    projection == null ? SessionPlannerStatePanelProjection.empty() : projection;
            return new Projection(
                    safe.selectedEncounterAvailable(),
                    safe.selectedEncounterTitle(),
                    safe.selectedEncounterDetail(),
                    safe.selectedEncounterXpSummary(),
                    safe.stateContextLabel(),
                    safe.placeholderTitle(),
                    safe.placeholderDetail());
        }

        private static String safeText(String text) {
            return text == null ? "" : text;
        }
    }
}
