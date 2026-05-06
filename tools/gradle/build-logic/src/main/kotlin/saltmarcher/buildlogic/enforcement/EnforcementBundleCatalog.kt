package saltmarcher.buildlogic.enforcement

import java.io.File
import java.util.Properties

data class EnforcementRootTask(
    val description: String?,
    val attachToCheck: Boolean,
    val attachToCheckArchitecture: Boolean
)

data class EnforcementArchunitTask(
    val taskName: String,
    val description: String,
    val sourceDirs: List<String>,
    val sourceIncludes: List<String>,
    val includePatterns: List<String>,
    val useSharedTestSupport: Boolean
)

data class EnforcementJqassistantTask(
    val taskName: String,
    val scanTaskName: String,
    val analyzeTaskName: String,
    val scanDescription: String,
    val analyzeDescription: String,
    val ruleGroups: List<String>,
    val rulesDirPath: String,
    val reportsDirPath: String
)

data class EnforcementPmdTask(
    val taskName: String,
    val description: String,
    val rulesetPath: String,
    val sourceRoots: List<String>,
    val sourceIncludes: List<String>,
    val ignoreFailures: Boolean,
    val consoleOutput: Boolean
)

data class EnforcementBundleDescriptor(
    val bundleId: String,
    val order: Int,
    val taskNames: List<String>,
    val rootPluginId: String?,
    val rootTask: EnforcementRootTask?,
    val buildHarnessSourceDir: String?,
    val buildHarnessArchitectureRuleClasses: List<String>,
    val buildHarnessDocumentationRuleClasses: List<String>,
    val buildHarnessTaskMainClasses: Map<String, String>,
    val errorProneCheckers: List<String>,
    val errorProneSourceDir: String?,
    val errorProneServiceFile: String?,
    val archunit: EnforcementArchunitTask?,
    val jqassistantTasks: List<EnforcementJqassistantTask>,
    val pmdTasks: List<EnforcementPmdTask>,
    val pmdSourceDir: String?,
    val verificationSourceRoots: List<String>,
    val verificationSourceIncludes: List<String>
) {
    fun publicCheckTaskName(): String = publicCheckTaskName(taskNames, bundleId)

    fun requiresFocusedCompile(): Boolean = errorProneSourceDir != null || archunit != null || jqassistantTasks.isNotEmpty()
}

data class EnforcementBundleCatalog(
    val descriptorsById: Map<String, EnforcementBundleDescriptor>
) {
    val bundleIdsInOrder: List<String> = descriptorsById.values
        .sortedBy(EnforcementBundleDescriptor::order)
        .map(EnforcementBundleDescriptor::bundleId)

    val taskToBundleId: Map<String, String> = descriptorsById.values
        .flatMap { descriptor -> descriptor.taskNames.map { taskName -> taskName to descriptor.bundleId } }
        .toMap()

    fun descriptor(bundleId: String): EnforcementBundleDescriptor = descriptorsById[bundleId]
        ?: error("Unknown enforcement bundle '$bundleId'.")
}

data class EnforcementBundleSelection(
    val focusedEnforcementBundleMode: Boolean,
    val activeEnforcementBundleIds: List<String>
)

open class EnforcementBundlesExtension(
    val repoRootDir: File,
    val catalog: EnforcementBundleCatalog,
    val selection: EnforcementBundleSelection
) {
    val focusedEnforcementBundleMode: Boolean
        get() = selection.focusedEnforcementBundleMode

    val activeEnforcementBundleIds: List<String>
        get() = selection.activeEnforcementBundleIds

    fun descriptor(bundleId: String): EnforcementBundleDescriptor = catalog.descriptor(bundleId)

    fun activeDescriptors(): List<EnforcementBundleDescriptor> = activeEnforcementBundleIds.map(::descriptor)
}

