package saltmarcher.quality.pmd;

import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import net.sourceforge.pmd.lang.document.TextDocument;
import net.sourceforge.pmd.lang.java.ast.ASTCompilationUnit;

final class SaltMarcherSourceFacts {

    static final Pattern REGISTRATION_SPEC_METHOD_PATTERN =
            Pattern.compile("\\bShellContributionSpec\\s+registrationSpec\\s*\\(\\s*\\)");
    static final Pattern CREATE_SCREEN_METHOD_PATTERN =
            Pattern.compile("\\bShellScreen\\s+createScreen\\s*\\(\\s*(?:final\\s+)?(?:shell\\.host\\.)?ShellRuntimeContext\\s+\\w+\\s*\\)");
    static final Pattern SLOT_CONTENT_METHOD_PATTERN =
            Pattern.compile("\\bMap\\s*<\\s*ShellSlot\\s*,\\s*Node\\s*>\\s+slotContent\\s*\\(\\s*\\)");
    static final Pattern PERSISTENCE_REGISTER_METHOD_PATTERN =
            Pattern.compile("\\bvoid\\s+register\\s*\\(\\s*(?:final\\s+)?(?:shell\\.host\\.)?PersistenceRegistry\\.Builder\\s+\\w+\\s*\\)");
    static final Pattern SHELL_SLOT_USAGE_PATTERN =
            Pattern.compile("\\bShellSlot\\.([A-Z_]+)\\b");

    private final String absolutePath;
    private final String relativePath;
    private final List<String> segments;
    private final String fileName;
    private final String simpleName;
    private final String text;

    private SaltMarcherSourceFacts(String absolutePath, String relativePath, List<String> segments, String fileName, String text) {
        this.absolutePath = absolutePath;
        this.relativePath = relativePath;
        this.segments = segments;
        this.fileName = fileName;
        this.simpleName = fileName.endsWith(".java") ? fileName.substring(0, fileName.length() - 5) : fileName;
        this.text = text;
    }

    static SaltMarcherSourceFacts from(ASTCompilationUnit node) {
        TextDocument textDocument = node.getAstInfo().getTextDocument();
        String absolutePath = textDocument.getFileId().getAbsolutePath().replace('\\', '/');
        String relativePath = relativizeToSourceRoot(absolutePath);
        List<String> segments = List.of(relativePath.split("/"));
        return new SaltMarcherSourceFacts(absolutePath, relativePath, segments, segments.get(segments.size() - 1), textDocument.getText().toString());
    }

    private static String relativizeToSourceRoot(String absolutePath) {
        Path normalizedPath = Paths.get(absolutePath).normalize();
        int nameCount = normalizedPath.getNameCount();
        for (int index = 0; index < nameCount; index++) {
            String segment = normalizedPath.getName(index).toString();
            if (segment.equals("bootstrap") || segment.equals("shell") || segment.equals("src")) {
                return normalizedPath.subpath(index, nameCount).toString().replace('\\', '/');
            }
        }
        return normalizedPath.toString().replace('\\', '/');
    }

    String absolutePath() {
        return absolutePath;
    }

    String relativePath() {
        return relativePath;
    }

    String fileName() {
        return fileName;
    }

    String simpleName() {
        return simpleName;
    }

    String text() {
        return text;
    }

    boolean isUnderMainSourceRoots() {
        return startsWith("bootstrap") || startsWith("shell") || startsWith("src");
    }

    boolean isViewSource() {
        return startsWith("src", "view");
    }

    boolean isViewRoot() {
        return isViewSource() && segments.size() == 4;
    }

    boolean isDomainSource() {
        return startsWith("src", "domain");
    }

    boolean isDataSource() {
        return startsWith("src", "data");
    }

    boolean isDataRoot() {
        return isDataSource() && segments.size() == 4;
    }

    boolean isDataModel() {
        return startsWith("src", "data") && segments.size() >= 5 && segments.get(3).equals("model");
    }

    String featureName() {
        if (startsWith("src", "view") || startsWith("src", "domain") || startsWith("src", "data")) {
            return segments.size() >= 3 ? segments.get(2) : "";
        }
        return "";
    }

    Set<String> usedShellSlots() {
        Matcher matcher = SHELL_SLOT_USAGE_PATTERN.matcher(text);
        Set<String> result = new LinkedHashSet<>();
        while (matcher.find()) {
            result.add(matcher.group(1));
        }
        return result;
    }

    boolean hasExplicitPublicFinalClass() {
        return text.contains("public final class " + simpleName);
    }

    boolean hasExplicitPublicNoArgConstructor() {
        return text.contains("public " + simpleName + "()");
    }

    boolean hasRegistrationSpecMethod() {
        return REGISTRATION_SPEC_METHOD_PATTERN.matcher(text).find();
    }

    boolean hasCreateScreenMethod() {
        return CREATE_SCREEN_METHOD_PATTERN.matcher(text).find();
    }

    boolean hasSlotContentMethod() {
        return SLOT_CONTENT_METHOD_PATTERN.matcher(text).find();
    }

    boolean hasPersistenceRegisterMethod() {
        return PERSISTENCE_REGISTER_METHOD_PATTERN.matcher(text).find();
    }

    String expectedViewRootFileName() {
        return toPascalCaseSuffix(featureName(), "ViewContribution") + ".java";
    }

    String expectedPersistenceRootFileName() {
        return toPascalCaseSuffix(featureName(), "PersistenceContribution") + ".java";
    }

    String expectedPersistenceSchemaFileName() {
        return toPascalCaseSuffix(featureName(), "PersistenceSchema") + ".java";
    }

    private boolean startsWith(String... prefix) {
        if (segments.size() < prefix.length) {
            return false;
        }
        for (int index = 0; index < prefix.length; index++) {
            if (!segments.get(index).equals(prefix[index])) {
                return false;
            }
        }
        return true;
    }

    static String toPascalCaseSuffix(String featureName, String suffix) {
        StringBuilder result = new StringBuilder();
        boolean capitalizeNext = true;
        for (char character : featureName.toCharArray()) {
            if (!Character.isLetterOrDigit(character)) {
                capitalizeNext = true;
                continue;
            }
            result.append(capitalizeNext ? Character.toUpperCase(character) : character);
            capitalizeNext = false;
        }
        result.append(suffix);
        return result.toString();
    }

    static List<String> orderedSetOf(String... values) {
        List<String> result = new ArrayList<>();
        for (String value : values) {
            result.add(value.toUpperCase(Locale.ROOT));
        }
        return result;
    }
}
