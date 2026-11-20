import { CongestionLevel, Station, StationImageKey } from '../types';

export const STATION_IMAGES: Record<StationImageKey, string> = {
  central: '/src/assets/images/station_kirkuk_central_1795160985045.jpg',
  university: '/src/assets/images/station_university_1795160985606.jpg',
  nozzle: '/src/assets/images/fuel_refuel_nozzle_1795160985251.jpg',
};

export const REFUEL_COMPLETE_IMAGE =
  '/src/assets/images/fuel_refuel_nozzle_1795160985251.jpg';

export function computeCongestion(queueCount: number, activePumps: number): CongestionLevel {
  const ratio = queueCount / Math.max(1, activePumps);
  if (ratio <= 2) return 'light';
  if (ratio <= 4.2) return 'moderate';
  return 'crowded';
}

export function computeWaitMinutes(queueCount: number, activePumps: number): number {
  if (queueCount <= 0) return 0;
  // Average 4.5 minutes per vehicle per active pump
  return Math.min(600, Math.max(2, Math.round((queueCount / Math.max(1, activePumps)) * 6)));
}

export const INITIAL_KIRKUK_STATIONS: Station[] = [
  {
    id: 'kirkuk-central',
    nameAr: 'محطة كركوك المركزية',
    nameEn: 'Kirkuk Central Station',
    districtAr: 'حي الوسط — طريق بغداد',
    type: 'government',
    imageKey: 'central',
    mapX: 52,
    mapY: 46,
    distanceKm: 1.2,
    rating: 4.8,
    hoursAr: 'من 6 صباحاً إلى 12 مساءً',
    contactPhone: '0770 123 4567',
    queueCount: 8,
    activePumps: 4,
    waitMinutes: 12,
    servedToday: 142,
    congestion: 'light',
    isOpen: true,
    fuels: {
      b91: { available: true, priceIqd: 450 },
      b95: { available: true, priceIqd: 850 },
      b98: { available: true, priceIqd: 1250 },
    },
  },
  {
    id: 'kirkuk-university',
    nameAr: 'محطة الجامعة',
    nameEn: 'University Fuel Station',
    districtAr: 'طريق جامعة كركوك — الصيادة',
    type: 'government',
    imageKey: 'university',
    mapX: 30,
    mapY: 66,
    distanceKm: 2.5,
    rating: 4.5,
    hoursAr: 'من 6 صباحاً إلى 11 مساءً',
    contactPhone: '0770 234 8890',
    queueCount: 12,
    activePumps: 3,
    waitMinutes: 24,
    servedToday: 118,
    congestion: 'moderate',
    isOpen: true,
    fuels: {
      b91: { available: true, priceIqd: 450 },
      b95: { available: true, priceIqd: 850 },
      b98: { available: false, priceIqd: 1250 },
    },
  },
  {
    id: 'kirkuk-industry',
    nameAr: 'محطة الصناعة',
    nameEn: 'Industrial Zone Station',
    districtAr: 'الحي الصناعي الجنوبي',
    type: 'private',
    imageKey: 'central',
    mapX: 73,
    mapY: 71,
    distanceKm: 3.1,
    rating: 4.2,
    hoursAr: 'مفتوح 24 ساعة',
    contactPhone: '0771 445 1920',
    queueCount: 19,
    activePumps: 4,
    waitMinutes: 29,
    servedToday: 205,
    congestion: 'crowded',
    isOpen: true,
    fuels: {
      b91: { available: false, priceIqd: 450 },
      b95: { available: true, priceIqd: 900 },
      b98: { available: true, priceIqd: 1300 },
    },
  },
  {
    id: 'kirkuk-sulaymaniyah',
    nameAr: 'محطة السليمانية',
    nameEn: 'Sulaymaniyah Road Station',
    districtAr: 'طريق السليمانية — رحيم آوه',
    type: 'private',
    imageKey: 'university',
    mapX: 68,
    mapY: 25,
    distanceKm: 2.8,
    rating: 4.7,
    hoursAr: 'من 5 صباحاً إلى 1 صباحاً',
    contactPhone: '0770 981 3340',
    queueCount: 5,
    activePumps: 5,
    waitMinutes: 6,
    servedToday: 96,
    congestion: 'light',
    isOpen: true,
    fuels: {
      b91: { available: true, priceIqd: 450 },
      b95: { available: true, priceIqd: 850 },
      b98: { available: true, priceIqd: 1250 },
    },
  },
  {
    id: 'kirkuk-freedom',
    nameAr: 'محطة الحرية',
    nameEn: 'Al-Hurriya Station',
    districtAr: 'شارع القدس — الشورجة',
    type: 'government',
    imageKey: 'central',
    mapX: 25,
    mapY: 31,
    distanceKm: 3.6,
    rating: 4.4,
    hoursAr: 'من 6 صباحاً إلى 10 مساءً',
    contactPhone: '0770 612 7701',
    queueCount: 9,
    activePumps: 4,
    waitMinutes: 14,
    servedToday: 89,
    congestion: 'moderate',
    isOpen: true,
    fuels: {
      b91: { available: true, priceIqd: 450 },
      b95: { available: true, priceIqd: 850 },
      b98: { available: false, priceIqd: 1250 },
    },
  },
];
