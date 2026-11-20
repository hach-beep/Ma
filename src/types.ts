export type FuelGradeKey = 'b91' | 'b95' | 'b98';

export type CongestionLevel = 'light' | 'moderate' | 'crowded';

export type StationType = 'government' | 'private';

export type StationImageKey = 'central' | 'university' | 'nozzle';

export type BookingStatus = 'waiting' | 'called' | 'completed' | 'cancelled';

export type NotificationKind =
  | 'queue_called'
  | 'queue_update'
  | 'booking_confirmed'
  | 'congestion_alert';

export type AppMode = 'driver' | 'staff' | 'display';

export type DriverTab = 'map' | 'booking' | 'favorites' | 'notifications' | 'profile';

export interface FuelGrade {
  available: boolean;
  priceIqd: number;
}

export interface Station {
  id: string;
  nameAr: string;
  nameEn: string;
  districtAr: string;
  type: StationType;
  imageKey: StationImageKey;
  mapX: number;
  mapY: number;
  distanceKm: number;
  rating: number;
  hoursAr: string;
  contactPhone: string;
  queueCount: number;
  activePumps: number;
  waitMinutes: number;
  servedToday: number;
  congestion: CongestionLevel;
  isOpen: boolean;
  fuels: Record<FuelGradeKey, FuelGrade>;
  updatedAt?: unknown;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  phone: string;
  vehiclePlate: string;
  preferredFuel: FuelGradeKey;
  role: 'driver';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface FavoriteStation {
  userId: string;
  stationId: string;
  stationNameAr: string;
  createdAt?: unknown;
}

export interface NotificationItem {
  id?: string;
  userId: string;
  stationId: string;
  titleAr: string;
  messageAr: string;
  kind: NotificationKind;
  pumpNumber: number;
  isRead: boolean;
  createdAt?: unknown;
}

export interface Booking {
  id?: string;
  userId: string;
  driverName: string;
  driverPhone: string;
  stationId: string;
  stationNameAr: string;
  ticketNumber: string;
  fuelType: FuelGradeKey;
  slotDate: string;
  slotTime: string;
  status: BookingStatus;
  pumpNumber: number;
  estimatedWaitMinutes: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

/**
 * Synchronized validation constraints matching firebase-blueprint.json & firestore.rules.
 */
export const BLUEPRINT_CONSTRAINTS = {
  idPattern: /^[a-zA-Z0-9_-]+$/,
  ticketPattern: /^#[0-9]{4,6}$/,
  maxIdLength: 128,
  maxStationIdLength: 64,
  maxNameLength: 100,
  maxDistrictLength: 80,
  maxEmailLength: 150,
  maxPhoneLength: 30,
  maxPlateLength: 30,
  maxHoursLength: 80,
  maxNotifTitleLength: 120,
  maxNotifMsgLength: 300,
  maxQueueCount: 500,
  minPumps: 1,
  maxPumps: 24,
  maxWaitMinutes: 600,
  maxPriceIqd: 50000,
} as const;

export const FUEL_LABELS: Record<FuelGradeKey, { ar: string; octane: string }> = {
  b91: { ar: 'بنزين 91', octane: '91' },
  b95: { ar: 'بنزين 95', octane: '95' },
  b98: { ar: 'بنزين 98 محسن', octane: '98' },
};

export const CONGESTION_META: Record<
  CongestionLevel,
  { labelAr: string; badgeTextClass: string; surfaceClass: string; dotColor: string }
> = {
  light: {
    labelAr: 'خفيف — انسيابي',
    badgeTextClass: 'text-[#15803D]',
    surfaceClass: 'bg-[#DCFCE7] border-[#86EFAC]',
    dotColor: '#16A34A',
  },
  moderate: {
    labelAr: 'متوسط',
    badgeTextClass: 'text-[#B45309]',
    surfaceClass: 'bg-[#FEF3C7] border-[#FCD34D]',
    dotColor: '#D97706',
  },
  crowded: {
    labelAr: 'مزدحم',
    badgeTextClass: 'text-[#B91C1C]',
    surfaceClass: 'bg-[#FEE2E2] border-[#FCA5A5]',
    dotColor: '#DC2626',
  },
};
