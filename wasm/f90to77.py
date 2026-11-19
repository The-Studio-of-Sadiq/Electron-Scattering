"""Feasibility spike: turn ELSEPA 2021 (elsepa-2020 package) into Fortran 77 that f2c accepts.

The only Fortran 90 module, CONSTANTS in radial.f, holds six PARAMETER constants and no
state. Each `USE CONSTANTS` is replaced by an INCLUDE of the same constants written as
Fortran 77 declarations, placed after the unit's IMPLICIT statement (F77 statement order).
The two INCLUDEs at the top of elscata.f / elscatm.f are resolved by translating
radial.f + elsepa2020.f as one library file instead. Nothing else is changed.

Usage: python prep2021.py <elsepa-2020 dir> <out dir>
"""
import os, re, sys

src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
read = lambda n: open(os.path.join(src, n), encoding="latin-1").read().replace("\r\n", "\n").split("\n")

CONSTANTS_INC = """C  ELSEPA 2021 module CONSTANTS (radial.f) as Fortran 77 declarations.
      INTEGER*4 NDIM, MNT
      PARAMETER (NDIM=25000, MNT=50)
      DOUBLE PRECISION SL, A0B, HREV, REV
      PARAMETER (SL=137.035999139D0, A0B=5.2917721067D-9)
      PARAMETER (HREV=27.21138602D0, REV=510.9989461D3)
"""

is_comment = lambda l: l[:1] in ("C", "c", "*", "!") or not l.strip()
is_cont = lambda l: len(l) > 5 and not is_comment(l) and l[5] not in (" ", "0") and l[:5].strip() == ""


def replace_use(lines):
    res, pending, i = [], False, 0
    while i < len(lines):
        l = lines[i]
        body = l[6:].strip().upper() if not is_comment(l) else ""
        i += 1
        if re.match(r"USE\s+CONSTANTS\b", body):
            pending = True
            continue
        res.append(l)
        if pending and body.startswith("IMPLICIT"):
            # insert after the IMPLICIT statement and its continuation lines
            while i < len(lines) and is_cont(lines[i]):
                res.append(lines[i])
                i += 1
            res.append("      INCLUDE 'constants.inc'")
            pending = False
    if pending:
        raise SystemExit("USE CONSTANTS without a following IMPLICIT statement")
    return res


def drop_module(lines):
    out_, skip = [], False
    for l in lines:
        body = l[6:].strip().upper() if not is_comment(l) else ""
        if body.startswith("MODULE CONSTANTS"):
            skip = True
        if not skip:
            out_.append(l)
        if skip and body.startswith("END MODULE"):
            skip = False
    return out_


lib = replace_use(drop_module(read("radial.f"))) + replace_use(read("elsepa2020.f"))
open(os.path.join(out, "lib.f"), "w", encoding="latin-1", newline="\n").write("\n".join(lib))
for prog in ("elscata", "elscatm"):
    lines = [l for l in read(prog + ".f") if not re.match(r"^\s+INCLUDE\s+'(radial|elsepa2020)\.f'", l, re.I)]
    open(os.path.join(out, prog + ".f"), "w", encoding="latin-1", newline="\n").write("\n".join(replace_use(lines)))
open(os.path.join(out, "constants.inc"), "w", newline="\n").write(CONSTANTS_INC)
print("prepared", out)
