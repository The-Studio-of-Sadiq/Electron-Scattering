"""Generate the four architecture figures (SVG) for the v1.2 paper.

Usage: python docs/figures/make_figures.py docs/figures
Render to PNG with any headless browser, e.g. msedge --headless --screenshot.
"""
import os, sys
from xml.sax.saxutils import escape

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)

FONT = "Arial, Helvetica, sans-serif"
INK = "#1f2937"
MUTED = "#4b5563"
C = {  # stroke, fill, title
    "blue":   ("#2563eb", "#eff6ff", "#1d4ed8"),
    "green":  ("#059669", "#ecfdf5", "#047857"),
    "orange": ("#d97706", "#fffbeb", "#b45309"),
    "purple": ("#7c3aed", "#f5f3ff", "#6d28d9"),
    "grey":   ("#6b7280", "#f9fafb", "#374151"),
    "red":    ("#dc2626", "#fef2f2", "#b91c1c"),
    "slate":  ("#334155", "#f8fafc", "#0f172a"),
}


class Fig:
    def __init__(self, w, h, title):
        self.w, self.h, self.parts = w, h, []
        self.text(w / 2, 46, title, 30, weight="bold", anchor="middle")

    def text(self, x, y, s, size=20, weight="normal", anchor="start", fill=INK, italic=False):
        style = ' font-style="italic"' if italic else ""
        self.parts.append(
            f'<text x="{x}" y="{y}" font-family="{FONT}" font-size="{size}" font-weight="{weight}" '
            f'text-anchor="{anchor}" fill="{fill}"{style}>{escape(s)}</text>')

    def box(self, x, y, w, h, title, lines=(), color="blue", dashed=False, size=20, tsize=23,
            center=False, bullets=True, fill=None):
        stroke, bg, tcol = C[color]
        dash = ' stroke-dasharray="10 7"' if dashed else ""
        self.parts.append(
            f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="12" fill="{fill or bg}" '
            f'stroke="{stroke}" stroke-width="2.5"{dash}/>')
        ty = y + 34
        if title:
            self.text(x + w / 2 if center else x + 18, ty, title, tsize, "bold",
                      "middle" if center else "start", tcol)
            ty += 12
        for i, line in enumerate(lines):
            yy = ty + 26 + i * 28
            if center:
                self.text(x + w / 2, yy, line, size, anchor="middle", fill=MUTED)
            elif bullets and not line.startswith("  "):
                self.parts.append(f'<circle cx="{x + 24}" cy="{yy - 6}" r="3.5" fill="{stroke}"/>')
                self.text(x + 36, yy, line, size, fill=MUTED)
            else:
                self.text(x + 36, yy, line.strip(), size, fill=MUTED)

    def arrow(self, pts, label=None, lx=None, ly=None, dashed=False, both=False, color=INK, lsize=18,
              anchor="middle"):
        d = "M" + " L".join(f"{px},{py}" for px, py in pts)
        dash = ' stroke-dasharray="9 6"' if dashed else ""
        start = ' marker-start="url(#ah)"' if both else ""
        self.parts.append(
            f'<path d="{d}" fill="none" stroke="{color}" stroke-width="2.5"{dash} marker-end="url(#ah)"{start}/>')
        if label:
            if lx is None:
                (x1, y1), (x2, y2) = pts[0], pts[-1]
                lx, ly = (x1 + x2) / 2, (y1 + y2) / 2 - 10
            for i, part in enumerate(label.split("\n")):
                self.parts.append(
                    f'<text x="{lx}" y="{ly + i * 22}" font-family="{FONT}" font-size="{lsize}" '
                    f'text-anchor="{anchor}" fill="{INK}" stroke="#ffffff" stroke-width="6" '
                    f'paint-order="stroke">{escape(part)}</text>')

    def legend(self, x, y):
        self.parts.append(f'<path d="M{x},{y} L{x + 60},{y}" stroke="{INK}" stroke-width="2.5" marker-end="url(#ah)"/>')
        self.text(x + 72, y + 6, "always used", 18, fill=MUTED)
        self.parts.append(f'<path d="M{x + 220},{y} L{x + 280},{y}" stroke="{INK}" stroke-width="2.5" '
                          f'stroke-dasharray="9 6" marker-end="url(#ah)"/>')
        self.text(x + 292, y + 6, "optional / only when available or selected", 18, fill=MUTED)

    def legend_v(self, x, y):
        self.parts.append(f'<path d="M{x},{y} L{x + 60},{y}" stroke="{INK}" stroke-width="2.5" marker-end="url(#ah)"/>')
        self.text(x + 72, y + 6, "always used", 18, fill=MUTED)
        self.parts.append(f'<path d="M{x},{y + 34} L{x + 60},{y + 34}" stroke="{INK}" stroke-width="2.5" '
                          f'stroke-dasharray="9 6" marker-end="url(#ah)"/>')
        self.text(x + 72, y + 40, "optional, or only when", 18, fill=MUTED)
        self.text(x + 72, y + 62, "available or selected", 18, fill=MUTED)

    def save(self, name):
        svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{self.w}" height="{self.h}" '
               f'viewBox="0 0 {self.w} {self.h}">'
               '<defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" '
               f'orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="{INK}"/></marker></defs>'
               f'<rect width="100%" height="100%" fill="#ffffff"/>' + "".join(self.parts) + "</svg>")
        with open(os.path.join(OUT, name), "w", encoding="utf-8") as f:
            f.write(svg)


