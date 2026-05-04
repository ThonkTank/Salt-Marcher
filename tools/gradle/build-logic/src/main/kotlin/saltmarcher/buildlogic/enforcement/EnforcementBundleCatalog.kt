package saltmarcher.buildlogic.enforcement

import java.io.File
import java.util.Properties
import org.gradle.api.Project

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

data class EnforcementJqassistantTaskPair(
    val scanTaskName: String,
    val analyzeTaskName: String,
    val scanDescription: String,
    val analyzeDescription: String,
    val configPath: String,
    val rulesDirPath: String,
    val reportsDirPath: String
)

data class EnforcementPmdTask(
    val taskName: String,
    val description: String,
    val rulesetPath: String,
    val sourceRoots: List<String>,
    val sourceIncludes: List<String>
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
    val jqassistant: EnforcementJqassistantTaskPair?,
    val pmd: EnforcementPmdTask?,
    val pmdSourceDir: String?,
    val verificationSourceRoots: List<String>,
    val verificationSourceIncludes: List<String>
) {
    fun publicCheckTaskName(): String = taskNames.firstOrNull { taskName -> taskName.startsWith("check") }
        ?: error("Missing public check task for enforcement bundle '$bundleId'.")

    fun requiresFocusedCompile(): Boolean = errorProneSourceDir != null || archunit != null || jqassistant != null
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

fun Project.loadEnforcementBundlesExtension(): EnforcementBundlesExtension {
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
    val localSelection = if (propagatedFocusedEnforcementBundleMode != null &&
        propagatedActiveEnforcementBundleIds != null
    ) {
        null
    } else {
        computeLocalEnforcementBundleSelection(repoRootDir, catalog)
    }
    val focusedEnforcementBundleMode = propagatedFocusedEnforcementBundleMode
        ?: localSelection?.focusedEnforcementBundleMode
        ?: false
    val activeEnforcementBundleIds = if (propagatedActiveEnforcementBundleIds != null) {
        catalog.bundleIdsInOrder.filter { bundleId -> bundleId in propagatedActiveEnforcementBundleIds }
    } else if (localSelection?.focusedEnforcementBundleMode == true) {
        localSelection.activeEnforcementBundleIds
    } else {
        catalog.bundleIdsInOrder
    }

    System.setProperty("saltmarcher.repoRootDir", repoRootDir.absolutePath)
    System.setProperty("saltmarcher.focusedEnforcementBundleMode", focusedEnforcementBundleMode.toString())
    System.setProperty("saltmarcher.activeEnforcementBundleIds", activeEnforcementBundleIds.joinToString(","))

    return EnforcementBundlesExtension(
        repoRootDir = repoRootDir,
        catalog = catalog,
        selection = EnforcementBundleSelection(
            focusedEnforcementBundleMode = focusedEnforcementBundleMode,
            activeEnforcementBundleIds = activeEnforcementBundleIds
        )
    )
}

private fun Project.computeLocalEnforcementBundleSelection(
    repoRootDir: File,
    catalog: EnforcementBundleCatalog
): EnforcementBundleSelection {
    val verificationSurfaceCatalog = loadProperties(File(repoRootDir, "tools/gradle/verification-surface-catalog.properties"))
    val broadBuildTaskNames = verificationSurfaceCatalog.list("broadBuildTaskNames").toSet()
    val requestedTaskNames = gradle.startParameter.taskNames
        .map { taskName -> taskName.substringAfterLast(":") }
        .toSet()
    val requestedBundleIds = requestedTaskNames
        .mapNotNull(catalog.taskToBundleId::get)
        .distinct()
    val focusedEnforcementBundleMode = requestedTaskNames.isNotEmpty() &&
        requestedBundleIds.isNotEmpty() &&
        requestedTaskNames.none { taskName -> taskName in broadBuildTaskNames } &&
        requestedTaskNames.all { taskName -> taskName in catalog.taskToBundleId.keys }
    val activeEnforcementBundleIds = if (focusedEnforcementBundleMode) {
        catalog.bundleIdsInOrder.filter { bundleId -> bundleId in requestedBundleIds }
    } else {
        catalog.bundleIdsInOrder
    }
    return EnforcementBundleSelection(
        focusedEnforcementBundleMode = focusedEnforcementBundleMode,
        activeEnforcementBundleIds = activeEnforcementBundleIds
    )
}

private fun loadEnforcementBundleDescriptors(repoRootDir: File): Map<String, EnforcementBundleDescriptor> {
    optionalCatalogFile()?.let { catalogFile ->
        val properties = loadProperties(catalogFile)
        return properties.catalogBundleIds()
            .associateWith { bundleId ->
                properties.readCatalogDescriptor(bundleId).validated()
            }
    }

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
                    jqassistant = properties.readJqassistantTaskPair("", repoRootDir, descriptorFile),
                    pmd = properties.readPmdTask("", repoRootDir, descriptorFile, properties.list("taskNames")),
                    pmdSourceDir = properties.optionalTrimmed("pmdSourceDir")
                        ?.let { rawPath -> resolveDescriptorPath(repoRootDir, descriptorFile, rawPath) },
                    verificationSourceRoots = properties.list("verificationSourceRoots"),
                    verificationSourceIncludes = properties.list("verificationSourceIncludes")
                ).validated()
            }
        }
        .associateBy(EnforcementBundleDescriptor::bundleId)
}

