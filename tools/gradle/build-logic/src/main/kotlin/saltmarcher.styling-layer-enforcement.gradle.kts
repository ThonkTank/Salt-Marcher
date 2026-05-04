import java.io.File
import java.nio.file.Files
import java.util.Locale
import org.gradle.api.GradleException
import org.gradle.api.plugins.ExtensionAware
import org.gradle.api.plugins.quality.Pmd
import org.gradle.api.tasks.compile.JavaCompile
import org.gradle.kotlin.dsl.register
import org.gradle.kotlin.dsl.named
import org.gradle.kotlin.dsl.registering
import org.gradle.kotlin.dsl.withGroovyBuilder
import saltmarcher.buildlogic.enforcement.EnforcementBundlesExtension
import saltmarcher.buildlogic.tasks.CheckCentralizedStylesheetsTask
import saltmarcher.buildlogic.tasks.CheckDefinedStyleClassSelectorsTask
import saltmarcher.buildlogic.tasks.CheckStylingCentralStylesheetOwnerTask

plugins {
    id("saltmarcher.enforcement-bundles")
}

private val stylingStylesheetExtensions = listOf("css", "scss", "sass", "less", "styl")
private val stylingCanonicalStylesheetRelativePath = "salt-marcher.css"
private val stylingStylesheetRelativePathProvider = providers.gradleProperty("saltMarcherStylesheet")
    .orElse("resources/$stylingCanonicalStylesheetRelativePath")
private val stylingSourceRoots = files("bootstrap", "shell", "src")
private val stylingLayerRulesetFile = project.file("tools/quality/styling-layer-enforcement/pmd/ruleset.xml")