fun loadEnforcementBundlesExtension(rootDir: File): EnforcementBundlesExtension {
    val repoRootDir = System.getProperty("saltmarcher.repoRootDir")
        ?.trim()
        ?.takeIf(String::isNotEmpty)
        ?.let(::File)
        ?: rootDir
    val catalog = EnforcementBundleCatalog(loadEnforcementBundleDescriptors(repoRootDir))
    val propagatedFocusedEnforcementBundleMode = System.getProperty("saltmarcher.focusedEnforcementBundleMode")
        ?.trim()
        ?.takeIf(String::isNotEmpty)
        ?.toBoolean()
    val propagatedActiveEnforcementBundleIds = System.getProperty("saltmarcher.activeEnforcementBundleIds")
        ?.split(',')
        ?.map(String::trim)
        ?.filter(String::isNotEmpty)
        ?.takeIf(List<String>::isNotEmpty)
    require(propagatedFocusedEnforcementBundleMode != true || propagatedActiveEnforcementBundleIds != null) {
        "Focused enforcement bundle mode requires propagated active bundle ids from the settings plugin."
    }
    val focusedEnforcementBundleMode = propagatedFocusedEnforcementBundleMode ?: false
    val activeEnforcementBundleIds = if (propagatedActiveEnforcementBundleIds != null) {
        catalog.bundleIdsInOrder.filter { bundleId -> bundleId in propagatedActiveEnforcementBundleIds }
    } else {
        catalog.bundleIdsInOrder
    }

    return EnforcementBundlesExtension(
        repoRootDir = repoRootDir,
        catalog = catalog,
        selection = EnforcementBundleSelection(
            focusedEnforcementBundleMode = focusedEnforcementBundleMode,
            activeEnforcementBundleIds = activeEnforcementBundleIds
        )
    )
}

private fun loadEnforcementBundleDescriptors(repoRootDir: File): Map<String, EnforcementBundleDescriptor> {
    val qualityDir = File(repoRootDir, "tools/quality")
    if (!qualityDir.isDirectory) {
        return emptyMap()
    }
    return qualityDir.walkTopDown()
        .filter { file -> file.isFile && file.name == "bundle.properties" }
        .mapNotNull { descriptorFile ->
            val properties = loadProperties(descriptorFile)
            if (!properties.boolean("descriptorOwned")) {
                null
            } else {
                EnforcementBundleDescriptor(
                    bundleId = properties.requiredTrimmed("bundleId"),
                    order = properties.requiredTrimmed("order").toInt(),
                    taskNames = properties.list("taskNames"),
                    rootPluginId = properties.optionalTrimmed("rootPluginId"),
                    rootTask = properties.readRootTask(""),
                    buildHarnessSourceDir = properties.optionalTrimmed("buildHarnessSourceDir")
                        ?.let { rawPath -> resolveDescriptorPath(repoRootDir, descriptorFile, rawPath) },
                    buildHarnessArchitectureRuleClasses = properties.list("buildHarnessArchitectureRuleClasses"),
                    buildHarnessDocumentationRuleClasses = properties.list("buildHarnessDocumentationRuleClasses"),
                    buildHarnessTaskMainClasses = properties.mapEntries("buildHarnessTask.", ".mainClass"),
                    errorProneCheckers = properties.list("errorProneCheckers"),
                    errorProneSourceDir = properties.optionalTrimmed("errorProneSourceDir")
                        ?.let { rawPath -> resolveDescriptorPath(repoRootDir, descriptorFile, rawPath) },
                    errorProneServiceFile = properties.optionalTrimmed("errorProneServiceFile")
                        ?.let { rawPath -> resolveDescriptorPath(repoRootDir, descriptorFile, rawPath) },
                    archunit = properties.readArchunitTask("", repoRootDir, descriptorFile),
                    jqassistantTasks = properties.readJqassistantTasks("", repoRootDir, descriptorFile, properties.list("taskNames")),
                    pmdTasks = properties.readPmdTasks("", repoRootDir, descriptorFile, properties.list("taskNames")),
                    pmdSourceDir = properties.optionalTrimmed("pmdSourceDir")
                        ?.let { rawPath -> resolveDescriptorPath(repoRootDir, descriptorFile, rawPath) },
                    verificationSourceRoots = properties.list("verificationSourceRoots"),
                    verificationSourceIncludes = properties.list("verificationSourceIncludes")
                ).validated()
            }
        }
        .associateBy(EnforcementBundleDescriptor::bundleId)
}

