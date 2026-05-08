package saltmarcher.quality.errorprone.view.contribution;

import com.google.errorprone.VisitorState;
import com.sun.source.tree.CompilationUnitTree;
import java.util.LinkedHashSet;
import java.util.Set;
import saltmarcher.quality.errorprone.view.ViewArchitectureSupport;
import saltmarcher.quality.errorprone.view.ViewRolePolicy;

final class ViewContributionDependencySupport {

    private ViewContributionDependencySupport() {
    }

    static Set<String> collectForbiddenReferences(CompilationUnitTree tree, VisitorState state) {
        String sourcePackageName = ViewArchitectureSupport.packageName(tree);
        String sourceText = sourceText(tree, state);
        Set<String> forbiddenReferences = new LinkedHashSet<>();
        for (String referencedType : ViewArchitectureSupport.collectReferencedTypes(tree)) {
            if (isForbidden(sourcePackageName, referencedType, sourceText)) {
                forbiddenReferences.add(referencedType);
            }
        }
        return forbiddenReferences;
    }

    private static boolean isForbidden(
            String sourcePackageName,
            String referencedType,
            String sourceText
    ) {
        if (referencedType == null || referencedType.isBlank()) {
            return false;
        }
        if ("java.util.concurrent.Callable".equals(referencedType)
                && !sourceText.contains("Callable")
                && !sourceText.contains("java.util.concurrent")) {
            return false;
        }
        if (ViewArchitectureSupport.isForbiddenViewInfrastructureJdkType(referencedType)) {
            return true;
        }
        if (referencedType.startsWith("javafx.")) {
            return true;
        }
        if (referencedType.startsWith("shell.")) {
            return !ViewRolePolicy.isAllowedContributionShellType(referencedType);
        }
        if (referencedType.startsWith("src.data.")
                || referencedType.startsWith("src.domain.")) {
            return true;
        }

        ViewArchitectureSupport.ViewTypeInfo viewType = ViewArchitectureSupport.parseViewType(referencedType);
        if (viewType == null) {
            return false;
        }
        if ("CONTRIBUTION".equals(viewType.bucket())
                && ViewArchitectureSupport.isSameViewRootReference(sourcePackageName, referencedType)) {
            return false;
        }
        return !"BINDER".equals(viewType.bucket())
                || !ViewArchitectureSupport.isSameViewRootReference(sourcePackageName, referencedType);
    }

    private static String sourceText(CompilationUnitTree tree, VisitorState state) {
        if (tree.getSourceFile() == null) {
            return "";
        }
        try {
            String sourceText = state.getSourceForNode(tree);
            return sourceText == null ? "" : sourceText;
        } catch (IllegalArgumentException ignored) {
            return "";
        }
    }
}
