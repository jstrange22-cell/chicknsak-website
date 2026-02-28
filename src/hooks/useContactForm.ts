import { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { InquiryType } from '@/types';

interface ContactFormData {
  name: string;
  email: string;
  phone?: string;
  inquiryType: InquiryType;
  message: string;
}

export function useContactForm() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submitForm(data: ContactFormData) {
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      await addDoc(collection(db, 'leads'), {
        ...data,
        status: 'new',
        createdAt: serverTimestamp(),
      });
      setSuccess(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to submit form. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setSuccess(false);
    setError(null);
  }

  return { submitForm, loading, success, error, reset };
}
