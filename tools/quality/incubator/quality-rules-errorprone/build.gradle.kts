import java.io.File
import java.util.Properties
import org.gradle.api.tasks.SourceSetContainer
import org.gradle.api.tasks.testing.Test
import org.gradle.jvm.tasks.Jar
import org.gradle.kotlin.dsl.register
import org.gradle.kotlin.dsl.named
import org.gradle.kotlin.dsl.the
import saltmarcher.buildlogic.enforcement.EnforcementBundlesExtension
import saltmarcher.buildlogic.tasks.MergeBugCheckerServicesTask
import saltmarcher.buildlogic.tasks.ValidateBugCheckerRegistriesTask

plugins {
    `java-library`
    id("saltmarcher.enforcement-bundles")
}

group = "saltmarcher.quality"
version = "1.0-SNAPSHOT"

repositories {
    mavenCentral()
}

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)
    }
}

val enforcementBundles = extensions.getByType(EnforcementBundlesExtension::class.java)
val focusedEnforcementBundleMode = enforcementBundles.focusedEnforcementBundleMode
val activeEnforcementBundleIds = enforcementBundles.activeEnforcementBundleIds
val repoRootDir = layout.projectDirectory.dir("../../../..").asFile

data class StandaloneBundleDescriptor(
    val bundleId: String,
    val errorProneSourceDir: String?,
    val errorProneServiceFile: String?
)

fun resolveStandaloneDescriptorPath(descriptorFile: File, rawPath: String): String {
    val file = File(rawPath)
    return if (file.isAbsolute) {
        file.absolutePath
    } else {
        File(descriptorFile.parentFile, rawPath).canonicalFile.absolutePath
    }
}

fun loadStandaloneBundleDescriptors(): List<StandaloneBundleDescriptor> {
    val qualityDir = File(repoRootDir, "tools/quality")
    if (!qualityDir.isDirectory) {
        return emptyList()
    }
    return qualityDir.walkTopDown()
        .filter { file -> file.isFile && file.name == "bundle.properties" }
        .mapNotNull { descriptorFile ->
            val properties = Properties()
            descriptorFile.inputStream().use { stream ->
                properties.load(stream)
            }
            if (!properties.getProperty("descriptorOwned", "false").trim().toBoolean()) {
                null
            } else {
                StandaloneBundleDescriptor(
                    bundleId = properties.getProperty("bundleId").trim(),
                    errorProneSourceDir = properties.getProperty("errorProneSourceDir")
                        ?.trim()
                        ?.takeIf(String::isNotEmpty)
                        ?.let { rawPath -> resolveStandaloneDescriptorPath(descriptorFile, rawPath) },
                    errorProneServiceFile = properties.getProperty("errorProneServiceFile")
                        ?.trim()
                        ?.takeIf(String::isNotEmpty)
                        ?.let { rawPath -> resolveStandaloneDescriptorPath(descriptorFile, rawPath) }
                )
            }
        }
        .toList()
}

val standaloneBundleDescriptors = loadStandaloneBundleDescriptors()
val effectiveBundleDescriptors = if (activeEnforcementBundleIds.isEmpty()) {
    standaloneBundleDescriptors
} else {
    val focusedDescriptors = activeEnforcementBundleIds.map { bundleId ->
        enforcementBundles.descriptor(bundleId).let { descriptor ->
            StandaloneBundleDescriptor(
                bundleId = descriptor.bundleId,
                errorProneSourceDir = descriptor.errorProneSourceDir,
                errorProneServiceFile = descriptor.errorProneServiceFile
            )
        }
    }
    focusedDescriptors
        .filter { descriptor ->
            descriptor.errorProneSourceDir != null && descriptor.errorProneServiceFile != null
        }
        .ifEmpty {
            // Focused bundles such as jQAssistant-only layering checks still compile with the shared
            // Error Prone plugin on the classpath, so fall back to the full checker registry instead of
            // producing a focus-sensitive partial plugin jar with stale or missing service entries.
            standaloneBundleDescriptors
        }
}
val effectiveErrorProneSourceDirs = effectiveBundleDescriptors.mapNotNull(StandaloneBundleDescriptor::errorProneSourceDir)
val effectiveBugCheckerServices = effectiveBundleDescriptors.mapNotNull(StandaloneBundleDescriptor::errorProneServiceFile).map(::File)

val sourceSets = the<SourceSetContainer>()
sourceSets.named("main") {
    java.setSrcDirs(
        listOf(layout.projectDirectory.dir("src/main/java").asFile.absolutePath)
            + effectiveErrorProneSourceDirs
    )
    resources.setSrcDirs(emptyList<String>())
}
sourceSets.named("test") {
    java.setSrcDirs(
        listOf(layout.projectDirectory.dir("src/test/java").asFile.absolutePath)
            + listOf(
                File(repoRootDir, "tools/quality/view-view-enforcement/errorprone/src/main/java").absolutePath,
                File(repoRootDir, "tools/quality/viewinputevent-enforcement/errorprone/src/main/java").absolutePath
            )
    )
    resources.setSrcDirs(emptyList<String>())
}

