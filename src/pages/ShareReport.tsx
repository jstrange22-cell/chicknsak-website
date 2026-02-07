import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Loader2, Download, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import type { Report, ReportSection, Photo, Company } from '@/types';

function formatReportDate(date: unknown): string {
  if (!date) return '';
  // Handle Firestore Timestamp
  if (typeof date === 'object' && date !== null && 'toDate' in date) {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format((date as { toDate: () => Date }).toDate());
  }
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(date as string | number));
}

function SectionPhotos({
  section,
  photosMap,
}: {
  section: ReportSection;
  photosMap: Map<string, Photo>;
}) {
  const photos = section.photoIds
    .map((id) => photosMap.get(id))
    .filter((p): p is Photo => p !== undefined);

  if (photos.length === 0) return null;

  const layoutClass = cn(
    'grid gap-3',
    section.layout === 'single' && 'grid-cols-1',
    section.layout === 'grid' && 'grid-cols-2',
    section.layout === 'side-by-side' && 'grid-cols-2'
  );

  return (
    <div className={layoutClass}>
      {photos.map((photo) => (
        <div key={photo.id} className="overflow-hidden rounded-lg">
          <img
            src={photo.annotatedUrl || photo.url}
            alt={photo.description || section.title}
            className={cn(
              'w-full object-cover',
              section.layout === 'single' ? 'max-h-[600px]' : 'aspect-[4/3]'
            )}
            loading="lazy"
          />
          {photo.description && (
            <p className="mt-1.5 text-xs text-slate-500">{photo.description}</p>
          )}
        </div>
      ))}
    </div>
  );
}

export default function ShareReport() {
  const { token } = useParams<{ token: string }>();

  const [report, setReport] = useState<Report | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [photosMap, setPhotosMap] = useState<Map<string, Photo>>(new Map());
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!token) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    async function fetchReport() {
      try {
        // Query for the report by shareToken and published status
        const reportsRef = collection(db, 'reports');
        const q = query(
          reportsRef,
          where('shareToken', '==', token),
          where('status', '==', 'published')
        );
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
          setNotFound(true);
          setLoading(false);
          return;
        }

        const reportDoc = snapshot.docs[0];
        const reportData = { id: reportDoc.id, ...reportDoc.data() } as Report;
        setReport(reportData);

        // Fetch company for branding
        if (reportData.companyId) {
          try {
            const companyDoc = await getDoc(doc(db, 'companies', reportData.companyId));
            if (companyDoc.exists()) {
              setCompany({ id: companyDoc.id, ...companyDoc.data() } as Company);
            }
          } catch {
            // Company fetch is non-critical, continue without it
          }
        }

        // Collect all unique photo IDs across all sections
        const allPhotoIds = new Set<string>();
        reportData.sections.forEach((section) => {
          section.photoIds.forEach((id) => allPhotoIds.add(id));
        });

        // Batch fetch all photos
        if (allPhotoIds.size > 0) {
          const photoMap = new Map<string, Photo>();
          const photoIdArray = Array.from(allPhotoIds);

          // Firestore getDoc in parallel (batched to avoid excessive concurrent reads)
          const batchSize = 10;
          for (let i = 0; i < photoIdArray.length; i += batchSize) {
            const batch = photoIdArray.slice(i, i + batchSize);
            const promises = batch.map((photoId) =>
              getDoc(doc(db, 'photos', photoId))
            );
            const results = await Promise.all(promises);
            results.forEach((photoDoc) => {
              if (photoDoc.exists()) {
                photoMap.set(photoDoc.id, {
                  id: photoDoc.id,
                  ...photoDoc.data(),
                } as Photo);
              }
            });
          }

          setPhotosMap(photoMap);
        }
      } catch (error) {
        console.error('Error fetching shared report:', error);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }

    fetchReport();
  }, [token]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (notFound || !report) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4">
        <Building2 className="mb-4 h-12 w-12 text-slate-300" />
        <h1 className="text-xl font-semibold text-slate-700">Report not found</h1>
        <p className="mt-2 text-sm text-slate-500">
          This report is no longer available or the link may have expired.
        </p>
      </div>
    );
  }

  function handleDownloadPdf() {
    if (report?.pdfUrl) {
      window.open(report.pdfUrl, '_blank');
    } else {
      alert('PDF download coming soon');
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="mx-auto max-w-4xl px-4">
        {/* Report Document */}
        <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
          {/* Header */}
          <div className="border-b border-slate-100 px-8 py-8">
            {/* Company Branding */}
            {company && (
              <div className="mb-6 flex items-center gap-3">
                {company.logoUrl ? (
                  <img
                    src={company.logoUrl}
                    alt={company.name}
                    className="h-10 w-10 rounded-lg object-contain"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
                    <Building2 className="h-5 w-5 text-slate-400" />
                  </div>
                )}
                <span className="text-sm font-medium text-slate-600">
                  {company.name}
                </span>
              </div>
            )}

            {/* Report Title */}
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              {report.name}
            </h1>

            {report.coverTitle && (
              <p className="mt-2 text-lg text-slate-600">{report.coverTitle}</p>
            )}

            <div className="mt-4 flex items-center gap-4">
              <time className="text-sm text-slate-500">
                {formatReportDate(report.createdAt)}
              </time>
              {report.reportType && (
                <span className="rounded-full bg-slate-100 px-3 py-0.5 text-xs font-medium capitalize text-slate-600">
                  {report.reportType.replace('_', ' ')}
                </span>
              )}
            </div>
          </div>

          {/* Sections */}
          <div className="divide-y divide-slate-100">
            {report.sections.map((section, index) => (
              <div key={section.id || index} className="px-8 py-8">
                {section.title && (
                  <h2 className="mb-4 text-xl font-semibold text-slate-800">
                    {section.title}
                  </h2>
                )}

                <SectionPhotos section={section} photosMap={photosMap} />

                {section.notes && (
                  <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">
                    {section.notes}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="border-t border-slate-100 px-8 py-6">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-400">
                Generated by ProjectWorks
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadPdf}
              >
                <Download className="h-4 w-4" />
                Download PDF
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
