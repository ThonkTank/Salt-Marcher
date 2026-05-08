package saltmarcher.architecture.view.contributionmodel;

import java.util.List;
import java.util.Map;
import saltmarcher.architecture.ArchitectureContext;
import saltmarcher.architecture.ArchitectureRule;
import saltmarcher.architecture.ViolationSink;
import saltmarcher.architecture.view.ViewRole;
import saltmarcher.architecture.view.ViewSourceDescriptor;
import saltmarcher.architecture.view.ViewTopologyCatalog;
import saltmarcher.architecture.view.ViewUnitDescriptor;
import saltmarcher.architecture.view.ViewUnitKind;

public final class ViewContributionModelTopologyRules implements ArchitectureRule {

    @Override
    public void check(ArchitectureContext context, ViolationSink violations) {
        Map<ViewUnitDescriptor, List<ViewSourceDescriptor>> units =
                ViewTopologyCatalog.groupRecognizedUnits(context.sourceFiles(violations));
        for (Map.Entry<ViewUnitDescriptor, List<ViewSourceDescriptor>> entry : units.entrySet()) {
            ViewUnitDescriptor unit = entry.getKey();
            if (unit.kind() != ViewUnitKind.ACTIVE_ROOT) {
                continue;
            }
            for (ViewSourceDescriptor source : entry.getValue()) {
                if (source.role() == ViewRole.LEGACY_VIEW_MODEL || source.role() == ViewRole.PROJECTOR) {
                    violations.add(source.source(), "view-projectionmodel-legacy-role",
                            "Active view architecture must use *ContributionModel.java or *ContentModel.java and must not retain *ViewModel.java, *PresentationModel.java, or *Projector.java role files.");
                    continue;
                }
                if (!source.role().isProjectionModel()) {
                    continue;
                }
                if (source.role() != ViewRole.CONTRIBUTION_MODEL) {
                    violations.add(source.source(), "view-projectionmodel-active-suffix",
                            "Active contribution roots must name their aggregate projection role *ContributionModel.java.");
                }
            }
        }
    }
}
