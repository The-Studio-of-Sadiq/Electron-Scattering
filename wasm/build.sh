#!/usr/bin/env bash
# Builds the official ELSEPA Fortran (fortran/*.f) to WebAssembly so the
# browser / PWA can run it without a server.
#
#   Fortran 77 --(f2c)--> C --(emcc)--> public/elsepa/elsepa.{js,wasm,data}
#
# Requirements (only needed when the Fortran changes; the output is committed):
#   EMSDK   path to an activated emsdk checkout   (https://github.com/emscripten-core/emsdk)
#   F2C_DIR path to netlib f2c sources containing src/ and libf2c/
#           (https://www.netlib.org/f2c/src.tgz and libf2c.zip)
#
# Usage: EMSDK=... F2C_DIR=... bash wasm/build.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
: "${EMSDK:?set EMSDK to your emsdk directory}"
: "${F2C_DIR:?set F2C_DIR to the netlib f2c source directory}"
export PATH="$EMSDK/upstream/emscripten:$EMSDK/upstream/bin:$PATH"
EMCC=emcc
command -v emcc >/dev/null 2>&1 || EMCC=emcc.exe

BUILD="$ROOT/wasm/build"
OUT="$ROOT/public/elsepa"
mkdir -p "$BUILD/libf2c" "$OUT"

# ---- 1. f2c translator, compiled to a Node program ------------------------
F2C_JS="$BUILD/f2c.cjs"
if [ ! -f "$F2C_JS" ]; then
  echo "[build] f2c translator"
  pushd "$F2C_DIR/src" >/dev/null
  grep -n . <tokens | sed "s/\([^:]*\):\(.*\)/#define \2 \1/" >tokdefs.h
  echo '/*OK*/' >sysdep.hd
  $EMCC -O2 -w main.c init.c gram.c lex.c proc.c equiv.c data.c format.c expr.c exec.c \
    intr.c io.c misc.c error.c mem.c names.c output.c p1output.c pread.c put.c putpcc.c \
    vax.c formatdata.c parse_args.c niceprintf.c cds.c sysdep.c version.c \
    -sNODERAWFS=1 -sALLOW_MEMORY_GROWTH=1 -sEXIT_RUNTIME=1 -o "$F2C_JS"
  popd >/dev/null
fi

