package saltmarcher.buildlogic.enforcement

import java.io.File
import java.util.ArrayDeque

data class EnforcementArchunitTask(
    val taskName: String,
    val description: String,
    val sourceIncludes: List<String>,
    val includePatterns: List<String>
)

enum class EnforcementUtilityTaskKind {
    VIEW_FXML_RESOURCES,
    CENTRALIZED_STYLESHEETS,
    STYLING_CENTRAL_STYLESHEET_OWNER,
    DEFINED_STYLE_CLASS_SELECTORS
}

data class EnforcementUtilityTaskSpec(
    val taskName: String,
    val kind: EnforcementUtilityTaskKind
)

enum class BuildHarnessTaskKind {
    TOPOLOGY,
    DOCUMENTATION
}

data class BuildHarnessTaskSpec(
    val taskName: String,
    val kind: BuildHarnessTaskKind,
    val ruleClasses: List<String> = emptyList(),
    val coverageSpecIds: List<String> = emptyList()
)

data class EnforcementBundleDescriptor(
    val bundleId: String,
    val order: Int,
    val entryTaskName: String,
    val entryTaskDescription: String,
    val dependentBundleIds: List<String>,
    val buildHarnessArchitectureRuleClasses: List<String>,
    val buildHarnessDocumentationRuleClasses: List<String>,
    val buildHarnessDocumentationCoverageSpecIds: List<String>,
    val buildHarnessTasks: List<BuildHarnessTaskSpec>,
    val errorProneCheckers: List<String>,
    val archunit: EnforcementArchunitTask?,
    val utilityTasks: List<EnforcementUtilityTaskSpec>,
    val verificationSourceRoots: List<String>,
    val verificationSourceIncludes: List<String>
) {
    fun focusedSelectorTaskNames(): List<String> = listOf(entryTaskName)

    fun requiresFocusedCompile(): Boolean =
        errorProneCheckers.isNotEmpty() || archunit != null

    fun buildHarnessTask(taskName: String): BuildHarnessTaskSpec = buildHarnessTasks
        .firstOrNull { task -> task.taskName == taskName }
        ?: error("Unknown build-harness task '$taskName' for enforcement bundle '$bundleId'.")
}

data class EnforcementBundleCatalog(
    val descriptorsById: Map<String, EnforcementBundleDescriptor>
) {
    val bundleIdsInOrder: List<String> = descriptorsById.values
        .sortedBy(EnforcementBundleDescriptor::order)
        .map(EnforcementBundleDescriptor::bundleId)

    val taskToBundleId: Map<String, String> = descriptorsById.values
        .flatMap { descriptor -> descriptor.focusedSelectorTaskNames().map { taskName -> taskName to descriptor.bundleId } }
        .toMap()

    fun descriptor(bundleId: String): EnforcementBundleDescriptor = descriptorsById[bundleId]
        ?: error("Unknown enforcement bundle '$bundleId'.")

    fun dependentBundleIds(bundleId: String): List<String> = descriptor(bundleId).dependentBundleIds
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
    require(entryTaskName.isNotBlank()) {
        "Enforcement bundle '$bundleId' must declare entryTaskName."
    }
    require(entryTaskDescription.isNotBlank()) {
        "Enforcement bundle '$bundleId' must declare entryTaskDescription."
    }
    buildHarnessTasks.forEach { task ->
        require(task.taskName.isNotBlank()) {
            "Enforcement bundle '$bundleId' declares a build-harness task with a blank taskName."
        }
        when (task.kind) {
            BuildHarnessTaskKind.TOPOLOGY -> require(task.ruleClasses.isNotEmpty()) {
                "Enforcement bundle '$bundleId' topology task '${task.taskName}' must declare ruleClasses."
            }
            BuildHarnessTaskKind.DOCUMENTATION -> require(task.ruleClasses.isNotEmpty() || task.coverageSpecIds.isNotEmpty()) {
                "Enforcement bundle '$bundleId' documentation task '${task.taskName}' must declare ruleClasses or coverageSpecIds."
            }
        }
    }

    utilityTasks.forEach { task ->
        require(task.taskName.isNotBlank()) {
            "Enforcement bundle '$bundleId' declares a utility task with a blank taskName."
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

    return this
}

private fun EnforcementBundleCatalog.validatedCrossBundleDependencies(): EnforcementBundleCatalog {
    descriptorsById.values.forEach { descriptor ->
        descriptor.dependentBundleIds.forEach { dependencyBundleId ->
            require(descriptorsById.containsKey(dependencyBundleId)) {
                "Enforcement bundle '${descriptor.bundleId}' references unknown dependent bundle '$dependencyBundleId'."
            }
        }
    }
    return this
}