private fun Properties.readCatalogDescriptor(bundleId: String): EnforcementBundleDescriptor {
    val descriptorFile = File(requiredTrimmed("bundle.$bundleId.descriptorFile"))
    val propertyPrefix = "bundle.$bundleId."
    return EnforcementBundleDescriptor(
        bundleId = bundleId,
        order = requiredTrimmed("bundle.$bundleId.order").toInt(),
        taskNames = list("bundle.$bundleId.taskNames"),
        rootPluginId = optionalTrimmed("${propertyPrefix}rootPluginId"),
        rootTask = readRootTask(propertyPrefix),
        buildHarnessSourceDir = optionalTrimmed("${propertyPrefix}buildHarnessSourceDir"),
        buildHarnessArchitectureRuleClasses = list("${propertyPrefix}buildHarnessArchitectureRuleClasses"),
        buildHarnessDocumentationRuleClasses = list("${propertyPrefix}buildHarnessDocumentationRuleClasses"),
        buildHarnessTaskMainClasses = mapEntries("${propertyPrefix}buildHarnessTask.", ".mainClass"),
        errorProneCheckers = list("${propertyPrefix}errorProneCheckers"),
        errorProneSourceDir = optionalTrimmed("${propertyPrefix}errorProneSourceDir"),
        errorProneServiceFile = optionalTrimmed("${propertyPrefix}errorProneServiceFile"),
        archunit = readCatalogArchunitTask(propertyPrefix, descriptorFile),
        jqassistant = readCatalogJqassistantTaskPair(propertyPrefix, descriptorFile),
        pmd = readCatalogPmdTask(propertyPrefix, descriptorFile, list("bundle.$bundleId.taskNames")),
        pmdSourceDir = optionalTrimmed("${propertyPrefix}pmdSourceDir"),
        verificationSourceRoots = list("${propertyPrefix}verificationSourceRoots"),
        verificationSourceIncludes = list("${propertyPrefix}verificationSourceIncludes")
    )
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

private fun Properties.readCatalogArchunitTask(
    propertyPrefix: String,
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
        sourceDirs = sourceDirs,
        sourceIncludes = sourceIncludes,
        includePatterns = includePatterns,
        useSharedTestSupport = useSharedTestSupport
    )
}

private fun Properties.readJqassistantTaskPair(
    propertyPrefix: String,
    repoRootDir: File,
    descriptorFile: File
): EnforcementJqassistantTaskPair? {
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
    return EnforcementJqassistantTaskPair(
        scanTaskName = scanTaskName,
        analyzeTaskName = analyzeTaskName,
        scanDescription = scanDescription,
        analyzeDescription = analyzeDescription,
        configPath = resolveDescriptorPath(repoRootDir, descriptorFile, configPath),
        rulesDirPath = resolveDescriptorPath(repoRootDir, descriptorFile, rulesDirPath),
        reportsDirPath = reportsDirPath
    )
}

private fun Properties.readCatalogJqassistantTaskPair(
    propertyPrefix: String,
    descriptorFile: File
): EnforcementJqassistantTaskPair? {
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
    return EnforcementJqassistantTaskPair(
        scanTaskName = scanTaskName,
        analyzeTaskName = analyzeTaskName,
        scanDescription = scanDescription,
        analyzeDescription = analyzeDescription,
        configPath = configPath,
        rulesDirPath = rulesDirPath,
        reportsDirPath = reportsDirPath
    )
}

