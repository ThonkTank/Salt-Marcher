package saltmarcher.quality.errorprone;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.sun.source.tree.CompilationUnitTree;
import java.util.LinkedHashSet;
import java.util.Set;

@BugPattern(
        name = "ViewModelFrameworkIndependence",
        summary = "ViewModels stay independent from shell and view classes; contributions own shell/view wiring.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class ViewModelFrameworkIndependenceChecker extends BugChecker
        implements BugChecker.CompilationUnitTreeMatcher {

    @Override
    public Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) {
        String packageName = ViewArchitectureSupport.packageName(tree);
        boolean contribution = ViewArchitectureSupport.isContributionSource(tree);
        boolean viewModel = ViewArchitectureSupport.isViewModelSource(tree);
        if (!contribution && !viewModel) {
            return Description.NO_MATCH;
        }

        Set<String> forbiddenReferences = new LinkedHashSet<>();
        for (String referencedType : ViewArchitectureSupport.collectReferencedTypes(tree)) {
            collectForbiddenReferences(referencedType, contribution, forbiddenReferences);
        }

        if (forbiddenReferences.isEmpty()) {
            return Description.NO_MATCH;
        }
        return buildDescription(tree)
                .setMessage("Package '" + packageName
                        + "' violates MVVM ViewModel independence via references: "
                        + String.join(", ", forbiddenReferences))
                .build();
    }

    private static void collectForbiddenReferences(
            String qualifiedName,
            boolean contribution,
            Set<String> forbiddenReferences) {
        if (qualifiedName == null || qualifiedName.isBlank()) {
            return;
        }
        if (isForbidden(qualifiedName, contribution)) {
            forbiddenReferences.add(qualifiedName);
        }
    }

    private static boolean isForbidden(String referencedType, boolean contribution) {
        if (referencedType.startsWith("javafx.")) {
            return contribution
                    ? !ViewArchitectureSupport.isAllowedModelJavafxType(referencedType)
                    : !ViewArchitectureSupport.isAllowedViewModelJavafxType(referencedType);
        }
        if (referencedType.startsWith("shell.")) {
            return !contribution || !ViewArchitectureSupport.isAllowedContributionShellType(referencedType);
        }
        if (referencedType.startsWith("src.data.")) {
            return true;
        }
        if (referencedType.startsWith("src.domain.")) {
            return !ViewArchitectureSupport.isAllowedDomainBoundary(referencedType);
        }
        ViewArchitectureSupport.ViewTypeInfo viewType = ViewArchitectureSupport.parseViewType(referencedType);
        if (viewType == null) {
            return false;
        }
        if (contribution) {
            return !"CONTRIBUTION".equals(viewType.bucket())
                    && !"MODEL".equals(viewType.bucket())
                    && !"VIEW".equals(viewType.bucket());
        }
        return !"MODEL".equals(viewType.bucket());
    }
}
