'use client';

import { useCallback, useRef, useState } from 'react';
import {
  Upload,
  FileText,
  Image,
  FileSpreadsheet,
  File,
  ExternalLink,
  Trash2,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import type { ProjectDocument } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DocumentUploadProps {
  documents: ProjectDocument[];
  onUpload: (file: File, description?: string) => void;
  onDelete: (doc: ProjectDocument) => void;
  isUploading?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

const ACCEPTED_EXTENSIONS =
  '.pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.heic';

function formatFileSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface FileTypeInfo {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  colorClass: string;
}

function getFileTypeInfo(fileType?: string, name?: string): FileTypeInfo {
  const ext = (
    fileType ??
    name?.split('.').pop() ??
    ''
  ).toLowerCase();

  if (ext === 'pdf' || ext === 'application/pdf') {
    return { icon: FileText, colorClass: 'text-red-500' };
  }

  if (['png', 'jpg', 'jpeg', 'heic', 'image/png', 'image/jpeg', 'image/heic'].includes(ext)) {
    return { icon: Image, colorClass: 'text-blue-500' };
  }

  if (
    ['doc', 'docx', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(ext)
  ) {
    return { icon: FileText, colorClass: 'text-blue-700' };
  }

  if (
    ['xls', 'xlsx', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'].includes(ext)
  ) {
    return { icon: FileSpreadsheet, colorClass: 'text-green-600' };
  }

  return { icon: File, colorClass: 'text-slate-500' };
}

function formatDate(timestamp: { toDate?: () => Date } | Date | string | number): string {
  let date: Date;

  if (timestamp && typeof timestamp === 'object' && 'toDate' in timestamp && typeof timestamp.toDate === 'function') {
    date = timestamp.toDate();
  } else {
    date = new Date(timestamp as string | number);
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DocumentUpload({
  documents,
  onUpload,
  onDelete,
  isUploading = false,
}: DocumentUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ---- File validation & submission ------------------------------------

  const processFile = useCallback(
    (file: File) => {
      setError(null);

      if (file.size > MAX_FILE_SIZE) {
        setError(`File "${file.name}" exceeds the 25 MB limit.`);
        return;
      }

      onUpload(file);
    },
    [onUpload],
  );

  // ---- Event handlers --------------------------------------------------

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);

      // Reset the input so the same file can be re-selected if needed.
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [processFile],
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const file = e.dataTransfer.files?.[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  const handleZoneClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // ---- Render ----------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* -------- Upload area -------- */}
      <Card className="rounded-xl">
        <CardContent className="p-0">
          <div
            role="button"
            tabIndex={0}
            onClick={handleZoneClick}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleZoneClick();
              }
            }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
              'flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 transition-colors cursor-pointer',
              isDragOver
                ? 'border-blue-500 bg-blue-50'
                : 'border-slate-300 bg-white hover:border-slate-400',
              isUploading && 'pointer-events-none opacity-60',
            )}
          >
            {isUploading ? (
              <>
                <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
                <p className="text-sm font-medium text-slate-700">
                  Uploading...
                </p>
              </>
            ) : (
              <>
                <Upload className="h-10 w-10 text-slate-400" />
                <div className="text-center">
                  <p className="text-sm font-medium text-slate-700">
                    Drop files here or click to upload
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    PDF, Images, Word, Excel up to 25MB
                  </p>
                </div>
              </>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_EXTENSIONS}
              onChange={handleFileChange}
              className="hidden"
              aria-label="Upload document"
            />
          </div>
        </CardContent>
      </Card>

      {/* -------- Error message -------- */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* -------- Document list -------- */}
      {documents.length > 0 ? (
        <Card className="rounded-xl">
          <CardContent className="divide-y divide-slate-100 p-0">
            {documents.map((doc) => {
              const { icon: TypeIcon, colorClass } = getFileTypeInfo(
                doc.fileType,
                doc.name,
              );

              return (
                <div
                  key={doc.id}
                  className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-slate-50"
                >
                  {/* File-type icon */}
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                    <TypeIcon className={cn('h-5 w-5', colorClass)} />
                  </div>

                  {/* Name + meta */}
                  <div className="min-w-0 flex-1">
                    <p className="max-w-xs truncate text-sm font-medium text-slate-900 sm:max-w-sm md:max-w-md">
                      {doc.name}
                    </p>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                      <span>{formatDate(doc.createdAt)}</span>
                      {doc.fileSizeBytes != null && (
                        <>
                          <span aria-hidden="true">&middot;</span>
                          <span>{formatFileSize(doc.fileSizeBytes)}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => window.open(doc.url, '_blank', 'noopener,noreferrer')}
                      aria-label={`View ${doc.name}`}
                    >
                      <ExternalLink className="h-4 w-4 text-slate-500" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete(doc)}
                      aria-label={`Delete ${doc.name}`}
                      className="hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4 text-slate-500 transition-colors group-hover:text-red-600" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : (
        /* -------- Empty state -------- */
        !isUploading && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="h-12 w-12 text-slate-300" />
            <p className="mt-3 text-sm font-medium text-slate-500">
              No documents yet
            </p>
          </div>
        )
      )}
    </div>
  );
}
