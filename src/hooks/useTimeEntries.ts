import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthContext } from '@/components/auth/AuthProvider';
import { logActivity } from '@/lib/activityLogger';
import type { TimeEntry, Geofence } from '@/types';

// Re-export location history hook so consumers can import from this module.
export { useLocationHistory } from '@/hooks/useLocationTracking';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Haversine formula – returns the distance in metres between two GPS points.
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6_371_000; // Earth's radius in metres
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Check whether a GPS position falls within a project geofence.
 * Returns `null` if there is no geofence or the geofence is disabled.
 * Otherwise returns `{ inside, distanceMeters }`.
 */
export function checkGeofence(
  latitude: number,
  longitude: number,
  geofence: Geofence | undefined,
): { inside: boolean; distanceMeters: number } | null {
  if (!geofence || !geofence.isEnabled) return null;

  const distance = haversineDistance(
    latitude,
    longitude,
    geofence.latitude,
    geofence.longitude,
  );

  return { inside: distance <= geofence.radiusMeters, distanceMeters: Math.round(distance) };
}

/** Returns Monday 00:00:00 through Sunday 23:59:59.999 for the week containing `date`. */
export function getWeekRange(date: Date): { start: Date; end: Date } {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sun, 1 = Mon, ...
  const diffToMonday = day === 0 ? -6 : 1 - day;

  const start = new Date(d);
  start.setDate(d.getDate() + diffToMonday);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

/** Capture current GPS position (web API). Resolves to coords or null. */
function captureGPS(): Promise<{ latitude: number; longitude: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  });
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Fetches the single currently-active time entry for the authenticated user. */
export function useActiveEntry() {
  const { user } = useAuthContext();
  const userId = user?.uid;

  return useQuery({
    queryKey: ['timeEntries', 'active', userId],
    queryFn: async (): Promise<TimeEntry | null> => {
      if (!userId) return null;

      const q = query(
        collection(db, 'timeEntries'),
        where('userId', '==', userId),
        where('status', '==', 'active'),
      );

      const snapshot = await getDocs(q);
      if (snapshot.empty) return null;

      const d = snapshot.docs[0];
      return { id: d.id, ...d.data() } as TimeEntry;
    },
    enabled: !!userId,
  });
}

/** Fetches time entries for the current user within a date range. */
export function useMyTimeEntries(startDate: Date, endDate: Date) {
  const { user } = useAuthContext();
  const userId = user?.uid;

  return useQuery({
    queryKey: ['timeEntries', 'my', userId, startDate.toISOString(), endDate.toISOString()],
    queryFn: async (): Promise<TimeEntry[]> => {
      if (!userId) return [];

      const startTs = Timestamp.fromDate(startDate);
      const endTs = Timestamp.fromDate(endDate);

      const q = query(
        collection(db, 'timeEntries'),
        where('userId', '==', userId),
        where('clockInTime', '>=', startTs),
        where('clockInTime', '<=', endTs),
      );

      const snapshot = await getDocs(q);
      const results = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as TimeEntry));
      results.sort((a, b) => {
        const aTime = (a.clockInTime as any)?.toDate?.()?.getTime() || 0;
        const bTime = (b.clockInTime as any)?.toDate?.()?.getTime() || 0;
        return bTime - aTime;
      });
      return results;
    },
    enabled: !!userId,
  });
}

/** Fetches time entries for all team members (admin/manager only). */
export function useTeamTimeEntries(startDate: Date, endDate: Date) {
  const { user, profile } = useAuthContext();
  const companyId = profile?.companyId;
  const isAllowed = profile?.role === 'admin' || profile?.role === 'manager';

  return useQuery({
    queryKey: ['timeEntries', 'team', companyId, startDate.toISOString(), endDate.toISOString()],
    queryFn: async (): Promise<TimeEntry[]> => {
      if (!companyId) return [];

      const startTs = Timestamp.fromDate(startDate);
      const endTs = Timestamp.fromDate(endDate);

      const q = query(
        collection(db, 'timeEntries'),
        where('companyId', '==', companyId),
        where('clockInTime', '>=', startTs),
        where('clockInTime', '<=', endTs),
      );

      const snapshot = await getDocs(q);
      const results = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as TimeEntry));
      results.sort((a, b) => {
        const aTime = (a.clockInTime as any)?.toDate?.()?.getTime() || 0;
        const bTime = (b.clockInTime as any)?.toDate?.()?.getTime() || 0;
        return bTime - aTime;
      });
      return results;
    },
    enabled: !!user?.uid && !!companyId && isAllowed,
  });
}

