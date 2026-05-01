import org.gradle.api.tasks.SourceSetContainer
import org.gradle.api.tasks.compile.JavaCompile
import org.gradle.api.tasks.testing.Test
import org.gradle.kotlin.dsl.named
import org.gradle.kotlin.dsl.registering
import org.gradle.kotlin.dsl.the

val sourceSets = the<SourceSetContainer>()
sourceSets.named("test") {
    java.srcDir("tools/quality/shell-layer-enforcement/archunit/src/test/java")
}

val mainJavaClassesDir = tasks.named<JavaCompile>("compileJava").flatMap { task -> task.destinationDirectory }

val shellLayerArchitectureTest by tasks.registering(Test::class) {
    group = "verification"
    description = "Run only the Shell Layer-focused architecture test suite."
    dependsOn(tasks.named("compileJava"))
    inputs.dir(mainJavaClassesDir)
    testClassesDirs = sourceSets["test"].output.classesDirs
    classpath = sourceSets["test"].runtimeClasspath
    useJUnitPlatform()
    filter {
        includeTestsMatching("architecture.shell.layer.ShellLayerArchitectureTest")
    }
    doFirst {
        systemProperty("saltmarcher.mainClassesDir", mainJavaClassesDir.get().asFile.absolutePath)
    }
}

tasks.register("checkShellLayerEnforcement") {
    group = "verification"
    description = "Run the dedicated Shell Layer enforcement bundle through one root entrypoint."
    dependsOn(shellLayerArchitectureTest)
    dependsOn(gradle.includedBuild("build-harness").task(":shellLayerTopologyCheck"))
}

tasks.matching { it.name == "checkArchitecture" }.configureEach {
    dependsOn("checkShellLayerEnforcement")
}

tasks.named("check") {
    dependsOn("checkShellLayerEnforcement")
}