# ---------------------------------------------------------------- Figure 1
f = Fig(1500, 1000, "Electron Scattering Simulator v1.2: system context")
f.box(30, 380, 270, 230, "Researcher / student", [
    "Chooses target, projectile,", "  energy and models", "Runs and compares", "  calculations",
    "Uploads measured data"], "slate")
f.box(370, 90, 660, 640, "Web browser (installable PWA)", [], "blue", fill="#f8fbff")
f.box(400, 150, 600, 130, "React user interface", [
    "Atomic and molecular workbenches, energy sweep", "Saved-run comparison, data overlay, exports"], "blue")
f.box(400, 310, 285, 190, "API router", [
    "Server ELSEPA if present", "Otherwise, or on a server", "  error: in-browser engine"], "blue")
f.box(715, 310, 285, 190, "ELSEPA engine", [
    "Official Fortran 77,", "  compiled to WebAssembly", "Runs in a Web Worker", "206 data tables bundled"], "green")
f.box(400, 530, 285, 170, "Browser storage", [
    "Saved runs (localStorage)", "Offline cache", "  (service worker)"], "purple")
f.box(715, 530, 285, 170, "TS approximation", [
    "Opt-in demo model", "Not ELSEPA; results", "  flagged approximate"], "grey", dashed=True)
f.arrow([(685, 405), (713, 405)])
f.arrow([(560, 500), (560, 528)])
f.box(1110, 90, 360, 170, "Web host", [
    "Render.com, or any", "  static host", "Serves app, engine, data"], "slate")
f.box(1110, 320, 360, 230, "Optional server", [
    "Node.js + Express", "Native ELSEPA (gfortran),", "  same Fortran source", "Returns errors, never", "  approximations"],
      "orange", dashed=True)
f.box(1110, 610, 360, 160, "Reference and lab data", [
    "NIST SRD 64, literature,", "  measurements (.csv, .dat)"], "purple")
f.box(370, 800, 660, 160, "GitHub repository and CI (GitHub Actions)", [
    "Parity test: WebAssembly = native gfortran", "  = reference tables, in 13 cases",
    "Server test: real ELSEPA, no silent fallback"], "red")
f.arrow([(300, 495), (368, 495)], "uses", 334, 482, both=True)
f.arrow([(1108, 175), (1032, 175)], "HTTPS", 1070, 162)
f.arrow([(1032, 435), (1108, 435)], "/api/*", 1070, 422, dashed=True, both=True)
f.arrow([(1108, 690), (1032, 690)], "upload", 1070, 677, dashed=True)
f.arrow([(700, 798), (700, 732)], "tests every change", 790, 772)
f.legend_v(30, 700)
f.save("fig1_system_context.svg")

