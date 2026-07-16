package architecture.system;

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

@Tag("architecture")
public final class TargetSourcePackageArchitectureTest {

    private static final List<String> TARGET_ROOTS = List.of("app", "shell", "platform", "features");
    private static final List<String> LEGACY_ROOTS = List.of("bootstrap", "src");
    private static final Pattern PACKAGE_DECLARATION = Pattern.compile(
            "(?m)^\\s*package\\s+([A-Za-z_][A-Za-z0-9_.]*)\\s*;");

    private TargetSourcePackageArchitectureTest() {
    }

    @Test
    void targetSourcesDeclareThePackageRepresentedByTheirPath() throws IOException {
        Path projectRoot = Path.of("").toAbsolutePath().normalize();
        List<String> violations = new ArrayList<>();

        for (String root : TARGET_ROOTS) {
            Path rootPath = projectRoot.resolve(root);
            if (!Files.isDirectory(rootPath)) {
                continue;
            }
            try (var sources = Files.walk(rootPath)) {
                for (Path source : sources.filter(TargetSourcePackageArchitectureTest::isJavaSource).toList()) {
                    verifyPackage(projectRoot, source, violations);
                }
            }
        }
        for (String root : LEGACY_ROOTS) {
            Path rootPath = projectRoot.resolve(root);
            if (!Files.isDirectory(rootPath)) {
                continue;
            }
            try (var sources = Files.walk(rootPath)) {
                for (Path source : sources.filter(TargetSourcePackageArchitectureTest::isJavaSource).toList()) {
                    rejectTargetPackageInLegacyRoot(projectRoot, source, violations);
                }
            }
        }

        assertTrue(violations.isEmpty(), () -> "Target source/package mismatches:\n" + String.join("\n", violations));
    }

    private static boolean isJavaSource(Path path) {
        return Files.isRegularFile(path) && path.getFileName().toString().endsWith(".java");
    }

    private static void verifyPackage(Path projectRoot, Path source, List<String> violations) throws IOException {
        String packageName = declaredPackage(source);
        Path parent = source.getParent();
        String expectedPackage = parent == null
                ? ""
                : projectRoot.relativize(parent).toString().replace(source.getFileSystem().getSeparator(), ".");
        if (!expectedPackage.equals(packageName)) {
            violations.add(projectRoot.relativize(source) + " declares '" + packageName
                    + "' instead of '" + expectedPackage + "'");
        }
    }

    private static void rejectTargetPackageInLegacyRoot(
            Path projectRoot,
            Path source,
            List<String> violations
    ) throws IOException {
        String packageName = declaredPackage(source);
        if (TARGET_ROOTS.stream().anyMatch(root -> inPackage(packageName, root))) {
            violations.add(projectRoot.relativize(source) + " declares target package '" + packageName
                    + "' from a legacy source root");
        }
    }

    private static String declaredPackage(Path source) throws IOException {
        return PACKAGE_DECLARATION.matcher(Files.readString(source))
                .results()
                .map(result -> result.group(1))
                .findFirst()
                .orElse("");
    }

    private static boolean inPackage(String actual, String expected) {
        return actual.equals(expected) || actual.startsWith(expected + ".");
    }
}
