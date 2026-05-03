import org.gradle.api.plugins.ExtensionAware
import org.gradle.api.tasks.SourceSetContainer
import org.gradle.api.tasks.compile.JavaCompile
import org.gradle.api.tasks.testing.Test
import org.gradle.kotlin.dsl.creating
import org.gradle.kotlin.dsl.get
import org.gradle.kotlin.dsl.named
import org.gradle.kotlin.dsl.registering
import org.gradle.kotlin.dsl.the
import org.gradle.kotlin.dsl.withGroovyBuilder

val sourceSets = the<SourceSetContainer>()
val testSourceSet = sourceSets["test"]
val viewInputEventEnforcementArchunit by sourceSets.creating {
    java.srcDir("tools/quality/viewinputevent-enforcement/archunit/src/test/java")
    compileClasspath += testSourceSet.output + testSourceSet.compileClasspath
    runtimeClasspath += output + compileClasspath + testSourceSet.output + testSourceSet.runtimeClasspath
}

val mainJavaClassesDir = tasks.named<JavaCompile>("compileJava").flatMap { task -> task.destinationDirectory }

tasks.named<JavaCompile>("compileJava") {
    val errorproneOptions = (options as ExtensionAware).extensions.getByName("errorprone")
    errorproneOptions.withGroovyBuilder {
        listOf(
            "ViewInputEventBoundary"
        ).forEach { checkName ->
            "error"(checkName)
        }
    }
}

val viewInputEventArchitectureTest by tasks.registering(Test::class) {
    group = "verification"
    description = "Run only the ViewInputEvent-focused architecture test suite."
    dependsOn(tasks.named("compileJava"))
    inputs.dir(mainJavaClassesDir)
    testClassesDirs = viewInputEventEnforcementArchunit.output.classesDirs
    classpath = viewInputEventEnforcementArchunit.runtimeClasspath
    useJUnitPlatform()
    doFirst {
        systemProperty("saltmarcher.mainClassesDir", mainJavaClassesDir.get().asFile.absolutePath)
    }
}

tasks.register("checkViewInputEventEnforcement") {
    group = "verification"
    description = "Run all currently active ViewInputEvent enforcement checks through one root entrypoint."
    dependsOn("compileJava")
    dependsOn(viewInputEventArchitectureTest)
    dependsOn(gradle.includedBuild("build-harness").task(":viewInputEventTopologyCheck"))
}

tasks.matching { it.name == "checkArchitecture" }.configureEach {
    dependsOn("checkViewInputEventEnforcement")
}

tasks.named("check") {
    dependsOn("checkViewInputEventEnforcement")
}