private fun Properties.readPmdTask(
    propertyPrefix: String,
    repoRootDir: File,
    descriptorFile: File,
    taskNames: List<String>
): EnforcementPmdTask? {
    val taskName = optionalTrimmed("${propertyPrefix}pmd.taskName")
        ?: taskNames.singleOrNull { taskNameCandidate -> taskNameCandidate.startsWith("pmd") }
    val description = optionalTrimmed("${propertyPrefix}pmd.description")
    val rulesetPath = optionalTrimmed("${propertyPrefix}pmd.ruleset")
    val sourceRoots = list("${propertyPrefix}pmd.sourceRoots")
    val sourceIncludes = list("${propertyPrefix}pmd.sourceIncludes")
    if (taskName == null && description == null && rulesetPath == null && sourceRoots.isEmpty() && sourceIncludes.isEmpty()) {
        return null
    }
    require(taskName != null && description != null && rulesetPath != null) {
        "Enforcement bundle descriptor '$descriptorFile' must fully declare pmd.taskName, pmd.description, and pmd.ruleset."
    }
    return EnforcementPmdTask(
        taskName = taskName,
        description = description,
        rulesetPath = resolveDescriptorPath(repoRootDir, descriptorFile, rulesetPath),
        sourceRoots = sourceRoots,
        sourceIncludes = sourceIncludes
    )
}

private fun Properties.readCatalogPmdTask(
    propertyPrefix: String,
    descriptorFile: File,
    taskNames: List<String>
): EnforcementPmdTask? {
    val taskName = optionalTrimmed("${propertyPrefix}pmd.taskName")
        ?: taskNames.singleOrNull { taskNameCandidate -> taskNameCandidate.startsWith("pmd") }
    val description = optionalTrimmed("${propertyPrefix}pmd.description")
    val rulesetPath = optionalTrimmed("${propertyPrefix}pmd.ruleset")
    val sourceRoots = list("${propertyPrefix}pmd.sourceRoots")
    val sourceIncludes = list("${propertyPrefix}pmd.sourceIncludes")
    if (taskName == null && description == null && rulesetPath == null && sourceRoots.isEmpty() && sourceIncludes.isEmpty()) {
        return null
    }
    require(taskName != null && description != null && rulesetPath != null) {
        "Enforcement bundle descriptor '$descriptorFile' must fully declare pmd.taskName, pmd.description, and pmd.ruleset."
    }
    return EnforcementPmdTask(
        taskName = taskName,
        description = description,
        rulesetPath = rulesetPath,
        sourceRoots = sourceRoots,
        sourceIncludes = sourceIncludes
    )
}

private fun optionalCatalogFile(): File? = System.getProperty("saltmarcher.enforcementBundleCatalogFile")
    ?.trim()
    ?.takeIf(String::isNotEmpty)
    ?.let(::File)
    ?.takeIf(File::isFile)

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

private fun Properties.boolean(name: String): Boolean = getProperty(name)
    ?.trim()
    ?.equals("true", ignoreCase = true)
    ?: false

private fun Properties.mapEntries(namePrefix: String, nameSuffix: String): Map<String, String> = stringPropertyNames()
    .asSequence()
    .filter { propertyName -> propertyName.startsWith(namePrefix) && propertyName.endsWith(nameSuffix) }
    .sorted()
    .associate { propertyName ->
        val name = propertyName.removePrefix(namePrefix).removeSuffix(nameSuffix)
        name to requiredTrimmed(propertyName)
    }

private fun Properties.catalogBundleIds(): List<String> {
    val explicitIds = list("bundleIdsInOrder")
    if (explicitIds.isNotEmpty()) {
        return explicitIds
    }

    return stringPropertyNames()
        .asSequence()
        .filter { propertyName -> propertyName.startsWith("bundle.") && propertyName.endsWith(".order") }
        .map { propertyName ->
            val bundleId = propertyName.removePrefix("bundle.").removeSuffix(".order")
            Triple(bundleId, requiredTrimmed(propertyName).toInt(), bundleId)
        }
        .sortedWith(compareBy<Triple<String, Int, String>> { it.second }.thenBy { it.third })
        .map { it.first }
        .toList()
}
