tasks.register("checkLayeringArchitectureEnforcement") {
    group = "verification"
    description = "Run the dedicated Layering Architecture enforcement bundle through one root entrypoint."
    dependsOn(gradle.includedBuild("build-harness").task(":layeringArchitectureTopologyCheck"))
}

tasks.matching { it.name == "checkArchitecture" }.configureEach {
    dependsOn("checkLayeringArchitectureEnforcement")
}

tasks.named("check") {
    dependsOn("checkLayeringArchitectureEnforcement")
}
