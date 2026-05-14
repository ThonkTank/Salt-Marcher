package saltmarcher.buildlogic.verification

import org.gradle.api.Plugin
import org.gradle.api.Project
import org.gradle.api.tasks.compile.JavaCompile
import org.gradle.api.tasks.TaskProvider
import org.gradle.kotlin.dsl.getByType
import org.gradle.kotlin.dsl.named
import org.gradle.kotlin.dsl.register
import org.gradle.language.base.plugins.LifecycleBasePlugin
import saltmarcher.buildlogic.enforcement.BuildHarnessTaskKind
import saltmarcher.buildlogic.enforcement.EnforcementBundleDescriptor
import saltmarcher.buildlogic.enforcement.EnforcementBundlesExtension
import saltmarcher.buildlogic.enforcement.standardEnforcementDiagnosticSurfaceCatalog

class SaltmarcherVerificationCorePlugin : Plugin<Project> {
    override fun apply(project: Project) {
        project.pluginManager.apply("saltmarcher.enforcement-bundles")
        project.configureVerificationCore()
    }
}

internal fun Project.configureVerificationCore() {
    val enforcementBundles = extensions.getByType(EnforcementBundlesExtension::class.java)
    val activeEnforcementBundleIds = enforcementBundles.activeEnforcementBundleIds
    val verificationHarness = extensions.getByType<VerificationHarnessExtension>()
    val diagnosticSurfaceCatalog = standardEnforcementDiagnosticSurfaceCatalog(enforcementBundles.catalog)
    val verificationLifecycleCatalog = standardVerificationLifecycleCatalog()
    val includeBuildHarness = systemBoolean("saltmarcher.includeBuildHarness", defaultValue = true)
    val includeJqassistant = systemBoolean("saltmarcher.includeJqassistant", defaultValue = true)

    fun descriptor(bundleId: String): EnforcementBundleDescriptor = enforcementBundles.descriptor(bundleId)

    fun defaultBundleDisplayName(bundleId: String): String = bundleId.replaceFirstChar(Char::uppercaseChar)

    fun activeSurfaceBuildHarnessTaskNames(kind: BuildHarnessTaskKind): List<String> =
        diagnosticSurfaceCatalog.surfacesInOrder
            .filter { surface ->
                surface.bundleIds
                    .filter(activeEnforcementBundleIds::contains)
                    .map(::descriptor)
                    .any { descriptor -> descriptor.buildHarnessTasks.any { task -> task.kind == kind } }
            }
            .map { surface -> surface.buildHarnessTaskName(kind) }

    val focusedCompileTasksByBundleId = registerFocusedCompileTasksByBundleId(
        activeEnforcementBundleIds.map(::descriptor),
        verificationHarness,
        focusedEnforcementBundleMode = enforcementBundles.focusedEnforcementBundleMode
    )
    val nearMissCompileTask = verificationHarness.registerFocusedVerificationCompileTask(
        FocusedVerificationSliceKey(
            verificationSourceRoots = listOf("bootstrap", "shell", "src"),
            verificationSourceIncludes = listOf("**/*.java"),
            compileClasspathOwner = "mainCompileClasspath"
        ),
        listOf("NearMissDtoOverfetching", "NearMissUseMapContainsKey"),
        "Compile production sources with cache-compatible near-miss hygiene checks enabled."
    )

    tasks.register("checkRewriteNearMisses") {
        group = LifecycleBasePlugin.VERIFICATION_GROUP
        description = "Run blocking first-party near-miss hygiene checks."
        dependsOn(nearMissCompileTask)
    }

    fun registerStandardBundle(bundleId: String) {
        val descriptor = descriptor(bundleId)
        val selectorTaskName = descriptor.selectorTaskName
        val checkerNames = descriptor.errorProneCheckers
        val bundleDisplayName = defaultBundleDisplayName(bundleId)

        val selectedCompileJava = if (descriptor.requiresFocusedCompile()) {
            focusedCompileTasksByBundleId[bundleId]
                ?: error("Missing coalesced focused compile task for enforcement bundle '$bundleId'.")
        } else {
            null
        }

        val aggregateDependencies = mutableListOf<Any>()
        aggregateDependencies.addAll(
            descriptor.dependentBundleIds.map { dependencyBundleId ->
                tasks.named(descriptor(dependencyBundleId).selectorTaskName)
            }
        )

        if (checkerNames.isNotEmpty()) {
            val compileTask = selectedCompileJava
                ?: tasks.named<JavaCompile>("compileJava")
            aggregateDependencies += compileTask
        }

        descriptor.archunit?.let { archunit ->
            val compileTask = selectedCompileJava
                ?: error("Missing selected compile task for ArchUnit enforcement bundle '$bundleId'.")
            val archunitTask = verificationHarness.registerFocusedArchunitTestTask(
                bundleId,
                archunit.taskName,
                archunit.description,
                compileTask,
                archunit.sourceIncludes,
                archunit.includePatterns
            )
            aggregateDependencies += archunitTask
        }

        descriptor.utilityTasks.forEach { utilityTask ->
            aggregateDependencies += verificationHarness.registerUtilityVerificationTask(
                utilityTask.taskName,
                utilityTask.kind
            )
        }

        descriptor.jqassistant?.takeIf { includeJqassistant }?.let { jqassistant ->
            aggregateDependencies += verificationHarness.registerJqassistantTask(bundleId, jqassistant)
        }

        tasks.register(selectorTaskName) {
            description = descriptor.selectorTaskDescription.ifBlank {
                "Internal selector for the $bundleDisplayName enforcement bundle."
            }
            aggregateDependencies.forEach(::dependsOn)
        }
    }

    activeEnforcementBundleIds
        .forEach(::registerStandardBundle)

    diagnosticSurfaceCatalog.surfacesInOrder.forEach { surface ->
        val activeSurfaceBundleIds = surface.bundleIds.filter(activeEnforcementBundleIds::contains)
        tasks.register(surface.diagnosticTaskName) {
            group = LifecycleBasePlugin.VERIFICATION_GROUP
            description = surface.description
            activeSurfaceBundleIds
                .map(::descriptor)
                .map(EnforcementBundleDescriptor::selectorTaskName)
                .forEach(::dependsOn)
            if (includeBuildHarness && activeSurfaceBundleIds
                    .map(::descriptor)
                    .any { descriptor -> descriptor.buildHarnessTasks.any { task -> task.kind == BuildHarnessTaskKind.TOPOLOGY } }
            ) {
                dependsOn(gradle.includedBuild("build-harness").task(":${surface.buildHarnessTaskName(BuildHarnessTaskKind.TOPOLOGY)}"))
            }
        }
    }

    val checkDocumentationEnforcement = tasks.register("checkDocumentationEnforcement") {
        group = LifecycleBasePlugin.VERIFICATION_GROUP
        description = "Run all Markdown-backed architecture and enforcement documentation checks through the verification core."
        if (includeBuildHarness) {
            dependsOn(gradle.includedBuild("build-harness").task(":documentationEnforcementCheck"))
            activeSurfaceBuildHarnessTaskNames(BuildHarnessTaskKind.DOCUMENTATION)
                .map { taskName -> gradle.includedBuild("build-harness").task(":$taskName") }
                .forEach(::dependsOn)
        }
    }

    tasks.register("desktop-install") {
        group = LifecycleBasePlugin.VERIFICATION_GROUP
        description = "Run the convenience desktop installation path after a green local handoff."
        dependsOn("installDesktopApp")
    }

    val productionHandoffSurface = verificationLifecycleCatalog.surface("production-handoff")
    val productionHandoffCompileIntegrity = tasks.register("productionHandoffCompileIntegrity") {
        group = LifecycleBasePlugin.VERIFICATION_GROUP
        description = "Run the fail-fast compile integrity phase for production handoff."
        verificationLifecycleCatalog.ownerTaskNames(VerificationLifecyclePhase.COMPILE_INTEGRITY).forEach(::dependsOn)
        if (includeBuildHarness) {
            dependsOn(gradle.includedBuild("build-harness").task(":classes"))
        }
        if (systemBoolean("saltmarcher.includeQualityRules", defaultValue = true)) {
            dependsOn(gradle.includedBuild("quality-rules").task(":jar"))
        }
        if (systemBoolean("saltmarcher.includeQualityRulesErrorProne", defaultValue = true)) {
            dependsOn(gradle.includedBuild("quality-rules-errorprone").task(":jar"))
        }
    }

    val productionHandoffStructure = tasks.register("productionHandoffStructure") {
        group = LifecycleBasePlugin.VERIFICATION_GROUP
        description = "Run the fail-fast architecture and build-harness structure phase for production handoff."
        dependsOn(productionHandoffCompileIntegrity)
        verificationLifecycleCatalog.ownerTaskNames(VerificationLifecyclePhase.STRUCTURE).forEach(::dependsOn)
        if (includeBuildHarness) {
            dependsOn(gradle.includedBuild("build-harness").task(":allBuildHarnessTopologyCheck"))
            dependsOn(gradle.includedBuild("build-harness").task(":architectureCheck"))
        }
    }

    val productionHandoffHygiene = tasks.register("productionHandoffHygiene") {
        group = LifecycleBasePlugin.VERIFICATION_GROUP
        description = "Run the aggregating hygiene, reporting, and bundle phase for production handoff."
        dependsOn(productionHandoffStructure)
        verificationLifecycleCatalog.ownerTaskNames(VerificationLifecyclePhase.HYGIENE).forEach(::dependsOn)
        activeEnforcementBundleIds
            .map(::descriptor)
            .map(EnforcementBundleDescriptor::selectorTaskName)
            .forEach(::dependsOn)
    }

    tasks.register(productionHandoffSurface.publicTaskName) {
        group = LifecycleBasePlugin.VERIFICATION_GROUP
        description = productionHandoffSurface.description
        dependsOn(productionHandoffHygiene)
    }

}

