import org.gradle.api.tasks.SourceSetContainer
import org.gradle.api.tasks.compile.JavaCompile
import org.gradle.api.tasks.testing.Test
import org.gradle.kotlin.dsl.named
import org.gradle.kotlin.dsl.registering
import org.gradle.kotlin.dsl.the

val sourceSets = the<SourceSetContainer>()
sourceSets.named("test") {
    java.srcDir("tools/quality/bootstrap-layer-enforcement/archunit/src/test/java")
}

val mainJavaClassesDir = tasks.named<JavaCompile>("compileJava").flatMap { task -> task.destinationDirectory }

val bootstrapLayerArchitectureTest by tasks.registering(Test::class) {
    group = "verification"
    description = "Run only the Bootstrap Layer-focused architecture test suite."
    dependsOn(tasks.named("compileJava"))
    inputs.dir(mainJavaClassesDir)
    testClassesDirs = sourceSets["test"].output.classesDirs
    classpath = sourceSets["test"].runtimeClasspath
    useJUnitPlatform()
    filter {
        includeTestsMatching("architecture.bootstrap.layer.BootstrapLayerArchitectureTest")
    }
    doFirst {
        systemProperty("saltmarcher.mainClassesDir", mainJavaClassesDir.get().asFile.absolutePath)
    }
}

tasks.register("checkBootstrapLayerEnforcement") {
    group = "verification"
    description = "Run the dedicated Bootstrap Layer enforcement bundle through one root entrypoint."
    dependsOn("compileJava")
    dependsOn(bootstrapLayerArchitectureTest)
    dependsOn(gradle.includedBuild("build-harness").task(":bootstrapLayerTopologyCheck"))
}

tasks.matching { it.name == "checkArchitecture" }.configureEach {
    dependsOn("checkBootstrapLayerEnforcement")
}

tasks.named("check") {
    dependsOn("checkBootstrapLayerEnforcement")
}
