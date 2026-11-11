import { localDateKey } from './dateKey';
import { AyahRange, SurahMemorizationState } from '../types';

export interface SurahMeta {
  number: number;
  nameAr: string;
  nameEn: string;
  totalAyahs: number;
  juzStart: number;
  place: 'makkah' | 'madinah';
}

export const TOTAL_QURAN_AYAHS = 6236;
export const TOTAL_QURAN_SURAHS = 114;
export const TOTAL_QURAN_JUZ = 30;

// Canonical dataset for all 114 Surahs of the Holy Quran
export const QURAN_SURAHS: SurahMeta[] = [
  { number: 1, nameAr: 'الفاتحة', nameEn: 'Al-Fatihah', totalAyahs: 7, juzStart: 1, place: 'makkah' },
  { number: 2, nameAr: 'البقرة', nameEn: 'Al-Baqarah', totalAyahs: 286, juzStart: 1, place: 'madinah' },
  { number: 3, nameAr: 'آل عمران', nameEn: 'Ali \'Imran', totalAyahs: 200, juzStart: 3, place: 'madinah' },
  { number: 4, nameAr: 'النساء', nameEn: 'An-Nisa', totalAyahs: 176, juzStart: 4, place: 'madinah' },
  { number: 5, nameAr: 'المائدة', nameEn: 'Al-Ma\'idah', totalAyahs: 120, juzStart: 6, place: 'madinah' },
  { number: 6, nameAr: 'الأنعام', nameEn: 'Al-An\'am', totalAyahs: 165, juzStart: 7, place: 'makkah' },
  { number: 7, nameAr: 'الأعراف', nameEn: 'Al-A\'raf', totalAyahs: 206, juzStart: 8, place: 'makkah' },
  { number: 8, nameAr: 'الأنفال', nameEn: 'Al-Anfal', totalAyahs: 75, juzStart: 9, place: 'madinah' },
  { number: 9, nameAr: 'التوبة', nameEn: 'At-Tawbah', totalAyahs: 129, juzStart: 10, place: 'madinah' },
  { number: 10, nameAr: 'يونس', nameEn: 'Yunus', totalAyahs: 109, juzStart: 11, place: 'makkah' },
  { number: 11, nameAr: 'هود', nameEn: 'Hud', totalAyahs: 123, juzStart: 11, place: 'makkah' },
  { number: 12, nameAr: 'يوسف', nameEn: 'Yusuf', totalAyahs: 111, juzStart: 12, place: 'makkah' },
  { number: 13, nameAr: 'الرعد', nameEn: 'Ar-Ra\'d', totalAyahs: 43, juzStart: 13, place: 'madinah' },
  { number: 14, nameAr: 'إبراهيم', nameEn: 'Ibrahim', totalAyahs: 52, juzStart: 13, place: 'makkah' },
  { number: 15, nameAr: 'الحجر', nameEn: 'Al-Hijr', totalAyahs: 99, juzStart: 14, place: 'makkah' },
  { number: 16, nameAr: 'النحل', nameEn: 'An-Nahl', totalAyahs: 128, juzStart: 14, place: 'makkah' },
  { number: 17, nameAr: 'الإسراء', nameEn: 'Al-Isra', totalAyahs: 111, juzStart: 15, place: 'makkah' },
  { number: 18, nameAr: 'الكهف', nameEn: 'Al-Kahf', totalAyahs: 110, juzStart: 15, place: 'makkah' },
  { number: 19, nameAr: 'مريم', nameEn: 'Maryam', totalAyahs: 98, juzStart: 16, place: 'makkah' },
  { number: 20, nameAr: 'طه', nameEn: 'Taha', totalAyahs: 135, juzStart: 16, place: 'makkah' },
  { number: 21, nameAr: 'الأنبياء', nameEn: 'Al-Anbiya', totalAyahs: 112, juzStart: 17, place: 'makkah' },
  { number: 22, nameAr: 'الحج', nameEn: 'Al-Hajj', totalAyahs: 78, juzStart: 17, place: 'madinah' },
  { number: 23, nameAr: 'المؤمنون', nameEn: 'Al-Mu\'minun', totalAyahs: 118, juzStart: 18, place: 'makkah' },
  { number: 24, nameAr: 'النور', nameEn: 'An-Nur', totalAyahs: 64, juzStart: 18, place: 'madinah' },
  { number: 25, nameAr: 'الفرقان', nameEn: 'Al-Furqan', totalAyahs: 77, juzStart: 18, place: 'makkah' },
  { number: 26, nameAr: 'الشعراء', nameEn: 'Ash-Shu\'ara', totalAyahs: 227, juzStart: 19, place: 'makkah' },
  { number: 27, nameAr: 'النمل', nameEn: 'An-Naml', totalAyahs: 93, juzStart: 19, place: 'makkah' },
  { number: 28, nameAr: 'القصص', nameEn: 'Al-Qasas', totalAyahs: 88, juzStart: 20, place: 'makkah' },
  { number: 29, nameAr: 'العنكبوت', nameEn: 'Al-\'Ankabut', totalAyahs: 69, juzStart: 20, place: 'makkah' },
  { number: 30, nameAr: 'الروم', nameEn: 'Ar-Rum', totalAyahs: 60, juzStart: 21, place: 'makkah' },
  { number: 31, nameAr: 'لقمان', nameEn: 'Luqman', totalAyahs: 34, juzStart: 21, place: 'makkah' },
  { number: 32, nameAr: 'السجدة', nameEn: 'As-Sajdah', totalAyahs: 30, juzStart: 21, place: 'makkah' },
  { number: 33, nameAr: 'الأحزاب', nameEn: 'Al-Ahzab', totalAyahs: 73, juzStart: 21, place: 'madinah' },
  { number: 34, nameAr: 'سبأ', nameEn: 'Saba', totalAyahs: 54, juzStart: 22, place: 'makkah' },
  { number: 35, nameAr: 'فاطر', nameEn: 'Fatir', totalAyahs: 45, juzStart: 22, place: 'makkah' },
  { number: 36, nameAr: 'يس', nameEn: 'Ya-Sin', totalAyahs: 83, juzStart: 22, place: 'makkah' },
  { number: 37, nameAr: 'الصافات', nameEn: 'As-Saffat', totalAyahs: 182, juzStart: 23, place: 'makkah' },
  { number: 38, nameAr: 'ص', nameEn: 'Sad', totalAyahs: 88, juzStart: 23, place: 'makkah' },
  { number: 39, nameAr: 'الزمر', nameEn: 'Az-Zumar', totalAyahs: 75, juzStart: 23, place: 'makkah' },
  { number: 40, nameAr: 'غافر', nameEn: 'Ghafir', totalAyahs: 85, juzStart: 24, place: 'makkah' },
  { number: 41, nameAr: 'فصلت', nameEn: 'Fussilat', totalAyahs: 54, juzStart: 24, place: 'makkah' },
  { number: 42, nameAr: 'الشورى', nameEn: 'Ash-Shura', totalAyahs: 53, juzStart: 25, place: 'makkah' },
  { number: 43, nameAr: 'الزخرف', nameEn: 'Az-Zukhruf', totalAyahs: 89, juzStart: 25, place: 'makkah' },
  { number: 44, nameAr: 'الدخان', nameEn: 'Ad-Dukhan', totalAyahs: 59, juzStart: 25, place: 'makkah' },
  { number: 45, nameAr: 'الجاثية', nameEn: 'Al-Jathiyah', totalAyahs: 37, juzStart: 25, place: 'makkah' },
  { number: 46, nameAr: 'الأحقاف', nameEn: 'Al-Ahqaf', totalAyahs: 35, juzStart: 26, place: 'makkah' },
  { number: 47, nameAr: 'محمد', nameEn: 'Muhammad', totalAyahs: 38, juzStart: 26, place: 'madinah' },
  { number: 48, nameAr: 'الفتح', nameEn: 'Al-Fath', totalAyahs: 29, juzStart: 26, place: 'madinah' },
  { number: 49, nameAr: 'الحجرات', nameEn: 'Al-Hujurat', totalAyahs: 18, juzStart: 26, place: 'madinah' },
  { number: 50, nameAr: 'ق', nameEn: 'Qaf', totalAyahs: 45, juzStart: 26, place: 'makkah' },
  { number: 51, nameAr: 'الذاريات', nameEn: 'Adh-Dhariyat', totalAyahs: 60, juzStart: 26, place: 'makkah' },
  { number: 52, nameAr: 'الطور', nameEn: 'At-Tur', totalAyahs: 49, juzStart: 27, place: 'makkah' },
  { number: 53, nameAr: 'النجم', nameEn: 'An-Najm', totalAyahs: 62, juzStart: 27, place: 'makkah' },
  { number: 54, nameAr: 'القمر', nameEn: 'Al-Qamar', totalAyahs: 55, juzStart: 27, place: 'makkah' },
  { number: 55, nameAr: 'الرحمن', nameEn: 'Ar-Rahman', totalAyahs: 78, juzStart: 27, place: 'madinah' },
  { number: 56, nameAr: 'الواقعة', nameEn: 'Al-Waqi\'ah', totalAyahs: 96, juzStart: 27, place: 'makkah' },
  { number: 57, nameAr: 'الحديد', nameEn: 'Al-Hadid', totalAyahs: 29, juzStart: 27, place: 'madinah' },
  { number: 58, nameAr: 'المجادلة', nameEn: 'Al-Mujadilah', totalAyahs: 22, juzStart: 28, place: 'madinah' },
  { number: 59, nameAr: 'الحشر', nameEn: 'Al-Hashr', totalAyahs: 24, juzStart: 28, place: 'madinah' },
  { number: 60, nameAr: 'الممتحنة', nameEn: 'Al-Mumtahanah', totalAyahs: 13, juzStart: 28, place: 'madinah' },
  { number: 61, nameAr: 'الصف', nameEn: 'As-Saff', totalAyahs: 14, juzStart: 28, place: 'madinah' },
  { number: 62, nameAr: 'الجمعة', nameEn: 'Al-Jumu\'ah', totalAyahs: 11, juzStart: 28, place: 'madinah' },
  { number: 63, nameAr: 'المنافقون', nameEn: 'Al-Munafiqun', totalAyahs: 11, juzStart: 28, place: 'madinah' },
  { number: 64, nameAr: 'التغابن', nameEn: 'At-Taghabun', totalAyahs: 18, juzStart: 28, place: 'madinah' },
  { number: 65, nameAr: 'الطلاق', nameEn: 'At-Talaq', totalAyahs: 12, juzStart: 28, place: 'madinah' },
  { number: 66, nameAr: 'التحريم', nameEn: 'At-Tahrim', totalAyahs: 12, juzStart: 28, place: 'madinah' },
  { number: 67, nameAr: 'الملك', nameEn: 'Al-Mulk', totalAyahs: 30, juzStart: 29, place: 'makkah' },
  { number: 68, nameAr: 'القلم', nameEn: 'Al-Qalam', totalAyahs: 52, juzStart: 29, place: 'makkah' },
  { number: 69, nameAr: 'الحاقة', nameEn: 'Al-Haqqah', totalAyahs: 52, juzStart: 29, place: 'makkah' },
  { number: 70, nameAr: 'المعارج', nameEn: 'Al-Ma\'arij', totalAyahs: 44, juzStart: 29, place: 'makkah' },
  { number: 71, nameAr: 'نوح', nameEn: 'Nuh', totalAyahs: 28, juzStart: 29, place: 'makkah' },
  { number: 72, nameAr: 'الجن', nameEn: 'Al-Jinn', totalAyahs: 28, juzStart: 29, place: 'makkah' },
  { number: 73, nameAr: 'المزمل', nameEn: 'Al-Muzzammil', totalAyahs: 20, juzStart: 29, place: 'makkah' },
  { number: 74, nameAr: 'المدثر', nameEn: 'Al-Muddaththir', totalAyahs: 56, juzStart: 29, place: 'makkah' },
  { number: 75, nameAr: 'القيامة', nameEn: 'Al-Qiyamah', totalAyahs: 40, juzStart: 29, place: 'makkah' },
  { number: 76, nameAr: 'الإنسان', nameEn: 'Al-Insan', totalAyahs: 31, juzStart: 29, place: 'madinah' },
  { number: 77, nameAr: 'المرسلات', nameEn: 'Al-Mursalat', totalAyahs: 50, juzStart: 29, place: 'makkah' },
  { number: 78, nameAr: 'النبأ', nameEn: 'An-Naba', totalAyahs: 40, juzStart: 30, place: 'makkah' },
  { number: 79, nameAr: 'النازعات', nameEn: 'An-Nazi\'at', totalAyahs: 46, juzStart: 30, place: 'makkah' },
  { number: 80, nameAr: 'عبس', nameEn: '\'Abasa', totalAyahs: 42, juzStart: 30, place: 'makkah' },
  { number: 81, nameAr: 'التكوير', nameEn: 'At-Takwir', totalAyahs: 29, juzStart: 30, place: 'makkah' },
  { number: 82, nameAr: 'الانفطار', nameEn: 'Al-Infitar', totalAyahs: 19, juzStart: 30, place: 'makkah' },
  { number: 83, nameAr: 'المطففين', nameEn: 'Al-Mutaffifin', totalAyahs: 36, juzStart: 30, place: 'makkah' },
  { number: 84, nameAr: 'الانشقاق', nameEn: 'Al-Inshiqaq', totalAyahs: 25, juzStart: 30, place: 'makkah' },
  { number: 85, nameAr: 'البروج', nameEn: 'Al-Buruj', totalAyahs: 22, juzStart: 30, place: 'makkah' },
  { number: 86, nameAr: 'الطارق', nameEn: 'At-Tariq', totalAyahs: 17, juzStart: 30, place: 'makkah' },
  { number: 87, nameAr: 'الأعلى', nameEn: 'Al-A\'la', totalAyahs: 19, juzStart: 30, place: 'makkah' },
  { number: 88, nameAr: 'الغاشية', nameEn: 'Al-Ghashiyah', totalAyahs: 26, juzStart: 30, place: 'makkah' },
  { number: 89, nameAr: 'الفجر', nameEn: 'Al-Fajr', totalAyahs: 30, juzStart: 30, place: 'makkah' },
  { number: 90, nameAr: 'البلد', nameEn: 'Al-Balad', totalAyahs: 20, juzStart: 30, place: 'makkah' },
  { number: 91, nameAr: 'الشمس', nameEn: 'Ash-Shams', totalAyahs: 15, juzStart: 30, place: 'makkah' },
  { number: 92, nameAr: 'الليل', nameEn: 'Al-Layl', totalAyahs: 21, juzStart: 30, place: 'makkah' },
  { number: 93, nameAr: 'الضحى', nameEn: 'Ad-Duha', totalAyahs: 11, juzStart: 30, place: 'makkah' },
  { number: 94, nameAr: 'الشرح', nameEn: 'Ash-Sharh', totalAyahs: 8, juzStart: 30, place: 'makkah' },
  { number: 95, nameAr: 'التين', nameEn: 'At-Tin', totalAyahs: 8, juzStart: 30, place: 'makkah' },
  { number: 96, nameAr: 'العلق', nameEn: 'Al-\'Alaq', totalAyahs: 19, juzStart: 30, place: 'makkah' },
  { number: 97, nameAr: 'القدر', nameEn: 'Al-Qadr', totalAyahs: 5, juzStart: 30, place: 'makkah' },
  { number: 98, nameAr: 'البينة', nameEn: 'Al-Bayyinah', totalAyahs: 8, juzStart: 30, place: 'madinah' },
  { number: 99, nameAr: 'الزلزلة', nameEn: 'Az-Zalzalah', totalAyahs: 8, juzStart: 30, place: 'madinah' },
  { number: 100, nameAr: 'العاديات', nameEn: 'Al-\'Adiyat', totalAyahs: 11, juzStart: 30, place: 'makkah' },
  { number: 101, nameAr: 'القارعة', nameEn: 'Al-Qari\'ah', totalAyahs: 11, juzStart: 30, place: 'makkah' },
  { number: 102, nameAr: 'التكاثر', nameEn: 'At-Takathur', totalAyahs: 8, juzStart: 30, place: 'makkah' },
  { number: 103, nameAr: 'العصر', nameEn: 'Al-\'Asr', totalAyahs: 3, juzStart: 30, place: 'makkah' },
  { number: 104, nameAr: 'الهمزة', nameEn: 'Al-Humazah', totalAyahs: 9, juzStart: 30, place: 'makkah' },
  { number: 105, nameAr: 'الفيل', nameEn: 'Al-Fil', totalAyahs: 5, juzStart: 30, place: 'makkah' },
  { number: 106, nameAr: 'قريش', nameEn: 'Quraysh', totalAyahs: 4, juzStart: 30, place: 'makkah' },
  { number: 107, nameAr: 'الماعون', nameEn: 'Al-Ma\'un', totalAyahs: 7, juzStart: 30, place: 'makkah' },
  { number: 108, nameAr: 'الكوثر', nameEn: 'Al-Kawthar', totalAyahs: 3, juzStart: 30, place: 'makkah' },
  { number: 109, nameAr: 'الكافرون', nameEn: 'Al-Kafirun', totalAyahs: 6, juzStart: 30, place: 'makkah' },
  { number: 110, nameAr: 'النصر', nameEn: 'An-Nasr', totalAyahs: 3, juzStart: 30, place: 'madinah' },
  { number: 111, nameAr: 'المسد', nameEn: 'Al-Masad', totalAyahs: 5, juzStart: 30, place: 'makkah' },
  { number: 112, nameAr: 'الإخلاص', nameEn: 'Al-Ikhlas', totalAyahs: 4, juzStart: 30, place: 'makkah' },
  { number: 113, nameAr: 'الفلق', nameEn: 'Al-Falaq', totalAyahs: 5, juzStart: 30, place: 'makkah' },
  { number: 114, nameAr: 'الناس', nameEn: 'An-Nas', totalAyahs: 6, juzStart: 30, place: 'makkah' }
];

