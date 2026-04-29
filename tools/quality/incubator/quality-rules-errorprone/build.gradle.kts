import java.util.LinkedHashSet
import org.gradle.api.tasks.SourceSetContainer
import org.gradle.language.jvm.tasks.ProcessResources
import org.gradle.kotlin.dsl.named
import org.gradle.kotlin.dsl.the

plugins {
    `java-library`
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

apply(from = "../../view-view-enforcement/errorprone-host.gradle.kts")
apply(from = "../../view-binder-enforcement/errorprone-host.gradle.kts")
apply(from = "../../viewinputevent-enforcement/errorprone-host.gradle.kts")
apply(from = "../../view-contribution-enforcement/errorprone-host.gradle.kts")
apply(from = "../../publishedevent-enforcement/errorprone-host.gradle.kts")
apply(from = "../../view-inspector-entry-enforcement/errorprone-host.gradle.kts")
apply(from = "../../viewintenthandler-enforcement/errorprone-host.gradle.kts")
apply(from = "../../view-contributionmodel-enforcement/errorprone-host.gradle.kts")
apply(from = "../../view-content-model-enforcement/errorprone-host.gradle.kts")

val sourceSets = the<SourceSetContainer>()
sourceSets.named("main") {
    java.setSrcDirs(listOf(
        "src/main/java",
        "../../view-view-enforcement/errorprone/src/main/java",
        "../../viewinputevent-enforcement/errorprone/src/main/java",
        "../../view-contribution-enforcement/errorprone/src/main/java",
        "../../view-binder-enforcement/errorprone/src/main/java",
        "../../publishedevent-enforcement/errorprone/src/main/java",
        "../../view-inspector-entry-enforcement/errorprone/src/main/java",
        "../../viewintenthandler-enforcement/errorprone/src/main/java",
        "../../view-contributionmodel-enforcement/errorprone/src/main/java",
        "../../view-content-model-enforcement/errorprone/src/main/java"
    ))
    resources.setSrcDirs(emptyList<String>())
}

val bugCheckerServicePath = "META-INF/services/com.google.errorprone.bugpatterns.BugChecker"
val hostBugCheckerService = layout.projectDirectory.file("src/main/resources/$bugCheckerServicePath")
val bundleBugCheckerServices = listOf(
    layout.projectDirectory.file("../../view-view-enforcement/errorprone/src/main/resources/$bugCheckerServicePath"),
    layout.projectDirectory.file("../../view-binder-enforcement/errorprone/src/main/resources/$bugCheckerServicePath"),
    layout.projectDirectory.file("../../viewinputevent-enforcement/errorprone/src/main/resources/$bugCheckerServicePath"),
    layout.projectDirectory.file("../../view-contribution-enforcement/errorprone/src/main/resources/$bugCheckerServicePath"),
    layout.projectDirectory.file("../../publishedevent-enforcement/errorprone/src/main/resources/$bugCheckerServicePath"),
    layout.projectDirectory.file("../../view-inspector-entry-enforcement/errorprone/src/main/resources/$bugCheckerServicePath"),
    layout.projectDirectory.file("../../viewintenthandler-enforcement/errorprone/src/main/resources/$bugCheckerServicePath"),
    layout.projectDirectory.file("../../view-contributionmodel-enforcement/errorprone/src/main/resources/$bugCheckerServicePath"),
    layout.projectDirectory.file("../../view-content-model-enforcement/errorprone/src/main/resources/$bugCheckerServicePath")
)
val generatedResourcesDir = layout.buildDirectory.dir("generated/quality-rules-errorprone/resources")
val generatedBugCheckerService = generatedResourcesDir.map { dir -> dir.file(bugCheckerServicePath) }

val syncQualityRulesErrorProneServices = tasks.register("syncQualityRulesErrorProneServices") {
    inputs.files(listOf(hostBugCheckerService) + bundleBugCheckerServices)
    outputs.file(generatedBugCheckerService)
    doLast {
        val mergedLines = LinkedHashSet<String>()
        listOf(hostBugCheckerService)
            .plus(bundleBugCheckerServices)
            .forEach { serviceFile ->
                serviceFile.asFile.readLines()
                    .map(String::trim)
                    .filter(String::isNotEmpty)
                    .forEach(mergedLines::add)
            }

        val target = generatedBugCheckerService.get().asFile
        target.parentFile.mkdirs()
        target.writeText(mergedLines.joinToString(System.lineSeparator()) + System.lineSeparator())
    }
}

tasks.named<ProcessResources>("processResources") {
    dependsOn(syncQualityRulesErrorProneServices)
    from(generatedResourcesDir)
}

dependencies {
    compileOnly("com.google.errorprone:error_prone_check_api:2.48.0")
}

tasks.withType<JavaCompile>().configureEach {
    options.compilerArgs.addAll(listOf(
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
    ))
}
