import java.io.File
import org.gradle.api.tasks.SourceSetContainer
import org.gradle.api.tasks.compile.JavaCompile
import org.gradle.language.jvm.tasks.ProcessResources
import org.gradle.jvm.tasks.Jar
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

val sourceSets = the<SourceSetContainer>()
sourceSets.named("main") {
    java.setSrcDirs(
        listOf(layout.projectDirectory.dir("src/main/java").asFile.absolutePath) +
            activeEnforcementBundleIds.mapNotNull { bundleId -> enforcementBundles.descriptor(bundleId).buildHarnessSourceDir } +
            listOfNotNull(
                repoRootDir.resolve("tools/quality/documentation-enforcement/build-harness/src/main/java")
                    .takeIf { !focusedEnforcementBundleMode }
                    ?.absolutePath
            )
    )
    resources.setSrcDirs(emptyList<String>())
}

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
            "tools/quality/**/bundle.properties"
        )
    )
    else -> repoInputTree(
        listOf(
            "api/**",
            "bootstrap/**",
            "shell/**",
            "src/**",
            "tools/quality/**/bundle.properties"
        )
    )
}

fun activeBuildHarnessArchitectureRuleClasses() = activeEnforcementBundleIds
    .flatMap { bundleId -> enforcementBundles.descriptor(bundleId).buildHarnessArchitectureRuleClasses }
    .distinct()

fun activeBuildHarnessDocumentationRuleClasses() = activeEnforcementBundleIds
    .flatMap { bundleId -> enforcementBundles.descriptor(bundleId).buildHarnessDocumentationRuleClasses }
    .distinct()

fun registerBuildHarnessTask(taskName: String, bundleLabel: String, mainClassName: String) {
    val isDocumentationTask = taskName.endsWith("DocumentationEnforcementCheck")
    val description = when {
        isDocumentationTask -> "Run only the $bundleLabel enforcement documentation-coverage rules."
        taskName.endsWith("TopologyCheck") -> "Run only the $bundleLabel build-harness topology rules."
        else -> "Run only the focused $bundleLabel build-harness rules."
    }

    tasks.register<RepoVerificationMainTask>(taskName) {
        group = LifecycleBasePlugin.VERIFICATION_GROUP
        this.description = description
        runtimeClasspath.from(sourceSets["main"].runtimeClasspath)
        verificationMainClass.set(mainClassName)
        repoRootPath.set(repoRootDir.absolutePath)
        verificationInputs.from(buildHarnessInputs(taskName))
        successMarker.set(layout.buildDirectory.file("verification-markers/$taskName/success.marker"))
    }
}

activeEnforcementBundleIds.forEach { bundleId ->
    val bundleLabel = humanizeBundleLabel(bundleId)
    enforcementBundles.descriptor(bundleId).buildHarnessTaskMainClasses.forEach { (taskName, mainClassName) ->
        registerBuildHarnessTask(taskName, bundleLabel, mainClassName)
    }
}

if (!focusedEnforcementBundleMode) {
    registerBuildHarnessTask(
        "documentationEnforcementCheck",
        "documentation",
        "saltmarcher.architecture.documentation.DocumentationEnforcementCheckMain"
    )
}

tasks.register<RepoVerificationMainTask>("architectureCheck") {
    group = LifecycleBasePlugin.VERIFICATION_GROUP
    description = "Checks repository layout, package-path alignment, and documented root-entrypoint presence."
    runtimeClasspath.from(sourceSets["main"].runtimeClasspath)
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

if (!focusedEnforcementBundleMode) {
    tasks.named<RepoVerificationMainTask>("documentationEnforcementCheck") {
        verificationArgs.set(activeBuildHarnessDocumentationRuleClasses())
    }
}

// This included build derives active verification sources from propagated
// bundle selection, so cached outputs can restore an incomplete harness.
tasks.named<JavaCompile>("compileJava") {
    outputs.cacheIf("build-harness compile output must track dynamic bundle selection live") { false }
}

tasks.named<ProcessResources>("processResources") {
    outputs.cacheIf("build-harness resources must track dynamic bundle selection live") { false }
}

tasks.named<Jar>("jar") {
    outputs.cacheIf("build-harness jar must track dynamic bundle selection live") { false }
}

tasks.named("check") {
    dependsOn("architectureCheck")
}