private fun EnforcementBundleDescriptor.validated(): EnforcementBundleDescriptor {
    require(taskNames.isNotEmpty()) {
        "Enforcement bundle '$bundleId' must declare taskNames."
    }
    publicCheckTaskName()

    if (buildHarnessTaskMainClasses.isNotEmpty()) {
        require(buildHarnessSourceDir != null) {
            "Enforcement bundle '$bundleId' must declare buildHarnessSourceDir when buildHarnessTask.*.mainClass is present."
        }
        val missingTaskNames = buildHarnessTaskMainClasses.keys - taskNames.toSet()
        require(missingTaskNames.isEmpty()) {
            "Enforcement bundle '$bundleId' declares buildHarness tasks that are missing from taskNames: ${missingTaskNames.joinToString()}."
        }
    }
    if (buildHarnessSourceDir != null) {
        require(
            buildHarnessTaskMainClasses.isNotEmpty() ||
                buildHarnessArchitectureRuleClasses.isNotEmpty() ||
                buildHarnessDocumentationRuleClasses.isNotEmpty()
        ) {
            "Enforcement bundle '$bundleId' must declare buildHarnessTask.*.mainClass or buildHarness*RuleClasses when buildHarnessSourceDir is present."
        }
    }
    if (buildHarnessArchitectureRuleClasses.isNotEmpty() || buildHarnessDocumentationRuleClasses.isNotEmpty()) {
        require(buildHarnessSourceDir != null) {
            "Enforcement bundle '$bundleId' must declare buildHarnessSourceDir when buildHarness*RuleClasses are present."
        }
    }

    val hasErrorProneSource = errorProneSourceDir != null
    val hasErrorProneService = errorProneServiceFile != null
    require(hasErrorProneSource == hasErrorProneService) {
        "Enforcement bundle '$bundleId' must declare both errorProneSourceDir and errorProneServiceFile together."
    }
    if (errorProneCheckers.isNotEmpty()) {
        require(hasErrorProneSource) {
            "Enforcement bundle '$bundleId' must declare errorProneSourceDir/errorProneServiceFile when errorProneCheckers are configured."
        }
    }

    if (pmdTasks.isNotEmpty()) {
        val missingTaskNames = pmdTasks.map(EnforcementPmdTask::taskName) - taskNames.toSet()
        require(missingTaskNames.isEmpty()) {
            "Enforcement bundle '$bundleId' declares PMD tasks that are missing from taskNames: ${missingTaskNames.joinToString()}."
        }
    }

    if (jqassistantTasks.isNotEmpty()) {
        val missingTaskNames = jqassistantTasks
            .flatMap { jqassistant -> listOf(jqassistant.taskName, jqassistant.scanTaskName, jqassistant.analyzeTaskName) }
            .toSet() - taskNames.toSet()
        require(missingTaskNames.isEmpty()) {
            "Enforcement bundle '$bundleId' declares jQAssistant tasks that are missing from taskNames: ${missingTaskNames.joinToString()}."
        }
    }

    if (requiresFocusedCompile()) {
        require(verificationSourceRoots.isNotEmpty()) {
            "Enforcement bundle '$bundleId' must declare verificationSourceRoots for compile-backed verification."
        }
        require(verificationSourceIncludes.isNotEmpty()) {
            "Enforcement bundle '$bundleId' must declare verificationSourceIncludes for compile-backed verification."
        }
    }

    if (rootPluginId == null) {
        require(rootTask != null) {
            "Standard enforcement bundle '$bundleId' must declare rootTask.* metadata."
        }
    }

    return this
}

private fun Properties.readRootTask(propertyPrefix: String): EnforcementRootTask? {
    val description = optionalTrimmed("${propertyPrefix}rootTask.description")
    val attachToCheck = containsKey("${propertyPrefix}rootTask.attachToCheck")
    val attachToCheckArchitecture = containsKey("${propertyPrefix}rootTask.attachToCheckArchitecture")
    if (description == null && !attachToCheck && !attachToCheckArchitecture) {
        return null
    }
    return EnforcementRootTask(
        description = description,
        attachToCheck = boolean("${propertyPrefix}rootTask.attachToCheck"),
        attachToCheckArchitecture = boolean("${propertyPrefix}rootTask.attachToCheckArchitecture")
    )
}