private val cssSelectorPattern = Regex("""\.([A-Za-z][A-Za-z0-9\-_]*)\b""")
private val stringLiteralPattern = Regex(""""([^"\\\\]*(?:\\\\.[^"\\\\]*)*)"""")
private val styleClassNamePattern = Regex("""[A-Za-z][A-Za-z0-9\-_]*""")
private val methodDeclarationPattern = Regex(
    """(?s)(?:public|protected|private|static|final|abstract|synchronized|native|default|strictfp|\s)+[A-Za-z0-9_<>, ?.@\[\]]+\s+([A-Za-z_][A-Za-z0-9_]*)\s*\((.*?)\)\s*\{"""
)
private val methodCallPattern = Regex("""(?<![\w$])([A-Za-z_][A-Za-z0-9_]*)\s*\(""")
private val styleClassMarker = "getStyleClass()"
private val styleClassMethods = setOf("add", "addAll", "setAll")

val enforcementBundles = extensions.getByType(EnforcementBundlesExtension::class.java)
val focusedEnforcementBundleMode = enforcementBundles.focusedEnforcementBundleMode

@Suppress("UNCHECKED_CAST")
val registerFocusedVerificationCompileTask = extra["saltmarcherRegisterFocusedVerificationCompileTask"] as
    (String, List<String>, String) -> org.gradle.api.tasks.TaskProvider<JavaCompile>

private data class StyleClassUsage(
    val selectors: Set<String>,
    val dynamicExpressions: Set<String>
)

private data class MethodDefinition(
    val name: String,
    val parameters: List<String>,
    val body: String
) {
    val key: MethodKey = MethodKey(name, parameters.size)
}

private data class MethodKey(
    val name: String,
    val arity: Int
)

private data class CallDefinition(
    val key: MethodKey,
    val arguments: List<String>
)

private fun verifyCentralizedStylesheets() {
    val projectRootPath = layout.projectDirectory.asFile.toPath().normalize()
    val allowedStylesheetPath = projectRootPath
        .resolve("resources/$stylingCanonicalStylesheetRelativePath")
        .normalize()
    val extensions = stylingStylesheetExtensions.map { it.lowercase(Locale.ROOT) }.toSet()

    val offendingFiles = layout.projectDirectory.asFileTree.matching {
        stylingStylesheetExtensions.forEach { extension -> include("**/*.$extension") }
        exclude("**/.git/**", "**/.gradle/**", "**/build/**")
    }.files.asSequence()
        .map { file -> file.toPath().normalize() }
        .filter(Files::isRegularFile)
        .filter { path ->
            val extension = path.fileName.toString().substringAfterLast('.', "").lowercase(Locale.ROOT)
            extension in extensions && path != allowedStylesheetPath
        }
        .map { path -> projectRootPath.relativize(path).toString().replace('\\', '/') }
        .sorted()
        .toList()

    if (offendingFiles.isNotEmpty()) {
        val details = offendingFiles.joinToString(separator = "\n") { " - $it" }
        throw GradleException(
            "Stylesheet files must be centralized in resources/$stylingCanonicalStylesheetRelativePath.\n" +
                "Move approved visual rules into the central stylesheet instead of adding replacement style files.\n" +
                "Offending files:\n$details"
        )
    }
}

private fun verifyCentralStylesheetOwner() {
    val configuredStylesheetPath = stylingStylesheetRelativePathProvider.get()
    if (configuredStylesheetPath != stylingCanonicalStylesheetRelativePath) {
        throw GradleException(
            "SaltMarcher styling must stay owned by resources/$stylingCanonicalStylesheetRelativePath.\n" +
                "The configured saltMarcherStylesheet path was '$configuredStylesheetPath'."
        )
    }

    val canonicalStylesheetFile = layout.projectDirectory.file("resources/$stylingCanonicalStylesheetRelativePath").asFile
    if (!canonicalStylesheetFile.isFile) {
        throw GradleException(
            "SaltMarcher styling must stay owned by resources/$stylingCanonicalStylesheetRelativePath.\n" +
                "The canonical stylesheet file is missing: ${canonicalStylesheetFile.toPath().toAbsolutePath()}"
        )
    }
}

private fun verifyDefinedStyleClassSelectors() {
    val definedSelectors = layout.projectDirectory.dir("resources").asFileTree.matching {
        stylingStylesheetExtensions.forEach { extension -> include("**/*.$extension") }
    }.files.asSequence()
        .filter(File::isFile)
        .flatMap { file -> cssSelectorPattern.findAll(file.readText()).map { match -> match.groupValues[1] } }
        .toSet()

    val missingSelectors = linkedMapOf<String, MutableSet<String>>()
    val dynamicSelectors = linkedMapOf<String, MutableSet<String>>()
    val sourceTexts = stylingSourceRoots.asFileTree.matching {
        include("**/*.java")
        exclude("**/build/**")
    }.files.asSequence()
        .filter { it.isFile && it.extension == "java" }
        .associateWith(File::readText)
    val helperMethods = resolveStyleClassHelperMethods(sourceTexts.values)
    sourceTexts.forEach { (file, sourceText) ->
        val usage = extractStyleClassLiterals(sourceText, helperMethods)
        val missing = usage.selectors.filterNot(definedSelectors::contains)
        val relativePath = file.relativeTo(project.projectDir).invariantSeparatorsPath
        if (missing.isNotEmpty()) {
            missingSelectors[relativePath] = missing.toMutableSet()
        }
        if (usage.dynamicExpressions.isNotEmpty()) {
            dynamicSelectors[relativePath] = usage.dynamicExpressions.toMutableSet()
        }
    }

    if (missingSelectors.isNotEmpty() || dynamicSelectors.isNotEmpty()) {
        val details = missingSelectors.entries.joinToString(separator = "\n") { (path, selectors) ->
            " - $path -> ${selectors.joinToString(", ")}"
        }
        val dynamicDetails = dynamicSelectors.entries.joinToString(separator = "\n") { (path, expressions) ->
            " - $path -> ${expressions.joinToString(", ")}"
        }
        throw GradleException(
            "Style classes used from Java must resolve to centralized selectors in resources/salt-marcher.css.\n" +
                "Add the missing selectors to a centralized stylesheet or stop using them from code.\n" +
                "Build style classes from explicit, centrally defined selector names; dynamic selector construction is forbidden.\n" +
                listOfNotNull(
                    details.takeIf(String::isNotBlank)?.let { "Missing selectors:\n$it" },
                    dynamicDetails.takeIf(String::isNotBlank)?.let { "Dynamic selector expressions:\n$it" }
                ).joinToString("\n")
        )
    }
}

private fun extractStyleClassLiterals(
    sourceText: String,
    helperMethods: Map<MethodKey, Set<Int>>
): StyleClassUsage {
    val selectors = linkedSetOf<String>()
    val dynamicExpressions = linkedSetOf<String>()
    collectStyleClassCallLiterals(sourceText, selectors, dynamicExpressions)
    collectHelperCallLiterals(sourceText, helperMethods, selectors, dynamicExpressions)
    return StyleClassUsage(selectors, dynamicExpressions)
}

private fun collectStyleClassCallLiterals(
    sourceText: String,
    selectors: MutableSet<String>,
    dynamicExpressions: MutableSet<String>
) {
    var searchIndex = 0
    while (true) {
        val markerIndex = sourceText.indexOf(styleClassMarker, searchIndex)
        if (markerIndex < 0) {
            return
        }
        var cursor = markerIndex + styleClassMarker.length
        while (cursor < sourceText.length && sourceText[cursor].isWhitespace()) {
            cursor++
        }
        if (cursor >= sourceText.length || sourceText[cursor] != '.') {
            searchIndex = markerIndex + styleClassMarker.length
            continue
        }
        cursor++
        val methodStart = cursor
        while (cursor < sourceText.length && Character.isJavaIdentifierPart(sourceText[cursor])) {
            cursor++
        }
        val methodName = sourceText.substring(methodStart, cursor)
        if (methodName !in styleClassMethods) {
            searchIndex = markerIndex + styleClassMarker.length
            continue
        }
        while (cursor < sourceText.length && sourceText[cursor].isWhitespace()) {
            cursor++
        }
        if (cursor >= sourceText.length || sourceText[cursor] != '(') {
            searchIndex = markerIndex + styleClassMarker.length
            continue
        }
        val closingParenIndex = findClosingParen(sourceText, cursor)
        if (closingParenIndex < 0) {
            return
        }
        splitArguments(sourceText.substring(cursor + 1, closingParenIndex)).forEach { argument ->
            collectStyleArgument(argument, selectors, dynamicExpressions)
        }
        searchIndex = closingParenIndex + 1
    }
}

private fun resolveStyleClassHelperMethods(sourceTexts: Iterable<String>): Map<MethodKey, Set<Int>> {
    val methods = sourceTexts.flatMap(::parseMethods)
    val styleParameterIndexesByMethod = linkedMapOf<MethodKey, MutableSet<Int>>()
    for (method in methods) {
        val directIndexes = directStyleParameterIndexes(method)
        if (directIndexes.isNotEmpty()) {
            styleParameterIndexesByMethod.getOrPut(method.key) { linkedSetOf() }.addAll(directIndexes)
        }
    }

    var changed = true
    while (changed) {
        changed = false
        for (method in methods) {
            val currentIndexes = styleParameterIndexesByMethod.getOrPut(method.key) { linkedSetOf() }
            for (call in parseCalls(method.body)) {
                val calleeStyleIndexes = styleParameterIndexesByMethod[call.key].orEmpty()
                for (calleeStyleIndex in calleeStyleIndexes) {
                    val argument = call.arguments.getOrNull(calleeStyleIndex)?.trim() ?: continue
                    val parameterIndex = method.parameters.indexOf(argument)
                    if (parameterIndex >= 0 && currentIndexes.add(parameterIndex)) {
                        changed = true
                    }
                }
            }
        }
    }

    return styleParameterIndexesByMethod
        .filterValues { it.isNotEmpty() }
        .mapValues { (_, indexes) -> indexes.toSet() }
}

private fun directStyleParameterIndexes(method: MethodDefinition): Set<Int> {
    val indexes = linkedSetOf<Int>()
    val styleClassCalls = styleClassCallArguments(method.body)
    for (arguments in styleClassCalls) {
        for (argument in arguments) {
            val parameterIndex = method.parameters.indexOf(argument.trim())
            if (parameterIndex >= 0) {
                indexes.add(parameterIndex)
            }
        }
    }
    return indexes
}

private fun collectHelperCallLiterals(
    sourceText: String,
    helperMethods: Map<MethodKey, Set<Int>>,
    selectors: MutableSet<String>,
    dynamicExpressions: MutableSet<String>
) {
    for (call in parseCalls(sourceText)) {
        val styleIndexes = helperMethods[call.key].orEmpty()
        for (parameterIndex in styleIndexes) {
            val argument = call.arguments.getOrNull(parameterIndex) ?: continue
            collectStyleArgument(argument, selectors, dynamicExpressions)
        }
    }
}

private fun styleClassCallArguments(body: String): List<List<String>> {
    val arguments = mutableListOf<List<String>>()
    var searchIndex = 0
    while (true) {
        val markerIndex = body.indexOf(styleClassMarker, searchIndex)
        if (markerIndex < 0) {
            return arguments
        }
        var cursor = markerIndex + styleClassMarker.length
        while (cursor < body.length && body[cursor].isWhitespace()) {
            cursor++
        }
        if (cursor >= body.length || body[cursor] != '.') {
            searchIndex = markerIndex + styleClassMarker.length
            continue
        }
        cursor++
        val methodStart = cursor
        while (cursor < body.length && Character.isJavaIdentifierPart(body[cursor])) {
            cursor++
        }
        val methodName = body.substring(methodStart, cursor)
        if (methodName !in styleClassMethods) {
            searchIndex = markerIndex + styleClassMarker.length
            continue
        }
        while (cursor < body.length && body[cursor].isWhitespace()) {
            cursor++
        }
        if (cursor >= body.length || body[cursor] != '(') {
            searchIndex = markerIndex + styleClassMarker.length
            continue
        }
        val closingParenIndex = findClosingParen(body, cursor)
        if (closingParenIndex < 0) {
            return arguments
        }
        arguments += splitArguments(body.substring(cursor + 1, closingParenIndex))
        searchIndex = closingParenIndex + 1
    }
}

private fun collectStyleArgument(
    argument: String,
    selectors: MutableSet<String>,
    dynamicExpressions: MutableSet<String>
) {
    val literalSelectors = stringLiteralPattern.findAll(argument)
        .map { match -> match.groupValues[1] }
        .filter(styleClassNamePattern::matches)
        .toList()
    if (literalSelectors.isEmpty()) {
        return
    }
    if (hasTopLevelConcatenation(argument)) {
        dynamicExpressions.add(argument.trim())
        return
    }
    literalSelectors.forEach(selectors::add)
}

private fun hasTopLevelConcatenation(expression: String): Boolean {
    var depth = 0
    var inString = false
    var escaped = false
    for (character in expression) {
        if (inString) {
            if (escaped) {
                escaped = false
            } else if (character == '\\') {
                escaped = true
            } else if (character == '"') {
                inString = false
            }
            continue
        }
        when (character) {
            '"' -> inString = true
            '(', '[', '<' -> depth++
            ')', ']', '>' -> if (depth > 0) {
                depth--
            }
            '+' -> if (depth == 0) {
                return true
            }
        }
    }
    return false
}

private fun parseMethods(sourceText: String): List<MethodDefinition> {
    val methods = mutableListOf<MethodDefinition>()
    for (match in methodDeclarationPattern.findAll(sourceText)) {
        val bodyStart = match.range.last
        val bodyEnd = findClosingBrace(sourceText, bodyStart)
        if (bodyEnd < 0) {
            continue
        }
        val name = match.groupValues[1]
        val parameters = parseParameterNames(match.groupValues[2])
        val body = sourceText.substring(bodyStart + 1, bodyEnd)
        methods.add(MethodDefinition(name, parameters, body))
    }
    return methods
}

private fun parseParameterNames(parameterText: String): List<String> {
    if (parameterText.isBlank()) {
        return emptyList()
    }
    return splitArguments(parameterText)
        .mapNotNull { parameter ->
            parameter.substringBefore('=')
                .trim()
                .substringAfterLast(' ')
                .substringAfterLast("...")
                .takeIf(String::isNotBlank)
        }
}

private fun parseCalls(sourceText: String): List<CallDefinition> {
    val calls = mutableListOf<CallDefinition>()
    for (match in methodCallPattern.findAll(sourceText)) {
        val name = match.groupValues[1]
        val openingParenIndex = match.range.last
        val closingParenIndex = findClosingParen(sourceText, openingParenIndex)
        if (closingParenIndex < 0) {
            continue
        }
        val arguments = splitArguments(sourceText.substring(openingParenIndex + 1, closingParenIndex))
        calls.add(CallDefinition(MethodKey(name, arguments.size), arguments))
    }
    return calls
}

private fun splitArguments(argumentsText: String): List<String> {
    if (argumentsText.isBlank()) {
        return emptyList()
    }
    val arguments = mutableListOf<String>()
    val current = StringBuilder()
    var parenDepth = 0
    var bracketDepth = 0
    var angleDepth = 0
    var braceDepth = 0
    var inString = false
    var escaped = false
    for (character in argumentsText) {
        if (inString) {
            current.append(character)
            if (escaped) {
                escaped = false
            } else if (character == '\\') {
                escaped = true
            } else if (character == '"') {
                inString = false
            }
            continue
        }
        when (character) {
            '"' -> {
                inString = true
                current.append(character)
            }
            '(' -> {
                parenDepth++
                current.append(character)
            }
            ')' -> {
                if (parenDepth > 0) {
                    parenDepth--
                }
                current.append(character)
            }
            '[' -> {
                bracketDepth++
                current.append(character)
            }
            ']' -> {
                if (bracketDepth > 0) {
                    bracketDepth--
                }
                current.append(character)
            }
            '<' -> {
                angleDepth++
                current.append(character)
            }
            '>' -> {
                if (angleDepth > 0) {
                    angleDepth--
                }
                current.append(character)
            }
            '{' -> {
                braceDepth++
                current.append(character)
            }
            '}' -> {
                if (braceDepth > 0) {
                    braceDepth--
                }
                current.append(character)
            }
            ',' -> if (parenDepth == 0 && bracketDepth == 0 && angleDepth == 0 && braceDepth == 0) {
                arguments.add(current.toString().trim())
                current.setLength(0)
            } else {
                current.append(character)
            }
            else -> current.append(character)
        }
    }
    val tail = current.toString().trim()
    if (tail.isNotEmpty()) {
        arguments.add(tail)
    }
    return arguments
}

private fun findClosingParen(text: String, openParenIndex: Int): Int {
    var depth = 0
    var inString = false
    var escape = false
    for (index in openParenIndex until text.length) {
        val char = text[index]
        when {
            escape -> escape = false
            char == '\\' -> if (inString) escape = true
            char == '"' -> inString = !inString
            inString -> Unit
            char == '(' -> depth++
            char == ')' -> {
                depth--
                if (depth == 0) {
                    return index
                }
            }
        }
    }
    return -1
}

private fun findClosingBrace(text: String, openBraceIndex: Int): Int {
    var depth = 0
    var inString = false
    var escape = false
    for (index in openBraceIndex until text.length) {
        val char = text[index]
        when {
            escape -> escape = false
            char == '\\' -> if (inString) escape = true
            char == '"' -> inString = !inString
            inString -> Unit
            char == '{' -> depth++
            char == '}' -> {
                depth--
                if (depth == 0) {
                    return index
                }
            }
        }
    }
    return -1
}

val stylingLayerCheckerNames = listOf("ViewProgrammaticStyling")
val compileStylingLayerVerificationJava = registerFocusedVerificationCompileTask(
    "stylingLayer",
    stylingLayerCheckerNames,
    "Compile only the centralized styling-layer verification slice with the styling Error Prone checks enabled."
)
val selectedStylingLayerCompileJava = if (focusedEnforcementBundleMode) {
    compileStylingLayerVerificationJava
} else {
    tasks.named<JavaCompile>("compileJava")
}

tasks.named<JavaCompile>("compileJava") {
    val errorproneOptions = (options as ExtensionAware).extensions.getByName("errorprone")
    errorproneOptions.withGroovyBuilder {
        stylingLayerCheckerNames.forEach { checkName ->
            "error"(checkName)
        }
    }
}

val stylingStylesheetFiles = layout.projectDirectory.asFileTree.matching {
    stylingStylesheetExtensions.forEach { extension -> include("**/*.$extension") }
    exclude("**/.git/**", "**/.gradle/**", "**/build/**")
}
val stylingJavaSourceFiles = stylingSourceRoots.asFileTree.matching {
    include("**/*.java")
    exclude("**/build/**")
}

val checkCentralizedStylesheets by tasks.registering(CheckCentralizedStylesheetsTask::class) {
    group = "verification"
    description = "Fail if stylesheet files exist outside the central resources/salt-marcher.css file."
    stylesheetFiles.from(stylingStylesheetFiles)
    canonicalStylesheetRelativePath.set("resources/$stylingCanonicalStylesheetRelativePath")
    canonicalStylesheetFile.set(layout.projectDirectory.file("resources/$stylingCanonicalStylesheetRelativePath"))
    successMarker.set(layout.buildDirectory.file("verification-markers/checkCentralizedStylesheets/success.marker"))
}

val checkStylingCentralStylesheetOwner by tasks.registering(CheckStylingCentralStylesheetOwnerTask::class) {
    group = "verification"
    description = "Fail if SaltMarcher styling stops using the canonical resources/salt-marcher.css owner."
    configuredStylesheetPath.set(stylingStylesheetRelativePathProvider)
    canonicalStylesheetRelativePath.set("resources/$stylingCanonicalStylesheetRelativePath")
    canonicalStylesheetFile.set(layout.projectDirectory.file("resources/$stylingCanonicalStylesheetRelativePath"))
    successMarker.set(layout.buildDirectory.file("verification-markers/checkStylingCentralStylesheetOwner/success.marker"))
}

val checkDefinedStyleClassSelectors by tasks.registering(CheckDefinedStyleClassSelectorsTask::class) {
    group = "verification"
    description = "Fail if Java-authored style classes are missing from resources/salt-marcher.css selectors."
    stylesheetFiles.from(stylingStylesheetFiles)
    javaSourceFiles.from(stylingJavaSourceFiles)
    successMarker.set(layout.buildDirectory.file("verification-markers/checkDefinedStyleClassSelectors/success.marker"))
}

val pmdStylingLayerEnforcement by tasks.registering(Pmd::class) {
    group = "verification"
    description = "Run the dedicated styling-layer PMD rule bundle."
    dependsOn(gradle.includedBuild("quality-rules").task(":jar"))

    ignoreFailures = false
    ruleSets = listOf()
    ruleSetFiles = files(stylingLayerRulesetFile)
    source = stylingSourceRoots.asFileTree
    include("**/*.java")
    classpath = files()
    reports {
        html.required.set(true)
        xml.required.set(true)
    }
}

tasks.register("checkStylingLayerEnforcement") {
    group = "verification"
    description = "Run the centralized styling-layer enforcement bundle through one root entrypoint."
    dependsOn(selectedStylingLayerCompileJava)
    dependsOn(checkCentralizedStylesheets)
    dependsOn(checkStylingCentralStylesheetOwner)
    dependsOn(checkDefinedStyleClassSelectors)
    dependsOn(pmdStylingLayerEnforcement)
}

tasks.matching { it.name == "checkArchitecture" }.configureEach {
    dependsOn("checkStylingLayerEnforcement")
}

tasks.named("check") {
    dependsOn("checkStylingLayerEnforcement")
}
