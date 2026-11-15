import { MuscleMovement, FitnessDifficulty, HomeEquipment, ExerciseEntry } from '../types';

/**
 * Single source of truth for the built-in home exercise catalog.
 * Shared by WorkoutAppModal (dashboard/habits entry point) and the Workout
 * Studio so the library is never duplicated or allowed to drift.
 */
export interface PrebuiltExercise {
  id: string;
  nameAr: string;
  nameEn: string;
  movement: MuscleMovement;
  difficulty: FitnessDifficulty;
  equipment: HomeEquipment;
  defaultReps: number;
  tipsAr: string;
}

export const EXERCISE_CATALOG: PrebuiltExercise[] = [
  {
    id: 'cat-push-1',
    nameAr: 'تمرين الضغط القياسي (Standard Push-ups)',
    nameEn: 'Standard Push-ups',
    movement: 'push',
    difficulty: 'intermediate',
    equipment: 'bodyweight_only',
    defaultReps: 15,
    tipsAr: 'حافظ على استقامة الجذع واقتراب المرفقين بزاوية 45 درجة من الجسم.'
  },
  {
    id: 'cat-push-2',
    nameAr: 'ضغط الماس للذراعين (Diamond Push-ups)',
    nameEn: 'Diamond Push-ups',
    movement: 'push',
    difficulty: 'advanced',
    equipment: 'bodyweight_only',
    defaultReps: 10,
    tipsAr: 'تلامس الإبهامين والسبابتين يركز الجهد على الترايسبس والجزء الداخلي للصدر.'
  },
  {
    id: 'cat-push-3',
    nameAr: 'تغطيس الكرسي (Chair Dips)',
    nameEn: 'Chair Tricep Dips',
    movement: 'push',
    difficulty: 'beginner',
    equipment: 'chair_elevated',
    defaultReps: 12,
    tipsAr: 'استند على كرسي منزلي ثابت مع النزول بزاوية 90 درجة للمرفق.'
  },
  {
    id: 'cat-legs-1',
    nameAr: 'القرفصاء الحرة (Bodyweight Air Squats)',
    nameEn: 'Bodyweight Air Squats',
    movement: 'legs',
    difficulty: 'beginner',
    equipment: 'bodyweight_only',
    defaultReps: 20,
    tipsAr: 'اجعل وزنك على الكعبين وانزل حتى يتوازى الفخذان مع الأرض.'
  },
  {
    id: 'cat-legs-2',
    nameAr: 'السكوات البلغاري الأحادي (Bulgarian Split Squats)',
    nameEn: 'Bulgarian Split Squats',
    movement: 'legs',
    difficulty: 'intermediate',
    equipment: 'chair_elevated',
    defaultReps: 12,
    tipsAr: 'ضع ساقك الخلفية على طرف كرسي وركّز الوزن على فخذ الساق الأمامية.'
  },
  {
    id: 'cat-legs-3',
    nameAr: 'جسر الحوض (Glute Bridges)',
    nameEn: 'Glute Bridges',
    movement: 'legs',
    difficulty: 'beginner',
    equipment: 'mat',
    defaultReps: 20,
    tipsAr: 'ارفع الحوض واثبت ثانية في الأعلى لتفعيل عضلات الألوية وأسفل الظهر.'
  },
  {
    id: 'cat-core-1',
    nameAr: 'بلانك الثبات للجذع (Plank Core Hold)',
    nameEn: 'Plank Core Hold',
    movement: 'core',
    difficulty: 'intermediate',
    equipment: 'mat',
    defaultReps: 45,
    tipsAr: 'شد عضلات البطن والأرداف دون رفع أو خفض أسفل الظهر.'
  },
  {
    id: 'cat-core-2',
    nameAr: 'تسلق الجبل الحركي (Mountain Climbers)',
    nameEn: 'Mountain Climbers',
    movement: 'core',
    difficulty: 'intermediate',
    equipment: 'bodyweight_only',
    defaultReps: 25,
    tipsAr: 'سحب الركبتين بالتناوب نحو الصدر بوتيرة ثابتة.'
  },
  {
    id: 'cat-core-3',
    nameAr: 'رفع الأرجل لأسفل البطن (Lying Leg Raises)',
    nameEn: 'Lying Leg Raises',
    movement: 'core',
    difficulty: 'intermediate',
    equipment: 'mat',
    defaultReps: 15,
    tipsAr: 'الصعود والنزول ببطء مع تثبيت أسفل الظهر ملامساً للأرض.'
  },
  {
    id: 'cat-mob-1',
    nameAr: 'إطالة القطة والبقرة (Cat-Cow Stretch)',
    nameEn: 'Cat-Cow Spinal Mobility',
    movement: 'mobility',
    difficulty: 'beginner',
    equipment: 'mat',
    defaultReps: 15,
    tipsAr: 'تنفس بعمق مع تقويس وبسط العمود الفقري لتحرير التوتر المتراكم.'
  },
  {
    id: 'cat-mob-2',
    nameAr: 'إطالة الحوض والورك (Hip Flexor Stretch)',
    nameEn: 'Deep Hip Flexor Stretch',
    movement: 'mobility',
    difficulty: 'beginner',
    equipment: 'mat',
    defaultReps: 30,
    tipsAr: 'ممتاز لمعالجة قصر عضلات الحوض الناتج عن الجلوس المكتبي.'
  },
  {
    id: 'cat-mob-3',
    nameAr: 'وضعية الطفل للاسترخاء (Child’s Pose)',
    nameEn: 'Restorative Child’s Pose',
    movement: 'mobility',
    difficulty: 'beginner',
    equipment: 'mat',
    defaultReps: 60,
    tipsAr: 'أرخِ الجبين على الأرض وتمدد بالذراعين للأمام للتنفس والاستشفاء.'
  },
  {
    id: 'cat-cardio-1',
    nameAr: 'قفز جاكس المنزلي (Jumping Jacks)',
    nameEn: 'Jumping Jacks',
    movement: 'cardio',
    difficulty: 'beginner',
    equipment: 'bodyweight_only',
    defaultReps: 40,
    tipsAr: 'تنشيط الدورة الدموية ومعدل ضربات القلب برفق.'
  },
  {
    id: 'cat-cardio-2',
    nameAr: 'الجري في المكان مع رفع الركبتين (High Knees)',
    nameEn: 'High Knees Cadence',
    movement: 'cardio',
    difficulty: 'intermediate',
    equipment: 'bodyweight_only',
    defaultReps: 30,
    tipsAr: 'رفع الركبة لمستوى الحوض بالتناوب مع الحفاظ على وتيرة خفيفة.'
  }
];

