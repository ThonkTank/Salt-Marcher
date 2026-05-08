import java.io.File
import java.util.Properties
import org.gradle.api.tasks.SourceSetContainer
import org.gradle.api.tasks.compile.JavaCompile
import org.gradle.api.tasks.testing.Test
import org.gradle.jvm.tasks.Jar
import org.gradle.kotlin.dsl.named
import org.gradle.kotlin.dsl.register
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

val repoRootDir = layout.projectDirectory.dir("../../../..").asFile
val enforcementBundles = extensions.getByType(EnforcementBundlesExtension::class.java)
val activeEnforcementBundleIds = enforcementBundles.activeEnforcementBundleIds.toSet()

fun repoVerificationFiles(relativeSuffix: String): List<File> {
    val qualityDir = repoRootDir.resolve("tools/quality")
    if (!qualityDir.isDirectory) {
        return emptyList()
    }
    return qualityDir.walkTopDown()
        .filter { file ->
            val relativePath = file.relativeTo(repoRootDir).path.replace(File.separatorChar, '/')
            relativePath.endsWith(relativeSuffix)
        }
        .toList()
}

fun activeBundleOwnerDirs(): Set<String> {
    if (activeEnforcementBundleIds.isEmpty()) {
        return emptySet()
    }
    val qualityDir = repoRootDir.resolve("tools/quality")
    if (!qualityDir.isDirectory) {
        return emptySet()
    }
    return qualityDir.walkTopDown()
        .filter { file -> file.isFile && file.name == "bundle.properties" }
        .mapNotNull { descriptorFile ->
            val properties = Properties()
            descriptorFile.inputStream().use(properties::load)
            val bundleId = properties.getProperty("bundleId")?.trim().orEmpty()
            descriptorFile.parentFile.absolutePath.takeIf { bundleId in activeEnforcementBundleIds }
        }
        .toSet()
}

fun bundleIdFor(file: File): String = file.relativeTo(repoRootDir).invariantSeparatorsPath
    .substringAfter("tools/quality/")
    .substringBefore('/')

val effectiveErrorProneSourceDirs = repoVerificationFiles("/errorprone/src/main/java")
val effectiveBugCheckerServices = repoVerificationFiles("/errorprone/src/main/resources/META-INF/services/com.google.errorprone.bugpatterns.BugChecker")
val activeBundleDirs = activeBundleOwnerDirs()
val validatedBugCheckerServices = if (activeEnforcementBundleIds.isEmpty()) {
    effectiveBugCheckerServices
} else {
    effectiveBugCheckerServices.filter { serviceFile ->
        activeBundleDirs.any { ownerDir -> serviceFile.absolutePath.startsWith(ownerDir) }
    }
}
val activeErrorProneSourceDirs = if (activeEnforcementBundleIds.isEmpty()) {
    effectiveErrorProneSourceDirs
} else {
    effectiveErrorProneSourceDirs.filter { sourceDir ->
        activeBundleDirs.any { ownerDir -> sourceDir.absolutePath.startsWith(ownerDir) }
    }
}

val sourceSets = the<SourceSetContainer>()
sourceSets.named("main") {
    java.setSrcDirs(
        listOf(layout.projectDirectory.dir("src/main/java").asFile.absolutePath)
            + effectiveErrorProneSourceDirs.map(File::getAbsolutePath)
    )
    resources.setSrcDirs(emptyList<String>())
}
sourceSets.named("test") {
    java.setSrcDirs(listOf(layout.projectDirectory.dir("src/test/java").asFile.absolutePath))
    resources.setSrcDirs(emptyList<String>())
}

val bugCheckerServicePath = "META-INF/services/com.google.errorprone.bugpatterns.BugChecker"
val hostBugCheckerService = layout.projectDirectory.file("src/main/resources/$bugCheckerServicePath").asFile
val mergedBugCheckerServices = listOf(hostBugCheckerService) + effectiveBugCheckerServices
val generatedResourcesDir = layout.buildDirectory.dir("generated/quality-rules-errorprone/resources")
val generatedBugCheckerService = generatedResourcesDir.map { dir -> dir.file(bugCheckerServicePath) }
val bugCheckerRegistrySpecs = buildList {
    add("host\t${hostBugCheckerService.absolutePath}\t${layout.projectDirectory.dir("src/main/java").asFile.absolutePath}")
    validatedBugCheckerServices.forEach { serviceFile ->
        val sourceDir = serviceFile.parentFile.parentFile.parentFile.parentFile.resolve("java")
        val bundleId = bundleIdFor(serviceFile)
        add("$bundleId\t${serviceFile.absolutePath}\t${sourceDir.absolutePath}")
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
        validatedBugCheckerServices
    )
    registryInputFiles.from(hostBugCheckerService)
    activeErrorProneSourceDirs.forEach { sourceDir ->
        registryInputFiles.from(project.files(sourceDir))
    }
}

val syncQualityRulesErrorProneServices = tasks.register<MergeBugCheckerServicesTask>(
    "syncQualityRulesErrorProneServices"
) {
    serviceFiles.from(mergedBugCheckerServices)
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
    compileOnly("org.checkerframework:dataflow-nullaway:3.53.0")
    testImplementation("org.checkerframework:dataflow-nullaway:3.53.0")
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
