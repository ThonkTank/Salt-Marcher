saltmarcher_is_nonblank() {
    [ -n "${1:-}" ]
}

saltmarcher_first_nonblank() {
    for candidate in "$@"; do
        if saltmarcher_is_nonblank "$candidate"; then
            printf '%s' "$candidate"
            return 0
        fi
    done
    return 1
}

saltmarcher_sanitized_segment() {
    raw_value=$1
    sanitized_value=$(
        printf '%s' "$raw_value" |
            LC_ALL=C tr -cs 'A-Za-z0-9._-' '-' |
            cut -c1-48 |
            sed 's/^[._-]*//; s/[._-]*$//'
    )
    [ -n "$sanitized_value" ] || sanitized_value=agent
    checksum_value=$(printf '%s' "$raw_value" | cksum | awk '{print $1}')
    printf '%s-%s' "$sanitized_value" "$checksum_value"
}

saltmarcher_copy_tree() {
    source_path=$1
    target_path=$2

    rm -rf "$target_path"
    mkdir -p "$(dirname "$target_path")"
    cp -R "$source_path" "$target_path"
    find "$target_path" \
        \( -name build -o -name .gradle -o -name .kotlin \) \
        -type d -prune -exec rm -rf {} +
}

saltmarcher_seed_wrapper_distribution() {
    seed_gradle_home=$1
    isolated_gradle_home=$2
    wrapper_properties_file=$APP_HOME/gradle/wrapper/gradle-wrapper.properties

    [ -f "$wrapper_properties_file" ] || return 0
    [ "$seed_gradle_home" != "$isolated_gradle_home" ] || return 0

    distribution_url=$(
        sed -n 's/^distributionUrl=//p' "$wrapper_properties_file" |
            sed 's#\\:#:#g'
    )
    [ -n "$distribution_url" ] || return 0

    distribution_name=$(basename "$distribution_url" .zip)
    source_wrapper_dir=$seed_gradle_home/wrapper/dists/$distribution_name
    target_wrapper_dir=$isolated_gradle_home/wrapper/dists/$distribution_name
    temp_wrapper_dir=$target_wrapper_dir.tmp.$$

    [ -d "$source_wrapper_dir" ] || return 0
    [ -d "$target_wrapper_dir" ] && return 0

    rm -rf "$temp_wrapper_dir"
    mkdir -p "$(dirname "$target_wrapper_dir")"
    cp -R "$source_wrapper_dir" "$temp_wrapper_dir"
    find "$temp_wrapper_dir" -name '*.lck' -type f -delete
    rm -rf "$target_wrapper_dir"
    mv "$temp_wrapper_dir" "$target_wrapper_dir"
}

saltmarcher_seed_read_only_dependency_cache() {
    seed_gradle_home=$1
    read_only_dependency_cache_root=$2
    source_modules_dir=$seed_gradle_home/caches/modules-2
    target_modules_dir=$read_only_dependency_cache_root/modules-2
    temp_modules_dir=$target_modules_dir.tmp.$$

    [ -d "$source_modules_dir" ] || return 0
    [ -d "$target_modules_dir" ] && return 0

    rm -rf "$temp_modules_dir"
    mkdir -p "$read_only_dependency_cache_root"
    cp -R "$source_modules_dir" "$temp_modules_dir"
    find "$temp_modules_dir" \( -name '*.lock' -o -name 'gc.properties' \) -type f -delete
    rm -rf "$target_modules_dir"
    mv "$temp_modules_dir" "$target_modules_dir"
}