export const getSurahMeta = (surahNumber: number): SurahMeta => {
  const found = QURAN_SURAHS.find((s) => s.number === surahNumber);
  return (
    found || {
      number: surahNumber,
      nameAr: `سورة ${surahNumber}`,
      nameEn: `Surah ${surahNumber}`,
      totalAyahs: 7,
      juzStart: 1,
      place: 'makkah'
    }
  );
};

// =========================================================================
// Deduplication Engine: Strict Non-Overlapping Ayah Intervals Union
// Guarantees no ayahs are double-counted in memorization records
// =========================================================================
export const mergeAyahRanges = (existingRanges: AyahRange[], newRange: AyahRange): AyahRange[] => {
  const sanitizedStart = Math.min(newRange.start, newRange.end);
  const sanitizedEnd = Math.max(newRange.start, newRange.end);

  const all = [...existingRanges, { start: sanitizedStart, end: sanitizedEnd }]
    .filter((r) => r.start > 0 && r.end >= r.start)
    .sort((a, b) => a.start - b.start);

  if (all.length === 0) return [];

  const merged: AyahRange[] = [all[0]];

  for (let i = 1; i < all.length; i++) {
    const current = all[i];
    const prev = merged[merged.length - 1];

    // If current overlaps or is immediately adjacent (e.g. 1-10 and 11-20), merge them
    if (current.start <= prev.end + 1) {
      prev.end = Math.max(prev.end, current.end);
    } else {
      merged.push({ start: current.start, end: current.end });
    }
  }

  return merged;
};

