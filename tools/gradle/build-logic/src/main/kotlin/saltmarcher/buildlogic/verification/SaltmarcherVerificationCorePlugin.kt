package saltmarcher.buildlogic.verification

import org.gradle.api.Plugin
import org.gradle.api.Project
import org.gradle.api.Task
import org.gradle.api.file.RegularFile
import org.gradle.api.specs.Spec
import org.gradle.api.tasks.TaskProvider
import org.gradle.api.tasks.compile.JavaCompile
import org.gradle.kotlin.dsl.getByType
import org.gradle.kotlin.dsl.named
import org.gradle.kotlin.dsl.register
import org.gradle.language.base.plugins.LifecycleBasePlugin
import saltmarcher.buildlogic.enforcement.BuildHarnessTaskKind
import saltmarcher.buildlogic.enforcement.EnforcementBundleDescriptor
import saltmarcher.buildlogic.enforcement.EnforcementBundlesExtension
import saltmarcher.buildlogic.enforcement.standardEnforcementDiagnosticSurfaceCatalog
import saltmarcher.buildlogic.shared.FocusedHandoffTaskName
import saltmarcher.buildlogic.shared.ProductionHandoffCompileIntegrityTaskName
import saltmarcher.buildlogic.shared.ProductionHandoffHygieneTaskName
import saltmarcher.buildlogic.shared.ProductionHandoffStructureTaskName
import saltmarcher.buildlogic.shared.ProductionHandoffSurfaceId

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

    val activeDescriptors = activeEnforcementBundleIds.map(::descriptor)
    if (focusedHandoffRequested()) {
        require(FocusedVerificationPaths.hasSelection()) {
            "Focused handoff requires at least one focused verification path."
        }
    }
    FocusedVerificationPaths.validateSelection(rootDir, activeDescriptors)

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
        activeDescriptors,
        verificationHarness,
        focusedEnforcementBundleMode = enforcementBundles.focusedEnforcementBundleMode
    )
    val nearMissCompileTask = if (nearMissVerificationRequested()) {
        verificationHarness.registerFocusedVerificationCompileTask(
            FocusedVerificationSliceKey(
                verificationSourceRoots = listOf("bootstrap", "shell", "src"),
                verificationSourceIncludes = listOf("**/*.java"),
                compileClasspathOwner = "mainCompileClasspath"
            ),
            listOf("NearMissDtoOverfetching", "NearMissUseMapContainsKey"),
            "Compile production sources with cache-compatible near-miss hygiene checks enabled."
        )
    } else {
        null
    }

    tasks.register("checkRewriteNearMisses") {
        group = LifecycleBasePlugin.VERIFICATION_GROUP
        description = "Run blocking first-party near-miss hygiene checks."
        nearMissCompileTask?.let { task -> dependsOn(task) }
    }

    fun registerStandardBundle(bundleId: String): RegisteredEnforcementBundleTasks {
        val descriptor = descriptor(bundleId)
        val selectorTaskName = descriptor.selectorTaskName
        val checkerNames = descriptor.errorProneCheckers
        val bundleDisplayName = defaultBundleDisplayName(bundleId)
        val leafTaskNames = mutableListOf<String>()

        val selectedCompileJava = if (descriptor.requiresFocusedCompile()) {
            focusedCompileTasksByBundleId[bundleId]
                ?: error("Missing coalesced focused compile task for enforcement bundle '$bundleId'.")
        } else {
            null
        }
        selectedCompileJava?.let { compileTask -> leafTaskNames += compileTask.name }

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
            val archunitTask = verificationHarness.registerFocusedArchunitTestTask(
                bundleId,
                archunit.taskName,
                archunit.description,
                descriptor.verificationSourceRoots,
                descriptor.verificationSourceIncludes,
                archunit.sourceRoots,
                archunit.sourceIncludes,
                archunit.includePatterns,
                archunit.inputPaths
            )
            aggregateDependencies += archunitTask
            leafTaskNames += archunitTask.name
        }

        descriptor.utilityTasks.forEach { utilityTask ->
            val utilityVerificationTask = verificationHarness.registerUtilityVerificationTask(
                utilityTask.taskName,
                utilityTask.kind
            )
            aggregateDependencies += utilityVerificationTask
            leafTaskNames += utilityVerificationTask.name
        }

        descriptor.jqassistant?.takeIf { includeJqassistant }?.let { jqassistant ->
            val jqassistantTasks = verificationHarness.registerJqassistantTask(bundleId, jqassistant)
            aggregateDependencies += jqassistantTasks.analyzeTask
            leafTaskNames += jqassistantTasks.scanTask.name
            leafTaskNames += jqassistantTasks.analyzeTask.name
        }

        tasks.register(selectorTaskName) {
            description = descriptor.selectorTaskDescription.ifBlank {
                "Internal selector for the $bundleDisplayName enforcement bundle."
            }
            aggregateDependencies.forEach(::dependsOn)
        }
        return RegisteredEnforcementBundleTasks(
            selectorTaskName = selectorTaskName,
            leafTaskNames = leafTaskNames.distinct()
        )
    }

    val registeredBundleTasks = activeEnforcementBundleIds
        .map(::registerStandardBundle)

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

    val focusedHandoffCompileIntegrity = systemBoolean("saltmarcher.focusedHandoffCompileIntegrity", defaultValue = false)
    val focusedHandoffSurfaceTaskNames = FocusedVerificationPaths.selectedSurfaceIds()
        .map { surfaceId -> diagnosticSurfaceCatalog.surface(surfaceId).diagnosticTaskName }
    tasks.register(FocusedHandoffTaskName) {
        group = LifecycleBasePlugin.VERIFICATION_GROUP
        description = "Run the package-focused handoff surface through Gradle-owned diagnostic surface selection."
        focusedHandoffSurfaceTaskNames.forEach(::dependsOn)
        if (focusedHandoffCompileIntegrity) {
            dependsOn("compileJava", "compileTestJava")
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

    val productionHandoffSurface = verificationLifecycleCatalog.surface(ProductionHandoffSurfaceId)
    val productionHandoffCompileIntegrity = tasks.register(ProductionHandoffCompileIntegrityTaskName) {
        group = LifecycleBasePlugin.VERIFICATION_GROUP
        description = "Run the fail-fast compile integrity phase for production handoff."
        verificationLifecycleCatalog.ownerTaskNames(VerificationLifecyclePhase.COMPILE_INTEGRITY).forEach(::dependsOn)
    }

    val productionHandoffMarkerLayout = productionHandoffMarkerLayout()
    val resetProductionHandoffPhaseMarkers = tasks.register<ResetProductionHandoffMarkersTask>(
        "resetProductionHandoffPhaseMarkers"
    ) {
        group = LifecycleBasePlugin.VERIFICATION_GROUP
        description = "Clear production handoff phase-success markers before the fail-fast phases run."
        compileIntegrityMarker.set(productionHandoffMarkerLayout.compileIntegrityMarker)
        structureMarker.set(productionHandoffMarkerLayout.structureMarker)
    }
    productionHandoffCompileIntegrity.configure {
        dependsOn(resetProductionHandoffPhaseMarkers)
    }
    val markProductionHandoffCompileIntegrity = tasks.register<WriteProductionHandoffMarkerTask>(
        "markProductionHandoffCompileIntegrity"
    ) {
        group = LifecycleBasePlugin.VERIFICATION_GROUP
        description = "Record that the production handoff compile-integrity phase completed successfully."
        dependsOn(productionHandoffCompileIntegrity)
        mustRunAfter(resetProductionHandoffPhaseMarkers)
        markerFile.set(productionHandoffMarkerLayout.compileIntegrityMarker)
    }

    val productionHandoffStructure = tasks.register(ProductionHandoffStructureTaskName) {
        group = LifecycleBasePlugin.VERIFICATION_GROUP
        description = "Run the fail-fast architecture and build-harness structure phase for production handoff."
        dependsOn(markProductionHandoffCompileIntegrity)
        verificationLifecycleCatalog.ownerTaskNames(VerificationLifecyclePhase.STRUCTURE).forEach(::dependsOn)
        if (includeBuildHarness) {
            dependsOn(gradle.includedBuild("build-harness").task(":allBuildHarnessTopologyCheck"))
            dependsOn(gradle.includedBuild("build-harness").task(":architectureCheck"))
        }
    }
    val markProductionHandoffStructure = tasks.register<WriteProductionHandoffMarkerTask>(
        "markProductionHandoffStructure"
    ) {
        group = LifecycleBasePlugin.VERIFICATION_GROUP
        description = "Record that the production handoff structure phase completed successfully."
        dependsOn(productionHandoffStructure)
        mustRunAfter(markProductionHandoffCompileIntegrity)
        markerFile.set(productionHandoffMarkerLayout.structureMarker)
    }

    val productionHandoffHygiene = tasks.register(ProductionHandoffHygieneTaskName) {
        group = LifecycleBasePlugin.VERIFICATION_GROUP
        description = "Run the aggregating hygiene, reporting, and bundle phase for production handoff."
        dependsOn(markProductionHandoffStructure)
        verificationLifecycleCatalog.ownerTaskNames(VerificationLifecyclePhase.HYGIENE).forEach(::dependsOn)
        registeredBundleTasks
            .map(RegisteredEnforcementBundleTasks::selectorTaskName)
            .forEach(::dependsOn)
    }
    val productionHandoffHygieneDependencyTaskNames =
        verificationLifecycleCatalog.ownerDependencyTaskNames(VerificationLifecyclePhase.HYGIENE) +
            registeredBundleTasks.map(RegisteredEnforcementBundleTasks::selectorTaskName) +
            registeredBundleTasks.flatMap(RegisteredEnforcementBundleTasks::leafTaskNames) +
            listOfNotNull(nearMissCompileTask?.name) +
            focusedCompileTasksByBundleId.values.map { taskProvider -> taskProvider.name }

    configureProductionHandoffHygieneBarriers(
        verificationLifecycleCatalog.ownerTaskNames(VerificationLifecyclePhase.COMPILE_INTEGRITY) +
            verificationLifecycleCatalog.ownerTaskNames(VerificationLifecyclePhase.STRUCTURE) +
            listOf(
                ProductionHandoffCompileIntegrityTaskName,
                ProductionHandoffStructureTaskName,
                markProductionHandoffCompileIntegrity.name,
                markProductionHandoffStructure.name
            ),
        productionHandoffHygieneDependencyTaskNames,
        productionHandoffRequested = productionHandoffRequested(),
        phaseCompletionMarkerPath = productionHandoffMarkerLayout.structureMarker.get().asFile.absolutePath
    )

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

private fun Project.configureProductionHandoffHygieneBarriers(
    barrierTaskNames: List<String>,
    hygieneDependencyTaskNames: List<String>,
    productionHandoffRequested: Boolean,
    phaseCompletionMarkerPath: String
) {
    val distinctBarrierTaskNames = barrierTaskNames.distinct()
    val phaseBarrier = ProductionHandoffHygienePhaseBarrier(
        productionHandoffRequested,
        phaseCompletionMarkerPath
    )
    hygieneDependencyTaskNames.distinct().forEach { taskName ->
        tasks.named(taskName).configure {
            mustRunAfter(distinctBarrierTaskNames)
            onlyIf("production handoff compile and structure phases completed successfully", phaseBarrier)
        }
    }
}

private data class ProductionHandoffHygienePhaseBarrier(
    val productionHandoffRequested: Boolean,
    val phaseCompletionMarkerPath: String
) : Spec<Task> {
    override fun isSatisfiedBy(element: Task): Boolean =
        !productionHandoffRequested || java.io.File(phaseCompletionMarkerPath).isFile
}

private fun Project.productionHandoffRequested(): Boolean {
    val requestedSurfaceNames = setOf(
        ProductionHandoffSurfaceId,
        ProductionHandoffCompileIntegrityTaskName,
        ProductionHandoffStructureTaskName,
        ProductionHandoffHygieneTaskName,
        "production-handoff",
        "check",
        "build"
    )
    return gradle.startParameter.taskNames
        .map { taskName -> taskName.substringAfterLast(':') }
        .any(requestedSurfaceNames::contains)
}

private fun Project.nearMissVerificationRequested(): Boolean {
    val requestedTaskNames = gradle.startParameter.taskNames
        .map { taskName -> taskName.substringAfterLast(':') }
        .toSet()
    val requestedSurfaceNames = setOf(
        ProductionHandoffSurfaceId,
        ProductionHandoffHygieneTaskName,
        "production-handoff",
        "check",
        "build",
        "checkRewriteNearMisses"
    )
    return requestedTaskNames.any(requestedSurfaceNames::contains)
}

private fun Project.focusedHandoffRequested(): Boolean = gradle.startParameter.taskNames
    .map { taskName -> taskName.substringAfterLast(':') }
    .any { taskName -> taskName == FocusedHandoffTaskName }

private fun Project.productionHandoffMarkerLayout(): ProductionHandoffMarkerLayout =
    ProductionHandoffMarkerLayout(
        compileIntegrityMarker = layout.buildDirectory.file("verification-markers/production-handoff/compile-integrity.marker"),
        structureMarker = layout.buildDirectory.file("verification-markers/production-handoff/structure.marker")
    )

private data class ProductionHandoffMarkerLayout(
    val compileIntegrityMarker: org.gradle.api.provider.Provider<RegularFile>,
    val structureMarker: org.gradle.api.provider.Provider<RegularFile>
)

private data class RegisteredEnforcementBundleTasks(
    val selectorTaskName: String,
    val leafTaskNames: List<String>
)

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