saltmarcher_prepare_composite_root() {
    composite_root=$1

    mkdir -p "$composite_root/tools/gradle"
    cp "$APP_HOME/tools/gradle/build-isolation.settings.gradle.kts" \
        "$composite_root/tools/gradle/build-isolation.settings.gradle.kts"
    mkdir -p "$composite_root/tools/quality"
    cp "$APP_HOME/tools/quality/enforcement-bundles.gradle.kts" \
        "$composite_root/tools/quality/enforcement-bundles.gradle.kts"

    saltmarcher_copy_tree \
        "$APP_HOME/tools/gradle/build-logic" \
        "$composite_root/tools/gradle/build-logic"
    saltmarcher_copy_tree \
        "$APP_HOME/tools/gradle/build-harness" \
        "$composite_root/tools/gradle/build-harness"
    for bundle_dir in "$APP_HOME"/tools/quality/*-enforcement "$APP_HOME"/tools/quality/documentation-enforcement; do
        [ -d "$bundle_dir" ] || continue
        saltmarcher_copy_tree \
            "$bundle_dir" \
            "$composite_root/tools/quality/$(basename "$bundle_dir")"
    done
    saltmarcher_copy_tree \
        "$APP_HOME/tools/quality/rules/quality-rules" \
        "$composite_root/tools/quality/rules/quality-rules"
    saltmarcher_copy_tree \
        "$APP_HOME/tools/quality/incubator/quality-rules-errorprone" \
        "$composite_root/tools/quality/incubator/quality-rules-errorprone"
}

saltmarcher_actor_id=$(
    saltmarcher_first_nonblank \
        "${SALTMARCHER_GRADLE_ISOLATION_ID:-}" \
        "${CODEX_THREAD_ID:-}" \
        local
) || saltmarcher_actor_id=local
saltmarcher_invocation_timestamp=$(date +%Y%m%dT%H%M%S%N 2>/dev/null || date +%Y%m%dT%H%M%S)
saltmarcher_raw_isolation_id=$(
    saltmarcher_first_nonblank \
        "${SALTMARCHER_GRADLE_INVOCATION_ID:-}" \
        "${saltmarcher_actor_id}-${saltmarcher_invocation_timestamp}-pid$$-ppid${PPID:-0}"
) || saltmarcher_raw_isolation_id="${saltmarcher_actor_id}-${saltmarcher_invocation_timestamp}-pid$$"
saltmarcher_isolation_segment=$(saltmarcher_sanitized_segment "$saltmarcher_raw_isolation_id")
saltmarcher_seed_gradle_home=${GRADLE_USER_HOME:-$HOME/.gradle}
saltmarcher_isolated_gradle_home=$APP_HOME/.gradle/isolated-user-home/$saltmarcher_isolation_segment
saltmarcher_isolated_runtime_root=$APP_HOME/.gradle/isolated-gradle/$saltmarcher_isolation_segment
saltmarcher_isolated_build_root=$APP_HOME/build/isolated-gradle/$saltmarcher_isolation_segment
saltmarcher_composite_root=$saltmarcher_isolated_runtime_root/composite-root
saltmarcher_read_only_dependency_cache_root=$APP_HOME/.gradle/read-only-dependency-cache
saltmarcher_latest_output_root=$APP_HOME/build/latest-output
saltmarcher_retained_failures_root=$APP_HOME/build/retained-gradle-failures

mkdir -p "$saltmarcher_isolated_gradle_home" "$saltmarcher_isolated_runtime_root"
saltmarcher_seed_wrapper_distribution "$saltmarcher_seed_gradle_home" "$saltmarcher_isolated_gradle_home"
if ! saltmarcher_is_nonblank "${GRADLE_RO_DEP_CACHE:-}"; then
    saltmarcher_seed_read_only_dependency_cache \
        "$saltmarcher_seed_gradle_home" \
        "$saltmarcher_read_only_dependency_cache_root"
fi
saltmarcher_prepare_composite_root "$saltmarcher_composite_root"

export GRADLE_USER_HOME=$saltmarcher_isolated_gradle_home
export SALTMARCHER_GRADLE_INVOCATION_ID=$saltmarcher_raw_isolation_id
export SALTMARCHER_INCLUDED_BUILD_ROOT=$saltmarcher_composite_root
export SALTMARCHER_GRADLE_ISOLATION_SEGMENT=$saltmarcher_isolation_segment
export SALTMARCHER_GRADLE_ISOLATED_USER_HOME=$saltmarcher_isolated_gradle_home
export SALTMARCHER_GRADLE_ISOLATED_RUNTIME_ROOT=$saltmarcher_isolated_runtime_root
export SALTMARCHER_GRADLE_ISOLATED_BUILD_ROOT=$saltmarcher_isolated_build_root
export SALTMARCHER_GRADLE_LATEST_OUTPUT_ROOT=$saltmarcher_latest_output_root
export SALTMARCHER_GRADLE_RETAINED_FAILURES_ROOT=$saltmarcher_retained_failures_root
if ! saltmarcher_is_nonblank "${GRADLE_RO_DEP_CACHE:-}" \
    && [ -d "$saltmarcher_read_only_dependency_cache_root/modules-2" ]; then
    export GRADLE_RO_DEP_CACHE=$saltmarcher_read_only_dependency_cache_root
fi
