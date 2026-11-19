/**
 * The single source of truth for every exercise illustration in NUQTA.
 *
 * Each catalog `illustrationKey` resolves to one drawing from **Open Exercise Art**
 * (https://github.com/AlexMollard/Open-Exercise-Art), a set of 562 illustrations
 * drawn from one character model. Using one authored set — instead of hand-drawn
 * per-exercise art — is what makes the library read as a single, consistent
 * character across every movement rather than 72 unrelated sketches.
 *
 * The drawings are CC BY-SA 4.0; see `public/exercise-art/manifest.json` and
 * ATTRIBUTION.md. They ship as `currentColor` line art, so one file renders
 * correctly in the light and dark themes and inside the workout accent scope.
 */

/** Provenance of the vendored artwork, surfaced in the UI credit and enforced by invariants. */
export const ART_SOURCE = {
  project: 'Open Exercise Art',
  author: 'Alex Mollard',
  url: 'https://github.com/AlexMollard/Open-Exercise-Art',
  license: 'CC-BY-SA-4.0',
  creditEn: 'Exercise illustrations: Open Exercise Art / Alex Mollard, CC BY-SA 4.0.',
  creditAr: 'رسومات التمارين: Open Exercise Art / Alex Mollard، بترخيص CC BY-SA 4.0.'
} as const;

export interface ExerciseArt {
  /** File stem under `public/exercise-art/` (also the upstream exercise id). */
  art: string;
  altEn: string;
  altAr: string;
}