private fun Properties.readArchunitTask(
    propertyPrefix: String,
    repoRootDir: File,
    descriptorFile: File
): EnforcementArchunitTask? {
    val taskName = optionalTrimmed("${propertyPrefix}archunit.taskName")
    val description = optionalTrimmed("${propertyPrefix}archunit.description")
    val sourceDirs = list("${propertyPrefix}archunit.sourceDirs")
    val sourceIncludes = list("${propertyPrefix}archunit.sourceIncludes")
    val includePatterns = list("${propertyPrefix}archunit.includePatterns")
    val useSharedTestSupport = boolean("${propertyPrefix}archunit.useSharedTestSupport")
    if (taskName == null && description == null && sourceDirs.isEmpty() && sourceIncludes.isEmpty() && includePatterns.isEmpty() && !useSharedTestSupport) {
        return null
    }
    require(taskName != null && description != null) {
        "Enforcement bundle descriptor '$descriptorFile' must declare archunit.taskName and archunit.description together."
    }
    require(sourceDirs.isNotEmpty()) {
        "Enforcement bundle descriptor '$descriptorFile' must declare archunit.sourceDirs when archunit.taskName is present."
    }
    return EnforcementArchunitTask(
        taskName = taskName,
        description = description,
        sourceDirs = sourceDirs.map { rawPath -> resolveDescriptorPath(repoRootDir, descriptorFile, rawPath) },
        sourceIncludes = sourceIncludes,
        includePatterns = includePatterns,
        useSharedTestSupport = useSharedTestSupport
    )
}

private fun Properties.readJqassistantTasks(
    propertyPrefix: String,
    repoRootDir: File,
    descriptorFile: File,
    taskNames: List<String>
): List<EnforcementJqassistantTask> {
    val namedTaskNames = jqassistantTaskNames(propertyPrefix)
    val undeclaredTaskNames = namedTaskNames - taskNames.toSet()
    require(undeclaredTaskNames.isEmpty()) {
        "Enforcement bundle descriptor '$descriptorFile' declares jQAssistant tasks outside taskNames: ${undeclaredTaskNames.joinToString()}."
    }
    val namedTasks = taskNames
        .filter { taskName -> taskName in namedTaskNames }
        .map { taskName -> readNamedJqassistantTask(propertyPrefix, repoRootDir, descriptorFile, taskName) }
    val duplicateNamedTaskNames = namedTasks.groupBy(EnforcementJqassistantTask::taskName)
        .filterValues { candidates -> candidates.size > 1 }
        .keys
    require(duplicateNamedTaskNames.isEmpty()) {
        "Enforcement bundle descriptor '$descriptorFile' declares duplicate jQAssistant tasks: ${duplicateNamedTaskNames.joinToString()}."
    }

    val legacyTask = readLegacyJqassistantTask(propertyPrefix, repoRootDir, descriptorFile, taskNames)
    if (legacyTask != null && namedTaskNames.contains(legacyTask.taskName)) {
        error(
            "Enforcement bundle descriptor '$descriptorFile' declares both legacy jqassistant.* metadata " +
                "and jqassistantTask.${legacyTask.taskName}.* metadata for the same public task."
        )
    }
    return buildList {
        legacyTask?.let(::add)
        addAll(namedTasks)
    }
}

private fun Properties.readLegacyJqassistantTask(
    propertyPrefix: String,
    repoRootDir: File,
    descriptorFile: File,
    taskNames: List<String>
): EnforcementJqassistantTask? {
    val scanTaskName = optionalTrimmed("${propertyPrefix}jqassistant.scanTaskName")
    val analyzeTaskName = optionalTrimmed("${propertyPrefix}jqassistant.analyzeTaskName")
    val scanDescription = optionalTrimmed("${propertyPrefix}jqassistant.scanDescription")
    val analyzeDescription = optionalTrimmed("${propertyPrefix}jqassistant.analyzeDescription")
    val configPath = optionalTrimmed("${propertyPrefix}jqassistant.config")
    val rulesDirPath = optionalTrimmed("${propertyPrefix}jqassistant.rulesDir")
    val reportsDirPath = optionalTrimmed("${propertyPrefix}jqassistant.reportsDir")
    if (
        scanTaskName == null &&
        analyzeTaskName == null &&
        scanDescription == null &&
        analyzeDescription == null &&
        configPath == null &&
        rulesDirPath == null &&
        reportsDirPath == null
    ) {
        return null
    }
    require(
        scanTaskName != null &&
            analyzeTaskName != null &&
            scanDescription != null &&
            analyzeDescription != null &&
            configPath != null &&
            rulesDirPath != null &&
            reportsDirPath != null
    ) {
        "Enforcement bundle descriptor '$descriptorFile' must fully declare jqassistant.* metadata."
    }
    return EnforcementJqassistantTask(
        taskName = publicCheckTaskName(taskNames, descriptorFile.path),
        scanTaskName = scanTaskName,
        analyzeTaskName = analyzeTaskName,
        scanDescription = scanDescription,
        analyzeDescription = analyzeDescription,
        ruleGroups = loadJqassistantRuleGroups(resolveDescriptorPath(repoRootDir, descriptorFile, configPath)),
        rulesDirPath = resolveDescriptorPath(repoRootDir, descriptorFile, rulesDirPath),
        reportsDirPath = reportsDirPath
    )
}

