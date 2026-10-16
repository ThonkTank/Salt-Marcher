"""Visible X11 focus target that records KeyRelease without forwarding it."""

import json
import sys
import time
import tkinter as tk
from pathlib import Path


out = Path(sys.argv[1])
root = tk.Tk()
root.title("Codex KeyRelease Sink")
root.geometry("360x180+180+140")
tk.Label(root, text="A release focus probe").pack(expand=True, fill="both")


def log(event):
    row = {
        "type": event.type.name,
        "keysym": getattr(event, "keysym", ""),
        "keycode": getattr(event, "keycode", None),
        "time": time.time(),
        "window": root.winfo_id(),
    }
    with out.open("a") as stream:
        stream.write(json.dumps(row) + "\n")


for name in ("<FocusIn>", "<FocusOut>", "<KeyPress>", "<KeyRelease>"):
    root.bind(name, log, add="+")
root.mainloop()
