"""Build the Windows x64 launcher with GNU binutils and the Python standard library."""
from argparse import ArgumentParser
from pathlib import Path
from struct import pack
from subprocess import run
from tempfile import TemporaryDirectory

parser = ArgumentParser()
parser.add_argument("output", type=Path)
args = parser.parse_args()
source = Path(__file__).with_name("launcher.s")
site = "https://mob-focus-north.autumnalaspen.chatgpt.site/"

with TemporaryDirectory() as directory:
    build = Path(directory)
    strings = {
        "edge": "msedge.exe", "chrome": "chrome.exe", "verb": "open",
        "app": "--app=" + site, "url": site, "title": "Mob",
        "error_text": "Open " + site + " in a browser."
    }
    lines = [name + ": .byte " + ",".join(map(str, (value + "\0").encode("utf-16-le"))) for name, value in strings.items()]
    (build / "strings.inc").write_text("\n".join(lines) + "\n")
    run(["as", "--64", "-I", directory, "-o", "launcher.o", str(source.resolve())], cwd=build, check=True)
    run(["ld", "-e", "mob_start", "--section-start=.text=0x1000", "--section-start=.idata=0x2000",
         "-o", "launcher.elf", "launcher.o"], cwd=build, check=True)
    for section in (".text", ".idata"):
        run(["objcopy", f"--dump-section={section}={section}.bin", "launcher.elf"], cwd=build, check=True)
    text = (build / ".text.bin").read_bytes()
    imports = (build / ".idata.bin").read_bytes()

def aligned(data, size=512):
    return data + bytes((-len(data)) % size)

dos = bytearray(128)
dos[:2] = b"MZ"
dos[60:64] = pack("<I", len(dos))
coff = b"PE\0\0" + pack("<HHIIIHH", 0x8664, 2, 0, 0, 0, 240, 0x22)
header = pack("<HBBIIIIIQIIHHHHHHIIIIHHQQQQII", 0x20B, 1, 0, 512, 512, 0, 0x1000, 0x1000,
              0x140000000, 4096, 512, 6, 0, 0, 0, 6, 0, 0, 0x3000, 512, 0, 2, 0x0100,
              1048576, 4096, 1048576, 4096, 0, 16)
dirs = bytes(8) + pack("<II", 0x2000, 80) + bytes(10 * 8) + pack("<II", 0x2050, 48) + bytes(3 * 8)

def section(name, data, address, offset, flags):
    return pack("<8sIIIIIIHHI", name, len(data), address, len(aligned(data)), offset, 0, 0, 0, 0, flags)

sections = section(b".text", text, 0x1000, 512, 0x60000020)
sections += section(b".idata", imports, 0x2000, 512 + len(aligned(text)), 0xC0000040)
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_bytes(aligned(dos + coff + header + dirs + sections) + aligned(text) + aligned(imports))