private fun Properties.readNamedJqassistantTask(
    propertyPrefix: String,
    repoRootDir: File,
    descriptorFile: File,
    taskName: String
): EnforcementJqassistantTask {
    val propertyBase = "${propertyPrefix}jqassistantTask.$taskName"
    val scanTaskName = optionalTrimmed("$propertyBase.scanTaskName")
    val analyzeTaskName = optionalTrimmed("$propertyBase.analyzeTaskName")
    val scanDescription = optionalTrimmed("$propertyBase.scanDescription")
    val analyzeDescription = optionalTrimmed("$propertyBase.analyzeDescription")
    val rulesDirPath = optionalTrimmed("$propertyBase.rulesDir")
    val reportsDirPath = optionalTrimmed("$propertyBase.reportsDir")
    val ruleGroups = list("$propertyBase.groups")
    require(
        scanTaskName != null &&
            analyzeTaskName != null &&
            scanDescription != null &&
            analyzeDescription != null &&
            rulesDirPath != null &&
            reportsDirPath != null &&
            ruleGroups.isNotEmpty()
    ) {
        "Enforcement bundle descriptor '$descriptorFile' must fully declare $propertyBase.* metadata."
    }
    return EnforcementJqassistantTask(
        taskName = taskName,
        scanTaskName = scanTaskName,
        analyzeTaskName = analyzeTaskName,
        scanDescription = scanDescription,
        analyzeDescription = analyzeDescription,
        ruleGroups = ruleGroups,
        rulesDirPath = resolveDescriptorPath(repoRootDir, descriptorFile, rulesDirPath),
        reportsDirPath = reportsDirPath
    )
}

private fun Properties.jqassistantTaskNames(propertyPrefix: String): Set<String> {
    val prefix = "${propertyPrefix}jqassistantTask."
    return stringPropertyNames()
        .filter { propertyName -> propertyName.startsWith(prefix) }
        .map { propertyName -> propertyName.removePrefix(prefix).substringBefore('.') }
        .filter(String::isNotBlank)
        .toSet()
}

private fun Properties.readPmdTasks(
    propertyPrefix: String,
    repoRootDir: File,
    descriptorFile: File,
    taskNames: List<String>
): List<EnforcementPmdTask> {
    val declaredTaskNames = pmdTaskNames(propertyPrefix)
    val undeclaredTaskNames = declaredTaskNames - taskNames.toSet()
    require(undeclaredTaskNames.isEmpty()) {
        "Enforcement bundle descriptor '$descriptorFile' declares PMD tasks outside taskNames: ${undeclaredTaskNames.joinToString()}."
    }
    val tasks = taskNames
        .filter { taskName -> taskName in declaredTaskNames }
        .map { taskName -> readNamedPmdTask(propertyPrefix, repoRootDir, descriptorFile, taskName) }
    val duplicateTaskNames = tasks.groupBy(EnforcementPmdTask::taskName)
        .filterValues { candidates -> candidates.size > 1 }
        .keys
    require(duplicateTaskNames.isEmpty()) {
        "Enforcement bundle descriptor '$descriptorFile' declares duplicate PMD tasks: ${duplicateTaskNames.joinToString()}."
    }
    return tasks
}