# ---------------------------------------------------------------- Figure 2
f = Fig(1500, 1060, "Physics engine: from interface settings to ELSEPA results")
f.box(30, 90, 300, 330, "Atomic input", [
    "Z = 1–103, neutral atom", "e⁻ or e⁺, E ≥ 10 eV", "Nucleus: point, uniform,", "  Fermi",
    "Exchange: none, FM,", "  RT, Thomas–Fermi", "Buckingham polarization", "LDA absorption"], "slate", size=19)
f.box(30, 450, 300, 220, "Molecular input", [
    "Atoms + coordinates (Å)", "Presets: H₂O, CO₂, CH₄,", "  N₂, C₆H₆, UF₆", "Exchange, polarization,", "  absorption"],
      "slate", size=19)
f.box(370, 250, 270, 270, "Input-deck builder", [
    "Writes the ELSEPA", "  keyword file", "IZ, MNUCL, MELEC 4,", "  MEXCH, MCPOL, MABS,", "  IHEF 2, EV",
    "Fixed-column format"], "blue", size=19)
f.arrow([(330, 255), (368, 330)])
f.arrow([(330, 560), (368, 450)])
f.box(680, 90, 500, 650, "ELSEPA (unmodified Fortran 77)", [], "green", fill="#f6fdf9")
f.text(700, 152, "Salvat, Jablonski & Powell, CPC 165 (2005) 157", 18, fill=MUTED, italic=True)
f.box(700, 170, 225, 110, "ELSCATA", ["atoms"], "green", center=True)
f.box(935, 170, 225, 110, "ELSCATM", ["molecules (IAM)"], "green", center=True)
steps = [
    ("1  Potential", "nucleus, Dirac–Fock density, exchange,", "correlation–polarization, absorption"),
    ("2  Dirac partial waves", "radial Dirac equation → phase shifts", ""),
    ("3  Amplitudes f(θ), g(θ)", "high-energy factorization (IHEF 2)", ""),
    ("4  Observables", "DCS, Sherman S(θ), σ_el, σ₁, σ₂", ""),
]
for i, (t, a, b) in enumerate(steps):
    y = 300 + i * 105
    f.parts.append(f'<rect x="700" y="{y}" width="460" height="92" rx="10" fill="#ffffff" stroke="#059669" stroke-width="2"/>')
    f.text(716, y + 28, t, 20, "bold", fill="#047857")
    f.text(716, y + 54, a, 18, fill=MUTED)
    if b:
        f.text(716, y + 75, b, 18, fill=MUTED)
    if i:
        f.arrow([(930, y - 13), (930, y - 1)])
f.arrow([(640, 385), (678, 385)])
f.box(370, 780, 270, 230, "Atomic data", [
    "206 tables, Z = 1–103", "z_NNN.den: Dirac–Fock", "  densities", "z_NNN.dfs: screening", "  functions"],
      "purple", size=19)
f.arrow([(640, 895), (660, 895), (660, 600), (678, 600)], "read", 650, 740, anchor="end")
f.box(700, 780, 230, 230, "WebAssembly", [
    "f2c + Emscripten", "Web Worker,", "  fresh instance", "  per run"], "green", size=19)
f.box(950, 780, 230, 230, "Native", [
    "gfortran on the", "  optional server"], "orange", dashed=True, size=19)
f.arrow([(815, 778), (815, 742)], "runs as", 880, 765)
f.arrow([(1065, 778), (1065, 742)], dashed=True)
f.text(940, 1042, "Same source; CI checks that both give identical output", 18, anchor="middle", fill=MUTED,
       italic=True)
f.box(1220, 90, 250, 330, "Output files", [
    "dcs_*.dat: DCS,", "  Sherman, σ_el, σ₁, σ₂", "scatamp.dat: f, g", "scfield.dat:", "  potentials",
    "dpwa.dat: phase", "  shifts"], "blue", size=19)
