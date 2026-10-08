"""Measure one native SelectTool drag through the isolated local RFB display.

The Dungeondraft-side mod is read-only. This script only sends pointer input and
requests snapshots from that mod while the button is held and after release.
"""

import argparse
import json
import socket
import struct
import time
from pathlib import Path


def receive(sock, size):
    data = b""
    while len(data) < size:
        part = sock.recv(size - len(data))
        if not part:
            raise EOFError(f"RFB closed while reading {size} bytes")
        data += part
    return data


def connect(port):
    sock = socket.create_connection(("127.0.0.1", port), timeout=5)
    version = receive(sock, 12)
    sock.sendall(version)
    count = receive(sock, 1)[0]
    if 1 not in receive(sock, count):
        raise RuntimeError("Local RFB server does not offer no-auth mode")
    sock.sendall(b"\x01")
    if struct.unpack(">I", receive(sock, 4))[0]:
        raise RuntimeError("RFB security handshake failed")
    sock.sendall(b"\x01")
    receive(sock, 20)
    receive(sock, struct.unpack(">I", receive(sock, 4))[0])
    return sock


def pointer(sock, x, y, held):
    sock.sendall(struct.pack(">BBHH", 5, int(held), x, y))


def snapshot(request_path, log_path, request_id, timeout=6):
    if log_path.exists() and f'"id":"{request_id}"' in log_path.read_text(errors="replace"):
        raise ValueError(f"Probe id already exists in the active log: {request_id}")
    request_path.write_text(json.dumps({"id": request_id, "fixture": "rfb-drag"}))
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if log_path.exists():
            for line in reversed(log_path.read_text(errors="replace").splitlines()):
                marker = "CODEX_SELECTION_PROBE "
                if marker not in line:
                    continue
                try:
                    result = json.loads(line.split(marker, 1)[1])
                except json.JSONDecodeError:
                    continue
                if result.get("id") == request_id:
                    return result
        time.sleep(0.1)
    raise TimeoutError(f"No native snapshot for {request_id}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--request", type=Path, required=True)
    parser.add_argument("--log", type=Path, required=True)
    parser.add_argument("--id", required=True)
    parser.add_argument("--start", nargs=2, type=int, required=True)
    parser.add_argument("--end", nargs=2, type=int, required=True)
    parser.add_argument("--port", type=int, default=5909)
    parser.add_argument("--steps", type=int, default=24)
    parser.add_argument("--trace-steps", action="store_true")
    parser.add_argument("--hold-seconds", type=float, default=0)
    parser.add_argument("--allow-selection", action="store_true")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    if args.steps < 1:
        parser.error("--steps must be positive")
    if args.hold_seconds < 0:
        parser.error("--hold-seconds must be nonnegative")
    start, end = tuple(args.start), tuple(args.end)
    before = snapshot(args.request, args.log, args.id + "-before")
    if before["selected"] and not args.allow_selection:
        raise RuntimeError("Native selection is not empty before the drag")
    with connect(args.port) as sock:
        step_trace = []
        pointer(sock, *start, False)
        time.sleep(0.45)
        pointer(sock, *start, True)
        time.sleep(0.12)
        for step in range(1, args.steps + 1):
            x = round(start[0] + (end[0] - start[0]) * step / args.steps)
            y = round(start[1] + (end[1] - start[1]) * step / args.steps)
            pointer(sock, x, y, True)
            time.sleep(0.09)
            if args.trace_steps:
                step_trace.append({"pointer": [x, y],
                                   "state": snapshot(args.request, args.log,
                                                     f"{args.id}-step-{step}")})
        time.sleep(args.hold_seconds)
        held = snapshot(args.request, args.log, args.id + "-held")
        pointer(sock, *end, False)
        time.sleep(0.2)
        after = snapshot(args.request, args.log, args.id + "-after")
    result = {"id": args.id, "screen_start": start, "screen_end": end,
              "before": before, "steps": step_trace,
              "held": held, "after": after}
    output = json.dumps(result, ensure_ascii=False, indent=2) + "\n"
    if args.output:
        args.output.write_text(output)
    print(output, end="")


if __name__ == "__main__":
    main()