private fun Properties.readNamedPmdTask(
    propertyPrefix: String,
    repoRootDir: File,
    descriptorFile: File,
    taskName: String
): EnforcementPmdTask {
    val propertyBase = "${propertyPrefix}pmdTask.$taskName"
    val description = optionalTrimmed("$propertyBase.description")
    val rulesetPath = optionalTrimmed("$propertyBase.ruleset")
    require(description != null && rulesetPath != null) {
        "Enforcement bundle descriptor '$descriptorFile' must fully declare $propertyBase.description and $propertyBase.ruleset."
    }
    return EnforcementPmdTask(
        taskName = taskName,
        description = description,
        rulesetPath = resolveDescriptorPath(repoRootDir, descriptorFile, rulesetPath),
        sourceRoots = list("$propertyBase.sourceRoots"),
        sourceIncludes = list("$propertyBase.sourceIncludes"),
        ignoreFailures = boolean("$propertyBase.ignoreFailures"),
        consoleOutput = boolean("$propertyBase.consoleOutput")
    )
}

private fun resolveDescriptorPath(repoRootDir: File, descriptorFile: File, rawPath: String): String {
    val trimmedPath = rawPath.trim()
    if (trimmedPath.isEmpty()) {
        error("Encountered an empty descriptor path in ${descriptorFile.path}.")
    }
    val rawFile = File(trimmedPath)
    val strippedLegacyPrefix = trimmedPath.removePrefix("../../")
    val candidatePaths = buildList {
        if (rawFile.isAbsolute) {
            add(rawFile)
        }
        add(repoRootDir.resolve(trimmedPath))
        add(descriptorFile.parentFile.resolve(trimmedPath))
        if (trimmedPath.startsWith("../../")) {
            add(repoRootDir.resolve("tools/$strippedLegacyPrefix"))
            add(repoRootDir.resolve("tools/quality/$strippedLegacyPrefix"))
        }
    }.distinctBy { file -> file.path }
    return candidatePaths.firstOrNull(File::exists)?.canonicalPath
        ?: error(
            "Could not resolve descriptor path '$trimmedPath' from ${descriptorFile.path}. " +
                "Tried: ${candidatePaths.joinToString { it.path }}"
        )
}

private fun loadProperties(file: File): Properties = Properties().apply {
    file.inputStream().use(::load)
}

private fun Properties.requiredTrimmed(name: String): String = getProperty(name)
    ?.trim()
    ?.takeIf(String::isNotEmpty)
    ?: error("Missing required enforcement bundle property '$name'.")

private fun Properties.optionalTrimmed(name: String): String? = getProperty(name)
    ?.trim()
    ?.takeIf(String::isNotEmpty)

private fun Properties.list(name: String): List<String> = getProperty(name)
    ?.split(',')
    ?.map(String::trim)
    ?.filter(String::isNotEmpty)
    ?: emptyList()

private fun publicCheckTaskName(taskNames: List<String>, owner: String): String = taskNames.firstOrNull { taskName ->
    taskName.startsWith("check")
} ?: error("Missing public check task for enforcement bundle '$owner'.")

private fun loadJqassistantRuleGroups(configPath: String): List<String> {
    val groups = mutableListOf<String>()
    var insideGroups = false
    File(configPath).forEachLine { rawLine ->
        val line = rawLine.trim()
        when {
            line == "groups:" -> insideGroups = true
            insideGroups && line.startsWith("- ") -> groups += line.removePrefix("- ").trim()
            insideGroups && line.isNotEmpty() && !line.startsWith("#") -> insideGroups = false
        }
    }
    require(groups.isNotEmpty()) {
        "jQAssistant config '$configPath' must declare at least one analyze group."
    }
    return groups
}

private fun Properties.boolean(name: String): Boolean = getProperty(name)
    ?.trim()
    ?.equals("true", ignoreCase = true)
    ?: false

private fun Properties.pmdTaskNames(propertyPrefix: String): List<String> {
    val prefix = "${propertyPrefix}pmdTask."
    return stringPropertyNames()
        .asSequence()
        .filter { propertyName -> propertyName.startsWith(prefix) }
        .map { propertyName ->
            propertyName.removePrefix(prefix).substringBefore('.')
        }
        .filter(String::isNotEmpty)
        .distinct()
        .sorted()
        .toList()
}

private fun Properties.mapEntries(namePrefix: String, nameSuffix: String): Map<String, String> = stringPropertyNames()
    .asSequence()
    .filter { propertyName -> propertyName.startsWith(namePrefix) && propertyName.endsWith(nameSuffix) }
    .sorted()
    .associate { propertyName ->
        val name = propertyName.removePrefix(namePrefix).removeSuffix(nameSuffix)
        name to requiredTrimmed(propertyName)
    }
