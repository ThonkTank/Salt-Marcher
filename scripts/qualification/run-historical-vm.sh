#!/usr/bin/env bash
# Usage: bash run-historical-vm.sh TOOL_IMAGE BASE_QCOW2 SEED_IMAGE NEW_OUTPUT_DIR SECONDS
set -euo pipefail
[[ $# == 5 || $# == 6 ]] || { echo 'Expected tool image, base disk, seed, new output directory, deadline, optional bootstrap-network' >&2; exit 2; }
network=none
if [[ $# == 6 ]]; then
  [[ $6 == bootstrap-network ]] || exit 2
  network=user,model=virtio-net-pci
fi
tool_image=$1
base_disk=$(realpath -e -- "$2")
seed_disk=$(realpath -e -- "$3")
output_dir=$(realpath -m -- "$4")
deadline=$5
[[ $deadline =~ ^[0-9]+$ ]] && ((deadline >= 5 && deadline <= 3600)) || exit 2
[[ -f $base_disk && -f $seed_disk && ! -e $output_dir ]] || exit 2
[[ $output_dir != *:* && $base_disk != *:* && $seed_disk != *:* ]] || exit 2
# The writable guest can grow to 24 GiB. Keep another 16 GiB for the host.
# Check before creating output or starting any container.
space_parent=$(dirname -- "$output_dir")
while [[ ! -d $space_parent ]]; do space_parent=$(dirname -- "$space_parent"); done
available_bytes=$(df -B1 --output=avail -- "$space_parent" | tail -n 1)
available_bytes=${available_bytes//[[:space:]]/}
required_bytes=$((40 * 1024 * 1024 * 1024))
if [[ ! $available_bytes =~ ^[0-9]+$ ]] || ((available_bytes < required_bytes)); then
  printf 'Qualification VM requires 40 GiB free host disk space; available bytes: %s. Remove disposable guest disks only after validating their exported reports.\n' "$available_bytes" >&2
  exit 2
fi
# A single VM per desktop account, including cleanup after a failed guest.
exec 9>"${XDG_RUNTIME_DIR:?}/salt-marcher-qualification-vm.lock"
flock -n 9 || { echo 'Another qualification VM is running' >&2; exit 2; }
mkdir -m 700 -- "$output_dir"
cat /proc/sys/kernel/random/boot_id > "$output_dir/host-boot-id"
container_name="salt-marcher-qualification-$(cat /proc/sys/kernel/random/uuid)"
printf '%s\n' "$container_name" > "$output_dir/container-name"
active_name="${container_name}-prepare"
podman_pid=''
cleanup() {
  result=$?
  trap - EXIT INT TERM
  printf '%s\n' "$result" > "$output_dir/exit-code"
  if podman container exists "$active_name"; then
    podman rm --force --time 5 "$active_name" >/dev/null
  fi
  if [[ -n $podman_pid ]]; then wait "$podman_pid" || true; fi
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
# Resolve the image once: a mutable tag cannot change between preparation and boot.
image_id=$(podman image inspect --format '{{.Id}}' "$tool_image")
printf '%s\n' "$image_id" > "$output_dir/tool-image-id"
podman create --rm --name "$active_name" --memory=1g --memory-swap=1g --pids-limit=64 --cpus=1 \
  --security-opt label=disable \
  -v "$base_disk:/base.qcow2:ro" -v "$output_dir:/output:rw" \
  "$image_id" qemu-img create -f qcow2 -F qcow2 -b /base.qcow2 /output/guest.qcow2 24G > "$output_dir/prepare-container-id"
podman start --attach "$active_name" &
podman_pid=$!
wait "$podman_pid"
podman_pid=''
active_name=$container_name
podman create --rm --name "$container_name" \
  --memory=7g --memory-swap=7g --pids-limit=128 --cpus=2 \
  --device /dev/kvm --security-opt label=disable \
  -v "$base_disk:/base.qcow2:ro" -v "$seed_disk:/seed.img:ro" \
  -v "$output_dir:/output:rw" \
  "$image_id" timeout --signal=TERM --kill-after=10s "${deadline}s" \
  qemu-system-x86_64 -enable-kvm -cpu host -smp 2 -m 4096 \
  -display none -serial stdio -monitor none -nic "$network" \
  -fw_cfg name=opt/salt-marcher/host-boot-id,file=/output/host-boot-id \
  -drive file=/output/guest.qcow2,if=virtio,format=qcow2 \
  -drive file=/seed.img,if=virtio,format=raw,readonly=on \
  > "$output_dir/vm-container-id"
set +e
podman start --attach "$container_name" > "$output_dir/serial.log" 2>&1 &
podman_pid=$!
wait "$podman_pid"
result=$?
podman_pid=''
set -e
printf '%s\n' "$result" > "$output_dir/exit-code"
exit "$result"
