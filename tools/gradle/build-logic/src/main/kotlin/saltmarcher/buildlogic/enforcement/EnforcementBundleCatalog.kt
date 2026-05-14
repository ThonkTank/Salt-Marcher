package saltmarcher.buildlogic.enforcement

import java.io.File
import java.util.ArrayDeque

data class EnforcementArchunitTask(
    val taskName: String,
    val description: String,
    val sourceIncludes: List<String>,
    val includePatterns: List<String>
)

data class EnforcementJqassistantTask(
    val taskName: String,
    val description: String,
    val sourceConfigPath: String,
    val rulesDirPath: String,
    val sourceRoots: List<String>,
    val sourceIncludes: List<String>
)

enum class EnforcementUtilityTaskKind {
    VIEW_FXML_RESOURCES,
    CENTRALIZED_STYLESHEETS,
    STYLING_CENTRAL_STYLESHEET_OWNER,
    DEFINED_STYLE_CLASS_SELECTORS,
    MANUAL_NODE_STYLING
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
    val kind: BuildHarnessTaskKind,
    val ruleClasses: List<String> = emptyList(),
    val coverageSpecIds: List<String> = emptyList()
)

data class EnforcementBundleDescriptor(
    val bundleId: String,
    val order: Int,
    val selectorTaskName: String,
    val selectorTaskDescription: String,
    val dependentBundleIds: List<String>,
    val buildHarnessArchitectureRuleClasses: List<String>,
    val buildHarnessDocumentationRuleClasses: List<String>,
    val buildHarnessDocumentationCoverageSpecIds: List<String>,
    val buildHarnessTasks: List<BuildHarnessTaskSpec>,
    val errorProneCheckers: List<String>,
    val archunit: EnforcementArchunitTask?,
    val jqassistant: EnforcementJqassistantTask?,
    val utilityTasks: List<EnforcementUtilityTaskSpec>,
    val verificationSourceRoots: List<String>,
    val verificationSourceIncludes: List<String>
) {
    fun internalSelectorTaskNames(): List<String> = listOf(selectorTaskName)

    fun requiresFocusedCompile(): Boolean =
        errorProneCheckers.isNotEmpty() || archunit != null

}

data class EnforcementBundleCatalog(
    val descriptorsById: Map<String, EnforcementBundleDescriptor>
) {
    val bundleIdsInOrder: List<String> = descriptorsById.values
        .sortedBy(EnforcementBundleDescriptor::order)
        .map(EnforcementBundleDescriptor::bundleId)

    val selectorTaskToBundleId: Map<String, String> = descriptorsById.values
        .flatMap { descriptor -> descriptor.internalSelectorTaskNames().map { taskName -> taskName to descriptor.bundleId } }
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
    require(selectorTaskName.isNotBlank()) {
        "Enforcement bundle '$bundleId' must declare selectorTaskName."
    }
    require(selectorTaskDescription.isNotBlank()) {
        "Enforcement bundle '$bundleId' must declare selectorTaskDescription."
    }
    buildHarnessTasks.forEach { task ->
        when (task.kind) {
            BuildHarnessTaskKind.TOPOLOGY -> require(task.ruleClasses.isNotEmpty()) {
                "Enforcement bundle '$bundleId' topology build-harness spec must declare ruleClasses."
            }
            BuildHarnessTaskKind.DOCUMENTATION -> require(task.ruleClasses.isNotEmpty() || task.coverageSpecIds.isNotEmpty()) {
                "Enforcement bundle '$bundleId' documentation build-harness spec must declare ruleClasses or coverageSpecIds."
            }
        }
    }

    utilityTasks.forEach { task ->
        require(task.taskName.isNotBlank()) {
            "Enforcement bundle '$bundleId' declares a utility task with a blank taskName."
        }
    }
    jqassistant?.let { task ->
        require(task.taskName.isNotBlank()) {
            "Enforcement bundle '$bundleId' declares a jQAssistant task with a blank taskName."
        }
        require(task.sourceConfigPath.isNotBlank()) {
            "Enforcement bundle '$bundleId' jQAssistant task '${task.taskName}' must declare sourceConfigPath."
        }
        require(task.rulesDirPath.isNotBlank()) {
            "Enforcement bundle '$bundleId' jQAssistant task '${task.taskName}' must declare rulesDirPath."
        }
        require(task.sourceRoots.isNotEmpty()) {
            "Enforcement bundle '$bundleId' jQAssistant task '${task.taskName}' must declare sourceRoots."
        }
        require(task.sourceIncludes.isNotEmpty()) {
            "Enforcement bundle '$bundleId' jQAssistant task '${task.taskName}' must declare sourceIncludes."
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
