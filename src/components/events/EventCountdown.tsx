import { useState, useEffect } from 'react';
import type { SiteEvent } from '@/types';

interface EventCountdownProps {
  event: SiteEvent;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function calculateTimeLeft(targetDate: Date): TimeLeft | null {
  const diff = targetDate.getTime() - Date.now();
  if (diff <= 0) return null;

  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  };
}

export function EventCountdown({ event }: EventCountdownProps) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(() =>
    calculateTimeLeft(event.date.toDate())
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft(event.date.toDate()));
    }, 1000);
    return () => clearInterval(timer);
  }, [event.date]);

  if (!timeLeft) return null;

  const blocks = [
    { value: timeLeft.days, label: 'Days' },
    { value: timeLeft.hours, label: 'Hours' },
    { value: timeLeft.minutes, label: 'Min' },
    { value: timeLeft.seconds, label: 'Sec' },
  ];

  return (
    <div className="bg-brand-gray rounded-xl border border-brand-gray-light p-6 sm:p-8">
      <p className="text-sm text-brand-muted uppercase tracking-widest text-center mb-2">
        Next Event
      </p>
      <h3 className="font-heading text-2xl sm:text-3xl font-bold uppercase text-brand-gold text-center mb-6">
        {event.title}
      </h3>
      <div className="flex justify-center gap-3 sm:gap-6">
        {blocks.map((block) => (
          <div key={block.label} className="text-center">
            <span className="block font-heading text-3xl sm:text-5xl font-bold text-white">
              {String(block.value).padStart(2, '0')}
            </span>
            <span className="block text-[10px] sm:text-xs uppercase tracking-widest text-brand-muted mt-1">
              {block.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