export const EXERCISE_ART: Record<string, ExerciseArt> = {
  'air-squat': { art: 'bodyweight-squat', altEn: 'Air squat: hips travel back and down until the thighs reach parallel, then stand.', altAr: 'القرفصاء الحرة: الحوض للخلف والأسفل حتى يوازي الفخذان الأرض ثم الوقوف.' },
  'arm-circle': { art: 'arm-circles', altEn: 'Arm circles: sweep the straight arms through full circles.', altAr: 'تدوير الذراعين: مرّر الذراعين المستقيمتين في دوائر كاملة.' },
  'bear-crawl': { art: 'bear-crawl', altEn: 'Bear crawl: knees hover just off the floor as you crawl.', altAr: 'زحف الدب: الركبتان ترتفعان قليلاً عن الأرض أثناء الزحف.' },
  'bench-dip': { art: 'bench-dip', altEn: 'Bench dip: legs extended, hips drop straight down.', altAr: 'تغطيس المقعد: الساقان ممدودتان والحوض ينزل للأسفل.' },
  'bicycle-crunch': { art: 'bicycle-crunch', altEn: 'Bicycle crunch: alternate elbow to opposite knee in a pedalling rhythm.', altAr: 'كرنش الدراجة: تبادل لمس المرفق للركبة المقابلة بإيقاع دوراني.' },
  'bird-dog': { art: 'bird-dog', altEn: 'Bird-dog: opposite arm and leg extended from a quadruped position.', altAr: 'الطائر والكلب: مدّ الذراع والقدم المتقابلين من وضع الرباعية.' },
  'bodyweight-good-morning-warmup': { art: 'good-morning', altEn: 'Bodyweight good morning: light hinge to warm up the posterior chain.', altAr: 'صباح الخير بوزن الجسم: ثني خفيف لتهيئة السلسلة الخلفية.' },
  'bulgarian-split-squat': { art: 'bulgarian-split-squat', altEn: 'Bulgarian split squat: rear foot elevated, drop the back knee.', altAr: 'سكوات البلغاري: القدم الخلفية مرتفعة مع خفض الركبة الخلفية.' },
  'burpee': { art: 'burpee', altEn: 'Burpee: squat, kick to a plank, return and jump.', altAr: 'البيربي: قرفصاء ثم بلانك ثم العودة والقفز.' },
  'calf-raise': { art: 'calf-raise', altEn: 'Calf raise: rise onto the balls of the feet, pause at the top.', altAr: 'رفع السمانة: ارتفع على مشط القدم مع الثبات في الأعلى.' },
  'cat-cow': { art: 'cat-cow-stretch', altEn: 'Cat-cow: alternate rounding and arching the spine on all fours.', altAr: 'القطة والبقرة: تبادل تقويس وبسط العمود الفقري على أربع.' },
  'chair-dip': { art: 'dip', altEn: 'Chair dip: hands on the seat edge, elbows bend to lower the hips.', altAr: 'تغطيس الكرسي: اليدان على حافة المقعد مع انثناء المرفقين لخفض الحوض.' },
  'child-pose': { art: 'child-s-pose', altEn: 'Child’s pose: hips back to the heels, arms long, forehead down.', altAr: 'وضعية الطفل: الحوض للخلف نحو الكعبين والذراعان ممدودتان والجبين على الأرض.' },
  'chin-up': { art: 'chin-up', altEn: 'Chin-up: underhand grip, elbows pull toward the ribs.', altAr: 'العقلة بالقبضة المعاكسة: المرفقان يسحبان نحو الأضلاع.' },
  'chin-up-negatives': { art: 'negative-pull-up', altEn: 'Chin-up negative: start at the top and lower slowly.', altAr: 'الهبوط السلبي للعقلة: ابدأ من الأعلى وانزل ببطء.' },
  'dead-bug': { art: 'dead-bug', altEn: 'Dead bug: on the back, opposite arm and leg lower while the low back stays flat.', altAr: 'الحشرة الميتة: على الظهر مع خفض الذراع والساق المتقابلين وثبات أسفل الظهر.' },
  'dead-hang': { art: 'dead-hang', altEn: 'Dead hang: grip the bar and hang with the shoulders packed.', altAr: 'التعليق الميت: امسك البار وتعلّق مع شد الكتفين.' },
  'decline-push-up': { art: 'decline-push-up', altEn: 'Decline push-up: feet elevated on a chair, hands on the floor.', altAr: 'ضغط منحدر: القدمان على كرسي واليدان على الأرض.' },
  'diamond-close-push-up': { art: 'diamond-push-up', altEn: 'Close-grip push-up: hands narrow, elbows tight to the ribs.', altAr: 'ضغط بقبضة ضيقة: اليدان متقاربتان والمرفقان ملاصقان للأضلاع.' },
  'diamond-push-up': { art: 'diamond-push-up', altEn: 'Diamond push-up: hands together under the chest forming a diamond.', altAr: 'ضغط الماس: اليدان متلاصقتان تحت الصدر على شكل معيّن.' },
  'donkey-kick': { art: 'donkey-kick', altEn: 'Donkey kick: from the quadruped position, drive the heel up behind.', altAr: 'رفسة الحمار: من الرباعية ادفع الكعب لأعلى خلفاً.' },
  'downward-dog': { art: 'pike-press', altEn: 'Downward dog: hips high, spine long, heels reaching down.', altAr: 'الكلب المتطلع: الحوض مرتفع والعمود الفقري ممدود والكعبان للأسفل.' },
  'fire-hydrant': { art: 'fire-hydrant', altEn: 'Fire hydrant: from the quadruped position, lift the knee out to the side.', altAr: 'صنبور الحريق: من الرباعية ارفع الركبة للجانب.' },
  'frog-pump': { art: 'frog-pump', altEn: 'Frog pump: soles together, knees out, press the hips up.', altAr: 'مضخة الضفدع: باطن القدمان متلاصقان والركبتان للخارج مع رفع الحوض.' },
  'glute-bridge': { art: 'glute-bridge', altEn: 'Glute bridge: from the floor, drive the hips up until the body is straight.', altAr: 'جسر الألوية: من الأرض ادفع الحوض لأعلى حتى يستقيم الجسم.' },
  'good-morning': { art: 'good-morning', altEn: 'Good morning: hinge at the hips with a flat back.', altAr: 'صباح الخير: ثني من مفصل الحوض مع استقامة الظهر.' },
  'high-knees': { art: 'high-knees', altEn: 'High knees: run in place driving each knee to hip height.', altAr: 'الركبتان المرتفعتان: الجري في المكان مع رفع كل ركبة لمستوى الحوض.' },
  'hip-circle': { art: 'hip-airplane', altEn: 'Hip circles: hands on hips, draw big circles with the pelvis.', altAr: 'تدوير الحوض: اليدان على الخصر مع رسم دوائر واسعة بالحوض.' },
  'hip-flexor-stretch': { art: 'kneeling-hip-flexor-stretch', altEn: 'Kneeling hip-flexor stretch: pelvis tucked, rear hip pressing forward.', altAr: 'إطالة مثنيات الحوض: الحوض مسحوب للداخل مع دفع الورك الخلفي للأمام.' },
  'hip-thrust': { art: 'hip-thrust', altEn: 'Hip thrust: shoulders on a chair, press the hips up to a straight line.', altAr: 'دفع الحوض: الكتفان على كرسي مع رفع الحوض حتى يستقيم الجسم.' },
  'hollow-body-hold': { art: 'hollow-hold', altEn: 'Hollow body hold: low back pressed down, shoulders and legs lifted.', altAr: 'ثبات الجسم المجوّف: أسفل الظهر ملاصق للأرض مع رفع الكتفين والساقين.' },
  'inchworm': { art: 'inchworm', altEn: 'Inchworm: fold forward, walk the hands out to a plank, walk back.', altAr: 'الدودة: انحناء للأمام مع المشي باليدين إلى البلانك ثم العودة.' },
  'inchworm-warmup': { art: 'inchworm', altEn: 'Inchworm warm-up: slow walk-out to loosen the shoulders and hamstrings.', altAr: 'تهيئة الدودة: خروج بطيء باليدين لتحرير الكتفين والمأبض.' },
  'incline-push-up': { art: 'incline-push-up', altEn: 'Incline push-up: hands on a chair seat, body straight.', altAr: 'ضغط مائل: اليدان على مقعد كرسي مع استقامة الجسم.' },
  'inverted-row': { art: 'inverted-row', altEn: 'Inverted row: body straight under a bar, pull the chest up to it.', altAr: 'السحب المقلوب: الجسم مستقيم تحت البار وسحب الصدر نحوه.' },
  'isometric-curl-hold': { art: 'bicep-curl', altEn: 'Isometric biceps hold: elbows bent at 90°, hold the contraction.', altAr: 'الثبات المتساوي للبايسبس: المرفقان بزاوية 90 درجة مع الثبات.' },
  'jumping-jack': { art: 'jumping-jack', altEn: 'Jumping jack: jump the feet out while the arms rise overhead.', altAr: 'قفز جاكس: القفز بتفريج القدمين مع رفع الذراعين للأعلى.' },
  'knee-push-up': { art: 'knee-push-up', altEn: 'Knee push-up: plank on the knees with hands under the shoulders.', altAr: 'ضغط الركبتين: بلانك على الركبتين مع وضع اليدين تحت الكتفين.' },
  'leg-raise-flutter': { art: 'flutter-kick', altEn: 'Flutter kicks: small alternating leg lifts with the low back flat.', altAr: 'رفرفة الأرجل: رفعات صغيرة متبادلة مع ثبات أسفل الظهر.' },
  'leg-swing': { art: 'leg-swing-stretch', altEn: 'Leg swing: hold a support and swing one leg forward and back.', altAr: 'تمرير الساق: امسك سنداً ومرّر ساقاً واحدة للأمام والخلف.' },
  'lying-leg-raise': { art: 'lying-leg-raise', altEn: 'Lying leg raise: legs vertical, lower them slowly without arching the back.', altAr: 'رفع الأرجل: الساقان عموديتان ثم أنزلهما ببطء دون تقويس الظهر.' },
  'mountain-climber': { art: 'mountain-climber', altEn: 'Mountain climber: from a plank, drive the knees toward the chest alternately.', altAr: 'متسلق الجبل: من البلانك اسحب الركبتين نحو الصدر بالتبادل.' },
  'nordic-curl': { art: 'nordic-curl', altEn: 'Nordic hamstring curl: kneel with the ankles anchored, lower the torso forward.', altAr: 'ثني النوردك: الركوع مع تثبيت الكعبين وخفض الجذع للأمام.' },
  'pike-push-up': { art: 'pike-push-up', altEn: 'Pike push-up: hips high, press the head toward the floor.', altAr: 'ضغط بايك: الحوض مرتفع والضغط بالرأس نحو الأرض.' },
  'plank': { art: 'plank', altEn: 'Forearm plank: body in one straight line from head to heels.', altAr: 'بلانك الساعدين: الجسم على خط مستقيم من الرأس إلى الكعبين.' },
  'prone-y-raise': { art: 'prone-y-raise', altEn: 'Prone Y-raise: face-down with the arms forming a Y.', altAr: 'رفع الذراعين بشكل Y من الانبطاح.' },
  'pseudo-planche-push-up': { art: 'planche-push-up', altEn: 'Pseudo planche push-up: hands by the waist, shoulders leaning forward.', altAr: 'ضغط بلانش المزيف: اليدان عند الخصر مع إمالة الكتفين للأمام.' },
  'pull-up': { art: 'pull-up', altEn: 'Pull-up: from a dead hang the elbows drive down until the chin clears the bar.', altAr: 'العقلة: من التعليق الكامل ينخفض المرفقان حتى يتجاوز الذقن البار.' },
  'push-up': { art: 'push-up', altEn: 'Push-up: from a straight-arm plank the elbows bend to lower the chest toward the floor, then press back up.', altAr: 'تمرين الضغط: من وضع البلانك بالذراعين المستقيمتين ينثني المرفقان لخفض الصدر نحو الأرض ثم الدفع لأعلى.' },
  'reverse-crunch': { art: 'reverse-crunch', altEn: 'Reverse crunch: knees bent, curl the hips up toward the ribs.', altAr: 'كرنش عكسي: الركبتان مثنيتان مع رفع الحوض نحو الأضلاع.' },
  'reverse-lunge': { art: 'reverse-lunge', altEn: 'Reverse lunge: step back, drop the rear knee toward the floor.', altAr: 'الطعن الخلفي: خطوة للخلف مع خفض الركبة الخلفية نحو الأرض.' },
  'reverse-snow-angel': { art: 'reverse-snow-angel', altEn: 'Reverse snow angel: face-down, sweep the straight arms overhead.', altAr: 'ملاك الثلج العكسي: من الانبطاح مرّر الذراعين المستقيمتين للأعلى.' },
  'reverse-wrist-curl': { art: 'wrist-extension', altEn: 'Reverse wrist curl: extend the wrists against light resistance.', altAr: 'ثني الرسغ العكسي: مدّ الرسغين ضد مقاومة خفيفة.' },
  'russian-twist': { art: 'russian-twist', altEn: 'Russian twist: seated with the torso leaning back, rotate side to side.', altAr: 'اللف الروسي: جالساً مع إمالة الجذع للخلف والتدوير يميناً ويساراً.' },
  'seated-calf-raise': { art: 'seated-calf-raise', altEn: 'Seated calf raise: knees bent, press the heels up.', altAr: 'رفع السمانة جالساً: الركبتان مثنيتان مع رفع الكعبين.' },
  'side-plank': { art: 'side-plank', altEn: 'Side plank: stacked shoulders and hips, hips lifted off the floor.', altAr: 'بلانك جانبي: الكتفان والحوض متراصّان مع رفع الحوض عن الأرض.' },
  'single-leg-calf-raise': { art: 'single-leg-calf-raise', altEn: 'Single-leg calf raise: balance on one foot and rise.', altAr: 'رفع السمانة على ساق واحدة: توازن على قدم واحدة وارتفع.' },
  'single-leg-glute-bridge': { art: 'single-leg-glute-bridge', altEn: 'Single-leg glute bridge: one foot planted, lift the hips.', altAr: 'جسر الألوية على ساق واحدة: قدم واحدة مثبتة مع رفع الحوض.' },
  'sissy-squat': { art: 'sissy-squat', altEn: 'Sissy squat: knees travel forward while the hips stay high.', altAr: 'سيسي سكوات: الركبتان للأمام مع بقاء الحوض مرتفعاً.' },
  'sliding-leg-curl': { art: 'towel-hamstring-curl', altEn: 'Sliding leg curl: hips lifted, drag the heels toward the hips.', altAr: 'ثني الساق بالانزلاق: الحوض مرفوع مع سحب الكعبين نحو الحوض.' },
  'squat-thrust': { art: 'sprawl', altEn: 'Squat thrust: hands down, jump the feet back and in.', altAr: 'دفع القرفصاء: اليدان للأسفل مع القفز بالقدمين للخلف والأمام.' },
  'standing-hamstring-stretch': { art: 'hamstring-stretch', altEn: 'Standing hamstring stretch: hinge forward with a long spine.', altAr: 'إطالة المأبض واقفاً: انحنِ للأمام مع استقامة العمود الفقري.' },
  'step-up': { art: 'dumbbell-step-up', altEn: 'Step-up: drive through the front leg to stand onto a chair.', altAr: 'الصعود على الدرجة: ادفع بالساق الأمامية للوقوف على الكرسي.' },
  'sumo-squat': { art: 'dumbbell-sumo-squat', altEn: 'Sumo squat: feet wide, toes out, drop straight down.', altAr: 'سومو سكوات: القدمان متباعدتان والأصابع للخارج والنزول للأسفل.' },
  'superman': { art: 'superman', altEn: 'Superman: lying face-down, lift the arms and legs off the floor.', altAr: 'سوبرمان: من الانبطاح ارفع الذراعين والقدمين عن الأرض.' },
  'thoracic-rotation': { art: 'torso-twist-stretch', altEn: 'Thoracic rotation: from all fours, thread one arm under and rotate.', altAr: 'تدوير الفقرات الصدرية: من أربع مرّ الذراع أسفل الجسم ثم دوّر.' },
  'towel-curl': { art: 'banded-alternating-curl', altEn: 'Towel biceps curl: step on a towel, curl the handles to the shoulders.', altAr: 'مرجحة المنشفة للبايسبس: قف على المنشفة وشدّ الأطراف نحو الكتفين.' },
  'wall-handstand-hold': { art: 'wall-handstand', altEn: 'Wall handstand hold: inverted, heels resting on a wall.', altAr: 'الوقوف على اليدين على الحائط: مقلوباً مع استناد الكعبين على الحائط.' },
  'wall-shoulder-tap': { art: 'plank-shoulder-tap', altEn: 'Wall shoulder tap: high plank, alternate hands to the opposite shoulder.', altAr: 'لمس الكتف: بلانك مرتفع مع لمس الكتف المقابل بالتبادل.' },
  'wall-sit': { art: 'wall-sit', altEn: 'Wall sit: back flat on the wall, knees bent to 90°.', altAr: 'الجلوس على الحائط: الظهر ملاصق للحائط والركبتان بزاوية 90 درجة.' },
  'wide-push-up': { art: 'wide-push-up', altEn: 'Wide push-up: hands wider than the shoulders.', altAr: 'ضغط واسع: اليدان أوسع من الكتفين.' },
  'wrist-curl': { art: 'wrist-curl', altEn: 'Wrist curl: forearms supported, curl the wrists upward.', altAr: 'ثني الرسغ: الساعدان مسندان مع ثني الرسغين لأعلى.' },
};

/** Every catalog illustration key that has art. */
export const ILLUSTRATION_KEYS = Object.keys(EXERCISE_ART);

/** Art ids actually referenced, in a stable order (deduplicated). */
export const ART_IDS: string[] = [...new Set(Object.values(EXERCISE_ART).map((a) => a.art))].sort();

export const getExerciseArt = (key: string | undefined): ExerciseArt | undefined =>
  key ? EXERCISE_ART[key] : undefined;

/** Public URL of an illustration, respecting the configured base path. */
export const artUrl = (art: string): string => `${import.meta.env.BASE_URL}exercise-art/${art}.svg`;

export default EXERCISE_ART;
