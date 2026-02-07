import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useSignDocument } from '@/hooks/useSignatures';
import { SignaturePad } from '@/components/signatures/SignaturePad';
import { Button } from '@/components/ui/Button';
import {
  Loader2,
  Building2,
  PenTool,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import type { Signature, Company } from '@/types';

type PageState = 'loading' | 'not_found' | 'already_signed' | 'signing' | 'success';

export default function SignDocument() {
  const { token } = useParams<{ token: string }>();
  const signDocument = useSignDocument();

  const [pageState, setPageState] = useState<PageState>('loading');
  const [signature, setSignature] = useState<Signature | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setPageState('not_found');
      return;
    }

    async function fetchSignature() {
      try {
        const signaturesRef = collection(db, 'signatures');
        const q = query(signaturesRef, where('shareToken', '==', token));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
          setPageState('not_found');
          return;
        }

        const sigDoc = snapshot.docs[0];
        const sigData = { id: sigDoc.id, ...sigDoc.data() } as Signature;
        setSignature(sigData);

        // Fetch company for branding
        if (sigData.companyId) {
          try {
            const companyDoc = await getDoc(doc(db, 'companies', sigData.companyId));
            if (companyDoc.exists()) {
              setCompany({ id: companyDoc.id, ...companyDoc.data() } as Company);
            }
          } catch {
            // Company fetch is non-critical
          }
        }

        if (sigData.status === 'signed') {
          setPageState('already_signed');
        } else if (sigData.status === 'expired' || sigData.status === 'declined') {
          setPageState('not_found');
        } else {
          setPageState('signing');
        }
      } catch (error) {
        console.error('Error fetching signature:', error);
        setPageState('not_found');
      }
    }

    fetchSignature();
  }, [token]);

  const handleSignatureSave = (dataUrl: string) => {
    setSignatureDataUrl(dataUrl);
  };

  const handleSignatureClear = () => {
    setSignatureDataUrl(null);
  };

  const handleSubmitSignature = async () => {
    if (!signature || !signatureDataUrl) return;
    setSubmitError(null);

    try {
      await signDocument.mutateAsync({
        signatureId: signature.id,
        signatureDataUrl,
      });
      setPageState('success');
    } catch (error) {
      console.error('Failed to submit signature:', error);
      setSubmitError('Failed to submit signature. Please try again.');
    }
  };

  // --- Loading State ---
  if (pageState === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  // --- Not Found State ---
  if (pageState === 'not_found') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4">
        <AlertCircle className="mb-4 h-12 w-12 text-slate-300" />
        <h1 className="text-xl font-semibold text-slate-700">
          Signature request not found
        </h1>
        <p className="mt-2 text-center text-sm text-slate-500">
          This signature request is no longer available or the link may have expired.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Company Header Bar */}
      {company && (
        <div className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
            {company.logoUrl ? (
              <img
                src={company.logoUrl}
                alt={company.name}
                className="h-8 w-8 rounded-lg object-contain"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100">
                <Building2 className="h-4 w-4 text-slate-400" />
              </div>
            )}
            <span className="text-sm font-medium text-slate-700">
              {company.name}
            </span>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-2xl px-4 py-8">
        {/* Already Signed State */}
        {pageState === 'already_signed' && signature && (
          <div className="flex flex-col items-center gap-4 rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle className="h-8 w-8 text-emerald-600" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">
              Already Signed
            </h1>
            <p className="text-sm text-slate-500">
              This document was signed by{' '}
              <span className="font-medium text-slate-700">
                {signature.signerName}
              </span>
              {signature.signedAt && (
                <>
                  {' '}on{' '}
                  {signature.signedAt.toDate().toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </>
              )}
              .
            </p>
            {signature.signatureData && (
              <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-4">
                <img
                  src={signature.signatureData}
                  alt="Signature"
                  className="h-24 w-auto"
                />
              </div>
            )}
          </div>
        )}

        {/* Signing State */}
        {pageState === 'signing' && signature && (
          <div className="space-y-6">
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                  <PenTool className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-slate-900">
                    Please sign below
                  </h1>
                  <p className="text-sm text-slate-500">
                    Signature requested for{' '}
                    <span className="font-medium text-slate-700">
                      {signature.signerName}
                    </span>
                  </p>
                </div>
              </div>

              <SignaturePad
                onSave={handleSignatureSave}
                onClear={handleSignatureClear}
              />

              {/* Signature preview */}
              {signatureDataUrl && (
                <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                  <p className="mb-2 text-xs font-medium text-emerald-700">
                    Signature preview:
                  </p>
                  <img
                    src={signatureDataUrl}
                    alt="Your signature"
                    className="h-16 w-auto rounded border border-emerald-200 bg-white"
                  />
                </div>
              )}

              {submitError && (
                <p className="mt-3 text-sm text-red-500">{submitError}</p>
              )}

              <div className="mt-6">
                <Button
                  className="w-full"
                  onClick={handleSubmitSignature}
                  disabled={!signatureDataUrl}
                  isLoading={signDocument.isPending}
                >
                  Submit Signature
                </Button>
              </div>
            </div>

            <p className="text-center text-xs text-slate-400">
              By signing, you confirm that you are{' '}
              <span className="font-medium">{signature.signerName}</span> and
              that this electronic signature is legally binding.
            </p>
          </div>
        )}

        {/* Success State */}
        {pageState === 'success' && (
          <div className="flex flex-col items-center gap-4 rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle className="h-8 w-8 text-emerald-600" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">
              Thank you!
            </h1>
            <p className="text-sm text-slate-500">
              Your signature has been recorded successfully.
              {signature?.signerName && (
                <>
                  {' '}Signed by{' '}
                  <span className="font-medium text-slate-700">
                    {signature.signerName}
                  </span>
                  .
                </>
              )}
            </p>
            {signatureDataUrl && (
              <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-4">
                <img
                  src={signatureDataUrl}
                  alt="Your signature"
                  className="h-20 w-auto"
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-2xl px-4 py-4">
          <p className="text-center text-xs text-slate-400">
            Powered by StructureWorks
          </p>
        </div>
      </div>
    </div>
  );
}
