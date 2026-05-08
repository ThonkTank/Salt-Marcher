package saltmarcher.architecture.view.viewinputevent;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import saltmarcher.architecture.ArchitectureContext;
import saltmarcher.architecture.ArchitectureRule;
import saltmarcher.architecture.ViolationSink;
import saltmarcher.architecture.view.PassiveViewInputEventSeamSupport;
import saltmarcher.architecture.view.PassiveViewInputEventSeamSupport.InteractivePassiveView;
import saltmarcher.architecture.view.ViewRole;
import saltmarcher.architecture.view.ViewSourceDescriptor;
import saltmarcher.architecture.view.ViewTopologyCatalog;
import saltmarcher.architecture.view.ViewUnitDescriptor;
import saltmarcher.architecture.view.ViewUnitKind;

public final class ViewInputEventTopologyRules implements ArchitectureRule {

    @Override
    public void check(ArchitectureContext context, ViolationSink violations) {
        Map<ViewUnitDescriptor, List<ViewSourceDescriptor>> units =
                ViewTopologyCatalog.groupRecognizedUnits(context.sourceFiles(violations));
        for (Map.Entry<ViewUnitDescriptor, List<ViewSourceDescriptor>> entry : units.entrySet()) {
            ViewUnitDescriptor unit = entry.getKey();
            List<ViewSourceDescriptor> files = entry.getValue();
            long viewCount = files.stream().filter(source -> source.role() == ViewRole.VIEW).count();
            long intentHandlerCount = files.stream().filter(source -> source.role() == ViewRole.INTENT_HANDLER).count();
            long viewInputEventCount = files.stream().filter(source -> source.role() == ViewRole.VIEW_INPUT_EVENT).count();
            Set<String> passiveViewStems = files.stream()
                    .filter(source -> source.role() == ViewRole.VIEW)
                    .map(ViewSourceDescriptor::stem)
                    .filter(stem -> !stem.isBlank())
                    .collect(Collectors.toCollection(java.util.LinkedHashSet::new));
            Set<String> viewInputEventStems = files.stream()
                    .filter(source -> source.role() == ViewRole.VIEW_INPUT_EVENT)
                    .map(ViewSourceDescriptor::stem)
                    .filter(stem -> !stem.isBlank())
                    .collect(Collectors.toCollection(java.util.LinkedHashSet::new));
            List<InteractivePassiveView> interactiveViews =
                    PassiveViewInputEventSeamSupport.scan(context, files, violations);
            if (unit.kind() == ViewUnitKind.ACTIVE_ROOT) {
                validateActiveRootUnit(
                        unit,
                        viewCount,
                        intentHandlerCount,
                        viewInputEventCount,
                        interactiveViews,
                        violations);
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

    private static void validateActiveRootUnit(
            ViewUnitDescriptor unit,
            long viewCount,
            long intentHandlerCount,
            long viewInputEventCount,
            List<InteractivePassiveView> interactiveViews,
            ViolationSink violations
    ) {
        if (intentHandlerCount == 0) {
            if (viewInputEventCount > 0) {
                violations.add(unit.source(), "view-viewinputevent-no-intenthandler",
                        "*ViewInputEvent files may exist only when the active view unit also defines a local *IntentHandler.");
            }
            for (InteractivePassiveView interactiveView : interactiveViews) {
                violations.add(interactiveView.source(), "view-viewinputevent-no-intenthandler",
                        "Active-root passive *View surfaces that expose onViewInputEvent(...) may exist only when the same view unit also defines a local *IntentHandler.");
            }
            return;
        }
        if (viewCount == 0) {
            violations.add(unit.source(), "view-viewinputevent-view-required",
                    "Interactive active view units with an *IntentHandler must also define at least one passive *View.java surface.");
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
