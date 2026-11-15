import { Illustration, Motion, GroundSpec, pt } from './geometry';
import * as P from './poses';

/**
 * Registry of every exercise illustration, keyed by `PrebuiltExercise.illustrationKey`.
 *
 * Each entry is authored once here and reused by the card (small, static) and the
 * detail view (large, animated). Add a key → it appears everywhere; omit it and the
 * UI falls back to a labelled placeholder, so the catalog can grow safely.
 */

const FLOOR = (from = 24, to = 176): GroundSpec['floor'] => ({ y: P.FLOOR_Y, from, to });
const MAT = (from = 40, to = 170): GroundSpec['mat'] => ({ y: P.MAT_Y, from, to });

const pushMotion = (from = pt(48, 96), to = pt(48, 128)): Motion => ({ from, to, kind: 'push' });
const pullMotion = (from = pt(150, 60), to = pt(150, 96)): Motion => ({ from, to, kind: 'pull' });
const upMotion = (from = pt(160, 120), to = pt(160, 92)): Motion => ({ from, to, kind: 'up' });

const registry: Record<string, Illustration> = {
  /* ------------------------------------------------------------- chest */
  'push-up': {
    phases: [P.plank(0), P.plank(1)],
    animated: true,
    ground: { floor: FLOOR() },
    motion: pushMotion(pt(96, 128), pt(96, 148)),
    altEn: 'Push-up: from a straight-arm plank the elbows bend to lower the chest toward the floor, then press back up.',
    altAr: 'تمرين الضغط: من وضع البلانك بالذراعين المستقيمتين ينثني المرفقان لخفض الصدر نحو الأرض ثم الدفع لأعلى.'
  },
  'knee-push-up': {
    phases: [P.kneePlank()],
    ground: { floor: FLOOR(), mat: MAT() },
    altEn: 'Knee push-up: plank on the knees with hands under the shoulders.',
    altAr: 'ضغط الركبتين: بلانك على الركبتين مع وضع اليدين تحت الكتفين.'
  },
  'incline-push-up': {
    phases: [P.plank(0)],
    ground: { floor: FLOOR(), chair: { x: 132, y: 104, w: 54, h: 12, back: true } },
    altEn: 'Incline push-up: hands on a chair seat, body straight.',
    altAr: 'ضغط مائل: اليدان على مقعد كرسي مع استقامة الجسم.'
  },
  'decline-push-up': {
    phases: [P.plank(0)],
    ground: { floor: FLOOR(), chair: { x: 96, y: 148, w: 54, h: 12, back: true } },
    altEn: 'Decline push-up: feet elevated on a chair, hands on the floor.',
    altAr: 'ضغط منحدر: القدمان على كرسي واليدان على الأرض.'
  },
  'wide-push-up': {
    phases: [P.plank(0)],
    ground: { floor: FLOOR() },
    altEn: 'Wide push-up: hands wider than the shoulders.',
    altAr: 'ضغط واسع: اليدان أوسع من الكتفين.'
  },
  'diamond-push-up': {
    phases: [P.plank(0)],
    ground: { floor: FLOOR() },
    motion: pushMotion(pt(96, 128), pt(96, 148)),
    altEn: 'Diamond push-up: hands together under the chest forming a diamond.',
    altAr: 'ضغط الماس: اليدان متلاصقتان تحت الصدر على شكل معيّن.'
  },
  'pseudo-planche-push-up': {
    phases: [P.plank(0)],
    ground: { floor: FLOOR() },
    altEn: 'Pseudo planche push-up: hands by the waist, shoulders leaning forward.',
    altAr: 'ضغط بلانش المزيف: اليدان عند الخصر مع إمالة الكتفين للأمام.'
  },

  /* -------------------------------------------------------------- back */
  'pull-up': {
    phases: [P.hang(0), P.hang(1)],
    animated: true,
    ground: { bar: { x1: 62, x2: 138, y: 44 } },
    motion: pullMotion(pt(150, 62), pt(150, 92)),
    altEn: 'Pull-up: from a dead hang the elbows drive down until the chin clears the bar.',
    altAr: 'العقلة: من التعليق الكامل ينخفض المرفقان حتى يتجاوز الذقن البار.'
  },
  'chin-up': {
    phases: [P.hang(0), P.hang(1)],
    animated: true,
    ground: { bar: { x1: 62, x2: 138, y: 44 } },
    motion: pullMotion(pt(150, 62), pt(150, 92)),
    altEn: 'Chin-up: underhand grip, elbows pull toward the ribs.',
    altAr: 'العقلة بالقبضة المعاكسة: المرفقان يسحبان نحو الأضلاع.'
  },
  'inverted-row': {
    phases: [P.plank(0)],
    ground: { bar: { x1: 70, x2: 150, y: 110 } },
    motion: pullMotion(pt(120, 112), pt(120, 132)),
    altEn: 'Inverted row: body straight under a bar, pull the chest up to it.',
    altAr: 'السحب المقلوب: الجسم مستقيم تحت البار وسحب الصدر نحوه.'
  },
  'superman': {
    phases: [P.prone()],
    ground: { floor: FLOOR(), mat: MAT() },
    altEn: 'Superman: lying face-down, lift the arms and legs off the floor.',
    altAr: 'سوبرمان: من الانبطاح ارفع الذراعين والقدمين عن الأرض.'
  },
  'reverse-snow-angel': {
    phases: [P.prone()],
    ground: { floor: FLOOR(), mat: MAT() },
    altEn: 'Reverse snow angel: face-down, sweep the straight arms overhead.',
    altAr: 'ملاك الثلج العكسي: من الانبطاح مرّر الذراعين المستقيمتين للأعلى.'
  },
  'bird-dog': {
    phases: [P.birdDog()],
    ground: { floor: FLOOR(), mat: MAT() },
    altEn: 'Bird-dog: opposite arm and leg extended from a quadruped position.',
    altAr: 'الطائر والكلب: مدّ الذراع والقدم المتقابلين من وضع الرباعية.'
  },
  'prone-y-raise': {
    phases: [P.prone()],
    ground: { floor: FLOOR(), mat: MAT() },
    altEn: 'Prone Y-raise: face-down with the arms forming a Y.',
    altAr: 'رفع الذراعين بشكل Y من الانبطاح.'
  },

  /* --------------------------------------------------------- shoulders */
  'pike-push-up': {
    phases: [P.hinge(0.7)],
    ground: { floor: FLOOR() },
    motion: pushMotion(pt(96, 120), pt(96, 140)),
    altEn: 'Pike push-up: hips high, press the head toward the floor.',
    altAr: 'ضغط بايك: الحوض مرتفع والضغط بالرأس نحو الأرض.'
  },
  'wall-handstand-hold': {
    phases: [P.hang(0)],
    ground: { floor: FLOOR(), wall: { x: 64, from: 40, to: 176 } },
    altEn: 'Wall handstand hold: inverted, heels resting on a wall.',
    altAr: 'الوقوف على اليدين على الحائط: مقلوباً مع استناد الكعبين على الحائط.'
  },
  'wall-shoulder-tap': {
    phases: [P.plank(0)],
    ground: { floor: FLOOR() },
    altEn: 'Wall shoulder tap: high plank, alternate hands to the opposite shoulder.',
    altAr: 'لمس الكتف: بلانك مرتفع مع لمس الكتف المقابل بالتبادل.'
  },

  /* ------------------------------------------------------------ biceps */
  'towel-curl': {
    phases: [P.stand()],
    ground: { floor: FLOOR() },
    motion: upMotion(pt(130, 112), pt(130, 92)),
    altEn: 'Towel biceps curl: step on a towel, curl the handles to the shoulders.',
    altAr: 'مرجحة المنشفة للبايسبس: قف على المنشفة وشدّ الأطراف نحو الكتفين.'
  },
  'isometric-curl-hold': {
    phases: [P.stand()],
    ground: { floor: FLOOR() },
    altEn: 'Isometric biceps hold: elbows bent at 90°, hold the contraction.',
    altAr: 'الثبات المتساوي للبايسبس: المرفقان بزاوية 90 درجة مع الثبات.'
  },
  'chin-up-negatives': {
    phases: [P.hang(0), P.hang(1)],
    ground: { bar: { x1: 62, x2: 138, y: 44 } },
    motion: pullMotion(pt(150, 92), pt(150, 62)),
    altEn: 'Chin-up negative: start at the top and lower slowly.',
    altAr: 'الهبوط السلبي للعقلة: ابدأ من الأعلى وانزل ببطء.'
  },

  /* ----------------------------------------------------------- triceps */
  'chair-dip': {
    phases: [P.sitChair(0), P.sitChair(1)],
    animated: true,
    ground: { floor: FLOOR(), chair: { x: 58, y: 126, w: 62, h: 12, back: true } },
    motion: { from: pt(80, 132), to: pt(80, 156), kind: 'down' },
    altEn: 'Chair dip: hands on the seat edge, elbows bend to lower the hips.',
    altAr: 'تغطيس الكرسي: اليدان على حافة المقعد مع انثناء المرفقين لخفض الحوض.'
  },
  'diamond-close-push-up': {
    phases: [P.plank(0)],
    ground: { floor: FLOOR() },
    altEn: 'Close-grip push-up: hands narrow, elbows tight to the ribs.',
    altAr: 'ضغط بقبضة ضيقة: اليدان متقاربتان والمرفقان ملاصقان للأضلاع.'
  },
  'bench-dip': {
    phases: [P.sitChair(0), P.sitChair(1)],
    animated: true,
    ground: { floor: FLOOR(), chair: { x: 58, y: 126, w: 62, h: 12 } },
    motion: { from: pt(80, 132), to: pt(80, 156), kind: 'down' },
    altEn: 'Bench dip: legs extended, hips drop straight down.',
    altAr: 'تغطيس المقعد: الساقان ممدودتان والحوض ينزل للأسفل.'
  },

  /* ---------------------------------------------------------- forearms */
  'wrist-curl': {
    phases: [P.stand()],
    ground: { floor: FLOOR() },
    altEn: 'Wrist curl: forearms supported, curl the wrists upward.',
    altAr: 'ثني الرسغ: الساعدان مسندان مع ثني الرسغين لأعلى.'
  },
  'reverse-wrist-curl': {
    phases: [P.stand()],
    ground: { floor: FLOOR() },
    altEn: 'Reverse wrist curl: extend the wrists against light resistance.',
    altAr: 'ثني الرسغ العكسي: مدّ الرسغين ضد مقاومة خفيفة.'
  },
  'dead-hang': {
    phases: [P.hang(0)],
    ground: { bar: { x1: 62, x2: 138, y: 44 } },
    altEn: 'Dead hang: grip the bar and hang with the shoulders packed.',
    altAr: 'التعليق الميت: امسك البار وتعلّق مع شد الكتفين.'
  },

  /* ------------------------------------------------------- quadriceps */
  'air-squat': {
    phases: [P.squat(0), P.squat(1)],
    animated: true,
    ground: { floor: FLOOR() },
    motion: { from: pt(60, 96), to: pt(60, 126), kind: 'down' },
    altEn: 'Air squat: hips travel back and down until the thighs reach parallel, then stand.',
    altAr: 'القرفصاء الحرة: الحوض للخلف والأسفل حتى يوازي الفخذان الأرض ثم الوقوف.'
  },
  'sumo-squat': {
    phases: [P.sumoSquat(0), P.sumoSquat(1)],
    animated: true,
    ground: { floor: FLOOR() },
    altEn: 'Sumo squat: feet wide, toes out, drop straight down.',
    altAr: 'سومو سكوات: القدمان متباعدتان والأصابع للخارج والنزول للأسفل.'
  },
  'wall-sit': {
    phases: [P.wallSit(1)],
    ground: { floor: FLOOR(), wall: { x: 72, from: 40, to: 176 } },
    altEn: 'Wall sit: back flat on the wall, knees bent to 90°.',
    altAr: 'الجلوس على الحائط: الظهر ملاصق للحائط والركبتان بزاوية 90 درجة.'
  },
  'reverse-lunge': {
    phases: [P.lunge(0.6), P.lunge(1)],
    animated: true,
    ground: { floor: FLOOR() },
    altEn: 'Reverse lunge: step back, drop the rear knee toward the floor.',
    altAr: 'الطعن الخلفي: خطوة للخلف مع خفض الركبة الخلفية نحو الأرض.'
  },
  'step-up': {
    phases: [P.splitSquat(0), P.splitSquat(0.2)],
    ground: { floor: FLOOR(), chair: { x: 108, y: 132, w: 66, h: 40 } },
    altEn: 'Step-up: drive through the front leg to stand onto a chair.',
    altAr: 'الصعود على الدرجة: ادفع بالساق الأمامية للوقوف على الكرسي.'
  },
  'sissy-squat': {
    phases: [P.lunge(0.8)],
    ground: { floor: FLOOR() },
    altEn: 'Sissy squat: knees travel forward while the hips stay high.',
    altAr: 'سيسي سكوات: الركبتان للأمام مع بقاء الحوض مرتفعاً.'
  },

  /* -------------------------------------------------------- hamstrings */
  'single-leg-glute-bridge': {
    phases: [P.gluteBridge()],
    ground: { floor: FLOOR(), mat: MAT() },
    motion: upMotion(pt(150, 152), pt(150, 130)),
    altEn: 'Single-leg glute bridge: one foot planted, lift the hips.',
    altAr: 'جسر الألوية على ساق واحدة: قدم واحدة مثبتة مع رفع الحوض.'
  },
  'nordic-curl': {
    phases: [P.kneelTall()],
    ground: { floor: FLOOR(), mat: MAT() },
    altEn: 'Nordic hamstring curl: kneel with the ankles anchored, lower the torso forward.',
    altAr: 'ثني النوردك: الركوع مع تثبيت الكعبين وخفض الجذع للأمام.'
  },
  'good-morning': {
    phases: [P.hinge(0.2), P.hinge(0.9)],
    animated: true,
    ground: { floor: FLOOR() },
    altEn: 'Good morning: hinge at the hips with a flat back.',
    altAr: 'صباح الخير: ثني من مفصل الحوض مع استقامة الظهر.'
  },
  'sliding-leg-curl': {
    phases: [P.gluteBridge()],
    ground: { floor: FLOOR(), mat: MAT() },
    altEn: 'Sliding leg curl: hips lifted, drag the heels toward the hips.',
    altAr: 'ثني الساق بالانزلاق: الحوض مرفوع مع سحب الكعبين نحو الحوض.'
  },

  /* ------------------------------------------------------------ glutes */
  'glute-bridge': {
    phases: [P.supineBent(), P.gluteBridge()],
    animated: true,
    ground: { floor: FLOOR(), mat: MAT() },
    motion: upMotion(pt(150, 152), pt(150, 130)),
    altEn: 'Glute bridge: from the floor, drive the hips up until the body is straight.',
    altAr: 'جسر الألوية: من الأرض ادفع الحوض لأعلى حتى يستقيم الجسم.'
  },
  'frog-pump': {
    phases: [P.gluteBridge()],
    ground: { floor: FLOOR(), mat: MAT() },
    altEn: 'Frog pump: soles together, knees out, press the hips up.',
    altAr: 'مضخة الضفدع: باطن القدمان متلاصقان والركبتان للخارج مع رفع الحوض.'
  },
  'fire-hydrant': {
    phases: [P.quadruped()],
    ground: { floor: FLOOR(), mat: MAT() },
    altEn: 'Fire hydrant: from the quadruped position, lift the knee out to the side.',
    altAr: 'صنبور الحريق: من الرباعية ارفع الركبة للجانب.'
  },
  'donkey-kick': {
    phases: [P.quadruped()],
    ground: { floor: FLOOR(), mat: MAT() },
    altEn: 'Donkey kick: from the quadruped position, drive the heel up behind.',
    altAr: 'رفسة الحمار: من الرباعية ادفع الكعب لأعلى خلفاً.'
  },
  'bulgarian-split-squat': {
    phases: [P.splitSquat(0), P.splitSquat(1)],
    animated: true,
    ground: { floor: FLOOR(), chair: { x: 44, y: 118, w: 46, h: 58 } },
    altEn: 'Bulgarian split squat: rear foot elevated, drop the back knee.',
    altAr: 'سكوات البلغاري: القدم الخلفية مرتفعة مع خفض الركبة الخلفية.'
  },
  'hip-thrust': {
    phases: [P.hipThrust()],
    ground: { floor: FLOOR(), chair: { x: 40, y: 116, w: 52, h: 60 } },
    motion: upMotion(pt(130, 150), pt(130, 124)),
    altEn: 'Hip thrust: shoulders on a chair, press the hips up to a straight line.',
    altAr: 'دفع الحوض: الكتفان على كرسي مع رفع الحوض حتى يستقيم الجسم.'
  },

  /* ------------------------------------------------------------ calves */
  'calf-raise': {
    phases: [P.calfRaise(0), P.calfRaise(1)],
    animated: true,
    ground: { floor: FLOOR() },
    motion: upMotion(pt(150, 168), pt(150, 150)),
    altEn: 'Calf raise: rise onto the balls of the feet, pause at the top.',
    altAr: 'رفع السمانة: ارتفع على مشط القدم مع الثبات في الأعلى.'
  },
  'single-leg-calf-raise': {
    phases: [P.calfRaise(0), P.calfRaise(1)],
    ground: { floor: FLOOR() },
    altEn: 'Single-leg calf raise: balance on one foot and rise.',
    altAr: 'رفع السمانة على ساق واحدة: توازن على قدم واحدة وارتفع.'
  },
  'seated-calf-raise': {
    phases: [P.sitChair()],
    ground: { floor: FLOOR(), chair: { x: 44, y: 126, w: 64, h: 12, back: true } },
    altEn: 'Seated calf raise: knees bent, press the heels up.',
    altAr: 'رفع السمانة جالساً: الركبتان مثنيتان مع رفع الكعبين.'
  },

  /* -------------------------------------------------------- core / abs */
  'plank': {
    phases: [P.plank(0)],
    ground: { floor: FLOOR(), mat: MAT() },
    altEn: 'Forearm plank: body in one straight line from head to heels.',
    altAr: 'بلانك الساعدين: الجسم على خط مستقيم من الرأس إلى الكعبين.'
  },
  'side-plank': {
    phases: [P.sidePlank()],
    ground: { floor: FLOOR(), mat: MAT() },
    altEn: 'Side plank: stacked shoulders and hips, hips lifted off the floor.',
    altAr: 'بلانك جانبي: الكتفان والحوض متراصّان مع رفع الحوض عن الأرض.'
  },
  'dead-bug': {
    phases: [P.supine(0, 250)],
    ground: { floor: FLOOR(), mat: MAT() },
    altEn: 'Dead bug: on the back, opposite arm and leg lower while the low back stays flat.',
    altAr: 'الحشرة الميتة: على الظهر مع خفض الذراع والساق المتقابلين وثبات أسفل الظهر.'
  },
  'lying-leg-raise': {
    phases: [P.supine(0, 250), P.supine(70, 250)],
    animated: true,
    ground: { floor: FLOOR(), mat: MAT() },
    motion: { from: pt(150, 118), to: pt(150, 150), kind: 'down' },
    altEn: 'Lying leg raise: legs vertical, lower them slowly without arching the back.',
    altAr: 'رفع الأرجل: الساقان عموديتان ثم أنزلهما ببطء دون تقويس الظهر.'
  },
  'reverse-crunch': {
    phases: [P.supineBent()],
    ground: { floor: FLOOR(), mat: MAT() },
    altEn: 'Reverse crunch: knees bent, curl the hips up toward the ribs.',
    altAr: 'كرنش عكسي: الركبتان مثنيتان مع رفع الحوض نحو الأضلاع.'
  },
  'hollow-body-hold': {
    phases: [P.supine(35, 265)],
    ground: { floor: FLOOR(), mat: MAT() },
    altEn: 'Hollow body hold: low back pressed down, shoulders and legs lifted.',
    altAr: 'ثبات الجسم المجوّف: أسفل الظهر ملاصق للأرض مع رفع الكتفين والساقين.'
  },
  'bicycle-crunch': {
    phases: [P.supine(45, 255)],
    ground: { floor: FLOOR(), mat: MAT() },
    altEn: 'Bicycle crunch: alternate elbow to opposite knee in a pedalling rhythm.',
    altAr: 'كرنش الدراجة: تبادل لمس المرفق للركبة المقابلة بإيقاع دوراني.'
  },
  'mountain-climber': {
    phases: [P.plank(0), P.plankKneeDrive()],
    animated: true,
    ground: { floor: FLOOR() },
    altEn: 'Mountain climber: from a plank, drive the knees toward the chest alternately.',
    altAr: 'متسلق الجبل: من البلانك اسحب الركبتين نحو الصدر بالتبادل.'
  },
  'russian-twist': {
    phases: [P.frontSitTwist(-28), P.frontSitTwist(28)],
    animated: true,
    ground: { floor: FLOOR(), mat: MAT() },
    altEn: 'Russian twist: seated with the torso leaning back, rotate side to side.',
    altAr: 'اللف الروسي: جالساً مع إمالة الجذع للخلف والتدوير يميناً ويساراً.'
  },
  'leg-raise-flutter': {
    phases: [P.supine(18, 265)],
    ground: { floor: FLOOR(), mat: MAT() },
    altEn: 'Flutter kicks: small alternating leg lifts with the low back flat.',
    altAr: 'رفرفة الأرجل: رفعات صغيرة متبادلة مع ثبات أسفل الظهر.'
  },

  /* -------------------------------------------------------- full body */
  'burpee': {
    phases: [P.plank(0), P.standArmsOverhead()],
    animated: true,
    ground: { floor: FLOOR() },
    altEn: 'Burpee: squat, kick to a plank, return and jump.',
    altAr: 'البيربي: قرفصاء ثم بلانك ثم العودة والقفز.'
  },
  'bear-crawl': {
    phases: [P.quadruped()],
    ground: { floor: FLOOR() },
    altEn: 'Bear crawl: knees hover just off the floor as you crawl.',
    altAr: 'زحف الدب: الركبتان ترتفعان قليلاً عن الأرض أثناء الزحف.'
  },
  'inchworm': {
    phases: [P.hinge(0.9), P.plank(0)],
    animated: true,
    ground: { floor: FLOOR() },
    altEn: 'Inchworm: fold forward, walk the hands out to a plank, walk back.',
    altAr: 'الدودة: انحناء للأمام مع المشي باليدين إلى البلانك ثم العودة.'
  },
  'jumping-jack': {
    phases: [P.frontStand(100), P.frontLegsApart(16)],
    animated: true,
    ground: { floor: FLOOR() },
    altEn: 'Jumping jack: jump the feet out while the arms rise overhead.',
    altAr: 'قفز جاكس: القفز بتفريج القدمين مع رفع الذراعين للأعلى.'
  },
  'high-knees': {
    phases: [P.frontStand(120)],
    ground: { floor: FLOOR() },
    altEn: 'High knees: run in place driving each knee to hip height.',
    altAr: 'الركبتان المرتفعتان: الجري في المكان مع رفع كل ركبة لمستوى الحوض.'
  },
  'squat-thrust': {
    phases: [P.squat(1), P.plank(0)],
    animated: true,
    ground: { floor: FLOOR() },
    altEn: 'Squat thrust: hands down, jump the feet back and in.',
    altAr: 'دفع القرفصاء: اليدان للأسفل مع القفز بالقدمين للخلف والأمام.'
  },

  /* ---------------------------------------------------------- mobility */
  'cat-cow': {
    phases: [P.quadruped()],
    ground: { floor: FLOOR(), mat: MAT() },
    altEn: 'Cat-cow: alternate rounding and arching the spine on all fours.',
    altAr: 'القطة والبقرة: تبادل تقويس وبسط العمود الفقري على أربع.'
  },
  'hip-flexor-stretch': {
    phases: [P.lunge(0.7)],
    ground: { floor: FLOOR(), mat: MAT() },
    altEn: 'Kneeling hip-flexor stretch: pelvis tucked, rear hip pressing forward.',
    altAr: 'إطالة مثنيات الحوض: الحوض مسحوب للداخل مع دفع الورك الخلفي للأمام.'
  },
  'child-pose': {
    phases: [P.childPose()],
    ground: { floor: FLOOR(), mat: MAT() },
    altEn: 'Child’s pose: hips back to the heels, arms long, forehead down.',
    altAr: 'وضعية الطفل: الحوض للخلف نحو الكعبين والذراعان ممدودتان والجبين على الأرض.'
  },
  'thoracic-rotation': {
    phases: [P.quadruped()],
    ground: { floor: FLOOR(), mat: MAT() },
    altEn: 'Thoracic rotation: from all fours, thread one arm under and rotate.',
    altAr: 'تدوير الفقرات الصدرية: من أربع مرّ الذراع أسفل الجسم ثم دوّر.'
  },
  'downward-dog': {
    phases: [P.hinge(0.95)],
    ground: { floor: FLOOR(), mat: MAT() },
    altEn: 'Downward dog: hips high, spine long, heels reaching down.',
    altAr: 'الكلب المتطلع: الحوض مرتفع والعمود الفقري ممدود والكعبان للأسفل.'
  },
  'standing-hamstring-stretch': {
    phases: [P.hinge(0.8)],
    ground: { floor: FLOOR() },
    altEn: 'Standing hamstring stretch: hinge forward with a long spine.',
    altAr: 'إطالة المأبض واقفاً: انحنِ للأمام مع استقامة العمود الفقري.'
  },

  /* ------------------------------------------------------ warm-up */
  'arm-circle': {
    phases: [P.frontStand(20), P.frontStand(160)],
    animated: true,
    ground: { floor: FLOOR() },
    altEn: 'Arm circles: sweep the straight arms through full circles.',
    altAr: 'تدوير الذراعين: مرّر الذراعين المستقيمتين في دوائر كاملة.'
  },
  'leg-swing': {
    phases: [P.frontLegSwing()],
    ground: { floor: FLOOR() },
    altEn: 'Leg swing: hold a support and swing one leg forward and back.',
    altAr: 'تمرير الساق: امسك سنداً ومرّر ساقاً واحدة للأمام والخلف.'
  },
  'hip-circle': {
    phases: [P.frontHipCircle()],
    ground: { floor: FLOOR() },
    altEn: 'Hip circles: hands on hips, draw big circles with the pelvis.',
    altAr: 'تدوير الحوض: اليدان على الخصر مع رسم دوائر واسعة بالحوض.'
  },
  'bodyweight-good-morning-warmup': {
    phases: [P.hinge(0.2), P.hinge(0.6)],
    animated: true,
    ground: { floor: FLOOR() },
    altEn: 'Bodyweight good morning: light hinge to warm up the posterior chain.',
    altAr: 'صباح الخير بوزن الجسم: ثني خفيف لتهيئة السلسلة الخلفية.'
  },
  'inchworm-warmup': {
    phases: [P.hinge(0.85)],
    ground: { floor: FLOOR() },
    altEn: 'Inchworm warm-up: slow walk-out to loosen the shoulders and hamstrings.',
    altAr: 'تهيئة الدودة: خروج بطيء باليدين لتحرير الكتفين والمأبض.'
  }
};

export const ILLUSTRATION_KEYS = Object.keys(registry);

export const getIllustration = (key: string | undefined): Illustration | undefined =>
  key ? registry[key] : undefined;

export default registry;