/** Returns total hours worked by the current user this week (Mon-Sun). */
export function useWeeklyHours() {
  const { user } = useAuthContext();
  const userId = user?.uid;
  const { start, end } = getWeekRange(new Date());

  return useQuery({
    queryKey: ['timeEntries', 'weeklyHours', userId, start.toISOString()],
    queryFn: async (): Promise<number> => {
      if (!userId) return 0;

      const startTs = Timestamp.fromDate(start);
      const endTs = Timestamp.fromDate(end);

      const q = query(
        collection(db, 'timeEntries'),
        where('userId', '==', userId),
        where('clockInTime', '>=', startTs),
        where('clockInTime', '<=', endTs),
      );

      const snapshot = await getDocs(q);
      let totalMinutes = 0;

      snapshot.docs.forEach((d) => {
        const entry = d.data() as Omit<TimeEntry, 'id'>;
        if (entry.durationMinutes != null) {
          totalMinutes += entry.durationMinutes - (entry.breakMinutes ?? 0);
        }
      });

      return Math.round((totalMinutes / 60) * 100) / 100;
    },
    enabled: !!userId,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** Result returned from the clockIn mutation, including geofence check info. */
export interface ClockInResult {
  id: string;
  geofenceCheck: { inside: boolean; distanceMeters: number } | null;
  [key: string]: unknown;
}

/** Clock in: creates a new active time entry with GPS coordinates. */
export function useClockIn() {
  const queryClient = useQueryClient();
  const { profile, user } = useAuthContext();

  return useMutation({
    mutationFn: async (data: {
      projectId?: string;
      notes?: string;
      /** If provided, the clock-in GPS will be checked against this geofence. */
      geofence?: Geofence;
    }): Promise<ClockInResult> => {
      if (!profile?.companyId || !user?.uid) {
        throw new Error('Not authenticated');
      }

      const gps = await captureGPS();

      // Geofence validation (non-blocking — we still clock in, but return the check result).
      let geofenceCheck: { inside: boolean; distanceMeters: number } | null = null;
      if (gps && data.geofence) {
        geofenceCheck = checkGeofence(gps.latitude, gps.longitude, data.geofence);
      }

      const entryData = {
        companyId: profile.companyId,
        userId: user.uid,
        projectId: data.projectId || null,
        clockInTime: serverTimestamp(),
        clockOutTime: null,
        durationMinutes: null,
        clockInLatitude: gps?.latitude ?? null,
        clockInLongitude: gps?.longitude ?? null,
        clockOutLatitude: null,
        clockOutLongitude: null,
        notes: data.notes || null,
        breakMinutes: 0,
        isManualEntry: false,
        approvedBy: null,
        approvedAt: null,
        status: 'active' as const,
        locationTrackingEnabled: !!gps,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, 'timeEntries'), entryData);

      await logActivity({
        companyId: profile.companyId,
        userId: user.uid,
        projectId: data.projectId,
        activityType: 'task_created',
        message: `${profile.fullName} clocked in`,
        entityType: 'timeEntry',
        entityId: docRef.id,
      });

      return { id: docRef.id, geofenceCheck, ...entryData };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeEntries'] });
    },
  });
}

/** Clock out: updates the active entry with clock-out time, duration, and GPS. */
export function useClockOut() {
  const queryClient = useQueryClient();
  const { profile, user } = useAuthContext();

  return useMutation({
    mutationFn: async (data: { entryId: string; clockInTime: Timestamp; breakMinutes?: number }) => {
      if (!profile?.companyId || !user?.uid) {
        throw new Error('Not authenticated');
      }

      const gps = await captureGPS();
      const now = new Date();
      const clockIn = data.clockInTime.toDate();
      const totalMinutes = Math.round((now.getTime() - clockIn.getTime()) / 60000);
      const breakMins = data.breakMinutes ?? 0;
      const durationMinutes = Math.max(0, totalMinutes - breakMins);

      const updateData = {
        clockOutTime: serverTimestamp(),
        clockOutLatitude: gps?.latitude ?? null,
        clockOutLongitude: gps?.longitude ?? null,
        durationMinutes,
        breakMinutes: breakMins,
        status: 'completed' as const,
        updatedAt: serverTimestamp(),
      };

      await updateDoc(doc(db, 'timeEntries', data.entryId), updateData);

      await logActivity({
        companyId: profile.companyId,
        userId: user.uid,
        activityType: 'task_completed',
        message: `${profile.fullName} clocked out (${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60}m)`,
        entityType: 'timeEntry',
        entityId: data.entryId,
      });

      return { id: data.entryId, ...updateData };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeEntries'] });
    },
  });
}

/** Create a manual time entry (admin/manager). */
export function useCreateManualEntry() {
  const queryClient = useQueryClient();
  const { profile, user } = useAuthContext();

  return useMutation({
    mutationFn: async (data: {
      userId: string;
      projectId?: string;
      clockInTime: Date;
      clockOutTime: Date;
      breakMinutes: number;
      notes?: string;
    }) => {
      if (!profile?.companyId || !user?.uid) {
        throw new Error('Not authenticated');
      }

      const totalMinutes = Math.round(
        (data.clockOutTime.getTime() - data.clockInTime.getTime()) / 60000,
      );
      const durationMinutes = Math.max(0, totalMinutes - data.breakMinutes);

      const entryData = {
        companyId: profile.companyId,
        userId: data.userId,
        projectId: data.projectId || null,
        clockInTime: Timestamp.fromDate(data.clockInTime),
        clockOutTime: Timestamp.fromDate(data.clockOutTime),
        durationMinutes,
        clockInLatitude: null,
        clockInLongitude: null,
        clockOutLatitude: null,
        clockOutLongitude: null,
        notes: data.notes || null,
        breakMinutes: data.breakMinutes,
        isManualEntry: true,
        approvedBy: null,
        approvedAt: null,
        status: 'completed' as const,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, 'timeEntries'), entryData);

      await logActivity({
        companyId: profile.companyId,
        userId: user.uid,
        activityType: 'task_created',
        message: `${profile.fullName} added a manual time entry`,
        entityType: 'timeEntry',
        entityId: docRef.id,
      });

      return { id: docRef.id, ...entryData };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeEntries'] });
    },
  });
}

/** Approve a completed time entry. */
export function useApproveEntry() {
  const queryClient = useQueryClient();
  const { profile, user } = useAuthContext();

  return useMutation({
    mutationFn: async (entryId: string) => {
      if (!profile?.companyId || !user?.uid) {
        throw new Error('Not authenticated');
      }

      await updateDoc(doc(db, 'timeEntries', entryId), {
        status: 'approved',
        approvedBy: user.uid,
        approvedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await logActivity({
        companyId: profile.companyId,
        userId: user.uid,
        activityType: 'task_completed',
        message: `${profile.fullName} approved a time entry`,
        entityType: 'timeEntry',
        entityId: entryId,
      });

      return entryId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeEntries'] });
    },
  });
}

/** Reject a completed time entry. */
export function useRejectEntry() {
  const queryClient = useQueryClient();
  const { profile, user } = useAuthContext();

  return useMutation({
    mutationFn: async (entryId: string) => {
      if (!profile?.companyId || !user?.uid) {
        throw new Error('Not authenticated');
      }

      await updateDoc(doc(db, 'timeEntries', entryId), {
        status: 'rejected',
        updatedAt: serverTimestamp(),
      });

      await logActivity({
        companyId: profile.companyId,
        userId: user.uid,
        activityType: 'task_completed',
        message: `${profile.fullName} rejected a time entry`,
        entityType: 'timeEntry',
        entityId: entryId,
      });

      return entryId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeEntries'] });
    },
  });
}

// Aliases for admin panel usage
export const useApproveTimeEntry = useApproveEntry;
export const useRejectTimeEntry = useRejectEntry;
