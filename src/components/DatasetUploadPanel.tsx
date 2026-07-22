import React, { useState } from 'react';
import { UploadCloud, FileText, CheckCircle2, AlertCircle, Trash2, Eye } from 'lucide-react';
import { UploadedDataset } from '../types';

interface DatasetUploadPanelProps {
  uploadedDatasets: UploadedDataset[];
  setUploadedDatasets: React.Dispatch<React.SetStateAction<UploadedDataset[]>>;
  onSelectOverlay: (id: string) => void;
}

export const DatasetUploadPanel: React.FC<DatasetUploadPanelProps> = ({
  uploadedDatasets,
  setUploadedDatasets,
  onSelectOverlay,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [datasetType, setDatasetType] = useState<'dcs-comparison' | 'custom-density' | 'custom-potential'>('dcs-comparison');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 5 * 1024 * 1024) {
        setUploadMessage({ text: 'File exceeds 5 MB limit.', type: 'error' });
        return;
      }
      setSelectedFile(file);
      setUploadMessage(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setUploadMessage(null);

    const formData = new FormData();
    formData.append('datasetFile', selectedFile);
    formData.append('datasetType', datasetType);

    try {
      const res = await fetch('/api/upload-dataset', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setUploadedDatasets((prev) => [data.dataset, ...prev]);
        setSelectedFile(null);
        setUploadMessage({ text: `Dataset "${data.dataset.filename}" securely uploaded and parsed (${data.dataset.dataPointsCount} data points)!`, type: 'success' });
      } else {
        const errData = await res.json();
        setUploadMessage({ text: errData.error || 'Upload failed.', type: 'error' });
      }
    } catch (err: any) {
      setUploadMessage({ text: err.message || 'Server error during upload.', type: 'error' });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteDataset = (id: string) => {
    setUploadedDatasets((prev) => prev.filter((d) => d.id !== id));
  };

  return (
    <div id="dataset-upload-panel-container" className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm text-slate-900 flex flex-col gap-5">
      <div className="pb-3 border-b border-slate-200">
        <h2 className="font-bold text-base text-slate-800 flex items-center gap-2">
          <UploadCloud className="w-5 h-5 text-indigo-600" />
          Secure Dataset Upload Manager
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Upload custom experimental DCS scattering data, custom atomic density files, or radial potentials (.dat, .csv, .txt) with validation & sanitization.
        </p>
      </div>

      {/* Upload Box */}
      <div className="bg-slate-50 border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-xl p-6 text-center transition-colors flex flex-col items-center justify-center">
        <UploadCloud className="w-10 h-10 text-indigo-500 mb-2" />
        <h4 className="font-bold text-sm text-slate-800">Drag & Drop or Select Dataset File</h4>
        <p className="text-xs text-slate-500 mt-1 max-w-sm">
          Supported formats: .dat, .csv, .txt with numerical columns (e.g. Angle vs DCS or Radius vs Density). Max 5 MB.
        </p>

        {/* Dataset Type Selector */}
        <div className="flex items-center space-x-3 my-4">
          <span className="text-xs font-semibold text-slate-600">Dataset Role:</span>
          <select
            value={datasetType}
            onChange={(e) => setDatasetType(e.target.value as any)}
            className="bg-white text-slate-800 border border-slate-300 text-xs rounded-md px-2.5 py-1.5 focus:outline-none"
          >
            <option value="dcs-comparison">Experimental DCS Comparison (Angle vs Cross Section)</option>
            <option value="custom-density">Custom Electron Density ρ(r)</option>
            <option value="custom-potential">Custom Radial Potential V(r)</option>
          </select>
        </div>

        <input
          id="dataset-file-input"
          type="file"
          accept=".dat,.csv,.txt,.in"
          onChange={handleFileChange}
          className="hidden"
        />

        <div className="flex items-center space-x-3 mt-2">
          <label
            htmlFor="dataset-file-input"
            className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-md text-xs font-semibold cursor-pointer transition-colors shadow-sm"
          >
            {selectedFile ? selectedFile.name : 'Choose File...'}
          </label>

          {selectedFile && (
            <button
              id="btn-confirm-upload"
              onClick={handleUpload}
              disabled={isUploading}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white rounded-md text-xs font-semibold shadow-lg shadow-indigo-200 transition-colors disabled:opacity-50"
            >
              {isUploading ? 'Uploading...' : 'Upload & Parse Dataset'}
            </button>
          )}
        </div>

        {uploadMessage && (
          <div
            className={`mt-4 px-3 py-2 rounded-md text-xs flex items-center space-x-2 ${
              uploadMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            {uploadMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400" />
            )}
            <span>{uploadMessage.text}</span>
          </div>
        )}
      </div>

      {/* List of Uploaded Datasets */}
      <div className="flex flex-col gap-3">
        <h3 className="font-bold text-sm text-slate-200">Uploaded Datasets ({uploadedDatasets.length})</h3>

        {uploadedDatasets.length === 0 ? (
          <p className="text-xs text-slate-500 italic">No datasets uploaded yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {uploadedDatasets.map((ds) => (
              <div
                key={ds.id}
                className="bg-slate-800/80 border border-slate-700 rounded-xl p-3 flex flex-col justify-between space-y-2"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2">
                    <FileText className="w-4 h-4 text-indigo-400" />
                    <div>
                      <div className="font-bold text-xs text-white truncate max-w-[180px]">{ds.filename}</div>
                      <div className="text-[10px] text-slate-400">
                        {ds.type} • {ds.dataPointsCount} points • {(ds.sizeBytes / 1024).toFixed(1)} KB
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDeleteDataset(ds.id)}
                    className="p-1 text-slate-400 hover:text-rose-400 rounded transition-colors"
                    title="Delete dataset"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-700/60">
                  <span className="text-[10px] text-slate-400">Uploaded {new Date(ds.uploadDate).toLocaleTimeString()}</span>
                  <button
                    onClick={() => onSelectOverlay(ds.id)}
                    className="px-2.5 py-1 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/40 rounded-lg text-[11px] font-bold flex items-center space-x-1"
                  >
                    <Eye className="w-3 h-3" />
                    <span>Overlay on DCS Graph</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
