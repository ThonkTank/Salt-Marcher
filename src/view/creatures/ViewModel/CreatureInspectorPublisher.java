package src.view.creatures.ViewModel;

import src.domain.creatures.api.CreatureDetail;

public interface CreatureInspectorPublisher {

    boolean isShowing(Object inspectorKey);

    void show(CreatureDetail detail, Object inspectorKey);
}
