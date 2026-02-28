import { HeroSection } from '@/components/home/HeroSection';
import { FeaturedMenu } from '@/components/home/FeaturedMenu';
import { SpiceTeaser } from '@/components/home/SpiceTeaser';
import { UpcomingEvents } from '@/components/home/UpcomingEvents';

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <FeaturedMenu />
      <SpiceTeaser />
      <UpcomingEvents />
    </>
  );
}