val bugCheckerServicePath = "META-INF/services/com.google.errorprone.bugpatterns.BugChecker"
val hostBugCheckerService = layout.projectDirectory.file("src/main/resources/$bugCheckerServicePath").asFile
val bundleBugCheckerServices = effectiveBugCheckerServices
val activeBugCheckerServices = if (focusedEnforcementBundleMode) {
    bundleBugCheckerServices
} else {
    listOf(hostBugCheckerService) + bundleBugCheckerServices
}
val generatedResourcesDir = layout.buildDirectory.dir("generated/quality-rules-errorprone/resources")
val generatedBugCheckerService = generatedResourcesDir.map { dir -> dir.file(bugCheckerServicePath) }
val bugCheckerRegistrySpecs = buildList {
    if (!focusedEnforcementBundleMode) {
        add("host\t${hostBugCheckerService.absolutePath}\t${layout.projectDirectory.dir("src/main/java").asFile.absolutePath}")
    }
    effectiveBundleDescriptors.forEach { descriptor ->
        val serviceFile = descriptor.errorProneServiceFile ?: return@forEach
        val sourceDir = descriptor.errorProneSourceDir ?: return@forEach
        add("${descriptor.bundleId}\t${File(serviceFile).absolutePath}\t${File(sourceDir).absolutePath}")
    }
}

val validateQualityRulesErrorProneServices = tasks.register<ValidateBugCheckerRegistriesTask>(
    "validateQualityRulesErrorProneServices"
) {
    registrySpecs.set(bugCheckerRegistrySpecs)
    successMarker.set(
        layout.buildDirectory.file(
            "verification-markers/validateQualityRulesErrorProneServices/success.marker"
        )
    )
    registryInputFiles.from(
        layout.projectDirectory.dir("src/main/java"),
        bundleBugCheckerServices
    )
    if (!focusedEnforcementBundleMode) {
        registryInputFiles.from(hostBugCheckerService)
    }
    effectiveErrorProneSourceDirs.forEach { sourceDir ->
        registryInputFiles.from(project.files(sourceDir))
    }
}

val syncQualityRulesErrorProneServices = tasks.register<MergeBugCheckerServicesTask>(
    "syncQualityRulesErrorProneServices"
) {
    serviceFiles.from(activeBugCheckerServices)
    mergedServiceFile.set(generatedBugCheckerService)
}

tasks.named("check") {
    dependsOn(validateQualityRulesErrorProneServices)
}

tasks.named<Jar>("jar") {
    dependsOn(validateQualityRulesErrorProneServices)
    dependsOn(syncQualityRulesErrorProneServices)
    from(generatedResourcesDir)
    isPreserveFileTimestamps = false
    isReproducibleFileOrder = true
    outputs.cacheIf("quality-rules-errorprone jar is a hot-path compile dependency") { true }
}

dependencies {
    compileOnly("com.google.errorprone:error_prone_check_api:2.48.0")
    testImplementation("com.google.errorprone:error_prone_test_helpers:2.48.0")
    testImplementation("junit:junit:4.13.2")
}

tasks.withType<JavaCompile>().configureEach {
    val javacExports = listOf(
        "--add-exports=jdk.compiler/com.sun.tools.javac.api=ALL-UNNAMED",
        "--add-exports=jdk.compiler/com.sun.tools.javac.code=ALL-UNNAMED",
        "--add-exports=jdk.compiler/com.sun.tools.javac.comp=ALL-UNNAMED",
        "--add-exports=jdk.compiler/com.sun.tools.javac.file=ALL-UNNAMED",
        "--add-exports=jdk.compiler/com.sun.tools.javac.main=ALL-UNNAMED",
        "--add-exports=jdk.compiler/com.sun.tools.javac.model=ALL-UNNAMED",
        "--add-exports=jdk.compiler/com.sun.tools.javac.parser=ALL-UNNAMED",
        "--add-exports=jdk.compiler/com.sun.tools.javac.processing=ALL-UNNAMED",
        "--add-exports=jdk.compiler/com.sun.tools.javac.tree=ALL-UNNAMED",
        "--add-exports=jdk.compiler/com.sun.tools.javac.util=ALL-UNNAMED"
    )
    options.compilerArgs.addAll(javacExports)
}

tasks.withType<Test>().configureEach {
    jvmArgs(
        "--add-exports=jdk.compiler/com.sun.tools.javac.api=ALL-UNNAMED",
        "--add-exports=jdk.compiler/com.sun.tools.javac.code=ALL-UNNAMED",
        "--add-exports=jdk.compiler/com.sun.tools.javac.comp=ALL-UNNAMED",
        "--add-exports=jdk.compiler/com.sun.tools.javac.file=ALL-UNNAMED",
        "--add-exports=jdk.compiler/com.sun.tools.javac.main=ALL-UNNAMED",
        "--add-exports=jdk.compiler/com.sun.tools.javac.model=ALL-UNNAMED",
        "--add-exports=jdk.compiler/com.sun.tools.javac.parser=ALL-UNNAMED",
        "--add-exports=jdk.compiler/com.sun.tools.javac.processing=ALL-UNNAMED",
        "--add-exports=jdk.compiler/com.sun.tools.javac.tree=ALL-UNNAMED",
        "--add-exports=jdk.compiler/com.sun.tools.javac.util=ALL-UNNAMED"
    )
}
