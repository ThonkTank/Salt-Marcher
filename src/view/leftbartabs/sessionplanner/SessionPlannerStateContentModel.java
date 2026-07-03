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
            boolean selectedSceneAvailable,
            String selectedSceneTitle,
            String selectedSceneDetail,
            String selectedSceneXpSummary,
            String stateContextLabel,
            String placeholderTitle,
            String placeholderDetail
    ) {

        Projection {
            selectedSceneTitle = safeText(selectedSceneTitle);
            selectedSceneDetail = safeText(selectedSceneDetail);
            selectedSceneXpSummary = safeText(selectedSceneXpSummary);
            stateContextLabel = safeText(stateContextLabel);
            placeholderTitle = safeText(placeholderTitle);
            placeholderDetail = safeText(placeholderDetail);
        }

        static Projection empty() {
            return new Projection(
                    false,
                    "Keine Session-Szene ausgewaehlt",
                    "Waehle im Planner eine Szene aus, um den vorbereitenden State-Kontext zu sehen.",
                    "",
                    "",
                    "Katalog-Vorbereitung",
                    "Planner-owned read-only Placeholder.");
        }

        static Projection from(SessionPlannerStatePanelProjection projection) {
            SessionPlannerStatePanelProjection safe =
                    projection == null ? SessionPlannerStatePanelProjection.empty() : projection;
            return new Projection(
                    safe.selectedSceneAvailable(),
                    safe.selectedSceneTitle(),
                    safe.selectedSceneDetail(),
                    safe.selectedSceneXpSummary(),
                    safe.stateContextLabel(),
                    safe.placeholderTitle(),
                    safe.placeholderDetail());
        }

        private static String safeText(String text) {
            return text == null ? "" : text;
        }
    }
}
