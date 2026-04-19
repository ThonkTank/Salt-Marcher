package saltmarcher.quality.errorprone;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.sun.source.tree.CompilationUnitTree;
import java.util.LinkedHashSet;
import java.util.Set;

@BugPattern(
        name = "FeatureShellApiAllowlist",
        summary = "View contributions and data service roots may use only their documented shell API subset.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class FeatureShellApiAllowlistChecker extends BugChecker
        implements BugChecker.CompilationUnitTreeMatcher {

    @Override
    public Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) {
        String packageName = ViewArchitectureSupport.packageName(tree);
        ShellPolicy shellPolicy = shellPolicy(packageName);
        if (shellPolicy == null) {
            return Description.NO_MATCH;
        }

        Set<String> forbiddenReferences = new LinkedHashSet<>();
        for (String referencedType : ViewArchitectureSupport.collectReferencedTypes(tree)) {
            if (referencedType.startsWith("shell.host.")) {
                forbiddenReferences.add(referencedType);
                continue;
            }
            if (referencedType.startsWith("shell.api.")
                    && !shellPolicy.isAllowed(referencedType)) {
                forbiddenReferences.add(referencedType);
            }
        }

        if (forbiddenReferences.isEmpty()) {
            return Description.NO_MATCH;
        }
        return buildDescription(tree)
                .setMessage("Package '" + packageName
                        + "' references shell types outside its allowed shell contract subset: "
                        + String.join(", ", forbiddenReferences))
                .build();
    }

    private static ShellPolicy shellPolicy(String packageName) {
        if (ViewArchitectureSupport.isContributionSource(treeFromPackage(packageName))) {
            return ShellPolicy.MODEL;
        }
        if (ViewArchitectureSupport.DATA_ROOT_PACKAGE.matcher(packageName).matches()) {
            return ShellPolicy.DATA_ROOT;
        }
        return null;
    }

    private enum ShellPolicy {
        MODEL {
            @Override
            boolean isAllowed(String referencedType) {
                return ViewArchitectureSupport.isAllowedContributionShellType(referencedType);
            }
        },
        DATA_ROOT {
            @Override
            boolean isAllowed(String referencedType) {
                return ViewArchitectureSupport.isAllowedDataRootShellType(referencedType);
            }
        };

        abstract boolean isAllowed(String referencedType);
    }

    private static CompilationUnitTree treeFromPackage(String unused) {
        throw new UnsupportedOperationException("Synthetic tree placeholder should never be called.");
    }
}
