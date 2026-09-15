import { useState, useRef, useEffect } from 'react';
import { useI18n } from '../i18n';
import { importWorkout } from '../api/workouts';
import { ApiError } from '../api/client';
import type { WorkoutImportResponse } from '../types';

interface DocumentUploadDropzoneProps {
  onSuccess: (response: WorkoutImportResponse) => void;
}

export function DocumentUploadDropzone({ onSuccess }: DocumentUploadDropzoneProps) {
  const { t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const loadingMessages = [
    t.createWorkout.importingState1,
    t.createWorkout.importingState2,
    t.createWorkout.importingState3,
  ];

  useEffect(() => {
    if (!loading) return;

    const interval = setInterval(() => {
      setLoadingStep((prev) => (prev < loadingMessages.length - 1 ? prev + 1 : prev));
    }, 3500);

    return () => clearInterval(interval);
  }, [loading, loadingMessages.length]);


  const handleFileChange = (file: File | null) => {
    setError(null);
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      setError(t.createWorkout.importErrorTooLarge);
      return;
    }

    setSelectedFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleStartImport = async () => {
    if (!selectedFile || loading) return;

    setLoading(true);
    setError(null);
    setLoadingStep(0);

    try {
      const result = await importWorkout(selectedFile);
      onSuccess(result);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 422) {
          setError(t.createWorkout.importErrorUnreadable);
        } else {
          setError(err.message || t.createWorkout.importErrorGeneric);
        }
      } else {
        setError(t.createWorkout.importErrorGeneric);
      }
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.toLowerCase().split('.').pop();
    if (ext === 'pdf') return '📄';
    if (['xlsx', 'xls', 'csv'].includes(ext || '')) return '📊';
    return '🖼️';
  };

  return (
    <div className="import-dropzone-container">
      <div className="import-header">
        <h3 className="import-title">{t.createWorkout.importTitle}</h3>
        <p className="import-subtitle">{t.createWorkout.importSubtitle}</p>
      </div>

      <p className="import-ai-disclaimer" role="note">
        <span aria-hidden="true">⚠️</span> {t.createWorkout.aiDisclaimerNotice}
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf, image/*, .xlsx, .xls, .csv"
        className="visually-hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            handleFileChange(e.target.files[0]);
          }
        }}
        disabled={loading}
      />

      {!selectedFile && (
        <div
          role="button"
          tabIndex={0}
          className={`dropzone-box ${dragOver ? 'drag-over' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
        >
          <div className="dropzone-icon">📁</div>
          <p className="dropzone-prompt">{t.createWorkout.importDropzone}</p>
          <span className="dropzone-badge">{t.createWorkout.importAcceptedFormats}</span>
        </div>
      )}

      {selectedFile && !loading && (
        <div className="selected-file-card">
          <div className="selected-file-info">
            <span className="selected-file-icon">{getFileIcon(selectedFile.name)}</span>
            <div className="selected-file-text">
              <span className="selected-file-name">{selectedFile.name}</span>
              <span className="selected-file-size">{formatFileSize(selectedFile.size)}</span>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-small btn-secondary"
            onClick={() => fileInputRef.current?.click()}
          >
            {t.createWorkout.importChangeFile}
          </button>
        </div>
      )}

      {loading && (
        <div className="import-loading-box">
          <div className="import-loading-spinner" />
          <div className="import-loading-steps">
            <p className="import-loading-current-text">{loadingMessages[loadingStep]}</p>
            <div className="import-loading-progress-dots">
              {loadingMessages.map((msg, idx) => (
                <span
                  key={msg}
                  className={`loading-dot ${idx === loadingStep ? 'active' : idx < loadingStep ? 'done' : ''}`}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {error && <p className="field-error" style={{ marginTop: 12 }}>{error}</p>}

      {selectedFile && !loading && (
        <button
          type="button"
          className="btn btn-primary import-submit-btn"
          onClick={handleStartImport}
        >
          {t.createWorkout.importSubmit}
        </button>
      )}
    </div>
  );
}