// Calculate strictly distinct ayahs from disjoint ranges
export const calculateDistinctAyahs = (ranges: AyahRange[]): number => {
  return ranges.reduce((acc, r) => acc + Math.max(0, r.end - r.start + 1), 0);
};

// Generate default tracking state for all 114 Surahs
export const generateInitialQuranSurahs = (): SurahMemorizationState[] => {
  const states: SurahMemorizationState[] = QURAN_SURAHS.map((s) => {
    // Initial sample seed: Surah Al-Fatihah memorized, An-Nas memorized, Al-Baqarah started
    if (s.number === 1) {
      return {
        surahNumber: 1,
        status: 'completed',
        memorizedAyahsRanges: [{ start: 1, end: 7 }],
        memorizedAyahsCount: 7,
        lastReviewedDate: localDateKey(),
        masteryRating: 5,
        notes: 'متقنة تماماً كالفاتحة'
      };
    }
    if (s.number === 114) {
      return {
        surahNumber: 114,
        status: 'completed',
        memorizedAyahsRanges: [{ start: 1, end: 6 }],
        memorizedAyahsCount: 6,
        lastReviewedDate: localDateKey(),
        masteryRating: 5
      };
    }
    if (s.number === 113) {
      return {
        surahNumber: 113,
        status: 'completed',
        memorizedAyahsRanges: [{ start: 1, end: 5 }],
        memorizedAyahsCount: 5,
        lastReviewedDate: localDateKey(),
        masteryRating: 5
      };
    }
    if (s.number === 112) {
      return {
        surahNumber: 112,
        status: 'completed',
        memorizedAyahsRanges: [{ start: 1, end: 4 }],
        memorizedAyahsCount: 4,
        lastReviewedDate: localDateKey(),
        masteryRating: 5
      };
    }
    if (s.number === 2) {
      return {
        surahNumber: 2,
        status: 'in_progress',
        memorizedAyahsRanges: [{ start: 1, end: 25 }],
        memorizedAyahsCount: 25,
        lastReviewedDate: localDateKey(),
        masteryRating: 4,
        notes: 'أول حزب من البقرة'
      };
    }
    if (s.number === 67) {
      return {
        surahNumber: 67,
        status: 'in_progress',
        memorizedAyahsRanges: [{ start: 1, end: 15 }],
        memorizedAyahsCount: 15,
        lastReviewedDate: localDateKey(),
        masteryRating: 4
      };
    }

    return {
      surahNumber: s.number,
      status: 'not_started',
      memorizedAyahsRanges: [],
      memorizedAyahsCount: 0
    };
  });

  return states;
};

