import React, { useState } from 'react';
import {
  BookOpen,
  Atom,
  Zap,
  Activity,
  Layers,
  Award,
  Info,
  Binary,
  BarChart3,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

interface PhysicsGuideProps {
  theme?: 'dark' | 'light';
}

export const PhysicsGuide: React.FC<PhysicsGuideProps> = ({ theme = 'dark' }) => {
  const [activeSection, setActiveSection] = useState<
    'overview' | 'dirac' | 'potentials' | 'observables' | 'molecular' | 'citations'
  >('overview');

  const isLight = theme === 'light';

  const cardBg = isLight
    ? 'bg-white border-slate-200 shadow-sm'
    : 'bg-slate-900/90 border-slate-800 shadow-xl';

  const subCardBg = isLight
    ? 'bg-slate-50 border-slate-200/80'
    : 'bg-slate-800/50 border-slate-700/60';

  const textPrimary = isLight ? 'text-slate-900' : 'text-slate-100';
  const textSecondary = isLight ? 'text-slate-600' : 'text-slate-300';
  const textMuted = isLight ? 'text-slate-500' : 'text-slate-400';

  return (
    <div className="flex flex-col gap-6">
      {/* Hero Header */}
      <div
        className={`p-6 sm:p-8 rounded-2xl border relative overflow-hidden ${
          isLight
            ? 'bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-900 text-white border-indigo-800'
            : 'bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 text-white border-indigo-900/60'
        }`}
      >
        <div className="absolute -right-10 -bottom-10 opacity-10 pointer-events-none">
          <Atom className="w-96 h-96 text-indigo-400" />
        </div>

        <div className="relative z-10 max-w-4xl">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>DIRAC PARTIAL-WAVE SCATTERING THEORY</span>
          </div>

          <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white mb-3">
            Physics Guide &amp; Dirac Theory
          </h2>

          <p className="text-slate-300 text-sm sm:text-base leading-relaxed mb-4">
            Explore the relativistic quantum mechanics, interaction potentials, phase-shift extraction,
            and molecular Independent Atom Model (IAM) algorithms behind the ELSEPA simulation engine.
          </p>

          <div className="flex flex-wrap gap-2 text-xs font-mono text-indigo-200/90 pt-2 border-t border-indigo-800/50">
            <span className="px-2.5 py-1 rounded bg-indigo-900/60 border border-indigo-700/50">
              Relativistic Dirac Equation
            </span>
            <span className="px-2.5 py-1 rounded bg-indigo-900/60 border border-indigo-700/50">
              Salvat-Jablonski-Powell ELSEPA Code
            </span>
            <span className="px-2.5 py-1 rounded bg-indigo-900/60 border border-indigo-700/50">
              Differential Cross Section dσ/dΩ
            </span>
            <span className="px-2.5 py-1 rounded bg-indigo-900/60 border border-indigo-700/50">
              Sherman Function S(θ)
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className={`p-1.5 rounded-xl border flex flex-wrap gap-1 ${cardBg}`}>
        {[
          { id: 'overview', label: 'Overview & Fundamentals', icon: BookOpen },
          { id: 'dirac', label: 'Dirac Partial-Wave Solver', icon: Atom },
          { id: 'potentials', label: 'Interaction Potentials V(r)', icon: Zap },
          { id: 'observables', label: 'Physical Observables', icon: Activity },
          { id: 'molecular', label: 'Molecular IAM Theory', icon: Layers },
          { id: 'citations', label: 'Literature & Citations', icon: Award },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSection === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id as any)}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all shrink-0 ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-md'
                  : isLight
                  ? 'text-slate-700 hover:bg-slate-100'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* SECTION 1: OVERVIEW */}
      {activeSection === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className={`lg:col-span-2 p-6 rounded-2xl border flex flex-col gap-5 ${cardBg}`}>
            <div>
              <h3 className={`text-lg font-bold flex items-center gap-2 ${textPrimary}`}>
                <BookOpen className="w-5 h-5 text-indigo-500" />
                Introduction to Dirac Elastic Scattering
              </h3>
              <p className={`text-sm mt-2 leading-relaxed ${textSecondary}`}>
                Elastic scattering of charged leptons (electrons e⁻ and positrons e⁺) by target atoms and molecules is one of the fundamental probes in atomic physics, surface analysis (AES, XPS), electron microscopy (TEM, SEM), and radiation dosimetry.
              </p>
            </div>

            <div className={`p-4 rounded-xl border ${subCardBg}`}>
              <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-500 mb-2">
                Why Relativistic Dirac Theory?
              </h4>
              <p className={`text-xs leading-relaxed ${textSecondary}`}>
                For projectile kinetic energies above a few tens of electronvolts, or for medium-to-heavy target atoms (Z ≥ 10), non-relativistic Schrödinger mechanics fails to capture relativistic kinematic corrections, spin-orbit coupling, and Mott spin polarization effects.
                The ELSEPA package solves the coupled radial Dirac equation with sub-percent numerical precision across kinetic energies from 10 eV up to 1 GeV.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className={`p-4 rounded-xl border ${subCardBg}`}>
                <div className="flex items-center space-x-2 text-indigo-400 font-bold text-sm mb-1">
                  <Zap className="w-4 h-4" />
                  <span>Key Features of ELSEPA</span>
                </div>
                <ul className={`text-xs space-y-1.5 list-disc list-inside ${textMuted}`}>
                  <li>Exact Dirac partial-wave numerical phase shifts</li>
                  <li>Electrons (e⁻) &amp; Positrons (e⁺) targets</li>
                  <li>Fermi, Uniform, or Point nuclear charge models</li>
                  <li>Dirac-Fock / Thomas-Fermi electron screening</li>
                  <li>Furness-McCarthy / Riley-Truhlar exchange</li>
                  <li>Buckingham + LDA correlation polarization</li>
                </ul>
              </div>

              <div className={`p-4 rounded-xl border ${subCardBg}`}>
                <div className="flex items-center space-x-2 text-emerald-400 font-bold text-sm mb-1">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Benchmark Accuracy</span>
                </div>
                <ul className={`text-xs space-y-1.5 list-disc list-inside ${textMuted}`}>
                  <li>NIST Standard Reference Database 64 alignment</li>
                  <li>Full spin-polarization Sherman function S(θ)</li>
                  <li>High-precision transport cross sections (σ_tr1, σ_tr2)</li>
                  <li>Sub-percent numerical convergence</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Quick Summary Sidebar */}
          <div className={`p-6 rounded-2xl border flex flex-col gap-4 ${cardBg}`}>
            <h4 className={`text-sm font-bold flex items-center gap-2 ${textPrimary}`}>
              <Info className="w-4 h-4 text-indigo-500" />
              Quick Reference Parameters
            </h4>

            <div className="space-y-3 text-xs">
              <div className={`p-3 rounded-lg border ${subCardBg}`}>
                <div className="font-semibold text-indigo-400 mb-1">Projectile Charge (Q)</div>
                <div className={textMuted}>e⁻ (Q = -1) experiences exchange &amp; attractive static; e⁺ (Q = +1) experiences no exchange &amp; repulsive static potential.</div>
              </div>

              <div className={`p-3 rounded-lg border ${subCardBg}`}>
                <div className="font-semibold text-indigo-400 mb-1">Kinetic Energy Range</div>
                <div className={textMuted}>10 eV ≤ E ≤ 1,000,000,000 eV (1 GeV). Relativistic momentum p = √(E(E + 2m_e c²))/c.</div>
              </div>

              <div className={`p-3 rounded-lg border ${subCardBg}`}>
                <div className="font-semibold text-indigo-400 mb-1">Nuclear Models</div>
                <div className={textMuted}>Point charge, Uniform sphere (R_N = 1.07 A^(1/3) fm), or 2-Parameter Fermi distribution.</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: DIRAC PARTIAL-WAVE SOLVER */}
      {activeSection === 'dirac' && (
        <div className={`p-6 rounded-2xl border flex flex-col gap-6 ${cardBg}`}>
          <div>
            <h3 className={`text-lg font-bold flex items-center gap-2 ${textPrimary}`}>
              <Atom className="w-5 h-5 text-indigo-500" />
              Relativistic Dirac Radial Equation
            </h3>
            <p className={`text-sm mt-2 leading-relaxed ${textSecondary}`}>
              In a spherically symmetric interaction potential V(r), the Dirac Hamiltonian for a fast lepton reduces to two coupled first-order radial differential equations for the large component g_κ(r) and small component f_κ(r):
            </p>
          </div>

          {/* Equation Box */}
          <div className="p-4 sm:p-6 rounded-xl bg-slate-950 border border-indigo-900/80 font-mono text-xs sm:text-sm text-indigo-200 overflow-x-auto space-y-3">
            <div className="text-amber-400 font-sans font-bold text-xs uppercase tracking-wider mb-1">
              Coupled Radial Dirac System:
            </div>
            <div>
              dg_κ/dr = -(κ/r) g_κ(r) + [ (E + m_e c² - V(r)) / (ħ c) ] f_κ(r)
            </div>
            <div>
              df_κ/dr =  (κ/r) f_κ(r) - [ (E - m_e c² - V(r)) / (ħ c) ] g_κ(r)
            </div>
            <div className="text-slate-400 text-xs font-sans border-t border-slate-800 pt-2 mt-2">
              Where κ is the relativistic angular momentum quantum number (κ = l for j = l - 1/2, and κ = -(l+1) for j = l + 1/2).
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className={`p-5 rounded-xl border ${subCardBg}`}>
              <h4 className="text-sm font-bold text-indigo-400 mb-2 flex items-center gap-1.5">
                <Binary className="w-4 h-4" />
                Asymptotic Boundary Conditions &amp; Phase Shifts
              </h4>
              <p className={`text-xs leading-relaxed ${textSecondary}`}>
                As r → ∞, the short-range potential V(r) → 0, and the numerical solution g_κ(r) matches a linear combination of spherical Bessel and Neumann functions:
              </p>
              <div className="my-3 p-3 rounded bg-slate-950 border border-slate-800 font-mono text-xs text-indigo-300">
                g_κ(r) → A_κ [ cos(δ_κ) j_l(kr) - sin(δ_κ) n_l(kr) ]
              </div>
              <p className={`text-xs ${textMuted}`}>
                Matching the numerical wavefunction at two grid points outside the atomic radius yields the exact phase shift δ_κ for each partial wave κ.
              </p>
            </div>

            <div className={`p-5 rounded-xl border ${subCardBg}`}>
              <h4 className="text-sm font-bold text-indigo-400 mb-2 flex items-center gap-1.5">
                <BarChart3 className="w-4 h-4" />
                Scattering Amplitudes f(θ) and g(θ)
              </h4>
              <p className={`text-xs leading-relaxed ${textSecondary}`}>
                The elastic scattering process is defined by the direct amplitude f(θ) and the spin-flip amplitude g(θ):
              </p>
              <div className="my-3 p-3 rounded bg-slate-950 border border-slate-800 font-mono text-xs text-indigo-300 space-y-1">
                <div>f(θ) = (1/2ik) ∑ [ (l+1)(exp(2i δ_κ=-l-1) - 1) + l(exp(2i δ_κ=l) - 1) ] P_l(cos θ)</div>
                <div className="pt-1">g(θ) = (1/2ik) ∑ [ exp(2i δ_κ=l) - exp(2i δ_κ=-l-1) ] P_l¹(cos θ)</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: INTERACTION POTENTIALS */}
      {activeSection === 'potentials' && (
        <div className={`p-6 rounded-2xl border flex flex-col gap-6 ${cardBg}`}>
          <div>
            <h3 className={`text-lg font-bold flex items-center gap-2 ${textPrimary}`}>
              <Zap className="w-5 h-5 text-indigo-500" />
              Effective Interaction Potential V(r)
            </h3>
            <p className={`text-sm mt-2 leading-relaxed ${textSecondary}`}>
              The total central potential V(r) experienced by the projectile is a sum of electrostatic static, local exchange, and correlation-polarization contributions:
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-950 border border-indigo-900/80 font-mono text-xs sm:text-sm text-indigo-200 text-center">
            V(r) = V_stat(r) + V_ex(r) + V_pol(r) + i W_abs(r)
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className={`p-4 rounded-xl border ${subCardBg} flex flex-col gap-2`}>
              <div className="font-bold text-sm text-blue-400">1. Static Potential V_stat(r)</div>
              <p className={`text-xs ${textSecondary}`}>
                Generated by the nuclear charge Z·e screened by the electron cloud density ρ(r):
              </p>
              <div className="p-2 rounded bg-slate-950 font-mono text-[11px] text-blue-300">
                V_stat(r) = Z₁e [ Z₂e/r - 4π ∫ ρ(r') r'² dr' ]
              </div>
              <p className={`text-[11px] ${textMuted}`}>
                Modeled using Dirac-Fock analytical screening parameters or Thomas-Fermi/Molière approximations.
              </p>
            </div>

            <div className={`p-4 rounded-xl border ${subCardBg} flex flex-col gap-2`}>
              <div className="font-bold text-sm text-purple-400">2. Local Exchange V_ex(r)</div>
              <p className={`text-xs ${textSecondary}`}>
                Arises from Pauli exclusion principle for identical electrons (e⁻ projectile only, zero for e⁺):
              </p>
              <div className="p-2 rounded bg-slate-950 font-mono text-[11px] text-purple-300">
                V_ex^FM(r) = 1/2 [ (E - V_s) - √((E - V_s)² + 2π e⁴ ρ(r)) ]
              </div>
              <p className={`text-[11px] ${textMuted}`}>
                Furness-McCarthy or Riley-Truhlar local density approximations.
              </p>
            </div>

            <div className={`p-4 rounded-xl border ${subCardBg} flex flex-col gap-2`}>
              <div className="font-bold text-sm text-emerald-400">3. Polarization V_pol(r)</div>
              <p className={`text-xs ${textSecondary}`}>
                Distortion of the atomic electron cloud by the projectile field:
              </p>
              <div className="p-2 rounded bg-slate-950 font-mono text-[11px] text-emerald-300">
                V_pol(r) = -α_d e² / [ 2(r² + r_c²)² ]
              </div>
              <p className={`text-[11px] ${textMuted}`}>
                Buckingham potential joined smoothly to LDA short-range correlation potential (Perdew-Zunger / Padé).
              </p>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 4: OBSERVABLES */}
      {activeSection === 'observables' && (
        <div className={`p-6 rounded-2xl border flex flex-col gap-6 ${cardBg}`}>
          <div>
            <h3 className={`text-lg font-bold flex items-center gap-2 ${textPrimary}`}>
              <Activity className="w-5 h-5 text-indigo-500" />
              Physical Observables &amp; Cross Sections
            </h3>
            <p className={`text-sm mt-2 leading-relaxed ${textSecondary}`}>
              From amplitudes f(θ) and g(θ), ELSEPA calculates all measurable scattering observables across scattering angles θ ∈ [0°, 180°]:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className={`p-5 rounded-xl border ${subCardBg}`}>
              <div className="font-bold text-sm text-indigo-400 mb-2">Differential Cross Section (DCS)</div>
              <div className="p-3 rounded bg-slate-950 font-mono text-xs text-indigo-200 mb-3">
                dσ/dΩ(θ) = |f(θ)|² + |g(θ)|²  [cm²/sr or Å²/sr]
              </div>
              <p className={`text-xs leading-relaxed ${textMuted}`}>
                Quantifies the probability per unit solid angle that a particle is deflected into angle θ. Exhibits characteristic diffraction oscillations (Mott minima) at low/intermediate energies.
              </p>
            </div>

            <div className={`p-5 rounded-xl border ${subCardBg}`}>
              <div className="font-bold text-sm text-indigo-400 mb-2">Sherman Function S(θ) (Mott Asymmetry)</div>
              <div className="p-3 rounded bg-slate-950 font-mono text-xs text-indigo-200 mb-3">
                S(θ) = i [ f(θ)g*(θ) - f*(θ)g(θ) ] / [ |f(θ)|² + |g(θ)|² ] = 2 Im[f(θ)g*(θ)] / (dσ/dΩ)
              </div>
              <p className={`text-xs leading-relaxed ${textMuted}`}>
                Measures transverse spin polarization after scattering of an initially unpolarized beam. Critical for Mott polarimetry and electron spin physics.
              </p>
            </div>

            <div className={`p-5 rounded-xl border ${subCardBg}`}>
              <div className="font-bold text-sm text-indigo-400 mb-2">Total Elastic Cross Section σ_el</div>
              <div className="p-3 rounded bg-slate-950 font-mono text-xs text-indigo-200 mb-3">
                σ_el = 2π ∫₀^π (dσ/dΩ)(θ) sin θ dθ
              </div>
              <p className={`text-xs leading-relaxed ${textMuted}`}>
                Integrated total probability for elastic deflection over all solid angles 4π.
              </p>
            </div>

            <div className={`p-5 rounded-xl border ${subCardBg}`}>
              <div className="font-bold text-sm text-indigo-400 mb-2">Transport Cross Sections (σ_tr1, σ_tr2)</div>
              <div className="p-3 rounded bg-slate-950 font-mono text-xs text-indigo-200 mb-3 space-y-1">
                <div>σ_tr1 = 2π ∫₀^π (dσ/dΩ) (1 - cos θ) sin θ dθ</div>
                <div>σ_tr2 = 3π ∫₀^π (dσ/dΩ) sin³ θ dθ</div>
              </div>
              <p className={`text-xs leading-relaxed ${textMuted}`}>
                Essential input for Monte Carlo electron transport simulations (PENELOPE, Geant4) to determine transport mean free path and angular diffusion.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 5: MOLECULAR IAM THEORY */}
      {activeSection === 'molecular' && (
        <div className={`p-6 rounded-2xl border flex flex-col gap-6 ${cardBg}`}>
          <div>
            <h3 className={`text-lg font-bold flex items-center gap-2 ${textPrimary}`}>
              <Layers className="w-5 h-5 text-indigo-500" />
              Molecular Independent Atom Model (IAM)
            </h3>
            <p className={`text-sm mt-2 leading-relaxed ${textSecondary}`}>
              For molecular targets (H₂O, CO₂, CH₄, SF₆, C₆H₆), the total molecular elastic differential cross section is calculated by combining atomic scattering factor amplitudes f_i(θ) and g_i(θ) with interatomic interference terms:
            </p>
          </div>

          <div className="p-5 rounded-xl bg-slate-950 border border-indigo-900/80 font-mono text-xs sm:text-sm text-indigo-200 space-y-2">
            <div className="text-amber-400 font-sans font-bold text-xs uppercase tracking-wider">
              Molecular Interference Differential Cross Section:
            </div>
            <div>
              (dσ/dΩ)_mol = ∑ᵢ (dσ/dΩ)ᵢ + ∑ᵢ≠ⱼ [ f_i f_j* + g_i g_j* ] · [ sin(q R_ij) / (q R_ij) ]
            </div>
            <div className="text-slate-400 text-xs font-sans pt-2 border-t border-slate-800">
              Where q = 2k sin(θ/2) is the momentum transfer magnitude, and R_ij is the interatomic distance between atom i and atom j.
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className={`p-5 rounded-xl border ${subCardBg}`}>
              <h4 className="font-bold text-sm text-indigo-400 mb-2">Incoherent Sum vs. Coherent IAM</h4>
              <p className={`text-xs leading-relaxed ${textSecondary}`}>
                The first sum ∑ (dσ_i/dΩ) represents independent atom incoherent scattering. The second double sum introduces molecular structure factors sin(q R_ij)/(q R_ij) causing constructive and destructive molecular interference fringes.
              </p>
            </div>

            <div className={`p-5 rounded-xl border ${subCardBg}`}>
              <h4 className="font-bold text-sm text-indigo-400 mb-2">Modified IAM / MIFS Corrections</h4>
              <p className={`text-xs leading-relaxed ${textSecondary}`}>
                At low energies (E &lt; 100 eV), intra-molecular shadow effects (screening of inner atoms by outer atoms) are accounted for via Molecular Interference and Screening (MIFS) reduction factors, preventing unphysical overestimation of low-angle cross sections.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 6: LITERATURE & CITATIONS */}
      {activeSection === 'citations' && (
        <div className={`p-6 rounded-2xl border flex flex-col gap-6 ${cardBg}`}>
          <div>
            <h3 className={`text-lg font-bold flex items-center gap-2 ${textPrimary}`}>
              <Award className="w-5 h-5 text-indigo-500" />
              Academic References &amp; Physics Literature
            </h3>
            <p className={`text-sm mt-2 leading-relaxed ${textSecondary}`}>
              The physics engine and benchmark data implemented in this workbench are based on peer-reviewed literature and national metrology standards:
            </p>
          </div>

          <div className="space-y-4">
            <div className={`p-4 rounded-xl border ${subCardBg}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="font-bold text-sm text-indigo-400">
                  ELSEPA — Dirac partial-wave program for elastic scattering
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-900/60 text-indigo-200 border border-indigo-700">
                  CPC 2005
                </span>
              </div>
              <div className={`text-xs mt-1 ${textSecondary}`}>
                F. Salvat, A. Jablonski, C. J. Powell. <em>Computer Physics Communications</em> 165, 157–190 (2005).
              </div>
              <div className={`text-xs mt-2 ${textMuted}`}>
                Primary reference for the official FORTRAN program ELSEPA for calculating elastic cross sections of electrons and positrons by atoms.
              </div>
            </div>

            <div className={`p-4 rounded-xl border ${subCardBg}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="font-bold text-sm text-indigo-400">
                  NIST Electron Elastic-Scattering Cross-Section Database (SRD 64)
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-900/60 text-emerald-200 border border-emerald-700">
                  NIST SRD 64
                </span>
              </div>
              <div className={`text-xs mt-1 ${textSecondary}`}>
                A. Jablonski, F. Salvat, C. J. Powell. National Institute of Standards and Technology, Gaithersburg MD.
              </div>
              <div className={`text-xs mt-2 ${textMuted}`}>
                Standard reference database for elastic electron collision cross sections used worldwide in electron microscopy and surface analysis.
              </div>
            </div>

            <div className={`p-4 rounded-xl border ${subCardBg}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="font-bold text-sm text-indigo-400">
                  PENELOPE — A Code System for Monte Carlo Simulation of Electron and Photon Transport
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-900/60 text-purple-200 border border-purple-700">
                  OECD/NEA
                </span>
              </div>
              <div className={`text-xs mt-1 ${textSecondary}`}>
                F. Salvat. OECD Nuclear Energy Agency, Paris (2015).
              </div>
              <div className={`text-xs mt-2 ${textMuted}`}>
                Underpinning transport theory for transport cross sections σ_tr1 and mean free path evaluations.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