export const MOVEMENT_TO_CATEGORY: Record<MuscleMovement, ExerciseEntry['category']> = {
  push: 'chest',
  legs: 'legs',
  core: 'core',
  cardio: 'cardio',
  mobility: 'mobility',
  back_pull: 'back'
};

/** Build a 3-set exercise entry from a catalog item, ready to log or edit. */
export const exerciseEntryFromCatalog = (catEx: PrebuiltExercise, isAr: boolean): ExerciseEntry => ({
  id: 'ex-' + crypto.randomUUID().slice(0, 6),
  name: isAr ? catEx.nameAr : catEx.nameEn,
  category: MOVEMENT_TO_CATEGORY[catEx.movement],
  movement: catEx.movement,
  sets: [1, 2, 3].map((n) => ({
    setNumber: n,
    weightKg: 0,
    reps: catEx.defaultReps,
    restSeconds: 45,
    completed: true
  }))
});

export const movementLabel = (m: MuscleMovement, isAr: boolean): string => {
  const ar: Record<MuscleMovement, string> = {
    push: 'دفع',
    legs: 'أرجل',
    core: 'جذع',
    back_pull: 'سحب',
    mobility: 'مرونة',
    cardio: 'كارديو'
  };
  const en: Record<MuscleMovement, string> = {
    push: 'Push',
    legs: 'Legs',
    core: 'Core',
    back_pull: 'Pull',
    mobility: 'Mobility',
    cardio: 'Cardio'
  };
  return isAr ? ar[m] : en[m];
};

export const equipmentLabel = (e: HomeEquipment, isAr: boolean): string => {
  const ar: Record<HomeEquipment, string> = {
    bodyweight_only: 'وزن الجسم',
    mat: 'سجادة',
    pullup_bar: 'عقلة',
    resistance_band: 'حبل مقاومة',
    chair_elevated: 'كرسي مرتفع',
    light_dumbbells: 'دمبل خفيف'
  };
  const en: Record<HomeEquipment, string> = {
    bodyweight_only: 'Bodyweight',
    mat: 'Mat',
    pullup_bar: 'Pull-up bar',
    resistance_band: 'Resistance band',
    chair_elevated: 'Elevated chair',
    light_dumbbells: 'Light dumbbells'
  };
  return isAr ? ar[e] : en[e];
};
