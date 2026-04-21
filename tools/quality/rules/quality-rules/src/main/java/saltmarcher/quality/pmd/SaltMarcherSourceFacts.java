package saltmarcher.quality.pmd;

import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import net.sourceforge.pmd.lang.document.TextDocument;
import net.sourceforge.pmd.lang.java.ast.ASTCompilationUnit;

final class SaltMarcherSourceFacts {

    static final Pattern REGISTRATION_SPEC_METHOD_PATTERN =
            Pattern.compile("\\bShellContributionSpec\\s+registrationSpec\\s*\\(\\s*\\)");
    static final Pattern BIND_METHOD_PATTERN =
            Pattern.compile("\\bShellBinding\\s+bind\\s*\\(\\s*(?:final\\s+)?(?:shell\\.api\\.)?ShellRuntimeContext\\s+\\w+\\s*\\)");
    static final Pattern SERVICE_REGISTER_METHOD_PATTERN =
            Pattern.compile("\\bvoid\\s+register\\s*\\(\\s*(?:final\\s+)?(?:shell\\.api\\.)?ServiceRegistry\\.Builder\\s+\\w+\\s*\\)");
    static final Pattern SHELL_SLOT_USAGE_PATTERN =
            Pattern.compile("\\bShellSlot\\.([A-Z_]+)\\b");
    static final Pattern INSTANCE_FIELD_DECLARATION_PATTERN =
            Pattern.compile("(?m)^ {4}(?:private|protected|public)\\s+(?!static\\b)(?!final\\s+class\\b)(?!class\\b|interface\\b|enum\\b|record\\b)[^\\n;()]+;");
    static final Pattern EXPOSED_EXECUTABLE_DECLARATION_PATTERN =
            Pattern.compile("(?m)^ {4}(?:public|protected)\\s+[^\\n=;{}]*\\(");
    static final Pattern IMPORT_PATTERN =
            Pattern.compile("(?m)^\\s*import\\s+([^;]+);");
    static final Pattern SERVICE_REGISTER_CALL_PATTERN =
            Pattern.compile("\\bregister\\s*\\(\\s*([A-Za-z_][A-Za-z0-9_$.]*)\\s*\\.class\\s*,");

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

    boolean isViewContributionSource() {
        return isDiscoverableViewContributionArea() && simpleName.endsWith("Contribution");
    }

    boolean isViewBinderSource() {
        return isActiveViewRootSource() && simpleName.endsWith("Binder");
    }

    boolean isViewSupportModelSource() {
        return isSlotcontentSource() && simpleName.endsWith("DisplayModel");
    }

    boolean isViewInspectorEntrySource() {
        return isSlotcontentSource() && simpleName.endsWith("InspectorEntry");
    }

    boolean isViewModelSource() {
        return (isActiveViewRootSource() || isSlotcontentSource()) && simpleName.endsWith("ViewModel");
    }

    boolean isViewPanelSource() {
        return isViewSource()
                && ((isSlotcontentSource() || isActiveViewRootSource())
                && simpleName.endsWith("View")
                && !simpleName.endsWith("ViewModel"));
    }

    boolean isLegacyViewSource() {
        return isViewSource()
                && !isViewContributionSource()
                && !isViewBinderSource()
                && !isViewModelSource()
                && !isViewSupportModelSource()
                && !isViewInspectorEntrySource()
                && !isViewPanelSource();
    }

    private boolean isActiveViewRootSource() {
        return isViewSource()
                && segments.size() == 5
                && Set.of("leftbartabs", "statetabs", "dropdowns").contains(segments.get(2));
    }

    private boolean isSlotcontentSource() {
        return isViewSource()
                && segments.size() == 6
                && segments.get(2).equals("slotcontent")
                && Set.of("controls", "main", "state", "details", "topbar").contains(segments.get(3));
    }

    private boolean isDiscoverableViewContributionArea() {
        return isViewSource()
                && segments.size() == 5
                && Set.of("leftbartabs", "statetabs", "dropdowns").contains(segments.get(2));
    }

    boolean isDomainSource() {
        return startsWith("src", "domain");
    }

    boolean isDomainRoot() {
        return isDomainSource() && segments.size() == 4;
    }

    boolean isDomainApplicationSource() {
        return isDomainSource() && segments.size() >= 5 && segments.get(3).equals("application");
    }

