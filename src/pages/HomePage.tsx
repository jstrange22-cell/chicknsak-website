import { HeroSection } from '@/components/home/HeroSection';
import { FeaturedMenu } from '@/components/home/FeaturedMenu';
import { SpiceTeaser } from '@/components/home/SpiceTeaser';
import { PhotoGallery } from '@/components/home/PhotoGallery';
import { UpcomingEvents } from '@/components/home/UpcomingEvents';
import { LocationMap } from '@/components/home/LocationMap';
import { SocialSection } from '@/components/home/SocialSection';

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <FeaturedMenu />
      <SpiceTeaser />
      <PhotoGallery />
      <UpcomingEvents />
      <LocationMap />
      <SocialSection />
    </>
  );
}
