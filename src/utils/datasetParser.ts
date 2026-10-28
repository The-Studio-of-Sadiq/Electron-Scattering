import { UploadedDataset } from '../types';

// Parses a whitespace/comma/tab separated numeric dataset (x y [label] per line).
// Shared by the Express upload endpoint and the in-browser API fallback.
export function parseUploadedDataset(
  fileContent: string,
  originalName: string,
  sizeBytes: number,
  datasetType: UploadedDataset['type'] = 'dcs-comparison'
): UploadedDataset {
  const lines = fileContent.split('\n');
  const parsedData: Array<{ x: number; y: number; label?: string }> = [];
  const headerLines: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith('#') || line.startsWith('C') || line.startsWith('!')) {
      headerLines.push(line);
      continue;
    }

    // Split by space, comma, or tab
    const tokens = line.split(/[\s,\t]+/).filter(Boolean);
    if (tokens.length >= 2) {
      const x = parseFloat(tokens[0]);
      const y = parseFloat(tokens[1]);
      if (!isNaN(x) && !isNaN(y)) {
        parsedData.push({ x, y, label: tokens[2] || undefined });
      }
    }
  }

  return {
    id: `ds_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    filename: originalName,
    originalName,
    uploadDate: new Date().toISOString(),
    sizeBytes,
    type: datasetType,
    dataPointsCount: parsedData.length,
    parsedData,
    headerText: headerLines.join('\n') || 'Uploaded numeric dataset',
  };
}