f.arrow([(1180, 255), (1218, 255)])
f.box(1220, 460, 250, 160, "Output parser", ["dcs + scatamp + ...", "  → JSON result"], "blue", size=19)
f.arrow([(1345, 420), (1345, 458)])
f.box(1220, 660, 250, 160, "Interface", ["Charts, tables,", "  CSV / JSON export"], "blue", size=19)
f.arrow([(1345, 620), (1345, 658)])
f.box(30, 780, 300, 230, "TS approximation", [
    "Separate, opt-in", "Approximate phase", "  shifts, not ELSEPA", "Results flagged in UI"],
      "grey", dashed=True, size=19)
f.save("fig2_physics_engine.svg")

# ---------------------------------------------------------------- Figure 3
f = Fig(1600, 1000, "Data flow of a simulation request")
f.box(30, 380, 230, 170, "1  Set parameters", ["React interface"], "slate", size=19)
f.box(300, 380, 250, 170, "2  API request", ["/api/simulate,", "  -molecule, -sweep,", "  batch-simulate"], "blue", size=19)
f.arrow([(260, 465), (298, 465)])
# router diamond
cx, cy = 690, 465
f.parts.append(f'<path d="M{cx},{cy - 110} L{cx + 110},{cy} L{cx},{cy + 110} L{cx - 110},{cy} Z" fill="#eff6ff" '
               f'stroke="#2563eb" stroke-width="2.5"/>')
f.text(cx, cy - 18, "3  Router", 21, "bold", "middle", "#1d4ed8")
f.text(cx, cy + 10, "server with", 18, anchor="middle", fill=MUTED)
f.text(cx, cy + 34, "native ELSEPA?", 18, anchor="middle", fill=MUTED)
f.arrow([(550, 465), (578, 465)])
f.box(860, 140, 330, 180, "Server (optional)", [
    "Express → gfortran", "  ELSCATA / ELSCATM", "Runs in a temp folder"], "orange", dashed=True, size=19)
f.box(860, 610, 330, 200, "Browser", [
    "ELSEPA WebAssembly", "  in a Web Worker", "Fresh module per run"], "green", size=19)
f.arrow([(cx, cy - 110), (cx, 220), (858, 220)], "yes", 760, 207, dashed=True)
f.arrow([(cx, cy + 110), (cx, 710), (858, 710)], "no", 760, 697)
f.arrow([(1025, 320), (1025, 608)], "server error\n(HTTP 5xx)", 1080, 450, dashed=True, anchor="start")
f.box(1240, 380, 320, 170, "4  ELSEPA output", ["dcs_*.dat, scatamp.dat,", "  scfield.dat, dpwa.dat"],
      "green", size=19)
f.arrow([(1190, 220), (1400, 220), (1400, 378)])
f.arrow([(1190, 710), (1400, 710), (1400, 552)])
f.box(1240, 830, 320, 140, "5  Parse to JSON", ["SimulationResult"], "blue", size=19)
f.arrow([(1500, 552), (1500, 828)])
f.box(860, 830, 330, 140, "6  Visualize", ["DCS, Sherman, polar plot,", "  potentials, phase shifts"],
      "blue", size=19)
f.arrow([(1238, 900), (1192, 900)])
f.box(400, 830, 410, 140, "7  Keep and share", ["Save run (localStorage), overlay", "  data, export CSV / JSON"],
      "purple", size=19)
f.arrow([(858, 900), (812, 900)])
f.box(30, 120, 520, 180, "Errors are reported, not hidden", [
    "If ELSEPA cannot run (e.g. E < 10 eV), the", "  user sees the error; no approximate", "  result is substituted"],
      "red", size=19)
f.box(30, 620, 520, 170, "Energy sweep and batch runs", [
    "Steps 3–5 repeat for each energy", "  (16 energies, 10 eV–1 MeV) or atom"], "slate", size=19)
f.text(30, 990, "The TS approximation is used only when the user selects it, and its results are flagged.",
       18, fill=MUTED, italic=True)
f.legend(870, 100)
f.save("fig3_data_flow.svg")

