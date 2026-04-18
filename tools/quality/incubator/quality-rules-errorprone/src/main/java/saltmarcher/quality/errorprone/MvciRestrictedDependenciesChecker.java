package saltmarcher.quality.errorprone;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.sun.source.tree.CompilationUnitTree;
import com.sun.source.tree.ImportTree;
import java.util.LinkedHashSet;
import java.util.Set;

@BugPattern(
        name = "MvciRestrictedDependencies",
        summary = "MVCI view buckets must not import forbidden layers or shell types.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class MvciRestrictedDependenciesChecker extends BugChecker
        implements BugChecker.CompilationUnitTreeMatcher {

    @Override
    public Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) {
        if (tree.getPackageName() == null) {
            return Description.NO_MATCH;
        }
        String packageName = tree.getPackageName().toString();
        SourceRole sourceRole = SourceRole.fromPackage(packageName);
        if (sourceRole == SourceRole.OTHER) {
            return Description.NO_MATCH;
        }

        Set<String> forbiddenImports = new LinkedHashSet<>();
        for (ImportTree importTree : tree.getImports()) {
            String imported = importTree.getQualifiedIdentifier().toString();
            if (isForbidden(sourceRole, imported)) {
                forbiddenImports.add(imported);
            }
        }

        if (forbiddenImports.isEmpty()) {
            return Description.NO_MATCH;
        }
        return buildDescription(tree)
                .setMessage("Package '" + packageName + "' violates strict MVCI dependency rules via imports: "
                        + String.join(", ", forbiddenImports))
                .build();
    }

    private static boolean isForbidden(SourceRole sourceRole, String imported) {
        if (imported.startsWith("shell.")) {
            return sourceRole != SourceRole.ASSEMBLY && sourceRole != SourceRole.ROOT;
        }
        return switch (sourceRole) {
            case MODEL -> isViewBucket(imported, "Controller")
                    || isViewBucket(imported, "View")
                    || isViewBucket(imported, "interactor")
                    || isViewBucket(imported, "assembly")
                    || imported.startsWith("src.domain.")
                    || imported.startsWith("src.data.");
            case VIEW -> isViewBucket(imported, "interactor")
                    || imported.startsWith("src.domain.")
                    || imported.startsWith("src.data.");
            case CONTROLLER -> isViewBucket(imported, "View")
                    || isViewBucket(imported, "assembly")
                    || imported.startsWith("src.domain.")
                    || imported.startsWith("src.data.");
            case INTERACTOR -> false;
            case ROOT, ASSEMBLY, OTHER -> false;
        };
    }

    private static boolean isViewBucket(String imported, String bucket) {
        return imported.matches("^src\\.view\\.[^.]+\\." + java.util.regex.Pattern.quote(bucket) + "(\\.|$).*");
    }

    private enum SourceRole {
        ROOT,
        ASSEMBLY,
        MODEL,
        VIEW,
        CONTROLLER,
        INTERACTOR,
        OTHER;

        static SourceRole fromPackage(String packageName) {
            if (!packageName.startsWith("src.view.")) {
                return OTHER;
            }
            if (packageName.matches("^src\\.view\\.[^.]+$")) {
                return ROOT;
            }
            if (packageName.matches("^src\\.view\\.[^.]+\\.assembly(\\..*)?$")) {
                return ASSEMBLY;
            }
            if (packageName.matches("^src\\.view\\.[^.]+\\.Model(\\..*)?$")) {
                return MODEL;
            }
            if (packageName.matches("^src\\.view\\.[^.]+\\.View(\\..*)?$")) {
                return VIEW;
            }
            if (packageName.matches("^src\\.view\\.[^.]+\\.Controller(\\..*)?$")) {
                return CONTROLLER;
            }
            if (packageName.matches("^src\\.view\\.[^.]+\\.interactor(\\..*)?$")) {
                return INTERACTOR;
            }
            return OTHER;
        }
    }
}
