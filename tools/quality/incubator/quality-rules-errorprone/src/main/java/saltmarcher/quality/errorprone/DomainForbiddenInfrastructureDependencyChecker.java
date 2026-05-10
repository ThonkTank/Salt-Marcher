package saltmarcher.quality.errorprone;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.sun.source.tree.CompilationUnitTree;
import java.util.Set;
import java.util.TreeSet;

@BugPattern(
        name = "DomainForbiddenInfrastructureDependency",
        summary = "Domain code must not depend on outer-layer or infrastructure types.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class DomainForbiddenInfrastructureDependencyChecker extends BugChecker
        implements BugChecker.CompilationUnitTreeMatcher {

    private static final Set<String> FORBIDDEN_PREFIXES = Set.of(
            "bootstrap.",
            "shell.",
            "src.view.",
            "src.data.",
            "javafx.",
            "java.sql.",
            "javax.sql.",
            "javax.json.",
            "jakarta.json.",
            "com.fasterxml.jackson.",
            "org.json.",
            "java.net.",
            "okhttp3.",
            "retrofit2.",
            "java.io.",
            "java.nio.file.",
            "javax.transaction.",
            "jakarta.transaction.",
            "javax.persistence.",
            "jakarta.persistence.",
            "org.jooq.",
            "org.hibernate.",
            "com.zaxxer.hikari.");
    private static final Set<String> FORBIDDEN_TYPES = Set.of(
            "java.lang.AutoCloseable",
            "java.io.Closeable");

    @Override
    public Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) {
        String packageName = DataArchitectureSupport.packageName(tree);
        if (!packageName.startsWith("src.domain.")) {
            return Description.NO_MATCH;
        }

        TreeSet<String> forbiddenReferences = new TreeSet<>();
        for (String referencedType : DataArchitectureSupport.collectReferencedTypes(tree)) {
            if (isForbiddenReference(referencedType)) {
                forbiddenReferences.add(referencedType);
            }
        }

        if (forbiddenReferences.isEmpty()) {
            return Description.NO_MATCH;
        }
        return buildDescription(tree)
                .setMessage("Domain package '" + packageName
                        + "' references outer-layer or infrastructure type(s): "
                        + String.join(", ", forbiddenReferences)
                        + ". Domain code must stay inside the application core; use domain-owned repositories and adapters outside src/domain/**.")
                .build();
    }

    private static boolean isForbiddenReference(String referencedType) {
        if (referencedType == null || referencedType.isBlank()) {
            return false;
        }
        if (FORBIDDEN_TYPES.contains(referencedType)) {
            return true;
        }
        for (String forbiddenPrefix : FORBIDDEN_PREFIXES) {
            if (referencedType.startsWith(forbiddenPrefix)) {
                return true;
            }
        }
        return false;
    }
}
