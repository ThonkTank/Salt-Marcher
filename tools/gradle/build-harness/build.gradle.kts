import java.io.File
import org.gradle.api.tasks.SourceSetContainer
import org.gradle.kotlin.dsl.named
import org.gradle.kotlin.dsl.register
import org.gradle.kotlin.dsl.the
import saltmarcher.buildlogic.enforcement.EnforcementBundlesExtension
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
val allEnforcementBundleIds = enforcementBundles.catalog.bundleIdsInOrder

val sourceSets = the<SourceSetContainer>()

fun camelToKebab(value: String): String = value
    .replace(Regex("([a-z0-9])([A-Z])"), "$1-$2")
    .lowercase()

fun bundleBuildHarnessJavaDir(bundleId: String): String =
    repoRootDir.resolve("tools/quality/${camelToKebab(bundleId)}-enforcement/build-harness/src/main/java").absolutePath

sourceSets.named("main") {
    java.setSrcDirs(
        listOf(layout.projectDirectory.dir("src/main/java").asFile.absolutePath) +
            repoRootDir.resolve("tools/quality/documentation-enforcement/build-harness/src/main/java").absolutePath +
            allEnforcementBundleIds.map(::bundleBuildHarnessJavaDir)
    )
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

fun buildHarnessInputs(taskName: String) = when {
    taskName.endsWith("DocumentationEnforcementCheck") -> repoInputTree(
        listOf(
            "AGENTS.md",
            "docs/**",
            "src/**/DOMAIN.md",
            "tools/quality/**/*.md",
            "tools/gradle/build-logic/src/main/kotlin/saltmarcher/buildlogic/enforcement/**"
        )
    )
    else -> repoInputTree(
        listOf(
            "api/**",
            "bootstrap/**",
            "shell/**",
            "src/**",
            "tools/gradle/build-logic/src/main/kotlin/saltmarcher/buildlogic/enforcement/**"
        )
    )
}

fun activeBuildHarnessArchitectureRuleClasses() = activeEnforcementBundleIds
    .flatMap { bundleId -> enforcementBundles.descriptor(bundleId).buildHarnessArchitectureRuleClasses }
    .distinct()

fun activeBuildHarnessDocumentationRuleClasses() = activeEnforcementBundleIds
    .flatMap { bundleId -> enforcementBundles.descriptor(bundleId).buildHarnessDocumentationRuleClasses }
    .distinct()

fun activeBuildHarnessDocumentationCoverageSpecIds() = activeEnforcementBundleIds
    .flatMap { bundleId -> enforcementBundles.descriptor(bundleId).buildHarnessDocumentationCoverageSpecIds }
    .distinct()

fun descriptorBuildHarnessRuleClasses(bundleId: String, taskName: String): List<String> =
    enforcementBundles.descriptor(bundleId).buildHarnessTaskRuleClasses(taskName)

fun descriptorBuildHarnessDocumentationCoverageSpecIds(bundleId: String, taskName: String): List<String> =
    enforcementBundles.descriptor(bundleId).buildHarnessTaskDocumentationCoverageSpecIds(taskName)

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

fun registerBuildHarnessTask(
    taskName: String,
    bundleLabel: String,
    mainClassName: String?,
    ruleClasses: List<String>,
    documentationCoverageSpecIds: List<String>
) {
    val isDocumentationTask = taskName.endsWith("DocumentationEnforcementCheck")
    val description = when {
        isDocumentationTask -> "Run only the $bundleLabel enforcement documentation-coverage rules."
        taskName.endsWith("TopologyCheck") -> "Run only the $bundleLabel build-harness topology rules."
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
                else -> mainClassName ?: "saltmarcher.architecture.ArchitectureCheckMain"
            }
        )
        repoRootPath.set(repoRootDir.absolutePath)
        when {
            isDocumentationTask -> verificationArgs.set(documentationVerificationArgs(ruleClasses, documentationCoverageSpecIds))
            ruleClasses.isNotEmpty() -> verificationArgs.set(listOf("--only-rules") + ruleClasses)
        }
        verificationInputs.from(buildHarnessInputs(taskName))
        successMarker.set(layout.buildDirectory.file("verification-markers/$taskName/success.marker"))
    }
}

activeEnforcementBundleIds.forEach { bundleId ->
    val bundleLabel = humanizeBundleLabel(bundleId)
    val descriptor = enforcementBundles.descriptor(bundleId)
    descriptor.buildHarnessTaskNames()
        .forEach { taskName ->
            registerBuildHarnessTask(
                taskName,
                bundleLabel,
                null,
                descriptorBuildHarnessRuleClasses(bundleId, taskName),
                descriptorBuildHarnessDocumentationCoverageSpecIds(bundleId, taskName)
            )
        }
}

if (!focusedEnforcementBundleMode) {
    val documentationRootRuleClasses = listOf(
        "saltmarcher.architecture.documentation.domain.DomainDocumentationRules"
    )
    registerBuildHarnessTask(
        "documentationEnforcementCheck",
        "documentation",
        null,
        documentationRootRuleClasses + activeBuildHarnessDocumentationRuleClasses(),
        activeBuildHarnessDocumentationCoverageSpecIds()
    )
}

tasks.register<RepoVerificationMainTask>("architectureCheck") {
    group = LifecycleBasePlugin.VERIFICATION_GROUP
    description = "Checks repository layout, package-path alignment, and documented root-entrypoint presence."
    dependsOn(tasks.named(mainSourceSet.classesTaskName))
    runtimeClasspath.from(mainSourceSet.output)
    runtimeClasspath.from(mainSourceSet.runtimeClasspath)
    verificationMainClass.set("saltmarcher.architecture.ArchitectureCheckMain")
    repoRootPath.set(repoRootDir.absolutePath)
    verificationArgs.set(activeBuildHarnessArchitectureRuleClasses())
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