    boolean isNamedDomainModuleSource() {
        return isDomainSource()
                && segments.size() >= 5
                && !Set.of("published", "application").contains(segments.get(3));
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
            if (startsWith("src", "view") && segments.size() >= 4) {
                return segments.get(3);
            }
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

    boolean hasBindMethod() {
        return BIND_METHOD_PATTERN.matcher(text).find();
    }

    boolean hasInstanceFields() {
        return topLevelMemberDeclarations().stream()
                .anyMatch(line -> INSTANCE_FIELD_DECLARATION_PATTERN.matcher(line).find());
    }

    List<String> exposedExecutableDeclarations() {
        List<String> declarations = new ArrayList<>();
        for (String line : topLevelMemberDeclarations()) {
            Matcher matcher = EXPOSED_EXECUTABLE_DECLARATION_PATTERN.matcher(line);
            if (matcher.find()) {
                declarations.add(matcher.group().trim());
            }
        }
        return declarations;
    }

    private List<String> topLevelMemberDeclarations() {
        String body = topLevelClassBody();
        List<String> declarations = new ArrayList<>();
        int depth = 1;
        for (String line : body.split("\\R")) {
            String stripped = line.strip();
            if (depth == 1 && isMemberDeclarationStart(stripped)) {
                declarations.add(stripped);
            }
            depth = updateBraceDepth(line, depth);
        }
        return declarations;
    }

    private String topLevelClassBody() {
        int classIndex = text.indexOf("public final class " + simpleName);
        if (classIndex < 0) {
            return text;
        }
        int bodyStart = text.indexOf('{', classIndex);
        if (bodyStart < 0) {
            return "";
        }
        int depth = 0;
        for (int index = bodyStart; index < text.length(); index++) {
            char character = text.charAt(index);
            if (character == '{') {
                depth++;
            } else if (character == '}') {
                depth--;
                if (depth == 0) {
                    return text.substring(bodyStart + 1, index);
                }
            }
        }
        return text.substring(bodyStart + 1);
    }

    private static boolean isMemberDeclarationStart(String line) {
        return line.startsWith("public ")
                || line.startsWith("protected ")
                || line.startsWith("private ");
    }

    private static int updateBraceDepth(String line, int currentDepth) {
        int depth = currentDepth;
        boolean inString = false;
        boolean inChar = false;
        boolean escaped = false;
        for (int index = 0; index < line.length(); index++) {
            char character = line.charAt(index);
            if (escaped) {
                escaped = false;
                continue;
            }
            if (character == '\\') {
                escaped = inString || inChar;
                continue;
            }
            if (character == '"' && !inChar) {
                inString = !inString;
                continue;
            }
            if (character == '\'' && !inString) {
                inChar = !inChar;
                continue;
            }
            if (inString || inChar) {
                continue;
            }
            if (character == '{') {
                depth++;
            } else if (character == '}') {
                depth--;
            }
        }
        return Math.max(0, depth);
    }

    boolean hasServiceRegisterMethod() {
        return SERVICE_REGISTER_METHOD_PATTERN.matcher(text).find();
    }

    List<String> registeredServiceTypes() {
        Matcher matcher = SERVICE_REGISTER_CALL_PATTERN.matcher(text);
        List<String> serviceTypes = new ArrayList<>();
        while (matcher.find()) {
            serviceTypes.add(resolveTypeLiteral(matcher.group(1)));
        }
        return serviceTypes;
    }

    String expectedServiceRootFileName() {
        return toPascalCaseSuffix(featureName(), "ServiceContribution") + ".java";
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

    private String resolveTypeLiteral(String literal) {
        if (literal.startsWith("src.") || literal.startsWith("shell.")) {
            return literal;
        }
        String topLevelName = literal;
        String nestedSuffix = "";
        int nestedSeparator = literal.indexOf('.');
        if (nestedSeparator >= 0 && Character.isUpperCase(literal.charAt(0))) {
            topLevelName = literal.substring(0, nestedSeparator);
            nestedSuffix = literal.substring(nestedSeparator);
        }
        String resolvedTopLevel = resolveSimpleType(topLevelName);
        return resolvedTopLevel == null ? literal : resolvedTopLevel + nestedSuffix;
    }

    private String resolveSimpleType(String simpleName) {
        Map<String, String> explicitImports = explicitImportsBySimpleName();
        if (explicitImports.containsKey(simpleName)) {
            return explicitImports.get(simpleName);
        }
        for (String importedType : importedTypes()) {
            if (importedType.endsWith(".*")) {
                return importedType.substring(0, importedType.length() - 2) + "." + simpleName;
            }
        }
        String packageName = relativePath.replaceAll("/[^/]+\\.java$", "").replace('/', '.');
        return packageName.isBlank() ? simpleName : packageName + "." + simpleName;
    }

    private Map<String, String> explicitImportsBySimpleName() {
        Map<String, String> importsBySimpleName = new LinkedHashMap<>();
        for (String importedType : importedTypes()) {
            if (importedType.endsWith(".*")) {
                continue;
            }
            int separator = importedType.lastIndexOf('.');
            if (separator < 0 || separator == importedType.length() - 1) {
                continue;
            }
            importsBySimpleName.put(importedType.substring(separator + 1), importedType);
        }
        return importsBySimpleName;
    }

    private List<String> importedTypes() {
        Matcher matcher = IMPORT_PATTERN.matcher(text);
        List<String> imports = new ArrayList<>();
        while (matcher.find()) {
            imports.add(matcher.group(1).trim());
        }
        return imports;
    }
}
