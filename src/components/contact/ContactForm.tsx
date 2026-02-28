import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, CheckCircle } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { useContactForm } from '@/hooks/useContactForm';
import { INQUIRY_TYPES } from '@/lib/constants';
import { cn } from '@/lib/utils';
import type { InquiryType } from '@/types';

const contactSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Valid email required'),
  phone: z.string().optional(),
  inquiryType: z.enum(['event_booking', 'retail', 'general', 'partnership']),
  message: z.string().min(10, 'Message must be at least 10 characters'),
});

type ContactFormData = z.infer<typeof contactSchema>;

export function ContactForm() {
  const { submitForm, loading, success, error, reset } = useContactForm();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
    reset: resetForm,
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      inquiryType: 'general',
    },
  });

  const selectedType = watch('inquiryType');

  async function onSubmit(data: ContactFormData) {
    await submitForm(data);
    if (!error) {
      resetForm();
    }
  }

  return (
    <AnimatePresence mode="wait">
      {success ? (
        <motion.div
          key="success"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          className="text-center py-12 bg-brand-gray rounded-xl border border-brand-gold/30 p-8"
        >
          <CheckCircle className="h-16 w-16 text-brand-gold mx-auto mb-4" />
          <h3 className="font-heading text-2xl font-bold uppercase text-white">
            Message Sent!
          </h3>
          <p className="text-brand-muted mt-2">
            We'll get back to you shortly. Thanks for reaching out.
          </p>
          <Button
            variant="outline-gold"
            className="mt-6"
            onClick={() => {
              reset();
              resetForm();
            }}
          >
            Send Another Message
          </Button>
        </motion.div>
      ) : (
        <motion.form
          key="form"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-6"
        >
          {/* Inquiry Type Selector */}
          <div>
            <label className="block text-sm font-medium text-brand-muted uppercase tracking-wider mb-3">
              What can we help with?
            </label>
            <div className="grid grid-cols-2 gap-2">
              {INQUIRY_TYPES.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setValue('inquiryType', type.value as InquiryType)}
                  className={cn(
                    'px-4 py-3 rounded-lg text-sm font-semibold uppercase tracking-wider transition-all duration-200 border',
                    selectedType === type.value
                      ? 'bg-brand-gold text-black border-brand-gold'
                      : 'bg-brand-dark text-brand-muted border-brand-gray-light hover:border-brand-gold/50 hover:text-white'
                  )}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          {/* Name & Email */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-brand-muted uppercase tracking-wider mb-2">
                Name
              </label>
              <Input
                {...register('name')}
                placeholder="Your name"
                error={errors.name?.message}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-muted uppercase tracking-wider mb-2">
                Email
              </label>
              <Input
                {...register('email')}
                type="email"
                placeholder="your@email.com"
                error={errors.email?.message}
              />
            </div>
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-brand-muted uppercase tracking-wider mb-2">
              Phone (optional)
            </label>
            <Input
              {...register('phone')}
              type="tel"
              placeholder="(555) 555-5555"
            />
          </div>

          {/* Message */}
          <div>
            <label className="block text-sm font-medium text-brand-muted uppercase tracking-wider mb-2">
              Message
            </label>
            <Textarea
              {...register('message')}
              placeholder={
                selectedType === 'event_booking'
                  ? 'Tell us about your event — date, size, vibe...'
                  : selectedType === 'retail'
                    ? 'Interested in K-Town Krack? Tell us more...'
                    : selectedType === 'partnership'
                      ? 'Tell us about your business and partnership ideas...'
                      : 'What\'s on your mind?'
              }
              error={errors.message?.message}
            />
          </div>

          {error && (
            <p className="text-brand-red text-sm">{error}</p>
          )}

          <Button
            type="submit"
            variant="gold"
            size="lg"
            className="w-full"
            isLoading={loading}
          >
            <Send className="h-4 w-4" />
            Send Message
          </Button>
        </motion.form>
      )}
    </AnimatePresence>
  );
}
