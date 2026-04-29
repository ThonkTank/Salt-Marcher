package saltmarcher.quality.errorprone.view.inspectorentry;

import com.google.errorprone.VisitorState;
import com.sun.source.tree.CompilationUnitTree;
import java.util.LinkedHashSet;
import java.util.Set;
import saltmarcher.quality.errorprone.view.ViewArchitectureSupport;

final class ViewInspectorEntrySupport {

    private static final Set<String> ALLOWED_SHELL_TYPES = Set.of("shell.api.InspectorEntrySpec");

    private ViewInspectorEntrySupport() {
    }

    static boolean isInspectorEntrySource(CompilationUnitTree tree) {
        return ViewArchitectureSupport.VIEW_MODEL_PACKAGE.matcher(ViewArchitectureSupport.packageName(tree)).matches()
                && sourceFileName(tree).endsWith("InspectorEntry.java");
    }

    static Set<String> collectForbiddenReferences(CompilationUnitTree tree, VisitorState state) {
        String sourcePackageName = ViewArchitectureSupport.packageName(tree);
        String sourceText = sourceText(tree, state);
        Set<String> forbiddenReferences = new LinkedHashSet<>();
        for (String referencedType : ViewArchitectureSupport.collectReferencedTypes(tree)) {
            if (isForbidden(referencedType, sourcePackageName, sourceText)) {
                forbiddenReferences.add(referencedType);
            }
        }
        return forbiddenReferences;
    }

    static Set<String> collectForbiddenShellReferences(CompilationUnitTree tree) {
        Set<String> forbiddenReferences = new LinkedHashSet<>();
        for (String referencedType : ViewArchitectureSupport.collectReferencedTypes(tree)) {
            if (referencedType.startsWith("shell.") && !isAllowedShellType(referencedType)) {
                forbiddenReferences.add(referencedType);
            }
        }
        return forbiddenReferences;
    }

    private static boolean isForbidden(
            String referencedType,
            String sourcePackageName,
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
            return !referencedType.equals("javafx.scene.Node");
        }
        if (referencedType.startsWith("shell.")) {
            return !isAllowedShellType(referencedType);
        }
        if (referencedType.startsWith("src.data.")) {
            return true;
        }
        if (referencedType.startsWith("src.domain.")) {
            return !referencedType.matches("^src\\.domain\\.[^.]+\\.published\\..+");
        }

        ViewArchitectureSupport.ViewTypeInfo viewType = ViewArchitectureSupport.parseViewType(referencedType);
        if (viewType == null) {
            return false;
        }

        return !Set.of("MODEL", "VIEW", "INSPECTOR_ENTRY").contains(viewType.bucket())
                || !ViewArchitectureSupport.isSameViewRootReference(sourcePackageName, referencedType);
    }

    private static boolean isAllowedShellType(String referencedType) {
        if (referencedType == null || !referencedType.startsWith("shell.")) {
            return true;
        }
        for (String allowedType : ALLOWED_SHELL_TYPES) {
            if (referencedType.equals(allowedType)
                    || referencedType.startsWith(allowedType + "$")
                    || referencedType.startsWith(allowedType + ".")) {
                return true;
            }
        }
        return false;
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

    private static String sourceFileName(CompilationUnitTree tree) {
        if (tree.getSourceFile() == null) {
            return "";
        }
        String name = tree.getSourceFile().getName().replace('\\', '/');
        int separator = name.lastIndexOf('/');
        return separator < 0 ? name : name.substring(separator + 1);
    }
}
