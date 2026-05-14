import java.io.File
import org.gradle.api.tasks.SourceSetContainer
import org.gradle.kotlin.dsl.named
import org.gradle.kotlin.dsl.register
import org.gradle.kotlin.dsl.the
import saltmarcher.buildlogic.enforcement.BuildHarnessTaskKind
import saltmarcher.buildlogic.enforcement.BuildHarnessTaskSpec
import saltmarcher.buildlogic.enforcement.EnforcementBundlesExtension
import saltmarcher.buildlogic.enforcement.EnforcementDiagnosticSurfaceSpec
import saltmarcher.buildlogic.enforcement.standardEnforcementDiagnosticSurfaceCatalog
import saltmarcher.buildlogic.tasks.RepoVerificationMainTask

plugins {
    java
    id("saltmarcher.enforcement-bundles")
}

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)
    }
}

val repoRootDir = System.getProperty("saltmarcher.repoRootDir")
    ?.let(::File)
    ?: projectDir.parentFile.parentFile.parentFile

val enforcementBundles = extensions.getByType(EnforcementBundlesExtension::class.java)
val focusedEnforcementBundleMode = enforcementBundles.focusedEnforcementBundleMode
val activeEnforcementBundleIds = enforcementBundles.activeEnforcementBundleIds
val diagnosticSurfaceCatalog = standardEnforcementDiagnosticSurfaceCatalog(enforcementBundles.catalog)

val sourceSets = the<SourceSetContainer>()

sourceSets.named("main") {
    java.setSrcDirs(listOf(layout.projectDirectory.dir("src/main/java").asFile.absolutePath))
    resources.setSrcDirs(emptyList<String>())
}
val mainSourceSet = sourceSets["main"]

fun humanizeBundleLabel(bundleId: String): String = bundleId
    .replace(Regex("([a-z0-9])([A-Z])"), "$1 $2")
    .replaceFirstChar(Char::uppercaseChar)

fun repoInputTree(includePatterns: List<String>) = fileTree(repoRootDir) {
    exclude(".git/**")
    exclude(".gradle/**")
    exclude("build/**")
    exclude("**/.gradle/**")
    exclude("**/build/**")
    includePatterns.forEach(::include)
}

fun buildHarnessInputs(kind: BuildHarnessTaskKind) = when (kind) {
    BuildHarnessTaskKind.DOCUMENTATION -> repoInputTree(
        listOf(
            "AGENTS.md",
            "docs/**",
            "src/**/DOMAIN.md",
            "tools/quality/**/*.md",
            "tools/gradle/build-logic/src/main/kotlin/saltmarcher/buildlogic/enforcement/**"
        )
    )
    BuildHarnessTaskKind.TOPOLOGY -> repoInputTree(
        listOf(
            "api/**",
            "bootstrap/**",
            "shell/**",
            "src/**",
            "tools/gradle/build-logic/src/main/kotlin/saltmarcher/buildlogic/enforcement/**"
        )
    )
}

fun documentationVerificationArgs(
    ruleClasses: List<String>,
    coverageSpecIds: List<String>
): List<String> = buildList {
    ruleClasses.forEach { ruleClass ->
        add("--rule-class")
        add(ruleClass)
    }
    coverageSpecIds.forEach { specId ->
        add("--coverage-spec")
        add(specId)
    }
}

fun buildHarnessSurfaceTaskSpec(
    surface: EnforcementDiagnosticSurfaceSpec,
    kind: BuildHarnessTaskKind
): BuildHarnessTaskSpec? {
    val activeSurfaceBundleIds = surface.bundleIds.filter(activeEnforcementBundleIds::contains)
    val taskSpecs = activeSurfaceBundleIds
        .flatMap { bundleId -> enforcementBundles.descriptor(bundleId).buildHarnessTasks }
        .filter { taskSpec -> taskSpec.kind == kind }
    if (taskSpecs.isEmpty()) {
        return null
    }

    return BuildHarnessTaskSpec(
        kind = kind,
        ruleClasses = taskSpecs.flatMap(BuildHarnessTaskSpec::ruleClasses).distinct(),
        coverageSpecIds = taskSpecs.flatMap(BuildHarnessTaskSpec::coverageSpecIds).distinct()
    )
}

