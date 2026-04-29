package saltmarcher.architecture.view.contentmodel;

import java.util.List;
import java.util.Map;
import saltmarcher.architecture.ArchitectureContext;
import saltmarcher.architecture.ArchitectureRule;
import saltmarcher.architecture.SourceFile;
import saltmarcher.architecture.ViolationSink;
import saltmarcher.architecture.view.ViewRoleSupport;

public final class ViewContentModelTopologyRules implements ArchitectureRule {

    @Override
    public void check(ArchitectureContext context, ViolationSink violations) {
        Map<ViewRoleSupport.ViewUnit, List<SourceFile>> units =
                ViewRoleSupport.groupByUnit(context.sourceFiles(violations));
        for (Map.Entry<ViewRoleSupport.ViewUnit, List<SourceFile>> entry : units.entrySet()) {
            ViewRoleSupport.ViewUnit unit = entry.getKey();
            if (!ViewRoleSupport.isSlotcontent(unit)) {
                continue;
            }
            for (SourceFile sourceFile : entry.getValue()) {
                if (ViewRoleSupport.isLegacyViewModelFile(sourceFile) || ViewRoleSupport.isProjectorFile(sourceFile)) {
                    violations.add(sourceFile.relativePath(), "view-projectionmodel-legacy-role",
                            "Active view architecture must use *ContributionModel.java or *ContentModel.java and must not retain *ViewModel.java, *PresentationModel.java, or *Projector.java role files.");
                    continue;
                }
                if (!ViewRoleSupport.isProjectionModelFile(sourceFile)) {
                    continue;
                }
                if (!ViewRoleSupport.isContentModelFile(sourceFile)) {
                    violations.add(sourceFile.relativePath(), "view-projectionmodel-slotcontent-suffix",
                            "Reusable slotcontent units must name their reusable projection role *ContentModel.java.");
                }
            }
        }
    }
}
