package saltmarcher.buildlogic.enforcement

import java.io.File
import java.util.ArrayDeque

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
    val rulesDirPaths: List<String>,
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

data class EnforcementCustomTask(
    val taskName: String,
    val kind: String
)

data class EnforcementBundleDescriptor(
    val bundleId: String,
    val order: Int,
    val taskNames: List<String>,
    val rootTask: EnforcementRootTask?,
    val rootTaskDependencies: List<String>,
    val buildHarnessArchitectureRuleClasses: List<String>,
    val buildHarnessDocumentationRuleClasses: List<String>,
    val buildHarnessDocumentationCoverageSpecIds: List<String>,
    val buildHarnessTaskMainClasses: Map<String, String>,
    val buildHarnessTaskRuleClasses: Map<String, List<String>>,
    val errorProneCheckers: List<String>,
    val archunit: EnforcementArchunitTask?,
    val jqassistantTasks: List<EnforcementJqassistantTask>,
    val pmdTasks: List<EnforcementPmdTask>,
    val customTasks: List<EnforcementCustomTask>,
    val verificationSourceRoots: List<String>,
    val verificationSourceIncludes: List<String>
) {
    fun publicCheckTaskName(): String = publicCheckTaskName(taskNames, bundleId)

    fun requiresFocusedCompile(): Boolean =
        errorProneCheckers.isNotEmpty() || archunit != null || jqassistantTasks.isNotEmpty()

    fun buildHarnessTaskRuleClasses(taskName: String): List<String> = buildHarnessTaskRuleClasses[taskName]
        ?: when {
            taskName.endsWith("DocumentationEnforcementCheck") -> buildHarnessDocumentationRuleClasses
            taskName.endsWith("TopologyCheck") -> buildHarnessArchitectureRuleClasses
            else -> emptyList()
        }

    fun buildHarnessTaskDocumentationCoverageSpecIds(taskName: String): List<String> =
        if (taskName.endsWith("DocumentationEnforcementCheck")) buildHarnessDocumentationCoverageSpecIds else emptyList()

    fun buildHarnessTaskNames(): List<String> = taskNames.filter { taskName ->
        buildHarnessTaskMainClasses.containsKey(taskName) ||
            buildHarnessTaskRuleClasses(taskName).isNotEmpty() ||
            buildHarnessTaskDocumentationCoverageSpecIds(taskName).isNotEmpty()
    }
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

    fun dependentBundleIds(bundleId: String): List<String> = descriptor(bundleId).rootTaskDependencies
        .mapNotNull(taskToBundleId::get)
        .filterNot(bundleId::equals)
        .distinct()

    fun expandedBundleIds(requestedBundleIds: Iterable<String>): List<String> {
        val expanded = linkedSetOf<String>()
        val pending = ArrayDeque(requestedBundleIds.toList())
        while (pending.isNotEmpty()) {
            val bundleId = pending.removeFirst()
            if (!expanded.add(bundleId)) {
                continue
            }
            dependentBundleIds(bundleId)
                .filterNot(expanded::contains)
                .forEach(pending::addLast)
        }
        return bundleIdsInOrder.filter(expanded::contains)
    }
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

fun standardEnforcementBundleCatalog(): EnforcementBundleCatalog = EnforcementBundleCatalog(
    standardEnforcementBundleDescriptors()
        .map(EnforcementBundleDescriptor::validated)
        .associateBy(EnforcementBundleDescriptor::bundleId)
).validatedCrossBundleDependencies()

fun loadEnforcementBundlesExtension(rootDir: File): EnforcementBundlesExtension {
    val repoRootDir = System.getProperty("saltmarcher.repoRootDir")
        ?.trim()
        ?.takeIf(String::isNotEmpty)
        ?.let(::File)
        ?: rootDir
    val focusedEnforcementBundleMode = System.getProperty("saltmarcher.focusedEnforcementBundleMode")
        ?.trim()
        ?.takeIf(String::isNotEmpty)
        ?.toBoolean()
        ?: false
    val propagatedActiveBundleIds = System.getProperty("saltmarcher.activeEnforcementBundleIds")
        ?.split(',')
        ?.map(String::trim)
        ?.filter(String::isNotEmpty)
        ?.takeIf(List<String>::isNotEmpty)

    require(!focusedEnforcementBundleMode || propagatedActiveBundleIds != null) {
        "Focused enforcement bundle mode requires propagated active bundle ids from the settings plugin."
    }

    val catalog = standardEnforcementBundleCatalog()
    val activeEnforcementBundleIds = propagatedActiveBundleIds
        ?.let { requestedIds -> catalog.bundleIdsInOrder.filter { bundleId -> bundleId in requestedIds } }
        ?: catalog.bundleIdsInOrder

    return EnforcementBundlesExtension(
        repoRootDir = repoRootDir,
        catalog = catalog,
        selection = EnforcementBundleSelection(
            focusedEnforcementBundleMode = focusedEnforcementBundleMode,
            activeEnforcementBundleIds = activeEnforcementBundleIds
        )
    )
}

private fun EnforcementBundleDescriptor.validated(): EnforcementBundleDescriptor {
    require(taskNames.isNotEmpty()) {
        "Enforcement bundle '$bundleId' must declare taskNames."
    }
    publicCheckTaskName()

    if (buildHarnessTaskMainClasses.isNotEmpty() || buildHarnessTaskRuleClasses.isNotEmpty()) {
        val declaredTaskNames = buildHarnessTaskMainClasses.keys + buildHarnessTaskRuleClasses.keys
        val missingTaskNames = declaredTaskNames - taskNames.toSet()
        require(missingTaskNames.isEmpty()) {
            "Enforcement bundle '$bundleId' declares build-harness tasks that are missing from taskNames: ${missingTaskNames.joinToString()}."
        }
        val overlappingTaskNames = buildHarnessTaskMainClasses.keys.intersect(buildHarnessTaskRuleClasses.keys)
        require(overlappingTaskNames.isEmpty()) {
            "Enforcement bundle '$bundleId' must not declare both buildHarnessTask.*.mainClass and buildHarnessTask.*.ruleClasses for the same task: ${overlappingTaskNames.joinToString()}."
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

    if (customTasks.isNotEmpty()) {
        val missingTaskNames = customTasks.map(EnforcementCustomTask::taskName) - taskNames.toSet()
        require(missingTaskNames.isEmpty()) {
            "Enforcement bundle '$bundleId' declares custom verification tasks that are missing from taskNames: ${missingTaskNames.joinToString()}."
        }
    }

    val undeclaredRootDependencies = rootTaskDependencies.filter { taskName ->
        !taskNames.contains(taskName) && !taskName.startsWith("check")
    }
    require(undeclaredRootDependencies.isEmpty()) {
        "Enforcement bundle '$bundleId' declares non-check root task dependencies that are missing from taskNames: ${undeclaredRootDependencies.joinToString()}."
    }

    if (requiresFocusedCompile()) {
        require(verificationSourceRoots.isNotEmpty()) {
            "Enforcement bundle '$bundleId' must declare verificationSourceRoots for compile-backed verification."
        }
        require(verificationSourceIncludes.isNotEmpty()) {
            "Enforcement bundle '$bundleId' must declare verificationSourceIncludes for compile-backed verification."
        }
    }

    require(rootTask != null) {
        "Enforcement bundle '$bundleId' must declare rootTask.* metadata."
    }

    return this
}

private fun EnforcementBundleCatalog.validatedCrossBundleDependencies(): EnforcementBundleCatalog {
    descriptorsById.values.forEach { descriptor ->
        descriptor.rootTaskDependencies.forEach { dependencyTaskName ->
            val dependencyBundleId = taskToBundleId[dependencyTaskName] ?: return@forEach
            if (dependencyBundleId == descriptor.bundleId) {
                return@forEach
            }
            val dependencyDescriptor = descriptor(dependencyBundleId)
            require(dependencyTaskName == dependencyDescriptor.publicCheckTaskName()) {
                "Enforcement bundle '${descriptor.bundleId}' must depend on the public check task of bundle " +
                    "'$dependencyBundleId', but references '$dependencyTaskName'."
            }
        }
    }
    return this
}

fun publicCheckTaskName(taskNames: List<String>, owner: String): String = taskNames
    .firstOrNull { taskName -> taskName.startsWith("check") }
    ?: error("Missing public check task for enforcement bundle '$owner'.")