fun allBuildHarnessTopologyTaskSpec(): BuildHarnessTaskSpec {
    val taskSpecs = activeEnforcementBundleIds
        .flatMap { bundleId -> enforcementBundles.descriptor(bundleId).buildHarnessTasks }
        .filter { taskSpec -> taskSpec.kind == BuildHarnessTaskKind.TOPOLOGY }
    return BuildHarnessTaskSpec(
        kind = BuildHarnessTaskKind.TOPOLOGY,
        ruleClasses = taskSpecs.flatMap(BuildHarnessTaskSpec::ruleClasses).distinct()
    )
}

fun registerBuildHarnessTask(
    taskName: String,
    bundleLabel: String,
    taskSpec: BuildHarnessTaskSpec
) {
    val isDocumentationTask = taskSpec.kind == BuildHarnessTaskKind.DOCUMENTATION
    val description = when {
        isDocumentationTask -> "Run only the $bundleLabel enforcement documentation-coverage rules."
        taskSpec.kind == BuildHarnessTaskKind.TOPOLOGY -> "Run only the $bundleLabel build-harness topology rules."
        else -> "Run only the focused $bundleLabel build-harness rules."
    }

    tasks.register<RepoVerificationMainTask>(taskName) {
        group = LifecycleBasePlugin.VERIFICATION_GROUP
        this.description = description
        dependsOn(tasks.named(mainSourceSet.classesTaskName))
        runtimeClasspath.from(mainSourceSet.output)
        runtimeClasspath.from(mainSourceSet.runtimeClasspath)
        verificationMainClass.set(
            when {
                isDocumentationTask -> "saltmarcher.architecture.documentation.DocumentationCheckMain"
                else -> "saltmarcher.architecture.ArchitectureCheckMain"
            }
        )
        repoRootPath.set(repoRootDir.absolutePath)
        when {
            isDocumentationTask -> verificationArgs.set(documentationVerificationArgs(taskSpec.ruleClasses, taskSpec.coverageSpecIds))
            taskSpec.kind == BuildHarnessTaskKind.TOPOLOGY -> verificationArgs.set(listOf("--only-rules") + taskSpec.ruleClasses)
        }
        verificationInputs.from(buildHarnessInputs(taskSpec.kind))
        successMarker.set(layout.buildDirectory.file("verification-markers/$taskName/success.marker"))
    }
}

registerBuildHarnessTask(
    "allBuildHarnessTopologyCheck",
    "all active surfaces",
    allBuildHarnessTopologyTaskSpec()
)

diagnosticSurfaceCatalog.surfacesInOrder.forEach { surface ->
    listOf(BuildHarnessTaskKind.TOPOLOGY, BuildHarnessTaskKind.DOCUMENTATION)
        .mapNotNull { kind -> buildHarnessSurfaceTaskSpec(surface, kind) }
        .forEach { taskSpec ->
            registerBuildHarnessTask(
                surface.buildHarnessTaskName(taskSpec.kind),
                "${humanizeBundleLabel(surface.surfaceId)} surface",
                taskSpec
            )
        }
}

if (!focusedEnforcementBundleMode) {
    val documentationRootRuleClasses = listOf(
        "saltmarcher.architecture.documentation.DocumentationHygieneRules",
        "saltmarcher.architecture.documentation.domain.DomainDocumentationRules"
    )
    registerBuildHarnessTask(
        "documentationEnforcementCheck",
        "documentation",
        BuildHarnessTaskSpec(
            kind = BuildHarnessTaskKind.DOCUMENTATION,
            ruleClasses = documentationRootRuleClasses
        )
    )
}

tasks.register<RepoVerificationMainTask>("architectureCheck") {
    group = LifecycleBasePlugin.VERIFICATION_GROUP
    description = "Checks root and residual architecture rules not owned by focused enforcement surfaces."
    dependsOn(tasks.named(mainSourceSet.classesTaskName))
    runtimeClasspath.from(mainSourceSet.output)
    runtimeClasspath.from(mainSourceSet.runtimeClasspath)
    verificationMainClass.set("saltmarcher.architecture.ArchitectureCheckMain")
    repoRootPath.set(repoRootDir.absolutePath)
    verificationInputs.from(
        repoInputTree(
            listOf(
                ".github/workflows/quality-platforms.yml",
                "AGENTS.md",
                "bootstrap/**",
                "docs/project/architecture/verification-core.md",
                "docs/project/verification/**",
                "shell/**",
                "src/**",
                "tools/gradle/**",
                "tools/gradle/build-harness/src/**"
            )
        )
    )
    successMarker.set(layout.buildDirectory.file("verification-markers/architectureCheck/success.marker"))
}

tasks.named("check") {
    dependsOn("architectureCheck")
}
