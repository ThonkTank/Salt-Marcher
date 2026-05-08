package saltmarcher.architecture.view.viewinputevent;

import java.util.List;
import java.util.Map;
import java.util.Set;
import saltmarcher.architecture.ArchitectureContext;
import saltmarcher.architecture.ArchitectureRule;
import saltmarcher.architecture.SourceFile;
import saltmarcher.architecture.ViolationSink;
import saltmarcher.architecture.view.PassiveViewInputEventSeamSupport;
import saltmarcher.architecture.view.PassiveViewInputEventSeamSupport.InteractivePassiveView;
import saltmarcher.architecture.view.ViewRoleSupport;

public final class ViewInputEventTopologyRules implements ArchitectureRule {

    @Override
    public void check(ArchitectureContext context, ViolationSink violations) {
        Map<ViewRoleSupport.ViewUnit, List<SourceFile>> units =
                ViewRoleSupport.groupByUnit(context.sourceFiles(violations));
        for (Map.Entry<ViewRoleSupport.ViewUnit, List<SourceFile>> entry : units.entrySet()) {
            ViewRoleSupport.ViewUnit unit = entry.getKey();
            List<SourceFile> files = entry.getValue();
            long viewCount = files.stream().filter(ViewRoleSupport::isPassiveViewFile).count();
            long intentHandlerCount = files.stream().filter(ViewRoleSupport::isIntentHandlerFile).count();
            long viewInputEventCount = files.stream().filter(ViewRoleSupport::isViewInputEventFile).count();
            Set<String> passiveViewStems = ViewRoleSupport.passiveViewStems(files);
            Set<String> viewInputEventStems = ViewRoleSupport.viewInputEventStems(files);
            List<InteractivePassiveView> interactiveViews =
                    PassiveViewInputEventSeamSupport.scan(context, files, violations);
            if (intentHandlerCount == 0) {
                if (viewInputEventCount > 0) {
                    violations.add(unit.source(), "view-viewinputevent-no-intenthandler",
                            "*ViewInputEvent files may exist only when the view unit also defines a local *IntentHandler.");
                }
                for (InteractivePassiveView interactiveView : interactiveViews) {
                    violations.add(interactiveView.source(), "view-viewinputevent-no-intenthandler",
                            "Passive *View surfaces that expose onViewInputEvent(...) may exist only when the view unit also defines a local *IntentHandler.");
                }
                continue;
            }
            if (viewCount == 0) {
                violations.add(unit.source(), "view-viewinputevent-view-required",
                        "Interactive view units with an *IntentHandler must also define at least one passive *View.java surface.");
            }
            for (String eventStem : viewInputEventStems) {
                if (!passiveViewStems.contains(eventStem)) {
                    violations.add(unit.source(), "view-viewinputevent-same-stem",
                            "*ViewInputEvent files must belong to a same-stem passive *View.java surface in the same view unit.");
                }
            }
            for (InteractivePassiveView interactiveView : interactiveViews) {
                validateInteractiveView(interactiveView, viewInputEventStems, violations);
            }
        }
    }

    private static void validateInteractiveView(
            InteractivePassiveView interactiveView,
            Set<String> viewInputEventStems,
            ViolationSink violations
    ) {
        String expectedEvent = interactiveView.expectedViewInputEventSimpleName();
        String declaredEvent = interactiveView.declaredEventSimpleName();
        if (declaredEvent == null) {
            violations.add(interactiveView.source(), "view-viewinputevent-same-stem",
                    "Passive *View surfaces that expose onViewInputEvent(...) must use Consumer<SameStemViewInputEvent> and own a same-stem *ViewInputEvent.java file in the same view unit.");
            return;
        }
        if (!expectedEvent.equals(declaredEvent)) {
            violations.add(interactiveView.source(), "view-viewinputevent-same-stem",
                    "Passive *View surfaces that expose onViewInputEvent(...) must use their own same-stem carrier. Expected "
                            + expectedEvent + " but found " + declaredEvent + ".");
            return;
        }
        if (!viewInputEventStems.contains(interactiveView.viewStem())) {
            violations.add(interactiveView.source(), "view-viewinputevent-same-stem",
                    "Passive *View surfaces that expose onViewInputEvent(...) must own a same-stem *ViewInputEvent.java file in the same view unit. Missing "
                            + expectedEvent + ".");
        }
    }
}