# ---------------------------------------------------------------- Figure 4
f = Fig(1500, 1000, "Technology stack and deployment")


def band(y, h, color, label, sub):
    stroke, bg, tcol = C[color]
    f.parts.append(f'<rect x="30" y="{y}" width="1440" height="{h}" rx="14" fill="{bg}" stroke="{stroke}" stroke-width="2.5"/>')
    f.parts.append(f'<rect x="30" y="{y}" width="230" height="{h}" rx="14" fill="{stroke}"/>')
    f.text(145, y + h / 2 - 6, label, 22, "bold", "middle", "#ffffff")
    f.text(145, y + h / 2 + 22, sub, 17, anchor="middle", fill="#ffffff")


def chip(x, y, w, t, s="", color="blue", h=78):
    stroke, _, tcol = C[color]
    f.parts.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="10" fill="#ffffff" stroke="{stroke}" stroke-width="2"/>')
    f.text(x + w / 2, y + (32 if s else 46), t, 20, "bold", "middle", tcol)
    if s:
        f.text(x + w / 2, y + 58, s, 17, anchor="middle", fill=MUTED)


band(85, 200, "blue", "Client", "in the browser")
xs = [285, 435, 595, 745, 905]
for x, (t, s, w) in zip(xs, [("React 19", "UI", 135), ("TypeScript", "5.8", 145), ("Vite 6", "build", 135),
                             ("Tailwind 4", "styling", 145), ("Recharts 3", "charts", 140)]):
    chip(x, 105, w, t, s)
for x, (t, s, w) in zip([1060, 1205], [("KaTeX", "equations", 130), ("Motion, lucide", "animation, icons", 245)]):
    chip(x, 105, w, t, s)
chip(285, 195, 400, "PWA: service worker + manifest", "offline cache, installable", h=78)
chip(705, 195, 330, "localStorage", "saved runs", h=78)
chip(1055, 195, 395, "API router (fetch shim)", "server or in-browser engine", h=78)

band(310, 210, "green", "Physics engine", "WebAssembly")
chain = [("ELSEPA", "Fortran 77 (CPC)", 190), ("netlib f2c", "→ C", 160), ("libf2c", "runtime", 140),
         ("Emscripten", "emcc -O3", 180), ("elsepa.wasm", "0.24 MB", 175), ("elsepa.data", "206 tables, 4 MB", 210)]
x = 285
for i, (t, s, w) in enumerate(chain):
    chip(x, 330, w, t, s, "green")
    if i < len(chain) - 2:
        f.arrow([(x + w + 2, 369), (x + w + 22, 369)])
    elif i == len(chain) - 2:
        f.text(x + w + 12, 377, "+", 26, "bold", "middle", INK)
    x += w + 24
chip(285, 425, 560, "Module Web Worker: one fresh instance per run", "input on stdin, output files read from memory", "green")
chip(865, 425, 585, "Unmodified physics: only file I/O changed", "build script: wasm/build.sh", "green")

band(545, 120, "orange", "Optional server", "native ELSEPA")
for x, (t, s, w) in zip([285, 470, 655, 830, 1015], [("Node.js", "runtime", 165), ("Express 4", "REST API", 165),
                                                    ("multer", "uploads", 155), ("tsx / esbuild", "run, bundle", 165),
                                                    ("gfortran -O2", "ELSCATA, ELSCATM", 435)]):
    chip(x, 566, w, t, s, "orange")

band(690, 140, "purple", "Deployment", "hosting")
chip(285, 720, 560, "Docker (node:20-slim + gfortran)", "full app with native server, on Render.com", "purple")
chip(865, 720, 585, "Static hosting, browser only", "any static host (e.g. Vercel previews)", "purple")

band(855, 120, "red", "Quality", "CI and tests")
chip(285, 876, 560, "GitHub Actions: parity test", "13 cases: WASM = gfortran = reference", "red")
chip(865, 876, 585, "Server test", "native ELSEPA, errors instead of fallbacks", "red")
f.save("fig4_tech_stack.svg")
print("ok")
