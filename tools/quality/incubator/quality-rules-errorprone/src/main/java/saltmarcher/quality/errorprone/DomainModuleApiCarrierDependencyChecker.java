package saltmarcher.quality.errorprone;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.sun.source.tree.CompilationUnitTree;
import java.util.Set;
import java.util.TreeSet;
import java.util.regex.Pattern;

@BugPattern(
        name = "DomainModuleNoApiCarrierDependency",
        summary = "Named domain modules must not depend on same-feature API command/query/result carriers.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class DomainModuleApiCarrierDependencyChecker extends BugChecker
        implements BugChecker.CompilationUnitTreeMatcher {

    private static final Pattern NAMED_DOMAIN_MODULE_PACKAGE =
            Pattern.compile("^src\\.domain\\.([^.]+)\\.((?!api$|application$)[^.]+)(\\..*)?$");
    private static final Set<String> FORBIDDEN_API_CARRIER_SUFFIXES = Set.of(
            "Command",
            "Query",
            "Result",
            "Draft",
            "Snapshot",
            "Page",
            "Detail",
            "Details",
            "Options",
            "Payload");

    @Override
    public Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) {
        String packageName = DataArchitectureSupport.packageName(tree);
        var matcher = NAMED_DOMAIN_MODULE_PACKAGE.matcher(packageName);
        if (!matcher.matches()) {
            return Description.NO_MATCH;
        }
        if (isDomainPortContract(tree)) {
            return Description.NO_MATCH;
        }

        String featureName = matcher.group(1);
        TreeSet<String> forbiddenReferences = new TreeSet<>();
        for (String referencedType : DataArchitectureSupport.collectReferencedTypes(tree)) {
            if (isForbiddenSameFeatureApiCarrier(referencedType, featureName)) {
                forbiddenReferences.add(referencedType);
            }
        }

        if (forbiddenReferences.isEmpty()) {
            return Description.NO_MATCH;
        }
        return buildDescription(tree)
                .setMessage("Named domain module '" + packageName
                        + "' depends on same-feature API carrier type(s): "
                        + String.join(", ", forbiddenReferences)
                        + ". Translate API carriers at the root/application boundary before entering the model.")
                .build();
    }

    private static boolean isForbiddenSameFeatureApiCarrier(String referencedType, String featureName) {
        String prefix = "src.domain." + featureName + ".api.";
        if (referencedType == null || !referencedType.startsWith(prefix)) {
            return false;
        }
        String simpleName = simpleName(referencedType);
        return FORBIDDEN_API_CARRIER_SUFFIXES.stream().anyMatch(simpleName::endsWith);
    }

    private static boolean isDomainPortContract(CompilationUnitTree tree) {
        String sourceName = tree.getSourceFile() == null ? "" : tree.getSourceFile().getName();
        return sourceName.endsWith("Repository.java") || sourceName.endsWith("Port.java");
    }

    private static String simpleName(String qualifiedName) {
        int dotIndex = qualifiedName.lastIndexOf('.');
        int nestedIndex = qualifiedName.lastIndexOf('$');
        int start = Math.max(dotIndex, nestedIndex) + 1;
        return qualifiedName.substring(start);
    }
}
