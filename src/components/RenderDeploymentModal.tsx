import React, { useState, useEffect, useRef } from 'react';
import {
  Terminal,
  Copy,
  Check,
  Server,
  Download,
  ExternalLink,
  ShieldCheck,
  Play,
  Save,
  RotateCcw,
  FileCode,
  Sparkles,
  AlertTriangle,
  Cpu,
  CheckCircle2,
  Code,
  Layers,
} from 'lucide-react';
import { FortranServerStatus } from '../types';

interface FortranFileInfo {
  name: string;
  lineCount: number;
  sizeBytes: number;
  modified: boolean;
}

interface RenderDeploymentModalProps {
  fortranStatus: FortranServerStatus | null;
  enginePreference?: 'gfortran' | 'typescript';
  setEnginePreference?: (engine: 'gfortran' | 'typescript') => void;
}

export const RenderDeploymentModal: React.FC<RenderDeploymentModalProps> = ({
  fortranStatus,
  enginePreference = 'gfortran',
  setEnginePreference,
}) => {
  // Mode switcher: 'fortran' or 'typescript'
  const [activeEditorMode, setActiveEditorMode] = useState<'fortran' | 'typescript'>(
    enginePreference === 'typescript' ? 'typescript' : 'fortran'
  );

  // Sync mode if enginePreference prop changes from outside
  useEffect(() => {
    if (enginePreference === 'typescript') {
      setActiveEditorMode('typescript');
    } else {
      setActiveEditorMode('fortran');
    }
  }, [enginePreference]);

  // Deployment files
  const [dockerfile, setDockerfile] = useState('');
  const [renderYaml, setRenderYaml] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Fortran Notebook Editor state
  const [fortranFiles, setFortranFiles] = useState<FortranFileInfo[]>([]);
  const [selectedFortranFilename, setSelectedFortranFilename] = useState<string>('elsepa.f');
  const [activeFortranCode, setActiveFortranCode] = useState<string>('');
  const [savedFortranBaselineCode, setSavedFortranBaselineCode] = useState<string>('');

  // TypeScript Engine Notebook Editor state
  const [activeTsCode, setActiveTsCode] = useState<string>('');
  const [savedTsBaselineCode, setSavedTsBaselineCode] = useState<string>('');
  const [isTsModified, setIsTsModified] = useState<boolean>(false);

  // Loading & Action states
  const [isLoadingFile, setIsLoadingFile] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isResetting, setIsResetting] = useState<boolean>(false);
  const [isTestingSim, setIsTestingSim] = useState<boolean>(false);

  // Build & Console Logs
  const [consoleLogs, setConsoleLogs] = useState<string>(
    `[Source Notebook Console] Initialized.\nReady to inspect, edit, save, and test scattering physics engine code.\n`
  );

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);

  // Fetch render deployment files
  useEffect(() => {
    fetch('/api/render-files')
      .then((res) => res.json())
      .then((data) => {
        setDockerfile(data.dockerfile || '');
        setRenderYaml(data.renderYaml || '');
      })
      .catch((err) => console.error('Error fetching render files:', err));
  }, []);

  // Fetch list of Fortran files
  const loadFortranFileList = async () => {
    try {
      const res = await fetch('/api/fortran-source/files');
      if (res.ok) {
        const data = await res.json();
        setFortranFiles(data.files || []);
      }
    } catch (err) {
      console.warn('Error fetching Fortran file list:', err);
    }
  };

  useEffect(() => {
    loadFortranFileList();
  }, []);

  // Fetch selected Fortran file content
  const loadFortranFileContent = async (filename: string) => {
    setIsLoadingFile(true);
    try {
      const res = await fetch(`/api/fortran-source/content?filename=${encodeURIComponent(filename)}`);
      if (res.ok) {
        const data = await res.json();
        setActiveFortranCode(data.content || '');
        setSavedFortranBaselineCode(data.content || '');
      } else {
        setConsoleLogs((prev) => prev + `\n[ERROR] Failed to load Fortran file ${filename}`);
      }
    } catch (err: any) {
      setConsoleLogs((prev) => prev + `\n[ERROR] Fortran load exception: ${err.message}`);
    } finally {
      setIsLoadingFile(false);
    }
  };

  // Fetch TypeScript physics engine content
  const loadTsEngineContent = async () => {
    setIsLoadingFile(true);
    try {
      const res = await fetch('/api/ts-source/content');
      if (res.ok) {
        const data = await res.json();
        setActiveTsCode(data.content || '');
        setSavedTsBaselineCode(data.content || '');
        setIsTsModified(!!data.modified);
      } else {
        setConsoleLogs((prev) => prev + `\n[ERROR] Failed to load TypeScript physics engine source.`);
      }
    } catch (err: any) {
      setConsoleLogs((prev) => prev + `\n[ERROR] TypeScript load exception: ${err.message}`);
    } finally {
      setIsLoadingFile(false);
    }
  };

  useEffect(() => {
    if (activeEditorMode === 'fortran') {
      loadFortranFileContent(selectedFortranFilename);
    } else {
      loadTsEngineContent();
    }
  }, [activeEditorMode, selectedFortranFilename]);

  // Active Code & Baseline depending on mode
  const currentCode = activeEditorMode === 'fortran' ? activeFortranCode : activeTsCode;
  const currentBaseline = activeEditorMode === 'fortran' ? savedFortranBaselineCode : savedTsBaselineCode;
  const isCurrentModified = currentCode !== currentBaseline || (activeEditorMode === 'typescript' && isTsModified);
  const currentFilename = activeEditorMode === 'fortran' ? selectedFortranFilename : 'elsepaPhysicsEngine.ts';
  const currentLineCount = currentCode.split('\n').length;

  // Setter for active code
  const setCurrentCode = (val: string) => {
    if (activeEditorMode === 'fortran') {
      setActiveFortranCode(val);
    } else {
      setActiveTsCode(val);
    }
  };

  // Handle Tab key inside code editor
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;

      const tabSpaces = activeEditorMode === 'fortran' ? '      ' : '  ';
      const newCode = currentCode.substring(0, start) + tabSpaces + currentCode.substring(end);

      setCurrentCode(newCode);

      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + tabSpaces.length;
      }, 0);
    }
  };

  // Sync scrolling between line numbers and code textarea
  const handleScroll = () => {
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  // Save Code (Fortran compile or TS file write)
  const handleSaveCode = async () => {
    setIsSaving(true);
    if (activeEditorMode === 'fortran') {
      setConsoleLogs(
        (prev) => prev + `\n--------------------------------------------------\n[Action] Saving ${selectedFortranFilename} to disk & recompiling Fortran binaries...\n`
      );

      try {
        const res = await fetch('/api/fortran-source/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: selectedFortranFilename,
            content: activeFortranCode,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          setSavedFortranBaselineCode(activeFortranCode);
          setConsoleLogs((prev) => prev + (data.logs || '[SUCCESS] Saved and compiled successfully.\n'));
          loadFortranFileList();
        } else {
          const errData = await res.json();
          setConsoleLogs((prev) => prev + `\n[ERROR] Fortran save failed: ${errData.error || 'Server error'}\n`);
        }
      } catch (err: any) {
        setConsoleLogs((prev) => prev + `\n[ERROR] Network error during Fortran save: ${err.message}\n`);
      } finally {
        setIsSaving(false);
      }
    } else {
      setConsoleLogs(
        (prev) => prev + `\n--------------------------------------------------\n[Action] Saving ${currentFilename} (TypeScript Dirac Physics Engine) to disk...\n`
      );

      try {
        const res = await fetch('/api/ts-source/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: activeTsCode,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          setSavedTsBaselineCode(activeTsCode);
          setIsTsModified(false);
          setConsoleLogs((prev) => prev + (data.logs || '[SUCCESS] TypeScript engine saved successfully.\n'));
        } else {
          const errData = await res.json();
          setConsoleLogs((prev) => prev + `\n[ERROR] TypeScript save failed: ${errData.error || 'Server error'}\n`);
        }
      } catch (err: any) {
        setConsoleLogs((prev) => prev + `\n[ERROR] Network error during TypeScript save: ${err.message}\n`);
      } finally {
        setIsSaving(false);
      }
    }
  };

  // Reset file(s) to original default
  const handleResetToOriginal = async (resetAll: boolean = false) => {
    setIsResetting(true);

    if (activeEditorMode === 'fortran') {
      const targetName = resetAll ? 'all Fortran files' : selectedFortranFilename;
      setConsoleLogs(
        (prev) => prev + `\n--------------------------------------------------\n[Action] Resetting ${targetName} to original Salvat ELSEPA source...\n`
      );

      try {
        const res = await fetch('/api/fortran-source/reset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: resetAll ? undefined : selectedFortranFilename,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          setConsoleLogs((prev) => prev + (data.logs || '[SUCCESS] Reset completed.\n'));
          await loadFortranFileList();
          await loadFortranFileContent(selectedFortranFilename);
        } else {
          const errData = await res.json();
          setConsoleLogs((prev) => prev + `\n[ERROR] Reset failed: ${errData.error}\n`);
        }
      } catch (err: any) {
        setConsoleLogs((prev) => prev + `\n[ERROR] Reset error: ${err.message}\n`);
      } finally {
        setIsResetting(false);
      }
    } else {
      setConsoleLogs(
        (prev) => prev + `\n--------------------------------------------------\n[Action] Resetting elsepaPhysicsEngine.ts to default Dirac solver source...\n`
      );

      try {
        const res = await fetch('/api/ts-source/reset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });

        if (res.ok) {
          const data = await res.json();
          setConsoleLogs((prev) => prev + (data.logs || '[SUCCESS] Reset completed.\n'));
          await loadTsEngineContent();
        } else {
          const errData = await res.json();
          setConsoleLogs((prev) => prev + `\n[ERROR] Reset failed: ${errData.error}\n`);
        }
      } catch (err: any) {
        setConsoleLogs((prev) => prev + `\n[ERROR] Reset error: ${err.message}\n`);
      } finally {
        setIsResetting(false);
      }
    }
  };

  // Run a test simulation directly inside the notebook
  const handleRunTestSimulation = async () => {
    setIsTestingSim(true);
    const engineName = activeEditorMode === 'fortran' ? 'Fortran Binary Engine' : 'TypeScript Dirac Engine';

    setConsoleLogs(
      (prev) =>
        prev +
        `\n--------------------------------------------------\n[Test Simulation] Running benchmark test (${engineName}): Gold (Z=79), E = 100 keV electron scattering...\n`
    );

    try {
      const startTime = performance.now();
      const res = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          z: 79,
          energyEv: 100000,
          projectile: -1,
          nuclearModel: 'fermi',
          densityModel: 'dirac-fock',
          exchangeModel: 'furness-mccarthy',
          polarizationModel: 'lda',
          polarizability: 31.04,
          absorptionModel: 'none',
          angleStep: 1.0,
          forceEngine: activeEditorMode === 'fortran' ? 'gfortran' : 'typescript',
        }),
      });

      const durationMs = (performance.now() - startTime).toFixed(1);

      if (res.ok) {
        const result = await res.json();
        const sigmaEl = result.summary.sigmaElCm2 ? result.summary.sigmaElCm2.toExponential(4) : 'N/A';
        const engineUsed = result.summary.engineUsed || engineName;

        setConsoleLogs(
          (prev) =>
            prev +
            `[Test Simulation SUCCESS] Completed in ${durationMs}ms via ${engineUsed}\n` +
            `  - Target: ${result.element?.name || 'Gold'} (Z=${result.params.z})\n` +
            `  - Energy: ${result.params.energyEv / 1000} keV\n` +
            `  - Angles calculated: ${result.scatteringData.length} points (0° to 180°)\n` +
            `  - Total Elastic Cross Section σ_el: ${sigmaEl} cm²\n` +
            `  - First DCS point (0.5°): ${result.scatteringData[0]?.dcsCm2?.toExponential(4) || 'N/A'} cm²/sr\n`
        );
      } else {
        const errData = await res.json();
        setConsoleLogs((prev) => prev + `\n[ERROR] Test simulation failed: ${errData.error || 'Server error'}\n`);
      }
    } catch (err: any) {
      setConsoleLogs((prev) => prev + `\n[ERROR] Test simulation network exception: ${err.message}\n`);
    } finally {
      setIsTestingSim(false);
    }
  };

  const handleCopy = (code: string, label: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(label);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleDownloadFile = () => {
    const blob = new Blob([currentCode], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = currentFilename;
    a.click();
  };

  return (
    <div id="render-deploy-panel-container" className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm text-slate-900 flex flex-col gap-6 font-sans">
      {/* Page Header */}
      <div className="pb-3 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-bold text-base text-slate-800 flex items-center gap-2">
            <Code className="w-5 h-5 text-indigo-600" />
            Physics Engine Source Notebook & Render.com Deployment
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Interactive source code cells for both Fortran 77 (`elsepa.f`, `elscata.f`) and TypeScript Dirac physics engines (`elsepaPhysicsEngine.ts`). Edits update simulation calculations instantly.
          </p>
        </div>

        <a
          href="https://render.com"
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white rounded-md text-xs font-semibold flex items-center space-x-1.5 shadow-md transition-all self-start sm:self-auto"
        >
          <span>Deploy on Render.com</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* Fortran & TypeScript Engine Status Banner */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-md border ${fortranStatus?.hasGFortran ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-indigo-50 border-indigo-200 text-indigo-700'}`}>
            <Server className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2 text-xs">
              <span>Server Engine Capability:</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${fortranStatus?.hasGFortran ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-indigo-100 text-indigo-800 border border-indigo-300'}`}>
                {fortranStatus?.hasGFortran ? 'gfortran Native Compiler Active' : 'TypeScript Dirac Engine Active'}
              </span>
            </div>
            <div className="text-[11px] text-slate-500 font-mono mt-0.5">
              {fortranStatus?.versionInfo || 'Checking engine status...'}
            </div>
          </div>
        </div>

        {/* Mode Switcher Pill Controls */}
        <div className="flex items-center space-x-1 bg-slate-200 p-1 rounded-lg text-xs font-bold shrink-0 self-start sm:self-auto">
          <button
            onClick={() => {
              setActiveEditorMode('fortran');
              setEnginePreference?.('gfortran');
            }}
            className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
              activeEditorMode === 'fortran'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>Fortran 77 Editor</span>
          </button>

          <button
            onClick={() => {
              setActiveEditorMode('typescript');
              setEnginePreference?.('typescript');
            }}
            className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
              activeEditorMode === 'typescript'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            <span>TypeScript Engine Editor</span>
          </button>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* INTERACTIVE SOURCE CODE NOTEBOOK CELL EDITOR */}
      {/* ==================================================================== */}
      <div id="fortran-notebook-editor" className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl flex flex-col">
        {/* Notebook File Selector Header Bar */}
        <div className="bg-slate-950 px-4 py-2.5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center space-x-1 overflow-x-auto py-1">
            <span className="text-[11px] font-bold text-slate-400 mr-2 flex items-center gap-1 font-mono">
              <FileCode className="w-3.5 h-3.5 text-indigo-400" />
              <span>{activeEditorMode === 'fortran' ? 'Fortran Files:' : 'TypeScript Engine:'}</span>
            </span>

            {activeEditorMode === 'fortran' ? (
              fortranFiles.length > 0 ? (
                fortranFiles.map((file) => (
                  <button
                    key={file.name}
                    onClick={() => setSelectedFortranFilename(file.name)}
                    className={`px-3 py-1 rounded-md text-xs font-mono font-bold transition-all flex items-center gap-1.5 ${
                      selectedFortranFilename === file.name
                        ? 'bg-emerald-600 text-white shadow'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <span>{file.name}</span>
                    {file.modified && (
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" title="File contains custom modifications" />
                    )}
                  </button>
                ))
              ) : (
                ['elsepa.f', 'elscata.f', 'elscatm.f', 'getpath.f'].map((fn) => (
                  <button
                    key={fn}
                    onClick={() => setSelectedFortranFilename(fn)}
                    className={`px-3 py-1 rounded-md text-xs font-mono font-bold transition-all ${
                      selectedFortranFilename === fn ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {fn}
                  </button>
                ))
              )
            ) : (
              <button
                className="px-3 py-1 rounded-md text-xs font-mono font-bold bg-indigo-600 text-white shadow flex items-center gap-1.5"
              >
                <span>elsepaPhysicsEngine.ts</span>
                {isCurrentModified && (
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" title="File contains custom modifications" />
                )}
              </button>
            )}
          </div>

          <div className="flex items-center space-x-2">
            {isCurrentModified && (
              <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded font-mono font-semibold flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                <span>Unsaved Edits</span>
              </span>
            )}

            <button
              id="btn-revert-fortran-code"
              onClick={() => handleResetToOriginal(false)}
              disabled={isResetting || isSaving}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-bold rounded flex items-center gap-1.5 transition-all"
              title={`Reset selected ${activeEditorMode === 'fortran' ? 'Fortran' : 'TypeScript'} file to original baseline code`}
            >
              <RotateCcw className={`w-3.5 h-3.5 text-amber-400 ${isResetting ? 'animate-spin' : ''}`} />
              <span>Reset File</span>
            </button>

            <button
              id="btn-save-compile-fortran"
              onClick={handleSaveCode}
              disabled={isSaving || isResetting}
              className={`px-3 py-1 ${activeEditorMode === 'fortran' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-indigo-600 hover:bg-indigo-500'} disabled:opacity-50 text-white text-xs font-bold rounded shadow flex items-center gap-1.5 transition-all`}
              title="Save code changes and apply to engine runner"
            >
              <Save className={`w-3.5 h-3.5 ${isSaving ? 'animate-spin' : ''}`} />
              <span>{isSaving ? 'Saving...' : activeEditorMode === 'fortran' ? 'Save & Compile' : 'Save Engine Code'}</span>
            </button>
          </div>
        </div>

        {/* Notebook Cell Input Header */}
        <div className="bg-slate-900/90 px-4 py-2 border-b border-slate-800/80 flex items-center justify-between text-xs text-slate-400 font-mono">
          <div className="flex items-center space-x-2">
            <span className={`${activeEditorMode === 'fortran' ? 'text-emerald-400' : 'text-indigo-400'} font-bold`}>[In 1]:</span>
            <span className="font-semibold text-slate-200">{currentFilename}</span>
            <span className="text-slate-500">|</span>
            <span>{activeEditorMode === 'fortran' ? 'FORTRAN 77 / 90 Source' : 'TypeScript Dirac Partial-Wave Engine'}</span>
          </div>

          <div className="flex items-center space-x-3 text-[11px]">
            <span>{currentLineCount.toLocaleString()} lines</span>
            <span>{(currentCode.length / 1024).toFixed(1)} KB</span>
            <button
              onClick={() => handleCopy(currentCode, currentFilename)}
              className="hover:text-indigo-300 transition-colors flex items-center gap-1"
            >
              {copiedCode === currentFilename ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copiedCode === currentFilename ? 'Copied' : 'Copy'}</span>
            </button>
            <button onClick={handleDownloadFile} className="hover:text-indigo-300 transition-colors flex items-center gap-1">
              <Download className="w-3 h-3" />
              <span>Download</span>
            </button>
          </div>
        </div>

        {/* Code Editor Body with Line Numbers */}
        <div className="relative flex bg-slate-950 font-mono text-xs text-emerald-200 h-[360px] overflow-hidden">
          {/* Synchronized Line Numbers Sidebar */}
          <div
            ref={lineNumbersRef}
            className="w-12 py-3 bg-slate-900/60 text-slate-600 text-right pr-3 select-none overflow-hidden font-mono text-[11px] leading-[1.4rem] border-r border-slate-800/60"
          >
            {Array.from({ length: currentLineCount }, (_, i) => (
              <div key={i + 1}>{i + 1}</div>
            ))}
          </div>

          {/* Textarea Editor */}
          <textarea
            ref={textareaRef}
            value={currentCode}
            onChange={(e) => setCurrentCode(e.target.value)}
            onKeyDown={handleKeyDown}
            onScroll={handleScroll}
            disabled={isLoadingFile}
            spellCheck={false}
            className="w-full h-full p-3 bg-transparent text-indigo-100 font-mono text-[11px] leading-[1.4rem] focus:outline-none resize-none overflow-auto selection:bg-indigo-700 selection:text-white"
            placeholder="Loading physics engine source code..."
          />
        </div>

        {/* Notebook Output Cell / Build Console Header */}
        <div className="bg-slate-950 px-4 py-2 border-t border-b border-slate-800 flex items-center justify-between text-xs font-mono">
          <div className="flex items-center space-x-2">
            <span className="text-indigo-400 font-bold">[Out 1]:</span>
            <span className="text-slate-300 font-semibold flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-indigo-400" />
              Build & Execution Output Console
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              id="btn-notebook-run-test-sim"
              onClick={handleRunTestSimulation}
              disabled={isTestingSim || isSaving}
              className={`px-3 py-1 ${activeEditorMode === 'fortran' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-indigo-600 hover:bg-indigo-500'} disabled:opacity-50 text-white font-bold rounded text-xs flex items-center gap-1.5 shadow transition-all`}
              title="Run a test simulation on server using the active physics engine code"
            >
              <Play className={`w-3.5 h-3.5 fill-current ${isTestingSim ? 'animate-spin' : ''}`} />
              <span>{isTestingSim ? 'Executing Test Run...' : `Run Test Simulation (${activeEditorMode === 'fortran' ? 'Fortran' : 'TypeScript'})`}</span>
            </button>

            <button
              onClick={() => handleResetToOriginal(true)}
              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] font-bold"
              title="Reset all physics files to pristine defaults"
            >
              Reset All
            </button>
          </div>
        </div>

        {/* Console Log Output Body */}
        <div className="bg-slate-950 p-3 font-mono text-[11px] text-slate-300 max-h-[180px] overflow-y-auto leading-relaxed border-t border-slate-900">
          <pre className="whitespace-pre-wrap">{consoleLogs}</pre>
        </div>
      </div>

      {/* Render.com Deployment Instructions */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
        <h3 className="font-bold text-sm text-slate-800 mb-3 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-indigo-600" />
          Step-by-Step Render.com Production Deployment Guide
        </h3>
        <ol className="list-decimal list-inside text-xs text-slate-600 space-y-2">
          <li>
            Sign in to <strong className="text-slate-800">Render.com</strong> and click <strong className="text-slate-800">New + → Web Service</strong>.
          </li>
          <li>Connect your GitHub repository containing this codebase.</li>
          <li>
            Select <strong className="text-slate-800">Docker</strong> as the Runtime environment (it reads the included <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-800">Dockerfile</code>).
          </li>
          <li>
            Set the start command to <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-800">npm start</code>.
          </li>
          <li>
            Render will automatically provision <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-800">gfortran</code> and Node 20, compile <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-800">elsepa.f</code> into a native Linux binary (<code className="bg-slate-200 px-1 py-0.5 rounded text-slate-800">elsepa_exec</code>), and serve the web app.
          </li>
        </ol>
      </div>

      {/* Deployment Configuration Code Blocks Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Dockerfile */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 flex flex-col justify-between">
          <div className="flex justify-between items-center mb-2 pb-2 border-b border-slate-800">
            <span className="text-xs font-mono font-bold text-indigo-300">Dockerfile</span>
            <button
              onClick={() => handleCopy(dockerfile, 'Dockerfile')}
              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-bold flex items-center gap-1"
            >
              {copiedCode === 'Dockerfile' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copiedCode === 'Dockerfile' ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
          <pre className="p-3 bg-slate-950 text-slate-300 font-mono text-[11px] rounded overflow-x-auto max-h-[200px]">
            {dockerfile}
          </pre>
        </div>

        {/* render.yaml */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 flex flex-col justify-between">
          <div className="flex justify-between items-center mb-2 pb-2 border-b border-slate-800">
            <span className="text-xs font-mono font-bold text-indigo-300">render.yaml</span>
            <button
              onClick={() => handleCopy(renderYaml, 'render.yaml')}
              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-bold flex items-center gap-1"
            >
              {copiedCode === 'render.yaml' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copiedCode === 'render.yaml' ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
          <pre className="p-3 bg-slate-950 text-slate-300 font-mono text-[11px] rounded overflow-x-auto max-h-[200px]">
            {renderYaml}
          </pre>
        </div>
      </div>
    </div>
  );
};