# ---- 2. libf2c runtime, compiled to wasm objects --------------------------
LIBF2C="$BUILD/libf2c.a"
if [ ! -f "$LIBF2C" ]; then
  echo "[build] libf2c"
  cp "$F2C_DIR"/libf2c/*.c "$F2C_DIR"/libf2c/*.h "$BUILD/libf2c/" 2>/dev/null || true
  pushd "$BUILD/libf2c" >/dev/null
  for h in f2c fio signal1 sysdep1; do cp "$F2C_DIR/libf2c/$h.h0" "$h.h"; done
  $EMCC -DNO_FPINIT arithchk.c -o arithchk.cjs -w && node arithchk.cjs >arith.h
  OBJS="f77vers i77vers s_rnge abort_ exit_ getarg_ iargc_ getenv_ signal_ s_stop s_paus
    system_ cabs ctype derf_ derfc_ erf_ erfc_ sig_die uninit
    pow_ci pow_dd pow_di pow_hh pow_ii pow_ri pow_zi pow_zz
    c_abs c_cos c_div c_exp c_log c_sin c_sqrt z_abs z_cos z_div z_exp z_log z_sin z_sqrt
    r_abs r_acos r_asin r_atan r_atn2 r_cnjg r_cos r_cosh r_dim r_exp r_imag r_int r_lg10
    r_log r_mod r_nint r_sign r_sin r_sinh r_sqrt r_tan r_tanh
    d_abs d_acos d_asin d_atan d_atn2 d_cnjg d_cos d_cosh d_dim d_exp d_imag d_int d_lg10
    d_log d_mod d_nint d_prod d_sign d_sin d_sinh d_sqrt d_tan d_tanh
    i_abs i_dim i_dnnt i_indx i_len i_mod i_nint i_sign lbitbits lbitshft
    h_abs h_dim h_dnnt h_indx h_len h_mod h_nint h_sign
    l_ge l_gt l_le l_lt hl_ge hl_gt hl_le hl_lt ef1asc_ ef1cmc_
    f77_aloc s_cat s_cmp s_copy
    backspac close dfe dolio due endfile err fmt fmtlib ftell_ iio ilnw inquire lread lwrite
    open rdfmt rewind rsfe rsli rsne sfe sue typesize uio util wref wrtfmt wsfe wsle wsne xwsne"
  for o in $OBJS; do $EMCC -O2 -w -DNO_TRUNCATE -DSkip_f2c_Undefs -c "$o.c" -o "$o.o"; done
  "$EMSDK/upstream/emscripten/emar" rcs "$LIBF2C" $(for o in $OBJS; do echo "$o.o"; done) 2>/dev/null \
    || emar.bat rcs "$LIBF2C" $(for o in $OBJS; do echo "$o.o"; done)
  popd >/dev/null
fi

# ---- 3. Make the Fortran pure F77 and translate it ------------------------
echo "[build] translating Fortran"
SRC="$BUILD/src"
mkdir -p "$SRC"
# elsepa.f INCLUDEs getpath.f, which uses F90 features (get_environment_variable,
# TRIM). In the browser the data tables always live at /data in the virtual FS.
sed -e "1s/^      INCLUDE 'getpath.f'.*$/C     getpath: see wasm\/build.sh/" \
    -e 's/CHARACTER (len=255) *\(::\)\? *getpath/CHARACTER*255 getpath/I' \
    "$ROOT/fortran/elsepa.f" >"$SRC/elsepa.f"
cat >>"$SRC/elsepa.f" <<'EOF'
C
      CHARACTER*255 FUNCTION getpath(F)
      CHARACTER*(*) F
      getpath='/data/'//F
      RETURN
      END
EOF
cp "$ROOT/fortran/elscata.f" "$ROOT/fortran/elscatm.f" "$SRC/"
PYTHON=python3
command -v python3 >/dev/null 2>&1 && python3 -c "" 2>/dev/null || PYTHON=python
pushd "$SRC" >/dev/null
for f in elsepa elscata elscatm; do
  "$PYTHON" "$ROOT/wasm/f77fix.py" "$f.f" "$f.f.tmp" && mv "$f.f.tmp" "$f.f"
done
# f2c infers the types of functions passed as arguments per file; re-run it with the
# generated prototype (.P) files until they stop changing so every call matches
# exactly (WebAssembly traps on indirect calls with mismatched signatures).
for f in elsepa elscata elscatm; do
  node "$F2C_JS" -a -A -P -T"$SRC" "$f.f" >/dev/null 2>"$f.f2c.log" || { cat "$f.f2c.log"; exit 1; }
done
for pass in 1 2 3 4 5; do
  changed=0
  for f in elsepa elscata elscatm; do
    status=0
    node "$F2C_JS" -a -A -Ps -T"$SRC" elsepa.P "$f.f" >/dev/null 2>"$f.f2c.log" || status=$?
    [ "$status" = 4 ] && changed=1
    [ "$status" != 0 ] && [ "$status" != 4 ] && { cat "$f.f2c.log"; exit 1; }
  done
  [ "$changed" = 0 ] && break
done
# Each program's main unit is MAIN__; give them distinct names so one module holds both.
sed -i 's/\bMAIN__\b/elscata_main__/g' elscata.c
sed -i 's/\bMAIN__\b/elscatm_main__/g' elscatm.c
# f2c declares these libf2c helpers as returning int, but libf2c defines them void;
# route them through int-returning wrappers (see entry.c) so signatures match.
sed -i -E 's/\b(s_cat|s_copy)\b/\1_i/g' elsepa.c elscata.c elscatm.c
popd >/dev/null

# ---- 4. Link everything into one module -----------------------------------
echo "[build] linking WebAssembly"
cat >"$SRC/entry.c" <<'EOF'
#include <string.h>
#include "f2c.h"
extern void f_init(void), f_exit(void);
extern int elscata_main__(void), elscatm_main__(void);
extern void s_cat(char *, char **, integer *, integer *, ftnlen);
extern void s_copy(char *, char *, ftnlen, ftnlen);
int s_cat_i(char *a, char **b, integer *c, integer *d, ftnlen e) { s_cat(a, b, c, d, e); return 0; }
int s_copy_i(char *a, char *b, ftnlen c, ftnlen d) { s_copy(a, b, c, d); return 0; }
int xargc; char **xargv;
/* argv[1] selects the program: "atomic" (ELSCATA) or "molecular" (ELSCATM). */
int main(int argc, char **argv) {
  xargc = argc; xargv = argv;
  f_init();
  if (argc > 1 && strcmp(argv[1], "molecular") == 0) elscatm_main__();
  else elscata_main__();
  f_exit();
  return 0;
}
EOF
# -fcommon: f2c emits a definition of each Fortran COMMON block in every file.
$EMCC -O3 -w -fcommon -I"$BUILD/libf2c" \
  "$SRC/entry.c" "$SRC/elsepa.c" "$SRC/elscata.c" "$SRC/elscatm.c" "$LIBF2C" -lm \
  -sMODULARIZE=1 -sEXPORT_ES6=1 -sEXPORT_NAME=createElsepa \
  -sENVIRONMENT=web,worker,node -sINVOKE_RUN=0 -sEXIT_RUNTIME=1 \
  -sALLOW_MEMORY_GROWTH=1 -sSTACK_SIZE=8MB -sFORCE_FILESYSTEM=1 \
  -sEXPORTED_RUNTIME_METHODS=FS,callMain \
  --preload-file "$ROOT/data@/data" \
  -o "$OUT/elsepa.js"

ls -la "$OUT"
echo "[build] done"
