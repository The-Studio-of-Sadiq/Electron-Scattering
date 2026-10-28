"""Make ELSEPA's fixed-form Fortran acceptable to f2c (strict Fortran 77).

gfortran tolerates DATA statements placed before other specification
statements; f2c does not. Within each program unit, misplaced DATA statements
are moved (in their original order) to just after the last specification
statement. This only reorders non-executable statements, so semantics are
unchanged.

Usage: python f77fix.py in.f out.f
"""
import re
import sys

SPEC = re.compile(
    r"^(IMPLICIT|PARAMETER|COMMON|DIMENSION|CHARACTER|EXTERNAL|INTRINSIC|INTEGER|REAL|"
    r"DOUBLE\s*PRECISION|DOUBLE\s*COMPLEX|COMPLEX|LOGICAL|SAVE|EQUIVALENCE)\b",
    re.I,
)
DATA = re.compile(r"^DATA\b", re.I)
END = re.compile(r"^END\s*$", re.I)


def is_comment(line):
    return line[:1] in ("C", "c", "*", "!") or not line.strip()


def is_continuation(line):
    return len(line) > 5 and not is_comment(line) and line[5] not in (" ", "0") and line[:5].strip() == ""


def statements(lines):
    """Group physical lines into (start, end) statement spans, comments as single lines."""
    i = 0
    while i < len(lines):
        j = i + 1
        if not is_comment(lines[i]):
            while j < len(lines) and (is_continuation(lines[j]) or (is_comment(lines[j]) and j + 1 < len(lines) and is_continuation(lines[j + 1]))):
                j += 1
        yield i, j
        i = j


def fix_unit(lines):
    spans = list(statements(lines))
    body = lambda s: lines[s[0]][6:].strip() if not is_comment(lines[s[0]]) else ""
    last_spec = max((k for k, s in enumerate(spans) if SPEC.match(body(s))), default=-1)
    moved = [s for k, s in enumerate(spans) if k < last_spec and DATA.match(body(s))]
    if not moved:
        return lines
    out = []
    for k, s in enumerate(spans):
        if s in moved:
            continue
        out.extend(lines[s[0]:s[1]])
        if k == last_spec:
            for m in moved:
                out.extend(lines[m[0]:m[1]])
    return out


def main(src, dst):
    lines = open(src, encoding="latin-1").read().split("\n")
    out, unit = [], []
    for line in lines:
        unit.append(line)
        if not is_comment(line) and END.match(line[6:].strip()):
            out.extend(fix_unit(unit))
            unit = []
    out.extend(unit)
    open(dst, "w", encoding="latin-1", newline="\n").write("\n".join(out))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
