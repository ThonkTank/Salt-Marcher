package saltmarcher.quality.errorprone.view.intenthandler;

import com.google.errorprone.VisitorState;
import com.sun.source.tree.CompilationUnitTree;
import java.util.LinkedHashSet;
import java.util.Set;

final class ViewIntentHandlerDependencySupport {

    private ViewIntentHandlerDependencySupport() {
    }

    static Set<String> collectForbiddenReferences(CompilationUnitTree tree, VisitorState state) {
        String sourcePackageName = ViewIntentHandlerArchitectureSupport.packageName(tree);
        String sourceText = sourceText(tree, state);
        Set<String> forbiddenReferences = new LinkedHashSet<>();
        for (String referencedType : ViewIntentHandlerArchitectureSupport.collectReferencedTypes(tree)) {
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
        if (ViewIntentHandlerArchitectureSupport.isForbiddenViewInfrastructureJdkType(referencedType)) {
            return true;
        }
        if (referencedType.startsWith("javafx.")) {
            return true;
        }
        if (referencedType.startsWith("shell.")
                || referencedType.startsWith("src.data.")
                || referencedType.startsWith("src.domain.")) {
            return true;
        }

        ViewIntentHandlerArchitectureSupport.ViewTypeInfo viewType =
                ViewIntentHandlerArchitectureSupport.parseViewType(referencedType);
        if (viewType == null) {
            return false;
        }
        if (Set.of("HANDLER", "VIEW_INPUT_EVENT", "PUBLISHED_EVENT").contains(viewType.bucket())) {
            return !ViewIntentHandlerArchitectureSupport.isSameViewRootReference(sourcePackageName, referencedType);
        }
        return !"MODEL".equals(viewType.bucket())
                || !ViewIntentHandlerArchitectureSupport.isSameViewRootReference(sourcePackageName, referencedType);
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