private fun systemBoolean(name: String, defaultValue: Boolean): Boolean =
    System.getProperty(name)
        ?.trim()
        ?.takeIf(String::isNotEmpty)
        ?.toBooleanStrictOrNull()
        ?: defaultValue

private fun registerFocusedCompileTasksByBundleId(
    descriptors: List<EnforcementBundleDescriptor>,
    verificationHarness: VerificationHarnessExtension,
    focusedEnforcementBundleMode: Boolean
): Map<String, TaskProvider<JavaCompile>> {
    val compileBackedDescriptors = descriptors
        .filter(EnforcementBundleDescriptor::requiresFocusedCompile)
    val groupedDescriptors = if (focusedEnforcementBundleMode) {
        compileBackedDescriptors
            .groupBy(FocusedVerificationSliceKey::from)
            .map { (sliceKey, sliceDescriptors) ->
                FocusedCompileGroupKey(sliceKey.sliceId, sliceKey) to sliceDescriptors
            }
    } else {
        compileBackedDescriptors
            .groupBy(::productionCompileFamilyId)
            .map { (familyId, familyDescriptors) ->
                FocusedCompileGroupKey(
                    familyId,
                    FocusedVerificationSliceKey.from(familyId, familyDescriptors)
                ) to familyDescriptors
            }
    }

    return groupedDescriptors
        .flatMap { (groupKey, sliceDescriptors) ->
            val sliceBundleIds = sliceDescriptors
                .map(EnforcementBundleDescriptor::bundleId)
                .sorted()
            val sliceCheckerNames = sliceDescriptors
                .flatMap(EnforcementBundleDescriptor::errorProneCheckers)
                .distinct()
                .sorted()
            val coalescedCompileTask = verificationHarness.registerFocusedVerificationCompileTask(
                groupKey.sliceKey,
                sliceCheckerNames,
                focusedCompileDescription(groupKey.groupId, sliceBundleIds, sliceCheckerNames)
            )
            sliceDescriptors.map { descriptor ->
                descriptor.bundleId to coalescedCompileTask
            }
        }
        .toMap()
}

private fun focusedCompileDescription(
    groupId: String,
    bundleIds: List<String>,
    checkerNames: List<String>
): String {
    val sliceDisplayName = bundleIds.joinToString(", ")
    return if (checkerNames.isEmpty()) {
        "Compile the coalesced focused verification slice '$groupId' for $sliceDisplayName."
    } else {
        "Compile the coalesced focused verification slice '$groupId' for $sliceDisplayName with the dedicated Error Prone checks enabled."
    }
}

private data class FocusedCompileGroupKey(
    val groupId: String,
    val sliceKey: FocusedVerificationSliceKey
)

private fun productionCompileFamilyId(descriptor: EnforcementBundleDescriptor): String = when {
    descriptor.bundleId.startsWith("view") || descriptor.bundleId.startsWith("styling") -> "view-ui"
    descriptor.bundleId.startsWith("domain") -> "domain"
    descriptor.bundleId.startsWith("data") -> "data"
    descriptor.bundleId.startsWith("shell") -> "shell"
    descriptor.bundleId.startsWith("bootstrap") -> "bootstrap"
    else -> descriptor.bundleId
}
