"""Capture only an isolated QEMU guest display for native-dialog diagnosis."""
import base64
import ctypes as C
import ctypes.util
import json
from pathlib import Path
import struct
import zlib

host = Path('/sys/firmware/qemu_fw_cfg/by_name/opt/salt-marcher/host-boot-id/raw').read_text().strip()
guest = Path('/proc/sys/kernel/random/boot_id').read_text().strip()
assert host and guest and host != guest, 'Separate guest kernel required'
x = C.CDLL(ctypes.util.find_library('X11'))
class XImage(C.Structure):
    _fields_ = [('width', C.c_int), ('height', C.c_int), ('xoffset', C.c_int),
                ('format', C.c_int), ('data', C.c_void_p), ('byte_order', C.c_int),
                ('bitmap_unit', C.c_int), ('bitmap_bit_order', C.c_int),
                ('bitmap_pad', C.c_int), ('depth', C.c_int), ('bytes_per_line', C.c_int),
                ('bits_per_pixel', C.c_int), ('red_mask', C.c_ulong),
                ('green_mask', C.c_ulong), ('blue_mask', C.c_ulong)]
x.XOpenDisplay.restype = C.c_void_p
x.XDefaultRootWindow.argtypes = [C.c_void_p]
x.XDefaultRootWindow.restype = C.c_ulong
x.XDefaultScreen.argtypes = [C.c_void_p]
x.XDisplayWidth.argtypes = [C.c_void_p, C.c_int]
x.XDisplayHeight.argtypes = [C.c_void_p, C.c_int]
x.XGetImage.argtypes = [C.c_void_p, C.c_ulong, C.c_int, C.c_int, C.c_uint, C.c_uint, C.c_ulong, C.c_int]
x.XGetImage.restype = C.POINTER(XImage)
x.XDestroyImage.argtypes = [C.POINTER(XImage)]
x.XCloseDisplay.argtypes = [C.c_void_p]
display = x.XOpenDisplay(None)
assert display, 'Guest display missing'
try:
    screen = x.XDefaultScreen(display)
    width, height = x.XDisplayWidth(display, screen), x.XDisplayHeight(display, screen)
    assert 0 < width <= 4096 and 0 < height <= 4096
    ptr = x.XGetImage(display, x.XDefaultRootWindow(display), 0, 0, width, height, C.c_ulong(-1), 2)
    assert ptr
    try:
        img = ptr.contents
        assert img.bits_per_pixel == 32 and img.byte_order == 0
        assert (img.red_mask, img.green_mask, img.blue_mask) == (0xff0000, 0xff00, 0xff)
        pixels = C.string_at(img.data, img.bytes_per_line * height)
        rows = bytearray()
        for y in range(height):
            rows.append(0)
            row = pixels[y * img.bytes_per_line:y * img.bytes_per_line + width * 4]
            for offset in range(0, len(row), 4):
                rows.extend((row[offset+2], row[offset+1], row[offset]))
        def chunk(kind, data):
            return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data))
        png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(rows)) + chunk(b'IEND', b'')
        print(json.dumps({'width': width, 'height': height, 'pngBase64': base64.b64encode(png).decode()}))
    finally:
        x.XDestroyImage(ptr)
finally:
    x.XCloseDisplay(display)
