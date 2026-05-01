package saltmarcher.quality.errorprone;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.sun.source.tree.CompilationUnitTree;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;

@BugPattern(
        name = "DataQueryGatewayCollaboratorBoundary",
        summary = "Query port adapters must depend on source-adapter facades, not concrete source mechanics.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class DataQueryGatewayCollaboratorBoundaryChecker extends BugChecker
        implements BugChecker.CompilationUnitTreeMatcher {

    @Override
    public Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) {
        String packageName = DataArchitectureSupport.packageName(tree);
        Matcher queryMatcher = DataArchitectureSupport.QUERY_PACKAGE.matcher(packageName);
        if (!queryMatcher.matches()) {
            return Description.NO_MATCH;
        }
        String featureName = queryMatcher.group(1);

        List<String> violations = new ArrayList<>();
        Set<String> referencedTypes = DataArchitectureSupport.collectReferencedTypes(tree);
        for (String referencedType : referencedTypes) {
            GatewayType gatewayType = GatewayType.from(referencedType);
            if (gatewayType == null || !gatewayType.featureName().equals(featureName)) {
                continue;
            }
            if (!gatewayType.topLevelSimpleName().endsWith("Gateway")) {
                violations.add(referencedType);
            }
        }

        if (violations.isEmpty()) {
            return Description.NO_MATCH;
        }
        return buildDescription(tree)
                .setMessage("Query adapter package '" + packageName
                        + "' depends directly on concrete source-adapter mechanics: "
                        + String.join(", ", violations)
                        + ". Coordinate query source work through an own-feature source-adapter facade type ending in 'Gateway'.")
                .build();
    }

    private record GatewayType(String featureName, String topLevelSimpleName) {

        static GatewayType from(String qualifiedName) {
            if (qualifiedName == null) {
                return null;
            }
            Matcher matcher = DataArchitectureSupport.GATEWAY_PACKAGE.matcher(packageName(qualifiedName));
            if (!matcher.matches()) {
                return null;
            }
            return new GatewayType(matcher.group(1), topLevelSimpleName(qualifiedName));
        }

        private static String packageName(String qualifiedName) {
            int separator = qualifiedName.lastIndexOf('.');
            return separator < 0 ? "" : qualifiedName.substring(0, separator);
        }

        private static String topLevelSimpleName(String qualifiedName) {
            int packageSeparator = qualifiedName.lastIndexOf('.');
            String simpleName = packageSeparator < 0 ? qualifiedName : qualifiedName.substring(packageSeparator + 1);
            int nestedSeparator = simpleName.indexOf('$');
            return nestedSeparator < 0 ? simpleName : simpleName.substring(0, nestedSeparator);
        }
    }
}
