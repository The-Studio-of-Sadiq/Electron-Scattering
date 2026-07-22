import React, { useState, useEffect } from 'react';
import { Terminal, Copy, Check, Server, Download, ExternalLink, ShieldCheck } from 'lucide-react';
import { FortranServerStatus } from '../types';

interface RenderDeploymentModalProps {
  fortranStatus: FortranServerStatus | null;
}

export const RenderDeploymentModal: React.FC<RenderDeploymentModalProps> = ({ fortranStatus }) => {
  const [dockerfile, setDockerfile] = useState('');
  const [renderYaml, setRenderYaml] = useState('');
  const [fortranSource, setFortranSource] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/render-files')
      .then((res) => res.json())
      .then((data) => {
        setDockerfile(data.dockerfile || '');
        setRenderYaml(data.renderYaml || '');
        setFortranSource(data.fortranSource || '');
      })
      .catch((err) => console.error('Error fetching render files:', err));
  }, []);

  const handleCopy = (code: string, label: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(label);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div id="render-deploy-panel-container" className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm text-slate-900 flex flex-col gap-6">
      {/* Header */}
      <div className="pb-3 border-b border-slate-200 flex items-center justify-between">
        <div>
          <h2 className="font-bold text-base text-slate-800 flex items-center gap-2">
            <Terminal className="w-5 h-5 text-indigo-600" />
            Fortran Source & Render.com Deployment Center
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Instructions & pre-configured build files (`Dockerfile`, `render.yaml`, `elsepa.f`) for deploying native ELSEPA to Render.com.
          </p>
        </div>

        <a
          href="https://render.com"
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white rounded-md text-xs font-semibold flex items-center space-x-1.5 shadow-lg shadow-indigo-200 transition-all"
        >
          <span>Deploy on Render.com</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* Fortran Status Banner */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-md">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-800 flex items-center gap-2">
              <span>Server Fortran Status:</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${fortranStatus?.hasGFortran ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-amber-100 text-amber-800 border border-amber-300'}`}>
                {fortranStatus?.hasGFortran ? 'gfortran Compiler Active' : 'TypeScript Dirac Engine Active'}
              </span>
            </div>
            <div className="text-[11px] text-slate-500 font-mono mt-0.5">
              {fortranStatus?.versionInfo || 'Checking gfortran status...'}
            </div>
          </div>
        </div>

        <div className="text-right hidden sm:block text-xs text-slate-500">
          <div className="font-bold text-slate-700">Render.com Container Strategy</div>
          <div>gfortran + Node.js 20-slim Docker environment</div>
        </div>
      </div>

      {/* Render.com Setup Steps */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
        <h3 className="font-bold text-sm text-slate-800 mb-3 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-indigo-600" />
          Step-by-Step Render.com Deployment Guide
        </h3>
        <ol className="list-decimal list-inside text-xs text-slate-600 space-y-2">
          <li>
            <strong className="text-slate-800">Export / Commit Code</strong>: Export this codebase or push it to your GitHub / GitLab repository.
          </li>
          <li>
            <strong className="text-slate-800">New Render Service</strong>: In Render.com dashboard, click <span className="font-mono text-indigo-700">New + &gt; Web Service</span>.
          </li>
          <li>
            <strong className="text-slate-800">Select Environment</strong>: Select <span className="font-mono text-indigo-700">Docker</span> as the environment. Render automatically detects the included <span className="font-mono text-indigo-700">Dockerfile</span>.
          </li>
          <li>
            <strong className="text-slate-800">Automatic Fortran Build</strong>: Render builds the Docker image, installs <span className="font-mono text-indigo-700">gfortran</span>, compiles <span className="font-mono text-indigo-700">elsepa.f</span>, bundles Vite/Express, and serves the website on port 3000!
          </li>
        </ol>
      </div>

      {/* Code Blocks Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Dockerfile */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 flex flex-col justify-between">
          <div className="flex justify-between items-center mb-2 pb-2 border-b border-slate-800">
            <span className="text-xs font-mono font-bold text-indigo-400">Dockerfile (Render.com)</span>
            <button
              onClick={() => handleCopy(dockerfile, 'Dockerfile')}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-bold flex items-center gap-1"
            >
              {copiedCode === 'Dockerfile' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copiedCode === 'Dockerfile' ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
          <pre className="p-3 bg-slate-950 text-slate-300 font-mono text-[11px] rounded overflow-x-auto max-h-[220px]">
            {dockerfile}
          </pre>
        </div>

        {/* render.yaml */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 flex flex-col justify-between">
          <div className="flex justify-between items-center mb-2 pb-2 border-b border-slate-800">
            <span className="text-xs font-mono font-bold text-indigo-400">render.yaml (Blueprint)</span>
            <button
              onClick={() => handleCopy(renderYaml, 'render.yaml')}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-bold flex items-center gap-1"
            >
              {copiedCode === 'render.yaml' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copiedCode === 'render.yaml' ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
          <pre className="p-3 bg-slate-950 text-slate-300 font-mono text-[11px] rounded overflow-x-auto max-h-[220px]">
            {renderYaml}
          </pre>
        </div>
      </div>

      {/* Fortran Source Code Viewer */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4">
        <div className="flex justify-between items-center mb-2 pb-2 border-b border-slate-800">
          <span className="text-xs font-mono font-bold text-indigo-300">Official ELSEPA Fortran Program Source (elsepa.f)</span>
          <button
            onClick={() => handleCopy(fortranSource, 'elsepa.f')}
            className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-bold flex items-center gap-1.5"
          >
            {copiedCode === 'elsepa.f' ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedCode === 'elsepa.f' ? 'Copied Fortran Source' : 'Copy elsepa.f'}</span>
          </button>
        </div>
        <pre className="p-3 bg-slate-900 text-indigo-200 font-mono text-[11px] rounded-lg overflow-x-auto max-h-[260px]">
          {fortranSource}
        </pre>
      </div>
    </div>
  );
};
