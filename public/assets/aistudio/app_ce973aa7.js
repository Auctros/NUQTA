/* NUQTA — local-first life workspace. No analytics, remote scripts, or third-party runtime. */
(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const uid = () => (crypto?.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`);
  const pad = n => String(n).padStart(2, '0');
  const localDateKey = (date = new Date()) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const shiftDate = (date, days) => { const d = new Date(date); d.setDate(d.getDate() + days); return d; };
  const dateFromKey = key => { if (!key) return null; const [y,m,d] = key.split('-').map(Number); return new Date(y, m - 1, d, 12); };
  const clamp = (n,min,max) => Math.max(min, Math.min(max, n));
  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const formatMoney = value => new Intl.NumberFormat(state?.settings?.lang === 'en' ? 'en-US' : 'ar-EG', { maximumFractionDigits: 2 }).format(Number(value || 0));
  const fmtDate = (key, options = { day: 'numeric', month: 'short' }) => {
    const date = typeof key === 'string' ? dateFromKey(key) : key;
    if (!date) return '—';
    return new Intl.DateTimeFormat(state?.settings?.lang === 'en' ? 'en-US' : 'ar-EG', options).format(date);
  };
  const fmtFullDate = date => new Intl.DateTimeFormat(state.settings.lang === 'en' ? 'en-US' : 'ar-EG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(date);
  const fmtTime = time => {
    if (!time) return '—';
    const [h,m] = time.split(':').map(Number);
    return new Intl.DateTimeFormat(state.settings.lang === 'en' ? 'en-US' : 'ar-EG', { hour: 'numeric', minute: '2-digit' }).format(new Date(2020,0,1,h,m));
  };
  const addDays = (key, count) => localDateKey(shiftDate(dateFromKey(key) || new Date(), count));
  const todayKey = () => localDateKey();
  const monthKey = (date = new Date()) => `${date.getFullYear()}-${pad(date.getMonth()+1)}`;
  const monthLabel = date => new Intl.DateTimeFormat(state.settings.lang === 'en' ? 'en-US' : 'ar-EG', { month: 'long', year: 'numeric' }).format(date);
  const dayNames = () => state.settings.lang === 'en' ? ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'] : ['أحد','إثنين','ثلاثاء','أربعاء','خميس','جمعة','سبت'];
  const shortDays = () => state.settings.lang === 'en' ? ['S','M','T','W','T','F','S'] : ['ح','ن','ث','ر','خ','ج','س'];

  const translations = {
    en: {
      tagline: 'Live it wisely', quickCapture: 'Quick capture', workspace: 'WORKSPACE', life: 'LIFE', smallStep: 'You do not have to do everything. Just choose the next step.', rescueMode: 'Rescue mode', localProfile: 'Local profile · Private', localOnly: 'Local & private', breadcrumb: 'Workspace', footerLine: 'Less time managing. More life lived.', footerPrivacy: 'Your data stays on this device',
      'nav.home':'Overview','nav.tasks':'Tasks','nav.habits':'Habits','nav.goals':'Goals','nav.focus':'Focus','nav.calendar':'Calendar','nav.finance':'Money','nav.health':'Health','nav.journal':'Journal','nav.insights':'Insights','nav.settings':'Settings & data',
      helloMorning:'Good morning',helloAfternoon:'Good afternoon',helloEvening:'Good evening',dateToday:'TODAY, AT YOUR PACE',weatherOffline:'Weather unavailable offline',heroLine:'A clearer day starts with one clear point.',heroSub:'Make room for what matters. The rest can wait.',startDay:'Start with intention',energy:'Energy',energyTitle:'Your daily energy',energyText:'A gentle estimate from sleep, mood, and today’s progress.',energyLow:'Protect your energy today',energyMid:'A steady pace is enough',energyHigh:'You have room for a deeper push',sleep:'Sleep',mood:'Mood',done:'Done',tasksToday:'Tasks today',habitsToday:'Habits today',focusToday:'Focus today',topThree:'Daily focus',topThreeDesc:'Three priorities. Everything else can stay quiet.',seeTasks:'All tasks',timeline:'Today, in flow',timelineDesc:'A little structure, with room to breathe.',weekAhead:'Your week',quickActions:'A few useful shortcuts',addTask:'Add task',addHabit:'New habit',writeJournal:'Write a reflection',startFocus:'Focus session',emptyTitle:'A little room to begin',emptyTask:'No tasks yet. Start with one small step.',emptyHabit:'Build consistency, one gentle repetition at a time.',emptyGoal:'Give a meaningful direction a name.',emptyTimeline:'Your day is open. Add a task or leave space to rest.',createFirst:'Create the first one',noTime:'Unscheduled',urgent:'Urgent',important:'Important',normal:'Normal',low:'Low',high:'High',medium:'Medium',priority:'Priority',today:'Today',tomorrow:'Tomorrow',all:'All',active:'Active',completed:'Completed',due:'Due',noDue:'No due date',noResults:'Nothing matches this view.',taskPlaceholder:'What needs your attention? Try “Read 10 pages tomorrow at 6 PM”',captureHint:'Enter to capture',tasksTitle:'Make room for the work that matters',tasksDesc:'A single list, different ways to see it. Capture first; organize only when useful.',taskSearch:'Search tasks',list:'List',board:'Board',matrix:'Matrix',calendarView:'Calendar',filterAll:'All tasks',filterActive:'Open',filterDone:'Completed',sortDue:'By date',sortPriority:'By priority',taskStatus:'Status',todo:'To do',inProgress:'In progress',complete:'Complete',edit:'Edit',delete:'Delete',save:'Save',cancel:'Cancel',close:'Close',newTask:'New task',editTask:'Edit task',taskName:'Task name',taskDetails:'Notes (optional)',dueDate:'Due date',dueTime:'Time',duration:'Duration (minutes)',area:'Area',priorityLabel:'Priority',topTask:'Pin to daily focus',recurrence:'Repeat',noRepeat:'Does not repeat',daily:'Every day',weekly:'Every week',weekdays:'Weekdays',monthly:'Monthly',blockedBy:'Depends on',noDependency:'No dependency',subtasks:'Subtasks (one per line)',taskAdded:'Task captured',taskSaved:'Task updated',taskCompleted:'Task completed',taskReopened:'Task reopened',blockedTask:'This task is waiting on another task.',confirmDelete:'Delete this item? This cannot be undone.',yesDelete:'Delete',dueToday:'Due today',overdue:'Overdue',tomorrowAt:'Tomorrow',noPriority:'No priority',noArea:'General',work:'Work',personal:'Personal',study:'Study',healthArea:'Health',admin:'Admin',other:'Other',
      habitsTitle:'Small actions, repeated with intention',habitsDesc:'Build a chain you can return to. Missing a day is information, not a verdict.',newHabit:'New habit',habitName:'Habit name',habitCue:'After what existing action?',habitTime:'When / where',habitTarget:'Daily target',habitDays:'This week',streak:'day streak',bestStreak:'Best streak',markDone:'Mark complete',markUndone:'Undo today',freeze:'Use a freeze',freezesLeft:'freezes left this month',habitAdded:'Habit created',habitDone:'Habit checked in',habitUndone:'Check-in removed',habitFreeze:'A streak freeze protected today.',habitFreezeNone:'You have used both monthly freezes.',stackExample:'e.g. After Fajr prayer',timeExample:'e.g. At my desk after breakfast',weekRate:'Weekly consistency',habitInsight:'A useful next adjustment',habitInsightText:'Attach the habit to a reliable cue and make the first version almost too easy.',noHabits:'No habits set up yet.',
      goalsTitle:'Give effort a direction',goalsDesc:'Long-range goals become calmer when the next measurable step is visible.',newGoal:'New goal',goalName:'Goal name',goalWhy:'Why does this matter?',goalTarget:'Target value',goalCurrent:'Current value',goalUnit:'Unit (pages, hours…)',goalDate:'Target date',goalMilestones:'Milestones (one per line)',goalAdded:'Goal created',updateProgress:'Add progress',progressAdded:'Progress updated',milestones:'Milestones',goalTargetHint:'A measurable result',goalVision:'Vision / reminder',goalEmpty:'A meaningful goal begins with a clear reason.',
      focusTitle:'Give one thing your full attention',focusDesc:'A little protected time beats a perfect plan that never starts.',focus:'Focus',shortBreak:'Short break',longBreak:'Long break',minutes:'minutes',start:'Start',pause:'Pause',resume:'Resume',reset:'Reset',finish:'Finish session',chooseTask:'Link a task (optional)',noLinkedTask:'Unlinked focus',todayFocus:'Focused today',sessions:'Sessions',focusStreak:'Deep-work days',sessionHistory:'Recent sessions',noSessions:'Your first focus session belongs here.',sessionSaved:'Focus session logged',focusQuote:'You only need to attend to the next thing.',focusRating:'How did that go?',beforeMood:'Mood before',afterMood:'Mood after',productivity:'Productivity rating',sessionNotes:'A note about this session',
      calendarTitle:'Make time visible',calendarDesc:'Your tasks and time blocks, arranged around a real day.',autoSchedule:'Auto-plan open tasks',scheduled:'tasks placed into open slots',scheduleNone:'No open tasks needed scheduling.',agenda:'Agenda',selectedDay:'Selected day',noAgenda:'No tasks scheduled for this day.',timeBlockHint:'Use a task time to reserve a slot. Auto-plan uses daytime hours and priority.',todayBtn:'Today',
      financeTitle:'Know where your money goes',financeDesc:'A lightweight view of spending and saving. No bank connection required.',addExpense:'Add expense',expense:'Expense',income:'Income',spending:'Spent this month',budgetRemaining:'Budget remaining',budget:'Monthly budget',setBudget:'Set monthly budget',category:'Category',amount:'Amount',description:'Description',date:'Date',expenseAdded:'Entry saved',noExpenses:'Nothing logged yet. A quick entry is enough.',savings:'Savings goals',newSaving:'New savings goal',savingName:'Savings goal',savingTarget:'Target amount',savingCurrent:'Already saved',addSaving:'Add savings',savingUpdated:'Savings updated',food:'Food',transport:'Transport',bills:'Bills',learning:'Learning',home:'Home',fun:'Leisure',incomeLabel:'Income',misc:'Other',budgetSet:'Budget updated',
      healthTitle:'Care for the system you live in',healthDesc:'Simple signals for sleep, hydration, movement, and your body over time.',sleepHours:'Sleep last night',water:'Water',glasses:'glasses',weight:'Weight',workout:'Movement',sleepLog:'Log sleep',weightLog:'Log weight',workoutLog:'Log activity',activityName:'Activity',minutesDuration:'Minutes',healthSaved:'Health log saved',waterAdded:'Water logged',sleepTarget:'Target: 8 h',waterTarget:'Target: 8 glasses',movementTarget:'Daily movement',todayLog:'Today’s check-in',bodyHistory:'Body & activity history',noHealth:'A blank slate. Start with one signal.',weightKg:'kg',hour:'h',
      journalTitle:'Listen before you optimize',journalDesc:'A small daily reflection. No streak pressure, no need to write beautifully.',wellPrompt:'What went well?',drainedPrompt:'What drained your energy?',tomorrowPrompt:'What is your plan for tomorrow?',gratitudePrompt:'One thing you are grateful for',moodToday:'How are you feeling?',saveEntry:'Save reflection',journalSaved:'Reflection saved',journalHistory:'Past reflections',noJournal:'Your reflections will appear here.',mood1:'Very low',mood2:'Low',mood3:'Okay',mood4:'Good',mood5:'Great',
      insightsTitle:'Notice patterns, not personal failures',insightsDesc:'A weekly view of what your routines and attention are making possible.',tasksDoneWeek:'Tasks completed this week',habitRate:'Habit consistency',focusHours:'Focus hours',daysJournaled:'Days reflected',weeklyActivity:'Your last seven days',progressView:'Progress at a glance',achievements:'Milestones earned',whatIf:'What if this continued?',whatIfDesc:'Small actions compound. This is a projection, not a promise.',perWeek:'per week',sixMonths:'in six months',weeklyReview:'Sunday ritual',openReview:'Review this week',reviewTitle:'A Sunday reset',reviewIntro:'Look at the week with curiosity, not judgment.',wentWell:'What worked this week?',hardPart:'What made things harder?',nextWeek:'What deserves attention next week?',reviewSaved:'Weekly review saved',
      settingsTitle:'Your workspace, your rules',settingsDesc:'Personalize your workspace and keep your data in your hands.',profileSettings:'Your profile',displayName:'What should we call you?',preferences:'Preferences',language:'Interface language',darkMode:'Dark appearance',darkModeOn:'Dark mode is on',lightModeOn:'Light mode is on',snapshotLabel:'serialized snapshot',notifications:'Browser reminders',notificationsDesc:'Optional reminders while this app is open. No external service.',dataPrivacy:'Privacy by design',privacyText:'Your tasks, habits, journal, and finance entries are stored in this browser. No account, analytics, ads, or cloud sync are configured in this build.',dataTools:'Data portability',exportJSON:'Export all data (JSON)',exportCSV:'Export task list (CSV)',importData:'Import backup',printPDF:'Print / save as PDF',wipeData:'Delete all local data',backupDone:'Backup downloaded',importDone:'Backup restored',invalidBackup:'That file does not look like a NUQTA backup.',dataImported:'Data imported successfully',deletedAll:'Local data cleared',settingsSaved:'Settings saved',offlineReady:'Offline shell is ready',exportHint:'Keep a backup somewhere safe. Your browser profile is the current home of this data.',storageTitle:'Local storage status',storageLocal:'IndexedDB when available, with a browser-local fallback.',syncTitle:'Cloud sync is not connected',syncDesc:'No account, server, or encryption key is set up. Your data stays on this device; syncing can be added as a separate audited layer.',storageFail:'Could not save. Export a backup now.',
      rescueTitle:'Let’s rescue the day',rescueIntro:'Three quick answers. We will shrink the plan, not judge the day.',rescueQ1:'What is your energy right now?',rescueLow:'Low — I need gentle steps',rescueMid:'Medium — I can do a little',rescueHigh:'High — I can focus',rescueQ2:'What absolutely matters today?',rescueMust:'Name the one thing that really matters',rescueQ3:'How much usable time do you have?',rescueTime:'Available time',rescue20:'20 minutes',rescue45:'45 minutes',rescue90:'90 minutes',buildPlan:'Rebuild my day',rescuePlan:'Your smaller plan',rescueCreate:'Add this plan to today',rescueCreated:'Your smaller plan is ready',rescueSkip:'The rest is not a failure. It is a choice.',minutesShort:'min',next:'Next',
      q1Title:'Urgent + important',q1Sub:'Do first',q2Title:'Important, not urgent',q2Sub:'Schedule it',q3Title:'Urgent, less important',q3Sub:'Reduce or delegate',q4Title:'Neither urgent nor important',q4Sub:'Consider removing',
    },
    ar: {
      tagline: 'عِشها بحكمة', quickCapture: 'التقاط سريع', workspace: 'مساحتك', life: 'الحياة', smallStep: 'ليس مطلوبًا أن تفعل كل شيء. اختر الخطوة التالية فقط.', rescueMode: 'وضع الإنقاذ', localProfile: 'ملف محلي · خاص', localOnly: 'محلي وخاص', breadcrumb: 'مساحتك', footerLine: 'وقت أقل في الإدارة. حياة أكثر في عيشها.', footerPrivacy: 'بياناتك لا تغادر هذا الجهاز',
      'nav.home':'نظرة عامة','nav.tasks':'المهام','nav.habits':'العادات','nav.goals':'الأهداف','nav.focus':'التركيز','nav.calendar':'التقويم','nav.finance':'المال','nav.health':'الصحة','nav.journal':'اليوميات','nav.insights':'الرؤى','nav.settings':'الإعدادات والبيانات',
      helloMorning:'صباح الخير',helloAfternoon:'يومك سعيد',helloEvening:'مساء الخير',dateToday:'اليوم، على مهل',weatherOffline:'الطقس غير متاح دون اتصال',heroLine:'يوم أوضح يبدأ بنقطة واحدة واضحة.',heroSub:'اترك مساحة لما يهم. والباقي يمكنه الانتظار.',startDay:'ابدأ بنيّة واضحة',energy:'الطاقة',energyTitle:'طاقتك اليوم',energyText:'تقدير هادئ مبني على النوم والمزاج وما أنجزته اليوم.',energyLow:'احمِ طاقتك اليوم',energyMid:'إيقاع ثابت يكفي',energyHigh:'لديك مساحة لدفعة أعمق',sleep:'النوم',mood:'المزاج',done:'أُنجز',tasksToday:'مهام اليوم',habitsToday:'عادات اليوم',focusToday:'تركيز اليوم',topThree:'بوصلة اليوم',topThreeDesc:'ثلاث أولويات فقط. اترك الباقي هادئًا.',seeTasks:'كل المهام',timeline:'إيقاع اليوم',timelineDesc:'قليل من التنظيم، ومساحة للتنفس.',weekAhead:'أسبوعك',quickActions:'اختصارات مفيدة',addTask:'أضف مهمة',addHabit:'عادة جديدة',writeJournal:'اكتب تأملًا',startFocus:'جلسة تركيز',emptyTitle:'مساحة صغيرة للبداية',emptyTask:'لا توجد مهام بعد. ابدأ بخطوة صغيرة واحدة.',emptyHabit:'ابنِ الاستمرارية بتكرار بسيط يمكنك العودة إليه.',emptyGoal:'امنح اتجاهًا ذا معنى اسمًا واضحًا.',emptyTimeline:'يومك مفتوح. أضف مهمة أو اترك مساحة للراحة.',createFirst:'أنشئ أول واحدة',noTime:'دون موعد',urgent:'عاجلة',important:'مهمة',normal:'عادية',low:'منخفضة',high:'مرتفعة',medium:'متوسطة',priority:'الأولوية',today:'اليوم',tomorrow:'غدًا',all:'الكل',active:'مفتوحة',completed:'مكتملة',due:'الموعد',noDue:'بلا موعد',noResults:'لا شيء يطابق هذا العرض.',taskPlaceholder:'ما الذي يحتاج انتباهك؟ جرّب: قراءة 10 صفحات بكرة الساعة 6 مساءً',captureHint:'Enter للحفظ',tasksTitle:'اترك مساحة للعمل الذي يستحق',tasksDesc:'قائمة واحدة وطرق مختلفة لرؤيتها. سجّل أولًا، ونظّم حين تحتاج.',taskSearch:'ابحث في المهام',list:'قائمة',board:'كانبان',matrix:'مصفوفة',calendarView:'تقويم',filterAll:'كل المهام',filterActive:'المفتوحة',filterDone:'المكتملة',sortDue:'حسب الموعد',sortPriority:'حسب الأولوية',taskStatus:'الحالة',todo:'لم تبدأ',inProgress:'قيد التنفيذ',complete:'مكتملة',edit:'تعديل',delete:'حذف',save:'حفظ',cancel:'إلغاء',close:'إغلاق',newTask:'مهمة جديدة',editTask:'تعديل المهمة',taskName:'اسم المهمة',taskDetails:'ملاحظات (اختياري)',dueDate:'تاريخ الاستحقاق',dueTime:'الوقت',duration:'المدة (بالدقائق)',area:'المجال',priorityLabel:'الأولوية',topTask:'أضف لبوصلة اليوم',recurrence:'التكرار',noRepeat:'بلا تكرار',daily:'يوميًا',weekly:'أسبوعيًا',weekdays:'أيام العمل',monthly:'شهريًا',blockedBy:'تعتمد على',noDependency:'لا توجد تبعية',subtasks:'خطوات فرعية (كل خطوة بسطر)',taskAdded:'تم التقاط المهمة',taskSaved:'تم تحديث المهمة',taskCompleted:'أُنجزت المهمة',taskReopened:'أُعيد فتح المهمة',blockedTask:'هذه المهمة تنتظر إنجاز مهمة أخرى أولًا.',confirmDelete:'حذف هذا العنصر؟ لا يمكن التراجع عن ذلك.',yesDelete:'احذف',dueToday:'موعدها اليوم',overdue:'متأخرة',tomorrowAt:'غدًا',noPriority:'بلا أولوية',noArea:'عام',work:'العمل',personal:'شخصي',study:'دراسة',healthArea:'الصحة',admin:'إداري',other:'أخرى',
      habitsTitle:'أفعال صغيرة، تتكرر بنيّة واضحة',habitsDesc:'ابنِ سلسلة تستطيع العودة إليها. فوات يوم معلومة، وليس حكمًا عليك.',newHabit:'عادة جديدة',habitName:'اسم العادة',habitCue:'بعد أي فعل موجود؟',habitTime:'متى / أين؟',habitTarget:'الحد اليومي',habitDays:'هذا الأسبوع',streak:'أيام متتالية',bestStreak:'أفضل سلسلة',markDone:'تسجيل الإنجاز',markUndone:'إلغاء تسجيل اليوم',freeze:'استخدم تجميدًا',freezesLeft:'تجميدان متبقيان هذا الشهر',habitAdded:'أُنشئت العادة',habitDone:'تم تسجيل العادة',habitUndone:'تم إلغاء تسجيل العادة',habitFreeze:'حافظ تجميد السلسلة على تقدمك اليوم.',habitFreezeNone:'استخدمت التجميدين المتاحين لهذا الشهر.',stackExample:'مثلًا: بعد صلاة الفجر',timeExample:'مثلًا: على المكتب بعد الإفطار',weekRate:'الانتظام الأسبوعي',habitInsight:'تعديل صغير قد يفيدك',habitInsightText:'اربط العادة بإشارة موثوقة، واجعل نسختها الأولى سهلة لدرجة يصعب رفضها.',noHabits:'لم تضف عادات بعد.',
      goalsTitle:'امنح جهدك اتجاهًا',goalsDesc:'تصبح الأهداف الكبيرة أهدأ حين تظهر الخطوة التالية القابلة للقياس.',newGoal:'هدف جديد',goalName:'اسم الهدف',goalWhy:'لماذا يهمك هذا؟',goalTarget:'القيمة المستهدفة',goalCurrent:'القيمة الحالية',goalUnit:'الوحدة (صفحات، ساعات...)',goalDate:'التاريخ المستهدف',goalMilestones:'محطات (كل محطة بسطر)',goalAdded:'أُنشئ الهدف',updateProgress:'أضف تقدمًا',progressAdded:'تم تحديث التقدم',milestones:'المحطات',goalTargetHint:'نتيجة قابلة للقياس',goalVision:'رؤية / تذكير',goalEmpty:'الهدف ذو المعنى يبدأ بسبب واضح.',
      focusTitle:'امنح شيئًا واحدًا انتباهك الكامل',focusDesc:'وقت قليل محمي أفضل من خطة مثالية لا تبدأ.',focus:'تركيز',shortBreak:'استراحة قصيرة',longBreak:'استراحة طويلة',minutes:'دقيقة',start:'ابدأ',pause:'إيقاف مؤقت',resume:'استئناف',reset:'إعادة ضبط',finishSession:'إنهاء الجلسة',chooseTask:'اربط بمهمة (اختياري)',noLinkedTask:'تركيز بلا مهمة',todayFocus:'تركيز اليوم',sessions:'جلسات',focusStreak:'أيام عمل عميق',sessionHistory:'جلسات أخيرة',noSessions:'ستظهر هنا أول جلسة تركيز.',sessionSaved:'تم تسجيل جلسة التركيز',focusQuote:'ليس عليك سوى الاهتمام بالشيء التالي.',focusRating:'كيف كانت الجلسة؟',beforeMood:'المزاج قبلها',afterMood:'المزاج بعدها',productivity:'تقييم الإنتاجية',sessionNotes:'ملاحظة عن الجلسة',
      calendarTitle:'اجعل الوقت مرئيًا',calendarDesc:'مهامك وكتل الوقت، حول يوم واقعي لا جدول مثالي.',autoSchedule:'وزّع المهام المفتوحة',scheduled:'مهام وُضعت في أوقات متاحة',scheduleNone:'لا توجد مهام مفتوحة تحتاج إلى توزيع.',agenda:'جدول اليوم',selectedDay:'اليوم المحدد',noAgenda:'لا توجد مهام مجدولة لهذا اليوم.',timeBlockHint:'حدد وقت المهمة لحجز مساحة. التوزيع التلقائي يستخدم ساعات النهار والأولوية.',todayBtn:'اليوم',
      financeTitle:'اعرف أين يذهب مالك',financeDesc:'نظرة بسيطة للمصروفات والادخار دون ربط حساب بنكي.',addExpense:'أضف معاملة',expense:'مصروف',income:'دخل',spending:'إنفاق الشهر',budgetRemaining:'المتبقي من الميزانية',budget:'ميزانية الشهر',setBudget:'تحديد ميزانية الشهر',category:'الفئة',amount:'المبلغ',description:'الوصف',date:'التاريخ',expenseAdded:'تم حفظ المعاملة',noExpenses:'لا توجد معاملات بعد. يكفي تسجيل سريع.',savings:'أهداف الادخار',newSaving:'هدف ادخار جديد',savingName:'هدف الادخار',savingTarget:'المبلغ المستهدف',savingCurrent:'المدخر حاليًا',addSaving:'أضف ادخارًا',savingUpdated:'تم تحديث الادخار',food:'طعام',transport:'مواصلات',bills:'فواتير',learning:'تعلم',home:'المنزل',fun:'ترفيه',incomeLabel:'دخل',misc:'أخرى',budgetSet:'تم تحديث الميزانية',
      healthTitle:'اعتنِ بالنظام الذي تعيش داخله',healthDesc:'إشارات بسيطة للنوم والماء والحركة وتغيرات الجسم مع الوقت.',sleepHours:'النوم الليلة الماضية',water:'الماء',glasses:'أكواب',weight:'الوزن',workout:'الحركة',sleepLog:'تسجيل النوم',weightLog:'تسجيل الوزن',workoutLog:'تسجيل نشاط',activityName:'النشاط',minutesDuration:'الدقائق',healthSaved:'تم حفظ سجل الصحة',waterAdded:'تم تسجيل الماء',sleepTarget:'المستهدف: 8 ساعات',waterTarget:'المستهدف: 8 أكواب',movementTarget:'الحركة اليومية',todayLog:'تسجيل اليوم',bodyHistory:'الجسم والنشاط',noHealth:'صفحة بيضاء. ابدأ بمؤشر واحد.',weightKg:'كجم',hour:'س',
      journalTitle:'استمع لنفسك قبل أن تحاول تحسين كل شيء',journalDesc:'تأمل يومي بسيط. لا ضغط للحفاظ على سلسلة، ولا حاجة للكتابة بإتقان.',wellPrompt:'ما الذي سار جيدًا؟',drainedPrompt:'ما الذي استنزف طاقتك؟',tomorrowPrompt:'ما خطتك للغد؟',gratitudePrompt:'شيء واحد تشعر بالامتنان له',moodToday:'كيف تشعر الآن؟',saveEntry:'احفظ التأمل',journalSaved:'تم حفظ التأمل',journalHistory:'تأملات سابقة',noJournal:'ستظهر تأملاتك هنا.',mood1:'منهك جدًا',mood2:'منخفض',mood3:'مقبول',mood4:'جيد',mood5:'رائع',
      insightsTitle:'لاحظ الأنماط، لا تحاكم نفسك',insightsDesc:'نظرة أسبوعية لما تصنعه عاداتك ووقت انتباهك.',tasksDoneWeek:'المهام المكتملة هذا الأسبوع',habitRate:'انتظام العادات',focusHours:'ساعات التركيز',daysJournaled:'أيام التأمل',weeklyActivity:'نشاطك في آخر سبعة أيام',progressView:'التقدم في لمحة',achievements:'محطات حققتها',whatIf:'ماذا لو استمر هذا؟',whatIfDesc:'الأفعال الصغيرة تتراكم. هذا إسقاط حسابي لا وعد.',perWeek:'أسبوعيًا',sixMonths:'خلال ستة أشهر',weeklyReview:'طقس الأحد',openReview:'راجع هذا الأسبوع',reviewTitle:'إعادة ضبط هادئة',reviewIntro:'انظر للأسبوع بفضول، لا بحكم على نفسك.',wentWell:'ما الذي نجح هذا الأسبوع؟',hardPart:'ما الذي جعل الأمور أصعب؟',nextWeek:'ما الذي يستحق انتباهك الأسبوع القادم؟',reviewSaved:'تم حفظ المراجعة الأسبوعية',
      settingsTitle:'مساحتك، وقواعدك',settingsDesc:'خصص مساحة العمل واحتفظ ببياناتك بين يديك.',profileSettings:'ملفك الشخصي',displayName:'بماذا نناديك؟',preferences:'التفضيلات',language:'لغة الواجهة',darkMode:'المظهر الداكن',darkModeOn:'المظهر الداكن مفعّل',lightModeOn:'المظهر الفاتح مفعّل',snapshotLabel:'لقطة محفوظة',notifications:'تذكيرات المتصفح',notificationsDesc:'تذكيرات اختيارية ما دام التطبيق مفتوحًا. دون خدمة خارجية.',dataPrivacy:'الخصوصية من التصميم',privacyText:'تُخزن المهام والعادات واليوميات والمعاملات في هذا المتصفح. لا حسابات أو تحليلات أو إعلانات أو مزامنة سحابية مفعّلة في هذه النسخة.',dataTools:'نقل بياناتك',exportJSON:'تصدير كل البيانات (JSON)',exportCSV:'تصدير المهام (CSV)',importData:'استيراد نسخة احتياطية',printPDF:'طباعة / حفظ PDF',wipeData:'حذف كل البيانات المحلية',backupDone:'تم تنزيل النسخة الاحتياطية',importDone:'تمت استعادة النسخة',invalidBackup:'هذا الملف لا يبدو نسخة احتياطية من NUQTA.',dataImported:'تم استيراد البيانات بنجاح',deletedAll:'حُذفت البيانات المحلية',settingsSaved:'تم حفظ الإعدادات',offlineReady:'واجهة العمل دون اتصال جاهزة',exportHint:'احتفظ بنسخة احتياطية في مكان آمن. ملف المتصفح هو الموطن الحالي لهذه البيانات.',storageTitle:'حالة التخزين المحلي',storageLocal:'IndexedDB عند توفره، مع بديل محلي للمتصفح.',syncTitle:'المزامنة السحابية غير متصلة',syncDesc:'لم يُعد حساب أو خادم أو مفتاح تشفير. تبقى البيانات على هذا الجهاز؛ ويمكن إضافة المزامنة كطبقة منفصلة تخضع للمراجعة.',storageFail:'تعذّر الحفظ. صدّر نسخة احتياطية الآن.',
      rescueTitle:'لننقذ اليوم',rescueIntro:'ثلاث إجابات سريعة. سنصغّر الخطة، لا نحاكم اليوم.',rescueQ1:'كيف طاقتك الآن؟',rescueLow:'منخفضة — أحتاج خطوات هادئة',rescueMid:'متوسطة — أستطيع فعل القليل',rescueHigh:'مرتفعة — أستطيع التركيز',rescueQ2:'ما الشيء الذي لا بد أن يحدث اليوم؟',rescueMust:'اكتب الشيء الوحيد الذي يهم فعلًا',rescueQ3:'كم وقتًا متاحًا لديك؟',rescueTime:'الوقت المتاح',rescue20:'20 دقيقة',rescue45:'45 دقيقة',rescue90:'90 دقيقة',buildPlan:'أعد بناء يومي',rescuePlan:'خطتك الأصغر',rescueCreate:'أضف الخطة إلى اليوم',rescueCreated:'أصبحت خطتك الأصغر جاهزة',rescueSkip:'تأجيل الباقي ليس فشلًا، بل اختيار.',minutesShort:'د',next:'التالي',
      q1Title:'عاجل ومهم',q1Sub:'ابدأ به',q2Title:'مهم وغير عاجل',q2Sub:'جدوله',q3Title:'عاجل وأقل أهمية',q3Sub:'قلّل أو فوّض',q4Title:'غير عاجل وغير مهم',q4Sub:'فكر في حذفه',
    }
  };

  const iconPaths = {
    grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    'check-square':'<rect x="3" y="3" width="18" height="18" rx="4"/><path d="m7 12 3 3 7-7"/>',
    repeat:'<path d="m17 2 4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>',
    target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    timer:'<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6M12 2v3"/>',
    calendar:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M16 3v4M8 3v4M3 10h18"/>',
    wallet:'<rect x="3" y="5" width="18" height="15" rx="3"/><path d="M3 9h18M16 14h2"/><path d="M6 5V4a1 1 0 0 1 1-1h10"/>',
    activity:'<path d="M3 12h4l3-8 4 16 3-8h4"/>',
    'book-open':'<path d="M12 7v14M3 5.5A2.5 2.5 0 0 1 5.5 3H12v18H5.5A2.5 2.5 0 0 0 3 23z"/><path d="M21 5.5A2.5 2.5 0 0 0 18.5 3H12v18h6.5A2.5 2.5 0 0 1 21 23z"/>',
    chart:'<path d="M3 3v18h18"/><path d="m7 14 4-4 3 3 6-7"/>',
    settings:'<circle cx="12" cy="12" r="3"/><path d="m19.4 15 .1.1 1.4 1.1-1.5 2.6-1.7-.6a8 8 0 0 1-1.5.9l-.3 1.8h-3l-.3-1.8a8 8 0 0 1-1.5-.9l-1.7.6-1.5-2.6 1.4-1.1a7 7 0 0 1 0-1.8l-1.4-1.1 1.5-2.6 1.7.6a8 8 0 0 1 1.5-.9l.3-1.8h3l.3 1.8a8 8 0 0 1 1.5.9l1.7-.6 1.5 2.6-1.4 1.1a7 7 0 0 1 0 1.8Z" transform="translate(-1 -1) scale(1.08)"/>',
    sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/>',
    moon:'<path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z"/>',
    bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
    menu:'<path d="M4 6h16M4 12h16M4 18h16"/>', close:'<path d="m6 6 12 12M18 6 6 18"/>', lock:'<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 1 1 8 0v3"/>',
    plus:'<path d="M12 5v14M5 12h14"/>', search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>', trash:'<path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6M10 10v6m4-6v6"/>', edit:'<path d="m15 5 4 4M4 20l4-.8L19 8a2.1 2.1 0 0 0-3-3L5 16z"/>', arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>', check:'<path d="m5 12 4 4L19 6"/>', chevronLeft:'<path d="m15 18-6-6 6-6"/>', chevronRight:'<path d="m9 18 6-6-6-6"/>', coffee:'<path d="M10 2v2M14 2v2M4 8h14v7a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4zM18 10h1a3 3 0 0 1 0 6h-2"/>', flame:'<path d="M12 22a7 7 0 0 0 7-7c0-3-2-5-3-6 0 3-2 4-2 4 1-4-1-8-5-11 0 5-4 7-4 13a7 7 0 0 0 7 7Z"/>', leaf:'<path d="M20 4c-8 0-14 3-14 10a6 6 0 0 0 6 6c7 0 8-8 8-16Z"/><path d="M4 21c2-5 5-8 11-11"/>', plusCircle:'<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
  };
  const icon = (name, cls = '') => `<svg class="${cls || 'inline-icon'}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${iconPaths[name] || iconPaths.grid}</svg>`;
  function installIcons(root = document) {
    $$('[data-icon]', root).forEach(node => { const name = node.getAttribute('data-icon'); const preservedDot = node.querySelector('.notification-dot'); node.innerHTML = icon(name); if (preservedDot) node.appendChild(preservedDot); });
    $$('.nav-icon[data-icon]', root).forEach(node => { const name = node.getAttribute('data-icon'); node.innerHTML = icon(name); });
    $$('.tiny-lock[data-icon]', root).forEach(node => { node.innerHTML = icon('lock'); });
  }
  const t = key => translations[state.settings.lang]?.[key] ?? translations.en[key] ?? key;

  const freshState = () => ({
    version: 1,
    settings: { name: 'علي', lang: 'ar', theme: 'dark', notifications: false, budget: 3000, energy: 3 },
    tasks: [], habits: [], goals: [], sessions: [], expenses: [], savings: [], journal: [], health: [], reviews: [],
    focus: { mode: 'focus', preset: 25, remaining: 25 * 60, running: false, endAt: null, startedAt: null, taskId: null, beforeMood: 3 },
    ui: { page: 'home', taskView: 'list', taskFilter: 'all', taskSearch: '', calendarDate: todayKey(), selectedCalendarDate: todayKey(), tasksCalendarDate: todayKey() },
    freezeUsage: {},
    notifications: { lastDate: '', count: 0, seenTaskIds: [], unread: 0 }
  });
  let state = freshState();
  let dbPromise = null;
  let saveTimer = null;
  let focusInterval = null;
  let notificationInterval = null;
  let lastStorageWarnAt = 0;
  let focusBeforeModal = null;
  let rescue = { step: 1, energy: 'medium', must: '', time: 45 };
  let weekReviewValues = { wentWell: '', hardPart: '', nextWeek: '' };

  function openDB() {
    if (!('indexedDB' in window)) return Promise.reject(new Error('IndexedDB unavailable'));
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open('NUQTA_LOCAL', 1);
      request.onupgradeneeded = () => { const db = request.result; if (!db.objectStoreNames.contains('state')) db.createObjectStore('state', { keyPath: 'key' }); };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Database open failed'));
    });
    return dbPromise;
  }
  async function loadState() {
    try {
      const db = await openDB();
      const result = await new Promise((resolve, reject) => { const tx = db.transaction('state', 'readonly'); const req = tx.objectStore('state').get('app'); req.onsuccess = () => resolve(req.result?.value || null); req.onerror = () => reject(req.error); });
      if (result) return mergeState(result);
    } catch (err) { console.warn('NUQTA IndexedDB fallback:', err?.message || err); }
    try { const local = localStorage.getItem('nuqta_backup'); if (local) return mergeState(JSON.parse(local)); } catch (err) { console.warn('NUQTA local fallback read failed.'); }
    return freshState();
  }
  function mergeState(saved) {
    const base = freshState();
    const merged = { ...base, ...saved };
    merged.settings = { ...base.settings, ...(saved.settings || {}) };
    merged.ui = { ...base.ui, ...(saved.ui || {}) };
    merged.focus = { ...base.focus, ...(saved.focus || {}) };
    merged.notifications = { ...base.notifications, ...(saved.notifications || {}) };
    delete merged.ui.calendarMonth;
    delete merged.focus.rating;
    ['tasks','habits','goals','sessions','expenses','savings','journal','health','reviews'].forEach(key => { if (!Array.isArray(merged[key])) merged[key] = []; });
    if (!['ar','en'].includes(merged.settings.lang)) merged.settings.lang = 'ar';
    if (!['dark','light'].includes(merged.settings.theme)) merged.settings.theme = 'dark';
    return merged;
  }
  function queueSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveState, 80);
  }
  async function saveState() {
    try {
      const db = await openDB();
      await new Promise((resolve, reject) => { const tx = db.transaction('state', 'readwrite'); tx.objectStore('state').put({ key: 'app', value: state }); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
    } catch (err) {
      try { localStorage.setItem('nuqta_backup', JSON.stringify(state)); }
      catch (fallbackErr) {
        const now = Date.now();
        if (now - lastStorageWarnAt > 30000) {
          lastStorageWarnAt = now;
          console.warn('NUQTA storage failure:', fallbackErr?.message || fallbackErr);
          if (location.protocol !== 'file:' && location.origin !== 'null') toast(t('storageFail'), true);
        }
      }
    }
  }
  function updateShell() {
    const lang = state.settings.lang;
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.body.classList.toggle('light-mode', state.settings.theme === 'light');
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', state.settings.theme === 'light' ? '#f3f5f3' : '#0b0f13');
    document.title = lang === 'en' ? 'NUQTA — Live it wisely' : 'NUQTA — عِشها بحكمة';
    $$('[data-i18n]').forEach(node => { const key = node.dataset.i18n; if (t(key) !== key) node.textContent = t(key); });
    $('#sidebar-user').textContent = state.settings.name || (lang === 'en' ? 'You' : 'أنت');
    $('#avatar-initial').textContent = (state.settings.name || 'N').trim().charAt(0);
    $('#lang-toggle .lang-glyph').textContent = lang === 'ar' ? 'EN' : 'ع';
    $('#theme-toggle').innerHTML = icon(state.settings.theme === 'dark' ? 'sun' : 'moon');
    $$('.nav-item[data-page]').forEach(node => node.classList.toggle('active', node.dataset.page === state.ui.page));
    const navTitle = t(`nav.${state.ui.page}`) || t('nav.home');
    $('#page-crumb').textContent = navTitle;
    $('#today-count').textContent = state.tasks.filter(task => task.status !== 'completed' && task.dueDate === todayKey()).length;
    const unread = Number(state.notifications.unread || 0);
    $('#notification-dot').classList.toggle('visible', unread > 0);
  }

  function toast(message, error = false) {
    const node = document.createElement('div'); node.className = 'toast';
    node.innerHTML = `<span class="toast-check" style="${error ? 'background:#513032;color:#ffb5b5' : ''}">${error ? '!' : '✓'}</span><span>${escapeHTML(message)}</span>`;
    $('#toast-region').appendChild(node);
    setTimeout(() => { node.style.opacity = '0'; node.style.transform = 'translateY(5px)'; setTimeout(() => node.remove(), 200); }, 2900);
  }
  function pageHeading(title, desc, eyebrow = 'NUQTA / DAILY LIVING', actions = '') {
    return `<div class="page-heading"><div><div class="eyebrow"><span class="line"></span>${escapeHTML(eyebrow)}</div><h1>${escapeHTML(title)}</h1><p>${escapeHTML(desc)}</p></div>${actions ? `<div class="heading-actions">${actions}</div>` : ''}</div>`;
  }
  function emptyState(title, text, buttonLabel = '', action = '') {
    return `<div class="empty-state"><span class="empty-icon">${icon('leaf')}</span><strong>${escapeHTML(title)}</strong><p>${escapeHTML(text)}</p>${buttonLabel ? `<button class="btn small" data-action="${action}">${escapeHTML(buttonLabel)}</button>` : ''}</div>`;
  }
  function statusTag(task) {
    if (task.status === 'completed') return `<span class="tag green">${escapeHTML(t('completed'))}</span>`;
    if (task.dueDate && task.dueDate < todayKey()) return `<span class="tag red">${escapeHTML(t('overdue'))}</span>`;
    if (task.dueDate === todayKey()) return `<span class="tag orange">${escapeHTML(t('dueToday'))}</span>`;
    return `<span class="tag">${escapeHTML(t(task.status === 'inprogress' ? 'inProgress' : 'todo'))}</span>`;
  }
  function priorityTag(priority) {
    if (!priority || priority === 'normal') return '';
    const key = priority === 'high' ? 'high' : priority === 'medium' ? 'medium' : 'low';
    return `<span class="tag ${key === 'high' ? 'red' : key === 'medium' ? 'orange' : 'green'}">${escapeHTML(t(key))}</span>`;
  }
  function activeTasks() { return state.tasks.filter(task => task.status !== 'completed'); }
  function todayTasks() { return state.tasks.filter(task => task.dueDate === todayKey() && task.status !== 'completed'); }
  function taskById(id) { return state.tasks.find(task => task.id === id); }
  function taskLabel(task) { return task?.title || t('noLinkedTask'); }
  function getStreak(habit) { let n = 0; let key = todayKey(); if (!habit.logs?.[key] && !habit.freezeDays?.[key]) key = addDays(key, -1); for (let i=0; i<500; i++) { if (habit.logs?.[key] || habit.freezeDays?.[key]) { n++; key = addDays(key,-1); } else break; } return n; }
  function getLongestStreak(habit) {
    let best = 0, run = 0;
    const dates = Object.keys(habit.logs || {}).filter(key => habit.logs[key]).sort();
    for (let i=0;i<dates.length;i++) { if (i === 0 || dates[i] === addDays(dates[i-1],1)) run++; else run = 1; best = Math.max(best,run); }
    return best;
  }
  function getHabitWeek(habit) { return Array.from({length:7},(_,i) => { const d = shiftDate(new Date(), i - ((new Date().getDay()+6)%7)); const key = localDateKey(d); return {key, label:shortDays()[(d.getDay())], done:!!habit.logs?.[key], today:key===todayKey()}; }); }
  function weekStart(date = new Date()) { const d = new Date(date); d.setHours(12,0,0,0); d.setDate(d.getDate() - ((d.getDay()+6)%7)); return d; }
  function habitRateForWeek() {
    const dates = Array.from({length:7},(_,i)=>localDateKey(shiftDate(weekStart(),i)));
    const possible = state.habits.length * 7;
    if (!possible) return 0;
    const completed = state.habits.reduce((sum,h) => sum + dates.filter(key => h.logs?.[key]).length,0);
    return Math.round((completed/possible)*100);
  }
  function energyEstimate() {
    const todayHealth = state.health.filter(item => item.date === todayKey());
    const sleep = todayHealth.find(item => item.type === 'sleep');
    const sleepScore = sleep ? clamp(Number(sleep.value)/8, 0, 1) : 0.55;
    const journal = state.journal.find(entry => entry.date === todayKey());
    const moodScore = journal ? clamp((Number(journal.mood || 3)-1)/4,0,1) : 0.55;
    const tasks = state.tasks.filter(task => task.dueDate === todayKey());
    const doneRate = tasks.length ? tasks.filter(task => task.status==='completed').length/tasks.length : 0.5;
    const selfReport = clamp((Number(state.settings.energy || 3)-1)/4, 0, 1);
    const score = Math.round((sleepScore*.35 + moodScore*.2 + doneRate*.25 + selfReport*.2)*100);
    return clamp(score, 15, 100);
  }
  function weekStats() {
    const start = weekStart(); const end = shiftDate(start,6); const keys = Array.from({length:7},(_,i)=>localDateKey(shiftDate(start,i)));
    const completed = state.tasks.filter(task => task.status === 'completed' && (task.completedDate || task.completedAt?.slice(0,10)) && keys.includes(task.completedDate || task.completedAt.slice(0,10))).length;
    const minutes = state.sessions.filter(session => keys.includes(session.date)).reduce((sum,session)=>sum+Number(session.minutes||0),0);
    const journaled = state.journal.filter(entry => keys.includes(entry.date)).length;
    const habit = habitRateForWeek();
    return {start,end,keys,completed,minutes,journaled,habit};
  }
  function currentStreak(type) {
    if (type === 'focus') {
      const dates = new Set(state.sessions.filter(session=>session.minutes>=20).map(session=>session.date)); let n=0, key=todayKey(); if (!dates.has(key)) key=addDays(key,-1); while(dates.has(key) && n<365){n++;key=addDays(key,-1)} return n;
    }
    return 0;
  }

  function renderPage() {
    updateShell();
    const page = state.ui.page || 'home';
    const root = $('#page-content');
    const renderers = { home:renderHome, tasks:renderTasks, habits:renderHabits, goals:renderGoals, focus:renderFocus, calendar:renderCalendar, finance:renderFinance, health:renderHealth, journal:renderJournal, insights:renderInsights, settings:renderSettings };
    root.innerHTML = (renderers[page] || renderHome)();
    wirePageControls(root);
    if (page === 'focus') updateTimerDisplay();
  }
  function navigate(page) {
    if (!['home','tasks','habits','goals','focus','calendar','finance','health','journal','insights','settings'].includes(page)) return;
    state.ui.page = page;
    if (page === 'journal') state.ui.journalEditDate = todayKey();
    queueSave(); renderPage(); closeSidebar(); $('#page-content').focus({preventScroll:true}); window.scrollTo({top:0,behavior:'smooth'});
  }

  function renderHome() {
    const now = new Date(); const hour = now.getHours();
    const greeting = hour < 12 ? t('helloMorning') : hour < 18 ? t('helloAfternoon') : t('helloEvening');
    const name = (state.settings.name || '').trim().split(/\s+/)[0] || (state.settings.lang==='en'?'there':'صديقي');
    const greetingLine = state.settings.lang === 'en' ? `${greeting}, ${name}` : `${greeting}، ${name}`;
    const tasksAll = todayTasks().sort((a,b)=> (a.time||'99:99').localeCompare(b.time||'99:99'));
    let top3 = state.tasks.filter(task=>task.top3 && task.status!=='completed');
    if (!top3.length) top3 = [...tasksAll].sort((a,b)=>priorityRank(b.priority)-priorityRank(a.priority)).slice(0,3);
    top3 = top3.slice(0,3);
    const doneToday = state.tasks.filter(task=>task.status==='completed' && (task.completedDate || task.completedAt?.slice(0,10))===todayKey()).length;
    const todayFocus = state.sessions.filter(s=>s.date===todayKey()).reduce((sum,s)=>sum+s.minutes,0);
    const todayHabitDone = state.habits.filter(h=>h.logs?.[todayKey()]).length;
    const energy=energyEstimate();
    const energyText=energy<45?t('energyLow'):energy<72?t('energyMid'):t('energyHigh');
    const tasksHTML = top3.length ? `<div class="top3-list">${top3.map(task=>homeTaskRow(task)).join('')}</div>` : emptyState(t('emptyTitle'),t('emptyTask'),t('addTask'),'add-task');
    const timeline = state.tasks.filter(task=>task.dueDate===todayKey() && task.time && task.status!=='completed').sort((a,b)=>a.time.localeCompare(b.time));
    const timelineHTML=timeline.length ? `<div class="timeline">${timeline.slice(0,5).map((task,i)=>`<div class="timeline-item ${i===0?'current':''}"><div class="timeline-time">${escapeHTML(fmtTime(task.time))}</div><div class="timeline-track"><span class="timeline-mark"></span></div><div class="timeline-copy"><strong>${escapeHTML(task.title)}</strong><small>${escapeHTML(task.duration ? `${task.duration} ${t('minutesShort')}` : t('noDue'))}</small></div></div>`).join('')}</div>` : `<div class="empty-inline">${escapeHTML(t('emptyTimeline'))}</div>`;
    const weekStartDate=weekStart();
    const weekStrip=Array.from({length:7},(_,i)=>{const d=shiftDate(weekStartDate,i);const key=localDateKey(d);const count=state.tasks.filter(task=>task.dueDate===key&&task.status!=='completed').length;return `<button class="week-day ${key===todayKey()?'selected today':''} ${count?'has-items':''}" data-calendar-day="${key}"><span>${escapeHTML(dayNames()[d.getDay()])}</span><strong>${d.getDate()}</strong><i class="day-dot"></i></button>`}).join('');
    const energyChips = [1,2,3,4,5].map(n=>`<button class="energy-chip ${Number(state.settings.energy||3)===n?'selected':''}" data-energy="${n}">${n===1?'☁':n===2?'◔':n===3?'◑':n===4?'◕':'✦'} ${n}</button>`).join('');
    return `${pageHeading(greetingLine,t('heroSub'),t('dateToday'),`<button class="btn subtle" data-action="rescue">✳ ${escapeHTML(t('rescueMode'))}</button><button class="btn primary" data-action="add-task"><span class="btn-icon">+</span>${escapeHTML(t('addTask'))}</button>`)}
      <div class="dashboard-grid"><section class="dashboard-left">
        <div class="hero-panel"><div class="hero-top"><span class="sparkle">✳</span>${escapeHTML(t('startDay'))}</div><h1>${escapeHTML(t('heroLine'))}</h1><p>${escapeHTML(t('heroSub'))}</p><div class="hero-foot"><span class="hero-date">${escapeHTML(fmtFullDate(now))}</span><span class="hero-date" id="live-clock" style="direction:ltr">${escapeHTML(new Intl.DateTimeFormat(state.settings.lang==='en'?'en-US':'ar-EG',{hour:'numeric',minute:'2-digit'}).format(now))}</span><span class="hero-weather">◌ ${escapeHTML(t('weatherOffline'))}</span></div><div class="hero-decoration" aria-hidden="true"><span class="ring"></span><span class="ring"></span><span class="ring"></span><span class="orb"></span></div></div>
        <form class="capture-bar" id="quick-capture-form"><span class="capture-icon">+</span><input id="quick-capture-input" autocomplete="off" aria-label="${escapeHTML(t('taskPlaceholder'))}" placeholder="${escapeHTML(t('taskPlaceholder'))}" /><span class="capture-hint">${escapeHTML(t('captureHint'))}</span><button class="send-capture" aria-label="${escapeHTML(t('addTask'))}" type="submit">↵</button></form>
        <div class="metrics-row"><div class="panel metric-card"><div class="metric-top"><span class="metric-icon">${icon('check-square')}</span><span class="small-muted">${escapeHTML(t('today'))}</span></div><div class="metric-value">${doneToday}<span style="font-size:14px;color:var(--muted);font-weight:500"> / ${state.tasks.filter(x=>x.dueDate===todayKey()).length}</span></div><div class="metric-label">${escapeHTML(t('tasksToday'))}</div><div class="metric-foot"><span class="up">↗</span>${escapeHTML(t('done'))} ${doneToday}</div></div><div class="panel metric-card"><div class="metric-top"><span class="metric-icon blue">${icon('repeat')}</span><span class="small-muted">${escapeHTML(t('today'))}</span></div><div class="metric-value">${todayHabitDone}<span style="font-size:14px;color:var(--muted);font-weight:500"> / ${state.habits.length}</span></div><div class="metric-label">${escapeHTML(t('habitsToday'))}</div><div class="metric-foot">${escapeHTML(t('weekRate'))}: ${habitRateForWeek()}%</div></div><div class="panel metric-card"><div class="metric-top"><span class="metric-icon orange">${icon('timer')}</span><span class="small-muted">${escapeHTML(t('today'))}</span></div><div class="metric-value">${Math.floor(todayFocus/60)}<span style="font-size:14px;color:var(--muted);font-weight:500">h ${todayFocus%60?`${todayFocus%60}m`:''}</span></div><div class="metric-label">${escapeHTML(t('focusToday'))}</div><div class="metric-foot"><span class="up">✳</span>${state.sessions.filter(s=>s.date===todayKey()).length} ${escapeHTML(t('sessions'))}</div></div></div>
        <section class="panel panel-pad"><div class="panel-heading"><div><h2>${escapeHTML(t('topThree'))}</h2><p>${escapeHTML(t('topThreeDesc'))}</p></div><button class="btn subtle small" data-navigate="tasks">${escapeHTML(t('seeTasks'))} ${icon('arrow')}</button></div>${tasksHTML}</section>
        <section class="panel panel-pad"><div class="panel-heading"><div><h2>${escapeHTML(t('weekAhead'))}</h2><p>${escapeHTML(t('timelineDesc'))}</p></div><button class="mini-icon" data-navigate="calendar">${icon('calendar')}</button></div><div class="week-strip">${weekStrip}</div></section>
      </section><aside class="dashboard-right">
        <section class="panel focus-card"><div class="panel-heading"><div><h2>${escapeHTML(t('energyTitle'))}</h2><p>${escapeHTML(t('energyText'))}</p></div><span class="tag green">${escapeHTML(t('energy'))}</span></div><div class="energy-layout"><div class="energy-ring" style="--energy:${energy}"><div class="energy-number">${energy}<small>%</small></div></div><div class="energy-info"><strong>${escapeHTML(energyText)}</strong><p>${escapeHTML(t('energyText'))}</p></div></div><div class="energy-inputs">${energyChips}</div><div class="focus-divider"></div><div class="panel-heading"><div><h2>${escapeHTML(t('timeline'))}</h2><p>${escapeHTML(t('timelineDesc'))}</p></div><span class="small-muted">${timeline.length} ${escapeHTML(t('all'))}</span></div>${timelineHTML}</section>
        <section class="panel panel-pad"><div class="panel-heading"><div><h2>${escapeHTML(t('quickActions'))}</h2><p>${escapeHTML(t('smallStep'))}</p></div><span style="color:var(--accent);font-size:18px">✳</span></div><div class="quick-action-list"><button class="task-row" data-action="add-task" style="width:100%;text-align:start"><span class="metric-icon">+</span><span class="task-core"><span class="task-title">${escapeHTML(t('addTask'))}</span><span class="task-subtitle">${escapeHTML(t('taskPlaceholder').split('Try')[0].split('جرّب')[0])}</span></span>${icon('arrow')}</button><button class="task-row" data-action="add-habit" style="width:100%;text-align:start;margin-top:8px"><span class="metric-icon blue">↻</span><span class="task-core"><span class="task-title">${escapeHTML(t('addHabit'))}</span><span class="task-subtitle">${escapeHTML(t('habitInsightText'))}</span></span>${icon('arrow')}</button><button class="task-row" data-navigate="journal" style="width:100%;text-align:start;margin-top:8px"><span class="metric-icon orange">✎</span><span class="task-core"><span class="task-title">${escapeHTML(t('writeJournal'))}</span><span class="task-subtitle">${escapeHTML(t('journalDesc'))}</span></span>${icon('arrow')}</button></div></section>
      </aside></div>`;
  }
  function priorityRank(priority) { return ({high:3,medium:2,normal:1,low:0})[priority] ?? 1; }
  function homeTaskRow(task) {
    const subtasksDone = (task.subtasks || []).filter(sub=>sub.done).length;
    return `<div class="top3-item"><button class="check-circle ${task.status==='completed'?'checked':''}" data-complete-task="${task.id}" aria-label="${escapeHTML(t('complete'))}"></button><div class="task-core"><span class="task-title">${escapeHTML(task.title)}</span><span class="task-subtitle">${task.time ? fmtTime(task.time) : t('noTime')}${subtasksDone?` · ${subtasksDone}/${task.subtasks.length}`:''}</span></div><div class="task-meta"><span class="priority-dot ${escapeHTML(task.priority||'normal')}"></span></div></div>`;
  }

  function renderTasks() {
    const all = state.tasks.filter(task => {
      const filter = state.ui.taskFilter || 'all';
      const search = (state.ui.taskSearch || '').toLowerCase();
      const passFilter = filter === 'all' || (filter === 'active' && task.status !== 'completed') || (filter === 'completed' && task.status === 'completed');
      return passFilter && (!search || `${task.title} ${task.notes||''}`.toLowerCase().includes(search));
    });
    const sortMode = state.ui.taskSort || 'due';
    all.sort((a,b) => sortMode === 'priority' ? priorityRank(b.priority)-priorityRank(a.priority) : ((a.dueDate||'9999').localeCompare(b.dueDate||'9999') || (a.time||'99:99').localeCompare(b.time||'99:99')));
    const view = state.ui.taskView || 'list';
    let body = '';
    if (!all.length) body = emptyState(t('emptyTitle'),state.ui.taskSearch?t('noResults'):t('emptyTask'),t('addTask'),'add-task');
    else if (view === 'board') body = `<div class="kanban">${[['todo','todo'],['inprogress','inProgress'],['completed','completed']].map(([status,label])=>{const tasks=all.filter(task=>task.status===status);return `<div class="kanban-column"><div class="kanban-head"><span>${escapeHTML(t(label))}</span><span>${tasks.length}</span></div><div class="kanban-cards">${tasks.length?tasks.map(task=>`<div class="kanban-card" data-edit-task="${task.id}"><span class="task-title">${escapeHTML(task.title)}</span><div style="display:flex;justify-content:space-between;gap:5px;align-items:center"><span class="small-muted">${task.dueDate?fmtDate(task.dueDate):t('noDue')}</span>${priorityTag(task.priority)}</div><select class="select task-status-select" style="margin-top:9px;padding:6px;font-size:9px" data-task-status="${task.id}" aria-label="${escapeHTML(t('taskStatus'))}"><option value="todo" ${status==='todo'?'selected':''}>${escapeHTML(t('todo'))}</option><option value="inprogress" ${status==='inprogress'?'selected':''}>${escapeHTML(t('inProgress'))}</option><option value="completed" ${status==='completed'?'selected':''}>${escapeHTML(t('completed'))}</option></select></div>`).join(''):`<div class="empty-inline">—</div>`}</div></div>`}).join('')}</div>`;
    else if (view === 'matrix') {
      const quadrants=[{key:'q1',title:'q1Title',items:all.filter(x=>x.urgent&&x.important)},{key:'q2',title:'q2Title',items:all.filter(x=>!x.urgent&&x.important)},{key:'q3',title:'q3Title',items:all.filter(x=>x.urgent&&!x.important)},{key:'q4',title:'q4Title',items:all.filter(x=>!x.urgent&&!x.important)}];
      body=`<div class="matrix-grid">${quadrants.map(q=>`<section class="matrix-quadrant ${q.key}"><div class="quadrant-title"><span class="qdot"></span><span>${escapeHTML(t(q.title))}</span></div>${q.items.length?q.items.map(task=>`<div class="matrix-task"><button class="mini-icon" data-edit-task="${task.id}" style="width:auto;height:auto;padding:0;color:inherit">${escapeHTML(task.title)}</button></div>`).join(''):`<div class="small-muted">—</div>`}</section>`).join('')}</div>`;
    } else if (view === 'calendar') {
      const base = dateFromKey(state.ui.tasksCalendarDate || todayKey()) || new Date();
      const first = new Date(base.getFullYear(), base.getMonth(), 1, 12);
      const start = new Date(first); start.setDate(first.getDate() - first.getDay());
      const grouped = {}; all.filter(task=>task.dueDate).forEach(task=>(grouped[task.dueDate] ||= []).push(task));
      body=`<div class="calendar-month-head" style="margin-bottom:10px"><strong>${escapeHTML(monthLabel(first))}</strong><button class="btn small subtle" data-action="calendar-today">${escapeHTML(t('todayBtn'))}</button></div><div class="calendar-days">${dayNames().map(d=>`<div class="calendar-day-label">${escapeHTML(d)}</div>`).join('')}${Array.from({length:42},(_,i)=>{const d=shiftDate(start,i);const key=localDateKey(d);return `<button class="calendar-cell ${d.getMonth()!==first.getMonth()?'other-month':''} ${key===todayKey()?'today':''}" data-calendar-day="${key}"><span class="day-num">${d.getDate()}</span><span class="cal-events">${(grouped[key]||[]).slice(0,2).map(task=>`<span class="cal-event-chip">${escapeHTML(task.title)}</span>`).join('')}</span>${(grouped[key]||[]).length>2?`<span class="event-count">+${grouped[key].length-2}</span>`:''}</button>`}).join('')}</div>`;
    } else body=`<div class="task-list">${all.map(task=>taskRow(task)).join('')}</div>`;
    return `${pageHeading(t('nav.tasks'),t('tasksDesc'),'NUQTA / EXECUTION',`<button class="btn primary" data-action="add-task"><span class="btn-icon">+</span>${escapeHTML(t('newTask'))}</button>`)}
      <div class="toolbar"><div class="filter-input"><input class="input" id="task-search" value="${escapeHTML(state.ui.taskSearch||'')}" placeholder="${escapeHTML(t('taskSearch'))}" />${state.ui.taskSearch ? `<button type="button" class="mini-icon" data-clear-search style="position:absolute;inset-inline-end:4px;top:5px;font-size:15px" aria-label="${escapeHTML(t('cancel'))}">×</button>` : ''}</div><select class="select" id="task-filter" style="width:auto"><option value="all" ${state.ui.taskFilter==='all'?'selected':''}>${escapeHTML(t('filterAll'))}</option><option value="active" ${state.ui.taskFilter==='active'?'selected':''}>${escapeHTML(t('filterActive'))}</option><option value="completed" ${state.ui.taskFilter==='completed'?'selected':''}>${escapeHTML(t('filterDone'))}</option></select><select class="select" id="task-sort" style="width:auto"><option value="due" ${(state.ui.taskSort||'due')==='due'?'selected':''}>${escapeHTML(t('sortDue'))}</option><option value="priority" ${state.ui.taskSort==='priority'?'selected':''}>${escapeHTML(t('sortPriority'))}</option></select><div class="view-switcher" role="group" aria-label="Task views">${[['list','list'],['board','board'],['matrix','matrix'],['calendar','calendarView']].map(([v,label])=>`<button data-task-view="${v}" class="${view===v?'active':''}">${escapeHTML(t(label))}</button>`).join('')}</div></div>
      <section class="panel panel-pad"><div class="panel-heading"><div><h2>${escapeHTML(t(view==='board'?'board':view==='matrix'?'matrix':view==='calendar'?'calendarView':'nav.tasks'))}</h2><p>${all.length} · ${escapeHTML(t('tasksTitle'))}</p></div><span class="tag">${escapeHTML(t(state.ui.taskFilter==='completed'?'completed':state.ui.taskFilter==='active'?'active':'all'))}</span></div>${body}</section>`;
  }
  function taskRow(task) {
    const subtasksDone=(task.subtasks||[]).filter(x=>x.done).length;
    const blocked=task.dependsOn && taskById(task.dependsOn)?.status!=='completed';
    return `<div class="task-row ${task.status==='completed'?'done':''}"><button class="check-circle ${task.status==='completed'?'checked':''}" data-complete-task="${task.id}" aria-label="${escapeHTML(t('complete'))}" ${blocked?'title="'+escapeHTML(t('blockedTask'))+'"':''}></button><div class="task-detail"><span class="task-title">${escapeHTML(task.title)}</span><span class="task-subtitle">${task.dueDate?`${escapeHTML(fmtDate(task.dueDate))}${task.time?` · ${escapeHTML(fmtTime(task.time))}`:''}`:escapeHTML(t('noDue'))}${task.duration?` · ${task.duration} ${escapeHTML(t('minutesShort'))}`:''}${task.subtasks?.length?` · ${subtasksDone}/${task.subtasks.length}`:''}${blocked?` · ${escapeHTML(t('blockedBy'))}`:''}</span></div><div class="task-meta">${priorityTag(task.priority)}${statusTag(task)}</div><div class="task-row-actions"><button class="mini-icon" data-edit-task="${task.id}" title="${escapeHTML(t('edit'))}" aria-label="${escapeHTML(t('edit'))}">${icon('edit')}</button><button class="mini-icon" data-delete-task="${task.id}" title="${escapeHTML(t('delete'))}" aria-label="${escapeHTML(t('delete'))}">${icon('trash')}</button></div></div>`;
  }

  function renderHabits() {
    const habits=state.habits;
    const done=habits.filter(h=>h.logs?.[todayKey()]).length;
    const rate=habitRateForWeek();
    const cards=habits.length?`<div class="habit-grid">${habits.map((habit,index)=>{const streak=getStreak(habit),week=getHabitWeek(habit),month=todayKey().slice(0,7),freezes=(state.freezeUsage||{})[month]||0;return `<article class="panel habit-card"><div class="habit-card-head"><span class="habit-icon ${index%3===1?'blue':index%3===2?'purple':''}">${escapeHTML(habit.icon||'✳')}</span><div style="display:flex;gap:4px"><button class="mini-icon" data-edit-habit="${habit.id}" title="${escapeHTML(t('edit'))}">${icon('settings')}</button><button class="mini-icon" data-delete-habit="${habit.id}" title="${escapeHTML(t('delete'))}">${icon('trash')}</button></div></div><h3>${escapeHTML(habit.name)}</h3><p>${escapeHTML(habit.cue?`${t('habitCue')}: ${habit.cue}`:habit.time||t('habitInsightText'))}</p><div class="habit-week">${week.map(day=>`<span class="${day.done?'done':habit.freezeDays?.[day.key]?'freeze':''} ${day.today?'today':''}" title="${escapeHTML(fmtDate(day.key))}">${day.done?'✓':habit.freezeDays?.[day.key]?'❄':escapeHTML(day.label)}</span>`).join('')}</div><div class="chain" aria-label="Recent days">${Array.from({length:14},(_,i)=>{const key=addDays(todayKey(),i-13);return `<span class="${habit.logs?.[key]||habit.freezeDays?.[key]?'filled':''} ${key===todayKey()?'today':''}"></span>`}).join('')}</div><div class="habit-card-foot"><span class="streak"><em>♨</em> ${streak} ${escapeHTML(t('streak'))}</span><button class="btn small ${habit.logs?.[todayKey()]?'subtle':'primary'}" data-toggle-habit="${habit.id}">${escapeHTML(habit.logs?.[todayKey()]?t('markUndone'):t('markDone'))}</button></div><div class="subtle-line"></div><button class="text-link" data-freeze-habit="${habit.id}">❄ ${escapeHTML(t('freeze'))} · ${Math.max(0,2-freezes)}</button></article>`}).join('')}</div>`:emptyState(t('emptyTitle'),t('noHabits'),t('newHabit'),'add-habit');
    return `${pageHeading(t('nav.habits'),t('habitsDesc'),'NUQTA / RHYTHM',`<button class="btn primary" data-action="add-habit"><span class="btn-icon">+</span>${escapeHTML(t('newHabit'))}</button>`)}
      <div class="money-summary" style="grid-template-columns:repeat(3,minmax(0,1fr))"><div class="panel money-card"><span class="money-label">${escapeHTML(t('done'))} ${escapeHTML(t('today'))}</span><strong>${done}/${habits.length}</strong><small>${escapeHTML(t('habitsToday'))}</small></div><div class="panel money-card"><span class="money-label">${escapeHTML(t('weekRate'))}</span><strong>${rate}%</strong><div class="progress-line"><span style="width:${rate}%"></span></div></div><div class="panel money-card"><span class="money-label">${escapeHTML(t('streak'))}</span><strong>${habits.length?Math.max(...habits.map(getStreak)):0}</strong><small>${escapeHTML(t('bestStreak'))}</small></div></div>
      <div class="section-head"><div><h2>${escapeHTML(t('habitDays'))}</h2><p>${escapeHTML(t('habitInsightText'))}</p></div></div>${cards}
      <section class="panel panel-pad" style="margin-top:15px"><div class="panel-heading"><div><h2>${escapeHTML(t('habitInsight'))}</h2><p>${escapeHTML(t('weekRate'))}: ${rate}%</p></div><span class="tag green">${escapeHTML(t('insightsTitle'))}</span></div><p class="muted" style="font-size:11px;line-height:1.8;margin:0">${escapeHTML(t('habitInsightText'))}</p></section>`;
  }

  function renderGoals() {
    const goals=state.goals;
    const grid=goals.length?`<div class="goal-grid">${goals.map((goal,index)=>{const target=Number(goal.target)||0,current=Number(goal.current)||0,pct=target>0?clamp(Math.round(current/target*100),0,100):0;return `<article class="panel goal-card"><div class="goal-top"><span class="goal-visual">${escapeHTML(goal.icon||['◎','↗','✦','⌘'][index%4])}</span><div style="min-width:0;flex:1"><h3>${escapeHTML(goal.title)}</h3><p class="goal-why">${escapeHTML(goal.why||t('goalTargetHint'))}</p></div><span class="goal-percent">${pct}%</span></div><div class="goal-progress-label"><span>${escapeHTML(t('progressView'))}</span><span>${formatMoney(current)} / ${formatMoney(target)} ${escapeHTML(goal.unit||'')}</span></div><div class="progress-line"><span style="width:${pct}%"></span></div>${goal.milestones?.length?`<div class="milestone-list"><strong class="small-muted">${escapeHTML(t('milestones'))}</strong>${goal.milestones.map((m,i)=>`<label class="milestone-row ${m.done?'done':''}"><input type="checkbox" data-milestone="${goal.id}:${i}" ${m.done?'checked':''}/><span>${escapeHTML(m.title)}</span></label>`).join('')}</div>`:''}<div class="goal-card-foot"><span class="small-muted">${goal.dueDate?`${escapeHTML(t('due'))}: ${escapeHTML(fmtDate(goal.dueDate))}`:escapeHTML(t('goalTargetHint'))}</span><div style="display:flex;align-items:center;gap:4px"><button class="btn small" data-progress-goal="${goal.id}">+ ${escapeHTML(t('updateProgress'))}</button><button class="mini-icon" data-delete-goal="${goal.id}" title="${escapeHTML(t('delete'))}" aria-label="${escapeHTML(t('delete'))}">${icon('trash')}</button></div></div></article>`}).join('')}</div>`:emptyState(t('emptyTitle'),t('goalEmpty'),t('newGoal'),'add-goal');
    return `${pageHeading(t('nav.goals'),t('goalsDesc'),'NUQTA / DIRECTION',`<button class="btn primary" data-action="add-goal"><span class="btn-icon">+</span>${escapeHTML(t('newGoal'))}</button>`)}
      <div class="section-head"><div><h2>${escapeHTML(t('nav.goals'))}</h2><p>${goals.length} ${escapeHTML(t('all'))}</p></div><span class="tag green">OKR / ${escapeHTML(t('progressView'))}</span></div>${grid}`;
  }

  function renderFocus() {
    const focus=state.focus; const sessionsToday=state.sessions.filter(s=>s.date===todayKey()); const mins=sessionsToday.reduce((sum,s)=>sum+Number(s.minutes||0),0); const taskOptions=state.tasks.filter(task=>task.status!=='completed').map(task=>`<option value="${task.id}" ${focus.taskId===task.id?'selected':''}>${escapeHTML(task.title)}</option>`).join('');
    const history=state.sessions.slice().sort((a,b)=>(b.startedAt||'').localeCompare(a.startedAt||'')).slice(0,5);
    return `${pageHeading(t('nav.focus'),t('focusDesc'),'NUQTA / ATTENTION',`<button class="btn subtle" data-navigate="tasks">${escapeHTML(t('chooseTask'))} ${icon('arrow')}</button>`)}
      <div class="focus-layout"><section class="panel timer-panel"><span class="tag green">✳ ${escapeHTML(t('focus'))}</span><div class="timer-mode-label" id="timer-mode-label">${escapeHTML(t(focus.mode==='focus'?'focus':focus.mode==='shortBreak'?'shortBreak':'longBreak'))}</div><div class="timer-ring" id="timer-ring"><div class="timer-readout" id="timer-readout">${pad(Math.floor(focus.remaining/60))}:${pad(focus.remaining%60)}<small>${escapeHTML(focus.running?t('pause'):t('minutes'))}</small></div></div><div class="timer-presets">${[25,50,90].map(n=>`<button data-timer-preset="${n}" class="${focus.preset===n?'active':''}">${n} ${escapeHTML(t('minutesShort'))}</button>`).join('')}</div><div class="timer-presets" style="margin-top:9px"><button data-timer-mode="shortBreak" class="${focus.mode==='shortBreak'?'active':''}">${escapeHTML(t('shortBreak'))} · 5</button><button data-timer-mode="longBreak" class="${focus.mode==='longBreak'?'active':''}">${escapeHTML(t('longBreak'))} · 15</button></div><div class="timer-controls"><button class="btn primary" id="timer-main-button">${escapeHTML(focus.running?t('pause'):focus.remaining<(focus.mode==='focus'?focus.preset:focus.mode==='shortBreak'?5:15)*60?t('resume'):t('start'))}</button><button class="btn subtle" id="timer-reset-button">${escapeHTML(t('reset'))}</button><button class="btn subtle" id="timer-finish-button">${escapeHTML(t('finishSession'))}</button></div><div class="field" style="width:min(330px,100%);margin-top:18px;text-align:start"><label for="focus-task-select">${escapeHTML(t('chooseTask'))}</label><select class="select" id="focus-task-select"><option value="">${escapeHTML(t('noLinkedTask'))}</option>${taskOptions}</select></div><div class="field" style="width:min(330px,100%);margin-top:11px;text-align:start"><label for="focus-before-mood">${escapeHTML(t('beforeMood'))}</label><select class="select" id="focus-before-mood">${[1,2,3,4,5].map(n=>`<option value="${n}" ${Number(focus.beforeMood||3)===n?'selected':''}>${n} / 5 · ${escapeHTML(t('mood'+n))}</option>`).join('')}</select></div><p class="small-muted" style="margin-top:18px">“${escapeHTML(t('focusQuote'))}”</p></section>
      <aside class="focus-side"><section class="panel"><div class="panel-heading"><div><h2>${escapeHTML(t('todayFocus'))}</h2><p>${escapeHTML(fmtFullDate(new Date()))}</p></div><span class="tag">${sessionsToday.length} ${escapeHTML(t('sessions'))}</span></div><div class="session-stat-grid"><div class="session-stat"><strong>${Math.floor(mins/60)}h ${mins%60}m</strong><small>${escapeHTML(t('todayFocus'))}</small></div><div class="session-stat"><strong>${currentStreak('focus')}</strong><small>${escapeHTML(t('focusStreak'))}</small></div></div><div class="subtle-line"></div><div class="progress-line"><span style="width:${clamp(mins/120*100,0,100)}%"></span></div><p class="small-muted" style="margin:8px 0 0">${Math.round(mins/120*100)}% ${escapeHTML(t('progressView'))} · 2h</p></section><section class="panel"><div class="panel-heading"><div><h2>${escapeHTML(t('sessionHistory'))}</h2><p>${escapeHTML(t('sessionSaved'))}</p></div></div>${history.length?history.map(s=>`<div class="session-log-row"><span class="session-log-icon">◷</span><div class="session-log-copy"><strong>${escapeHTML(s.taskTitle||t('noLinkedTask'))}</strong><small>${escapeHTML(fmtDate(s.date))}${s.rating?` · ★ ${s.rating}/5`:''}</small></div><span class="session-log-min">${s.minutes}m</span></div>`).join(''):`<div class="empty-inline">${escapeHTML(t('noSessions'))}</div>`}</section></aside></div>`;
  }

  function renderCalendar() {
    const base = dateFromKey(state.ui.calendarDate || todayKey()) || new Date(); const year=base.getFullYear(), month=base.getMonth(); const first=new Date(year,month,1,12); const start=new Date(first); start.setDate(first.getDate()-first.getDay()); const selected=state.ui.selectedCalendarDate||todayKey(); const days=dayNames();
    const cells=Array.from({length:42},(_,i)=>{const d=shiftDate(start,i);const key=localDateKey(d);const tasks=state.tasks.filter(task=>task.dueDate===key&&task.status!=='completed');return `<button class="calendar-cell ${d.getMonth()!==month?'other-month':''} ${key===todayKey()?'today':''} ${key===selected?'selected':''}" data-calendar-day="${key}"><span class="day-num">${d.getDate()}</span><span class="cal-events">${tasks.slice(0,2).map(task=>`<span class="cal-event-chip">${escapeHTML(task.title)}</span>`).join('')}</span>${tasks.length>2?`<span class="event-count">+${tasks.length-2}</span>`:''}</button>`}).join('');
    const agenda=state.tasks.filter(task=>task.dueDate===selected&&task.status!=='completed').sort((a,b)=>(a.time||'99:99').localeCompare(b.time||'99:99'));
    return `${pageHeading(t('nav.calendar'),t('calendarDesc'),'NUQTA / TIME',`<button class="btn subtle small" data-action="calendar-today">${escapeHTML(t('todayBtn'))}</button><button class="btn primary" data-action="auto-schedule">✳ ${escapeHTML(t('autoSchedule'))}</button><button class="btn subtle" data-action="add-task"><span class="btn-icon">+</span>${escapeHTML(t('addTask'))}</button>`)}
      <div class="calendar-layout"><section class="panel calendar-panel"><div class="calendar-month-head"><button class="icon-btn" data-month-shift="-1" aria-label="Previous month">${icon('chevronLeft')}</button><strong>${escapeHTML(monthLabel(base))}</strong><button class="icon-btn" data-month-shift="1" aria-label="Next month">${icon('chevronRight')}</button></div><div class="calendar-days">${days.map(day=>`<div class="calendar-day-label">${escapeHTML(day)}</div>`).join('')}${cells}</div><p class="fine-print">${escapeHTML(t('timeBlockHint'))}</p></section><aside class="panel day-agenda"><div class="panel-heading"><div><h2>${escapeHTML(t('agenda'))}</h2><p>${escapeHTML(t('selectedDay'))}</p></div><span class="tag">${agenda.length}</span></div><div class="agenda-date">${escapeHTML(fmtFullDate(dateFromKey(selected)||new Date()))}</div>${agenda.length?agenda.map(task=>`<div class="agenda-item"><span class="agenda-time">${escapeHTML(task.time?fmtTime(task.time):'—')}</span><span class="agenda-marker"></span><div class="agenda-main"><strong>${escapeHTML(task.title)}</strong><small>${escapeHTML(task.duration?`${task.duration} ${t('minutesShort')}`:t('noTime'))} · ${escapeHTML(t(task.priority||'normal'))}</small><div style="margin-top:7px"><button class="btn small subtle" data-edit-task="${task.id}">${escapeHTML(t('edit'))}</button> <button class="btn small subtle" data-complete-task="${task.id}">✓</button></div></div></div>`).join(''):`<div class="empty-inline">${escapeHTML(t('noAgenda'))}<br/><button class="btn small" style="margin-top:10px" data-action="add-task">${escapeHTML(t('addTask'))}</button></div>`}</aside></div>`;
  }

  function renderFinance() {
    const month=todayKey().slice(0,7); const expenses=state.expenses.filter(entry=>entry.date?.startsWith(month)); const spent=expenses.filter(x=>x.type!=='income').reduce((s,x)=>s+Number(x.amount||0),0);const income=expenses.filter(x=>x.type==='income').reduce((s,x)=>s+Number(x.amount||0),0);const budget=Number(state.settings.budget||0);const remaining=budget-spent;
    const categoryLabels={food:t('food'),transport:t('transport'),bills:t('bills'),learning:t('learning'),home:t('home'),fun:t('fun'),income:t('incomeLabel'),misc:t('misc')};
    const categories=['food','transport','bills','learning','home','fun','misc'];const budgets=categories.map(cat=>{const total=expenses.filter(x=>x.category===cat&&x.type!=='income').reduce((s,x)=>s+Number(x.amount||0),0);return {cat,total,pct:budget?clamp(total/(budget/categories.length)*100,0,100):0}});
    const recent=state.expenses.slice().sort((a,b)=>(b.date||'').localeCompare(a.date||'')).slice(0,7);
    return `${pageHeading(t('nav.finance'),t('financeDesc'),'NUQTA / FINANCE',`<button class="btn primary" data-action="add-expense"><span class="btn-icon">+</span>${escapeHTML(t('addExpense'))}</button>`)}
      <div class="money-summary"><div class="panel money-card"><span class="money-label">${escapeHTML(t('spending'))}</span><strong>${formatMoney(spent)}</strong><small>${escapeHTML(t('expense'))} · ${escapeHTML(monthLabel(new Date()))}</small></div><div class="panel money-card"><span class="money-label">${escapeHTML(t('budgetRemaining'))}</span><strong style="color:${remaining<0?'var(--red)':'var(--accent)'}">${formatMoney(remaining)}</strong><small>${escapeHTML(t('budget'))}: ${formatMoney(budget)}</small></div><div class="panel money-card"><span class="money-label">${escapeHTML(t('income'))}</span><strong>${formatMoney(income)}</strong><small>${escapeHTML(t('incomeLabel'))} · ${escapeHTML(monthLabel(new Date()))}</small></div></div>
      <div class="finance-layout"><section class="panel panel-pad"><div class="panel-heading"><div><h2>${escapeHTML(t('expense'))} / ${escapeHTML(t('income'))}</h2><p>${escapeHTML(t('date'))}: ${escapeHTML(monthLabel(new Date()))}</p></div><button class="btn subtle small" data-action="set-budget">${escapeHTML(t('setBudget'))}</button></div>${recent.length?recent.map(entry=>`<div class="expense-row"><span class="expense-icon">${entry.type==='income'?'↗':({'food':'⌁','transport':'↗','bills':'⌂','learning':'⌘','home':'⌂','fun':'✳','misc':'·'}[entry.category]||'·')}</span><div class="expense-detail"><strong>${escapeHTML(entry.description||categoryLabels[entry.category]||entry.category)}</strong><small>${escapeHTML(categoryLabels[entry.category]||entry.category)} · ${escapeHTML(fmtDate(entry.date))}</small></div><span class="expense-value" style="color:${entry.type==='income'?'var(--accent)':'var(--text)'}">${entry.type==='income'?'+':'−'}${formatMoney(entry.amount)}</span><button class="mini-icon" data-delete-expense="${entry.id}" title="${escapeHTML(t('delete'))}" aria-label="${escapeHTML(t('delete'))}">${icon('trash')}</button></div>`).join(''):`<div class="empty-inline">${escapeHTML(t('noExpenses'))}<br/><button class="btn small" style="margin-top:10px" data-action="add-expense">${escapeHTML(t('addExpense'))}</button></div>`}</section><aside><section class="panel panel-pad"><div class="panel-heading"><div><h2>${escapeHTML(t('budget'))}</h2><p>${escapeHTML(t('spending'))}: ${formatMoney(spent)}</p></div><span class="tag ${remaining<0?'red':'green'}">${remaining<0?'−':'+'}${formatMoney(Math.abs(remaining))}</span></div><div class="progress-line"><span style="width:${budget?clamp(spent/budget*100,0,100):0}%;background:${remaining<0?'var(--red)':'var(--accent-strong)'}"></span></div><div class="small-muted" style="margin-top:8px">${budget?Math.round(spent/budget*100):0}% ${escapeHTML(t('progressView'))}</div>${budgets.map(item=>`<div class="budget-row"><div class="budget-title"><strong>${escapeHTML(categoryLabels[item.cat])}</strong><span>${formatMoney(item.total)}</span></div><div class="progress-line"><span style="width:${item.pct}%;background:${item.pct>90?'var(--orange)':'var(--accent-strong)'}"></span></div></div>`).join('')}</section><div class="section-head"><div><h2>${escapeHTML(t('savings'))}</h2></div><button class="btn subtle small" data-action="add-saving">+ ${escapeHTML(t('newSaving'))}</button></div>${state.savings.length?state.savings.map(saving=>{const pct=clamp(Math.round(Number(saving.current||0)/Math.max(1,Number(saving.target||0))*100),0,100);return `<section class="panel savings-card"><div class="savings-head"><div><strong>${escapeHTML(saving.name)}</strong><small>${formatMoney(saving.current)} / ${formatMoney(saving.target)}</small></div><span class="savings-value">${pct}%</span></div><div class="progress-line" style="margin:13px 0"><span style="width:${pct}%"></span></div><div style="display:flex;align-items:center;gap:6px"><button class="btn small subtle" data-add-saving="${saving.id}">+ ${escapeHTML(t('addSaving'))}</button><button class="mini-icon" data-delete-saving="${saving.id}" title="${escapeHTML(t('delete'))}" aria-label="${escapeHTML(t('delete'))}">${icon('trash')}</button></div></section>`}).join(''):emptyState(t('emptyTitle'),t('goalEmpty'),t('newSaving'),'add-saving')}</aside></div>`;
  }

  function renderHealth() {
    const logs=state.health.filter(item=>item.date===todayKey());const sleep=logs.filter(x=>x.type==='sleep').reduce((s,x)=>s+Number(x.value||0),0);const water=logs.filter(x=>x.type==='water').reduce((s,x)=>s+Number(x.value||0),0);const workout=logs.filter(x=>x.type==='workout').reduce((s,x)=>s+Number(x.value||0),0);const weight=state.health.filter(x=>x.type==='weight').sort((a,b)=>(b.date||'').localeCompare(a.date||''))[0];
    const histories=state.health.slice().sort((a,b)=>(b.date||'').localeCompare(a.date||'')).slice(0,10);
    return `${pageHeading(t('nav.health'),t('healthDesc'),'NUQTA / WELLBEING',`<button class="btn subtle" data-action="log-sleep">${escapeHTML(t('sleepLog'))}</button><button class="btn primary" data-action="log-workout"><span class="btn-icon">+</span>${escapeHTML(t('workoutLog'))}</button>`)}
      <div class="health-summary"><div class="panel health-tile"><div class="health-tile-head"><span class="health-tile-icon">◔</span><span class="small-muted">${escapeHTML(t('today'))}</span></div><strong>${sleep||'—'}<small style="display:inline;margin-inline-start:5px">${escapeHTML(t('hour'))}</small></strong><small>${escapeHTML(t('sleepHours'))}</small><div class="health-goal">${escapeHTML(t('sleepTarget'))}</div></div><div class="panel health-tile"><div class="health-tile-head"><span class="health-tile-icon">≈</span><span class="small-muted">${escapeHTML(t('today'))}</span></div><strong>${water}<small style="display:inline;margin-inline-start:5px">${escapeHTML(t('glasses'))}</small></strong><small>${escapeHTML(t('water'))}</small><div class="health-goal">${escapeHTML(t('waterTarget'))}</div></div><div class="panel health-tile"><div class="health-tile-head"><span class="health-tile-icon">↟</span><span class="small-muted">${escapeHTML(t('today'))}</span></div><strong>${workout}<small style="display:inline;margin-inline-start:5px">${escapeHTML(t('minutesShort'))}</small></strong><small>${escapeHTML(t('workout'))}</small><div class="health-goal">${escapeHTML(t('movementTarget'))}</div></div><div class="panel health-tile"><div class="health-tile-head"><span class="health-tile-icon">⌁</span><span class="small-muted">${escapeHTML(t('today'))}</span></div><strong>${weight?weight.value:'—'}<small style="display:inline;margin-inline-start:5px">${escapeHTML(t('weightKg'))}</small></strong><small>${escapeHTML(t('weight'))}</small><div class="health-goal">${weight?escapeHTML(fmtDate(weight.date)):escapeHTML(t('noHealth'))}</div></div></div>
      <div class="health-layout"><section class="panel panel-pad"><div class="panel-heading"><div><h2>${escapeHTML(t('todayLog'))}</h2><p>${escapeHTML(fmtFullDate(new Date()))}</p></div><span class="tag green">${escapeHTML(t('localOnly'))}</span></div><div class="log-form-row"><div class="field"><label>${escapeHTML(t('water'))}</label><select id="water-amount" class="select"><option value="1">1 ${escapeHTML(t('glasses'))}</option><option value="2">2 ${escapeHTML(t('glasses'))}</option><option value="3">3 ${escapeHTML(t('glasses'))}</option><option value="4">4 ${escapeHTML(t('glasses'))}</option></select></div><button class="btn primary" data-action="add-water" style="grid-column:auto">+ ${escapeHTML(t('waterAdded'))}</button></div><div class="subtle-line"></div><div class="form-grid"><div class="field"><label>${escapeHTML(t('sleepHours'))}</label><input class="input" id="sleep-value" type="number" min="0" max="24" step="0.25" placeholder="7.5" /></div><div class="field" style="justify-content:end"><button class="btn" data-action="save-sleep">${escapeHTML(t('sleepLog'))}</button></div><div class="field"><label>${escapeHTML(t('weight'))} (${escapeHTML(t('weightKg'))})</label><input class="input" id="weight-value" type="number" min="1" max="500" step="0.1" placeholder="—" /></div><div class="field" style="justify-content:end"><button class="btn" data-action="save-weight">${escapeHTML(t('weightLog'))}</button></div></div><div class="subtle-line"></div><div class="field"><label>${escapeHTML(t('activityName'))}</label><input class="input" id="workout-name" placeholder="${escapeHTML(state.settings.lang==='en'?'Stretching, strength, walk…':'تمدد، تمارين قوة، مشي…')}" /></div><div class="log-form-row"><div class="field"><label>${escapeHTML(t('minutesDuration'))}</label><input class="input" type="number" id="workout-minutes" min="1" max="600" placeholder="20" /></div><button class="btn" data-action="save-workout">${escapeHTML(t('workoutLog'))}</button></div></section><aside class="panel panel-pad"><div class="panel-heading"><div><h2>${escapeHTML(t('bodyHistory'))}</h2><p>${escapeHTML(t('healthDesc'))}</p></div></div>${histories.length?histories.map(item=>`<div class="log-item"><div><strong>${escapeHTML(item.type==='sleep'?t('sleepHours'):item.type==='water'?t('water'):item.type==='weight'?t('weight'):item.title||t('workout'))}</strong><small>${escapeHTML(fmtDate(item.date))}${item.type==='workout'&&item.title?` · ${escapeHTML(item.title)}`:''}</small></div><span class="tag">${escapeHTML(item.value)} ${escapeHTML(item.unit||'')}</span><button class="mini-icon" data-delete-health="${item.id}" title="${escapeHTML(t('delete'))}" aria-label="${escapeHTML(t('delete'))}">${icon('trash')}</button></div>`).join(''):`<div class="empty-inline">${escapeHTML(t('noHealth'))}</div>`}<p class="fine-print">${escapeHTML(state.settings.lang==='en'?'Health entries are stored locally. Apple Health / Google Fit sync is not connected in this build.':'تُخزّن السجلات الصحية محليًا. لم يتم ربط Apple Health أو Google Fit في هذه النسخة.')}</p></aside></div>`;
  }

  function renderJournal() {
    const journalDate=state.ui.journalEditDate||todayKey();const entry=state.journal.find(item=>item.date===journalDate)||{date:journalDate,mood:3,well:'',drained:'',tomorrow:'',gratitude:''};const moods=[['😞','mood1'],['😕','mood2'],['😐','mood3'],['🙂','mood4'],['😊','mood5']];
    const history=state.journal.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,6);
    return `${pageHeading(t('nav.journal'),t('journalDesc'),'NUQTA / REFLECTION',`<button class="btn subtle" data-navigate="insights">${escapeHTML(t('nav.insights'))} ${icon('arrow')}</button>`)}
      <div class="journal-layout"><section class="panel journal-editor"><div class="journal-date-row"><div><span class="eyebrow">${escapeHTML(journalDate===todayKey()?t('today'):(state.settings.lang==='en'?'PAST ENTRY':'تأمل سابق'))}</span><strong>${escapeHTML(fmtFullDate(dateFromKey(journalDate)||new Date()))}</strong></div><span class="tag green">${escapeHTML(t('localOnly'))}</span></div><form id="journal-form" data-mood="${Number(entry.mood)||3}"><div class="field"><label class="field-label">${escapeHTML(t('moodToday'))}</label><div class="mood-picker" role="group" aria-label="${escapeHTML(t('moodToday'))}">${moods.map(([emoji,key],index)=>`<button type="button" class="mood-button ${Number(entry.mood)===index+1?'active':''}" data-mood="${index+1}"><span>${emoji}</span><small>${escapeHTML(t(key))}</small></button>`).join('')}</div></div><div class="prompt-block"><label class="field-label" for="journal-well">01 — ${escapeHTML(t('wellPrompt'))}</label><textarea class="textarea" id="journal-well" placeholder="${escapeHTML(state.settings.lang==='en'?'One thing, however small…':'حتى لو كان شيئًا صغيرًا…')}">${escapeHTML(entry.well||'')}</textarea></div><div class="prompt-block"><label class="field-label" for="journal-drained">02 — ${escapeHTML(t('drainedPrompt'))}</label><textarea class="textarea" id="journal-drained" placeholder="${escapeHTML(state.settings.lang==='en'?'Notice it without judging yourself…':'لاحظ ما حدث دون أن تحاكم نفسك…')}">${escapeHTML(entry.drained||'')}</textarea></div><div class="prompt-block"><label class="field-label" for="journal-tomorrow">03 — ${escapeHTML(t('tomorrowPrompt'))}</label><textarea class="textarea" id="journal-tomorrow" placeholder="${escapeHTML(state.settings.lang==='en'?'One priority and one small step…':'أولوية واحدة وخطوة صغيرة…')}">${escapeHTML(entry.tomorrow||'')}</textarea></div><div class="prompt-block"><label class="field-label" for="journal-gratitude">✳ — ${escapeHTML(t('gratitudePrompt'))}</label><input class="input" id="journal-gratitude" value="${escapeHTML(entry.gratitude||'')}" placeholder="${escapeHTML(state.settings.lang==='en'?'A person, a moment, a bit of rest…':'شخص، لحظة، أو شيء من الراحة…')}" /></div><div class="journal-actions"><span class="small-muted">${escapeHTML(t('smallStep'))}</span><button class="btn primary" type="submit">${escapeHTML(t('saveEntry'))} ✓</button></div></form></section><aside class="panel panel-pad"><div class="panel-heading"><div><h2>${escapeHTML(t('journalHistory'))}</h2><p>${escapeHTML(t('journalDesc'))}</p></div><span class="tag">${history.length}</span></div>${history.length?history.map(item=>`<div class="journal-history-item"><div class="journal-history-date"><strong>${escapeHTML(fmtDate(item.date,{weekday:'short',day:'numeric',month:'short'}))}</strong><small>${['','😞','😕','😐','🙂','😊'][Number(item.mood)||3]}</small></div><p>${escapeHTML((item.well||item.tomorrow||item.gratitude||'').slice(0,160)||'—')}</p><div style="display:flex;gap:12px;margin-top:7px;align-items:center"><button class="text-link" data-open-journal="${item.date}">${escapeHTML(t('edit'))} ↗</button><button class="text-link" data-delete-journal="${item.date}" style="color:var(--red)">${escapeHTML(t('delete'))}</button></div></div>`).join(''):`<div class="empty-inline">${escapeHTML(t('noJournal'))}</div>`}<div class="subtle-line"></div><div class="privacy-note"><span class="privacy-icon">${icon('lock')}</span><div><strong>${escapeHTML(t('dataPrivacy'))}</strong><p>${escapeHTML(t('privacyText'))}</p></div></div></aside></div>`;
  }

  function renderInsights() {
    const stats=weekStats();const values=stats.keys.map(key=>({key,count:state.tasks.filter(task=>task.status==='completed'&&(task.completedDate||task.completedAt?.slice(0,10))===key).length}));const max=Math.max(1,...values.map(x=>x.count));const sessionsMins=state.sessions.reduce((s,x)=>s+Number(x.minutes||0),0);const completedAll=state.tasks.filter(x=>x.status==='completed').length;const habitsToday=state.habits.filter(x=>x.logs?.[todayKey()]).length;const weeklyFocus=state.sessions.filter(x=>stats.keys.includes(x.date)).reduce((s,x)=>s+x.minutes,0);const projectedTasks=stats.completed*26;const projectedMinutes=weeklyFocus*26;const achievements=[{icon:'✳',title:state.settings.lang==='en'?'First point':'أول نقطة',sub:state.settings.lang==='en'?'Complete a task':'إنجاز مهمة',unlocked:completedAll>=1},{icon:'♨',title:state.settings.lang==='en'?'Seven-day chain':'سلسلة أسبوع',sub:state.settings.lang==='en'?'Keep a habit for a week':'حافظ على عادة 7 أيام',unlocked:state.habits.some(h=>getLongestStreak(h)>=7)},{icon:'◷',title:state.settings.lang==='en'?'Deep attention':'انتباه عميق',sub:'10+ '+t('sessions'),unlocked:state.sessions.length>=10},{icon:'⌁',title:state.settings.lang==='en'?'Reflector':'متأمل',sub:state.settings.lang==='en'?'5 journal entries':'5 تأملات',unlocked:state.journal.length>=5},{icon:'◎',title:state.settings.lang==='en'?'Direction set':'اتجاه واضح',sub:state.settings.lang==='en'?'Create a goal':'إنشاء هدف',unlocked:state.goals.length>0},{icon:'✦',title:state.settings.lang==='en'?'Steady week':'أسبوع متوازن',sub:state.settings.lang==='en'?'70% habit consistency':'انتظام عادات 70%',unlocked:habitRateForWeek()>=70}];
    return `${pageHeading(t('nav.insights'),t('insightsDesc'),'NUQTA / PATTERNS',`<button class="btn primary" data-action="weekly-review">✳ ${escapeHTML(t('openReview'))}</button>`)}
      <div class="money-summary"><div class="panel money-card"><span class="money-label">${escapeHTML(t('tasksDoneWeek'))}</span><strong>${stats.completed}</strong><small>${escapeHTML(fmtDate(stats.start))} — ${escapeHTML(fmtDate(stats.end))}</small></div><div class="panel money-card"><span class="money-label">${escapeHTML(t('habitRate'))}</span><strong>${stats.habit}%</strong><div class="progress-line"><span style="width:${stats.habit}%"></span></div></div><div class="panel money-card"><span class="money-label">${escapeHTML(t('focusHours'))}</span><strong>${(weeklyFocus/60).toFixed(1)}h</strong><small>${Math.round(weeklyFocus)} ${escapeHTML(t('minutes'))}</small></div></div>
      <div class="insight-grid"><section class="panel insight-card"><h3>${escapeHTML(t('weeklyActivity'))}</h3><p>${escapeHTML(t('tasksDoneWeek'))}</p><div class="bar-chart">${values.map(item=>`<div class="bar-column"><span class="bar-number">${item.count||''}</span><span class="bar" style="height:${Math.max(item.count?8:3,item.count/max*82)}%"></span><span class="bar-label">${escapeHTML(dayNames()[dateFromKey(item.key).getDay()])}</span></div>`).join('')}</div></section><section class="panel insight-card"><h3>${escapeHTML(t('progressView'))}</h3><p>${escapeHTML(t('insightsDesc'))}</p><div class="insight-stat-row"><span>${escapeHTML(t('nav.tasks'))}</span><strong>${completedAll}</strong></div><div class="insight-stat-row"><span>${escapeHTML(t('nav.habits'))}</span><strong>${habitsToday}/${state.habits.length}</strong></div><div class="insight-stat-row"><span>${escapeHTML(t('daysJournaled'))}</span><strong>${stats.journaled}/7</strong></div><div class="insight-stat-row"><span>${escapeHTML(t('sessions'))}</span><strong>${state.sessions.length}</strong></div></section><section class="panel insight-card"><h3>${escapeHTML(t('whatIf'))}</h3><p>${escapeHTML(t('whatIfDesc'))}</p><div class="subtle-line"></div><div class="insight-stat-row"><span>${escapeHTML(t('tasksDoneWeek'))} × 26</span><strong>${projectedTasks}</strong></div><div class="insight-stat-row"><span>${escapeHTML(t('focusHours'))} × 26</span><strong>${(projectedMinutes/60).toFixed(1)}h</strong></div><div class="insight-stat-row"><span>${escapeHTML(t('nav.habits'))}</span><strong>${Math.round(state.habits.length*7*26*stats.habit/100)} ${escapeHTML(t('done'))}</strong></div><p class="fine-print">${escapeHTML(t('whatIfDesc'))}</p></section><section class="panel insight-card"><h3>${escapeHTML(t('achievements'))}</h3><p>${escapeHTML(t('smallStep'))}</p><div class="achievement-grid">${achievements.map(a=>`<div class="achievement ${a.unlocked?'unlocked':''}"><span class="achievement-icon">${a.icon}</span><strong>${escapeHTML(a.title)}</strong><small>${escapeHTML(a.sub)}</small></div>`).join('')}</div></section></div>`;
  }

  function renderSettings() {
    const settings=state.settings;const taskCount=state.tasks.length, dataCount=state.habits.length+state.goals.length+state.expenses.length+state.journal.length+state.health.length+state.sessions.length;const estimate=new Blob([JSON.stringify(state)]).size;
    const themeStatus = settings.theme==='dark' ? t('darkModeOn') : t('lightModeOn');
    return `${pageHeading(t('nav.settings'),t('settingsDesc'),'NUQTA / CONTROL',`<button class="btn primary" data-action="export-json">${escapeHTML(t('exportJSON'))}</button>`)}
      <div class="settings-layout"><section><div class="panel settings-section"><div class="panel-heading"><div><h2>${escapeHTML(t('profileSettings'))}</h2><p>${escapeHTML(t('localProfile'))}</p></div></div><div class="settings-profile"><span class="settings-avatar">${escapeHTML((settings.name||'N').charAt(0))}</span><div><strong>${escapeHTML(settings.name||'—')}</strong><small>${escapeHTML(t('localOnly'))}</small></div></div><form id="profile-form"><div class="field"><label for="profile-name">${escapeHTML(t('displayName'))}</label><input class="input" id="profile-name" maxlength="60" value="${escapeHTML(settings.name||'')}" /></div><div class="form-actions"><button class="btn primary" type="submit">${escapeHTML(t('save'))}</button></div></form></div><div class="panel settings-section"><h2>${escapeHTML(t('preferences'))}</h2><p>${escapeHTML(t('settingsDesc'))}</p><div class="field"><label for="language-select">${escapeHTML(t('language'))}</label><select class="select" id="language-select"><option value="ar" ${settings.lang==='ar'?'selected':''}>العربية</option><option value="en" ${settings.lang==='en'?'selected':''}>English</option></select></div><div class="toggle-row"><div class="toggle-copy"><strong>${escapeHTML(t('darkMode'))}</strong><small>${escapeHTML(themeStatus)}</small></div><input class="toggle" id="theme-setting" type="checkbox" ${settings.theme==='dark'?'checked':''} aria-label="${escapeHTML(t('darkMode'))}" /></div><div class="toggle-row"><div class="toggle-copy"><strong>${escapeHTML(t('notifications'))}</strong><small>${escapeHTML(t('notificationsDesc'))}</small></div><input class="toggle" id="notifications-setting" type="checkbox" ${settings.notifications?'checked':''} aria-label="${escapeHTML(t('notifications'))}" /></div></div><div class="panel settings-section"><h2>${escapeHTML(t('dataTools'))}</h2><p>${escapeHTML(t('exportHint'))}</p><div class="settings-actions"><button class="btn" data-action="export-json">${icon('arrow')} ${escapeHTML(t('exportJSON'))}</button><button class="btn" data-action="export-csv">${icon('check-square')} ${escapeHTML(t('exportCSV'))}</button><button class="btn" data-action="import-data">${icon('arrow')} ${escapeHTML(t('importData'))}</button><button class="btn" data-action="print-pdf">${icon('book-open')} ${escapeHTML(t('printPDF'))}</button><button class="btn danger" data-action="wipe-data">${icon('trash')} ${escapeHTML(t('wipeData'))}</button></div></div></section><aside><div class="panel settings-section"><h2>${escapeHTML(t('dataPrivacy'))}</h2><p>${escapeHTML(t('privacyText'))}</p><div class="privacy-note"><span class="privacy-icon">${icon('lock')}</span><div><strong>${escapeHTML(t('localOnly'))}</strong><p>${escapeHTML(t('storageLocal'))}</p></div></div><div class="subtle-line"></div><div class="toggle-row"><div class="toggle-copy"><strong>${escapeHTML(t('storageTitle'))}</strong><small>${escapeHTML(t('storageLocal'))}</small></div><span class="tag green">${typeof indexedDB!=='undefined'?'IndexedDB':'Local'}</span></div><div class="small-muted" style="margin-top:12px">${taskCount} ${escapeHTML(t('nav.tasks'))} · ${dataCount} ${escapeHTML(t('all'))}</div><div class="storage-bar"><span style="width:${clamp(estimate/2_000_000*100,1,100)}%"></span></div><small class="small-muted">${(estimate/1024).toFixed(1)} KB ${escapeHTML(t('snapshotLabel'))}</small></div><div class="panel settings-section"><h2>${escapeHTML(t('syncTitle'))}</h2><p>${escapeHTML(t('syncDesc'))}</p><span class="tag orange">${escapeHTML(state.settings.lang==='en'?'Not configured':'غير مُعدّ')}</span><p class="fine-print">${escapeHTML(state.settings.lang==='en'?'E2E encryption, biometric lock, calendar integrations, health-platform sync, and shared groups are not implemented in this prototype.':'التشفير التام، والقفل البيومتري، وربط التقويم والمنصات الصحية، والمجموعات المشتركة لم تُنفّذ في هذه النسخة الأولية.')}</p></div></aside></div>`;
  }

  function modalShell(title, description, body, options = {}) {
    const size = options.wide ? 'wide' : '';
    focusBeforeModal = document.activeElement;
    $('#modal-root').innerHTML = `<div class="modal-backdrop" data-modal-backdrop><section class="modal ${size}" role="dialog" aria-modal="true" aria-label="${escapeHTML(title)}"><div class="modal-head"><div><h2>${escapeHTML(title)}</h2>${description?`<p>${escapeHTML(description)}</p>`:''}</div><button class="modal-close" data-close-modal aria-label="${escapeHTML(t('close'))}">×</button></div>${body}</section></div>`;
    const first = $('input:not([type="hidden"]),textarea,select,button', $('#modal-root'));
    setTimeout(() => first?.focus({preventScroll:true}), 25);
  }
  function closeModal() {
    $('#modal-root').innerHTML = '';
    const prev = focusBeforeModal;
    focusBeforeModal = null;
    if (prev && typeof prev.focus === 'function') {
      try { prev.focus({ preventScroll: true }); } catch {}
    }
  }
  function formField(id, label, value = '', type = 'text', opts = {}) {
    const cls = opts.span ? ' span-2' : '';
    const input = type === 'textarea' ? `<textarea class="textarea" id="${id}" name="${id}" placeholder="${escapeHTML(opts.placeholder||'')}" ${opts.required?'required':''}>${escapeHTML(value)}</textarea>`
      : type === 'select' ? `<select class="select" id="${id}" name="${id}" ${opts.required?'required':''}>${(opts.options||[]).map(option=>`<option value="${escapeHTML(option.value)}" ${String(value)===String(option.value)?'selected':''}>${escapeHTML(option.label)}</option>`).join('')}</select>`
      : `<input class="input" id="${id}" name="${id}" type="${type}" value="${escapeHTML(value)}" placeholder="${escapeHTML(opts.placeholder||'')}" ${opts.required?'required':''} ${opts.min!==undefined?`min="${opts.min}"`:''} ${opts.max!==undefined?`max="${opts.max}"`:''} ${opts.step!==undefined?`step="${opts.step}"`:''} ${opts.maxlength?`maxlength="${opts.maxlength}"`:''}/>`;
    return `<div class="field${cls}"><label for="${id}">${escapeHTML(label)}</label>${input}</div>`;
  }
  function modalActions(cancelLabel = t('cancel'), saveLabel = t('save'), leading = '') {
    return `<div class="form-actions">${leading ? leading + '<span style="flex:1"></span>' : ''}<button class="btn subtle" type="button" data-close-modal>${escapeHTML(cancelLabel)}</button><button class="btn primary" type="submit">${escapeHTML(saveLabel)}</button></div>`;
  }
  function openTaskModal(id = null, presetTitle = '') {
    const task = id ? taskById(id) : null;
    const recurringOptions = [['none',t('noRepeat')],['daily',t('daily')],['weekly',t('weekly')],['weekdays',t('weekdays')],['monthly',t('monthly')]].map(([value,label])=>({value,label}));
    const depends = state.tasks.filter(item=>item.id!==id && item.status!=='completed').map(item=>({value:item.id,label:item.title}));
    const areas = ['personal','work','study','healthArea','admin','other'].map(value=>({value,label:t(value)}));
    const priorities = ['low','normal','medium','high'].map(value=>({value,label:value==='normal'?t('normal'):t(value)}));
    const subtasks = (task?.subtasks||[]).map(item=>item.title).join('\n');
    const leading = task ? `<button class="btn danger" type="button" data-delete-task="${task.id}">${escapeHTML(t('delete'))}</button>` : '';
    const body = `<form id="task-form" data-task-id="${task?.id||''}"><div class="form-grid">${formField('task-title',t('taskName'),task?.title||presetTitle,'text',{span:true,required:true,placeholder:t('taskPlaceholder'),maxlength:180})}${formField('task-notes',t('taskDetails'),task?.notes||'','textarea',{span:true,placeholder:state.settings.lang==='en'?'Optional context or next action…':'سياق أو خطوة تالية (اختياري)…'})}${formField('task-date',t('dueDate'),task?.dueDate||'','date')}${formField('task-time',t('dueTime'),task?.time||'','time')}${formField('task-duration',t('duration'),task?.duration||45,'number',{min:5,max:1440,step:5})}${formField('task-priority',t('priorityLabel'),task?.priority||'normal','select',{options:priorities})}${formField('task-area',t('area'),task?.area||'personal','select',{options:areas})}${formField('task-status',t('taskStatus'),task?.status||'todo','select',{options:[{value:'todo',label:t('todo')},{value:'inprogress',label:t('inProgress')},{value:'completed',label:t('completed')}]})}${formField('task-repeat',t('recurrence'),task?.recurrence||'none','select',{options:recurringOptions})}${formField('task-dependency',t('blockedBy'),task?.dependsOn||'','select',{options:[{value:'',label:t('noDependency')},...depends]})}${formField('task-subtasks',t('subtasks'),subtasks,'textarea',{span:true,placeholder:state.settings.lang==='en'?'Gather materials\nDo the first 10 minutes':'تجهيز الأدوات\nابدأ بأول عشر دقائق'})}</div><div class="toggle-row"><div class="toggle-copy"><strong>${escapeHTML(t('urgent'))}</strong><small>${escapeHTML(state.settings.lang==='en'?'Needs attention soon':'تحتاج إلى انتباه قريب')}</small></div><input class="toggle" type="checkbox" id="task-urgent" ${(task?.urgent ?? (!task || task?.priority==='high'))?'checked':''}/></div><div class="toggle-row"><div class="toggle-copy"><strong>${escapeHTML(t('important'))}</strong><small>${escapeHTML(state.settings.lang==='en'?'Supports an important outcome':'تخدم نتيجة مهمة')}</small></div><input class="toggle" type="checkbox" id="task-important" ${(task?.important ?? (!task || task?.priority==='high'))?'checked':''}/></div><div class="toggle-row"><div class="toggle-copy"><strong>${escapeHTML(t('topTask'))}</strong><small>${escapeHTML(t('topThreeDesc'))}</small></div><input class="toggle" type="checkbox" id="task-top3" ${task?.top3 || (!task && state.tasks.filter(x=>x.top3&&x.status!=='completed').length<3)?'checked':''}/></div>${modalActions(t('cancel'), t('save'), leading)}</form>`;
    modalShell(task?t('editTask'):t('newTask'),t('tasksDesc'),body,{wide:true});
  }
  function parseNaturalTask(raw) {
    let title = raw.trim(); const out = { title, dueDate:'', time:'', priority:'normal', duration:45, urgent:false, important:false };
    const lower = title.toLowerCase();
    const todayWords = /\b(today|النهارده|النهاردة|اليوم)\b/iu;
    const tomorrowWords = /\b(tomorrow|tmrw|بكرة|بكره|غدا|غدًا|غداَ)\b/iu;
    if (tomorrowWords.test(title)) { out.dueDate=addDays(todayKey(),1); title=title.replace(tomorrowWords,' '); }
    else if (todayWords.test(title)) { out.dueDate=todayKey(); title=title.replace(todayWords,' '); }
    const numericDate = title.match(/\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/);
    if (numericDate) { const candidate=`${numericDate[1]}-${pad(numericDate[2])}-${pad(numericDate[3])}`; if (dateFromKey(candidate)) out.dueDate=candidate; title=title.replace(numericDate[0],' '); }
    const weekdayMapEn={sunday:0,monday:1,tuesday:2,wednesday:3,thursday:4,friday:5,saturday:6};
    const weekdayMapAr={'الأحد':0,'الاحد':0,'الإثنين':1,'الاثنين':1,'الثلاثاء':2,'الأربعاء':3,'الاربعاء':3,'الخميس':4,'الجمعة':5,'السبت':6};
    const weekdayMatch=title.match(/\b(next\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i);
    const arWeekdayMatch=title.match(/(الأحد|الاحد|الإثنين|الاثنين|الثلاثاء|الأربعاء|الاربعاء|الخميس|الجمعة|السبت)/u);
    if (weekdayMatch) { const target=weekdayMapEn[weekdayMatch[2].toLowerCase()]; let delta=(target-new Date().getDay()+7)%7; if(delta===0||weekdayMatch[1])delta+=7;out.dueDate=addDays(todayKey(),delta);title=title.replace(weekdayMatch[0],' '); }
    else if(arWeekdayMatch){const target=weekdayMapAr[arWeekdayMatch[0]];let delta=(target-new Date().getDay()+7)%7;if(delta===0)delta=7;out.dueDate=addDays(todayKey(),delta);title=title.replace(arWeekdayMatch[0],' ');}
    let timeMatch=title.match(/\b(?:at\s*)?(\d{1,2})(?::(\d{2}))?\s*(a\.m\.|p\.m\.|am|pm)\b/i);
    if (timeMatch) {
      let h=Number(timeMatch[1]), m=Number(timeMatch[2]||0), ap=timeMatch[3].toLowerCase().replaceAll('.',''); if(ap==='pm'&&h<12)h+=12;if(ap==='am'&&h===12)h=0;
      if(h<24&&m<60){out.time=`${pad(h)}:${pad(m)}`;title=title.replace(timeMatch[0],' ');}
    } else {
      timeMatch=title.match(/(?:الساعة\s*)?(\d{1,2})[:٫](\d{2})/u);
      if(timeMatch){const h=Number(timeMatch[1]),m=Number(timeMatch[2]);if(h<24&&m<60){out.time=`${pad(h)}:${pad(m)}`;title=title.replace(timeMatch[0],' ');}}
      else {
        timeMatch=title.match(/الساعة\s*(\d{1,2})(?:\s*(صباحًا|صباحا|مساءً|مساء|ص|م))?/u);
        if(timeMatch){let h=Number(timeMatch[1]);const ap=timeMatch[2]||'';if((ap==='مساءً'||ap==='مساء'||ap==='م')&&h<12)h+=12;if((ap==='صباحًا'||ap==='صباحا'||ap==='ص')&&h===12)h=0;if(h<24){out.time=`${pad(h)}:00`;title=title.replace(timeMatch[0],' ');}}
      }
    }
    const durationMatch=title.match(/(?:for\s*)?(\d+(?:\.\d+)?)\s*(hours?|hrs?|h|minutes?|mins?|m)\b/i) || title.match(/لمدة\s*(نصف\s*ساعة|ساعة\s*ونص|ساعة|ساعتين|\d+\s*دقيقة|\d+\s*دقائق|\d+\s*ساعات?)/u);
    if(durationMatch){const matchText=durationMatch[0].toLowerCase();if(/نصف|30\s*دقيقة/.test(matchText))out.duration=30;else if(/ساعتين/.test(matchText))out.duration=120;else if(/ساعة\s*ونص/.test(matchText))out.duration=90;else if(/ساعة/.test(matchText))out.duration=60;else {const n=Number(durationMatch[1]||30);out.duration=/hour|hr|\bh\b|ساعات?/i.test(matchText)?n*60:n;}out.duration=clamp(Math.round(out.duration),5,1440);title=title.replace(durationMatch[0],' ');}
    if(/\b(high priority|urgent|asap|important|عاجل|ضروري|مهم جدًا|مهم جدا)\b/iu.test(title)){out.priority='high';out.urgent=true;out.important=true;title=title.replace(/\b(high priority|urgent|asap|important|عاجل|ضروري|مهم جدًا|مهم جدا)\b/iu,' ');}
    else if(/\b(low priority|low)\b|أولوية منخفضة/iu.test(title)){out.priority='low';title=title.replace(/\b(low priority|low)\b|أولوية منخفضة/iu,' ');}
    else if(/\bmedium priority\b|أولوية متوسطة/iu.test(title)){out.priority='medium';title=title.replace(/\bmedium priority\b|أولوية متوسطة/iu,' ');}
    title=title.replace(/\b(for|at)\s*$/i,'').replace(/\s+/g,' ').replace(/^[\s,،–—-]+|[\s,،–—-]+$/g,'').trim();
    out.title=title||raw.trim();
    return out;
  }
  function captureTask(raw) {
    if(!raw.trim()) return;
    const parsed=parseNaturalTask(raw);
    const id=uid();const top3=state.tasks.filter(task=>task.top3&&task.status!=='completed').length<3 && (parsed.dueDate===todayKey()||!state.tasks.some(task=>task.top3&&task.status!=='completed'));
    state.tasks.push({id,...parsed,notes:'',status:'todo',area:'personal',top3,recurrence:'none',subtasks:[],dependsOn:'',createdAt:new Date().toISOString(),completedAt:null});
    queueSave();renderPage();toast(t('taskAdded'));
  }
  function saveTaskForm(form) {
    const formData=new FormData(form);const id=form.dataset.taskId;const existing=id?taskById(id):null;
    const title=String(formData.get('task-title')||'').trim();if(!title){$('#task-title')?.focus();return;}
    const subtasks=String(formData.get('task-subtasks')||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean).map(subTitle=>{const old=(existing?.subtasks||[]).find(s=>s.title===subTitle);return old||{id:uid(),title:subTitle,done:false}});
    const status=formData.get('task-status')||'todo';const requestedDependency=String(formData.get('task-dependency')||'');if(status==='completed'&&requestedDependency&&taskById(requestedDependency)?.status!=='completed'){toast(t('blockedTask'),true);return;}const values={title,notes:String(formData.get('task-notes')||'').trim(),dueDate:String(formData.get('task-date')||''),time:String(formData.get('task-time')||''),duration:clamp(Number(formData.get('task-duration')||45),5,1440),priority:String(formData.get('task-priority')||'normal'),area:String(formData.get('task-area')||'personal'),status,recurrence:String(formData.get('task-repeat')||'none'),dependsOn:String(formData.get('task-dependency')||''),subtasks,top3:$('#task-top3')?.checked||false,urgent:$('#task-urgent')?.checked||false,important:$('#task-important')?.checked||false};
    if(values.dependsOn===id)values.dependsOn='';
    if(values.top3){const otherTop=state.tasks.filter(task=>task.top3&&task.status!=='completed'&&task.id!==id);if(otherTop.length>=3)otherTop.slice(2).forEach(task=>task.top3=false);}
    if(existing){const wasCompleted=existing.status==='completed';Object.assign(existing,values);if(status==='completed'&&!existing.completedAt)existing.completedAt=new Date().toISOString();if(status==='completed')existing.completedDate=existing.completedDate||todayKey();if(status!=='completed'){existing.completedAt=null;existing.completedDate=null;}if(status==='completed'&&!wasCompleted){const next=nextRecurringDate(existing);if(next)state.tasks.push({...existing,id:uid(),status:'todo',dueDate:next,completedAt:null,completedDate:null,top3:false,createdAt:new Date().toISOString(),subtasks:(existing.subtasks||[]).map(sub=>({...sub,id:uid(),done:false}))});}}
    else state.tasks.push({id:uid(),...values,urgent:values.urgent,important:values.important,createdAt:new Date().toISOString(),completedAt:status==='completed'?new Date().toISOString():null,completedDate:status==='completed'?todayKey():null});
    queueSave();closeModal();renderPage();toast(existing?t('taskSaved'):t('taskAdded'));
  }
  function nextRecurringDate(task) {
    const reference=dateFromKey(task.dueDate||todayKey())||new Date();
    if(task.recurrence==='daily')return addDays(localDateKey(reference),1);
    if(task.recurrence==='weekly')return addDays(localDateKey(reference),7);
    if(task.recurrence==='weekdays'){let key=addDays(localDateKey(reference),1);while([0,6].includes(dateFromKey(key).getDay()))key=addDays(key,1);return key;}
    if(task.recurrence==='monthly'){
      const d=reference.getDate();const next=new Date(reference.getFullYear(),reference.getMonth()+1,1,12);const last=new Date(next.getFullYear(),next.getMonth()+1,0,12).getDate();next.setDate(d===new Date(reference.getFullYear(),reference.getMonth()+1,0,12).getDate()?last:Math.min(d,last));return localDateKey(next);
    }
    return null;
  }
  function toggleTask(id) {
    const task=taskById(id);if(!task)return;
    if(task.status!=='completed'&&task.dependsOn&&taskById(task.dependsOn)?.status!=='completed'){toast(t('blockedTask'),true);return;}
    if(task.status==='completed'){task.status='todo';task.completedAt=null;task.completedDate=null;toast(t('taskReopened'));}
    else {task.status='completed';task.completedAt=new Date().toISOString();task.completedDate=todayKey();task.top3=false;const next=nextRecurringDate(task);if(next){state.tasks.push({...task,id:uid(),status:'todo',dueDate:next,completedAt:null,completedDate:null,top3:false,createdAt:new Date().toISOString(),subtasks:(task.subtasks||[]).map(s=>({...s,id:uid(),done:false}))});}toast(t('taskCompleted'));}
    queueSave();renderPage();
  }
  function deleteTask(id) {
    const task=taskById(id);if(!task)return;
    confirmDialog(t('delete'),`${t('confirmDelete')}<br><strong style="display:block;margin-top:10px">${escapeHTML(task.title)}</strong>`,t('yesDelete'),()=>{state.tasks=state.tasks.filter(x=>x.id!==id);state.tasks.forEach(x=>{if(x.dependsOn===id)x.dependsOn=''});queueSave();closeModal();renderPage();toast(t('delete'));});
  }

  function openHabitModal(id=null) {
    const habit=id?state.habits.find(x=>x.id===id):null;
    const leading = habit ? `<button class="btn danger" type="button" data-delete-habit="${habit.id}">${escapeHTML(t('delete'))}</button>` : '';
    const body=`<form id="habit-form" data-habit-id="${habit?.id||''}"><div class="form-grid">${formField('habit-name',t('habitName'),habit?.name||'','text',{span:true,required:true,placeholder:state.settings.lang==='en'?'Read 2 pages':'قراءة صفحتين'})}${formField('habit-icon','Icon / Emoji',habit?.icon||'✳','text',{placeholder:'✳'})}${formField('habit-target',t('habitTarget'),habit?.target||1,'number',{min:1,max:100})}${formField('habit-cue',t('habitCue'),habit?.cue||'','text',{span:true,placeholder:t('stackExample')})}${formField('habit-time',t('habitTime'),habit?.time||'','text',{span:true,placeholder:t('timeExample')})}</div>${modalActions(t('cancel'), t('save'), leading)}</form>`;
    modalShell(habit?t('edit'):t('newHabit'),t('habitInsightText'),body);
  }
  function saveHabitForm(form) {
    const fd=new FormData(form);const id=form.dataset.habitId;const title=String(fd.get('habit-name')||'').trim();if(!title)return;const values={name:title,icon:String(fd.get('habit-icon')||'✳').trim().slice(0,8),target:Math.max(1,Number(fd.get('habit-target')||1)),cue:String(fd.get('habit-cue')||'').trim(),time:String(fd.get('habit-time')||'').trim()};
    const old=id?state.habits.find(x=>x.id===id):null;if(old)Object.assign(old,values);else state.habits.push({id:uid(),...values,logs:{},freezeDays:{},createdAt:new Date().toISOString()});queueSave();closeModal();renderPage();toast(t('habitAdded'));
  }
  function toggleHabit(id) {const habit=state.habits.find(x=>x.id===id);if(!habit)return;habit.logs ||= {};if(habit.logs[todayKey()]){delete habit.logs[todayKey()];toast(t('habitUndone'));}else{habit.logs[todayKey()]=true;toast(t('habitDone'));}queueSave();renderPage();}
  function freezeHabit(id) {
    const habit=state.habits.find(x=>x.id===id);if(!habit)return;const month=todayKey().slice(0,7);state.freezeUsage ||= {};state.freezeUsage[month] ||= 0;
    if(state.freezeUsage[month]>=2){toast(t('habitFreezeNone'),true);return;}
    if(habit.logs?.[todayKey()]){toast(state.settings.lang==='en'?'You already checked in today.':'أنت سجّلت إنجاز اليوم بالفعل.',true);return;}
    habit.freezeDays ||= {};habit.freezeDays[todayKey()]=true;state.freezeUsage[month]++;queueSave();renderPage();toast(t('habitFreeze'));
  }
  function deleteHabit(id) {
    const habit = state.habits.find(x => x.id === id);
    if (!habit) return;
    confirmDialog(t('delete'), `${t('confirmDelete')}<br><strong style="display:block;margin-top:10px">${escapeHTML(habit.name)}</strong>`, t('yesDelete'), () => {
      state.habits = state.habits.filter(x => x.id !== id);
      queueSave(); closeModal(); renderPage(); toast(t('delete'));
    });
  }

  function openGoalModal() {
    const body=`<form id="goal-form"><div class="form-grid">${formField('goal-name',t('goalName'),'','text',{span:true,required:true,placeholder:state.settings.lang==='en'?'Build a strong portfolio':'بناء ملف أعمال قوي'})}${formField('goal-why',t('goalWhy'),'','textarea',{span:true,required:true,placeholder:t('goalTargetHint')})}${formField('goal-target',t('goalTarget'),'100','number',{min:1,step:'any'})}${formField('goal-current',t('goalCurrent'),'0','number',{min:0,step:'any'})}${formField('goal-unit',t('goalUnit'),'','text',{placeholder:state.settings.lang==='en'?'hours, pages, projects…':'ساعات، صفحات، مشاريع…'})}${formField('goal-date',t('goalDate'),'','date')}${formField('goal-milestones',t('goalMilestones'),'','textarea',{span:true,placeholder:state.settings.lang==='en'?'Finish fundamentals\nBuild one project\nPublish portfolio':'إنهاء الأساسيات\nبناء مشروع\nنشر ملف الأعمال'})}</div>${modalActions()}</form>`;modalShell(t('newGoal'),t('goalsDesc'),body,{wide:true});
  }
  function saveGoalForm(form) {const fd=new FormData(form);const title=String(fd.get('goal-name')||'').trim();if(!title)return;state.goals.push({id:uid(),title,why:String(fd.get('goal-why')||'').trim(),target:Math.max(1,Number(fd.get('goal-target')||100)),current:Math.max(0,Number(fd.get('goal-current')||0)),unit:String(fd.get('goal-unit')||'').trim(),dueDate:String(fd.get('goal-date')||''),milestones:String(fd.get('goal-milestones')||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean).map(title=>({title,done:false})),createdAt:new Date().toISOString()});queueSave();closeModal();renderPage();toast(t('goalAdded'));}
  function updateGoalProgress(id) {const goal=state.goals.find(x=>x.id===id);if(!goal)return;const body=`<form id="goal-progress-form" data-goal-id="${goal.id}">${formField('goal-progress-value',`${t('updateProgress')} (${goal.unit||t('goalTarget')})`,'1','number',{min:0,step:'any'})}<p class="fine-print">${escapeHTML(state.settings.lang==='en'?'This amount will be added to the current value.':'ستُضاف هذه القيمة إلى القيمة الحالية.')}</p>${modalActions()}</form>`;modalShell(t('updateProgress'),goal.title,body);}
  function deleteGoal(id) {
    const goal = state.goals.find(x => x.id === id);
    if (!goal) return;
    confirmDialog(t('delete'), `${t('confirmDelete')}<br><strong style="display:block;margin-top:10px">${escapeHTML(goal.title)}</strong>`, t('yesDelete'), () => {
      state.goals = state.goals.filter(x => x.id !== id);
      queueSave(); closeModal(); renderPage(); toast(t('delete'));
    });
  }

  function openExpenseModal() {
    const cats=['food','transport','bills','learning','home','fun','misc','income'];const body=`<form id="expense-form"><div class="form-grid">${formField('expense-type',t('category'),'expense','select',{options:[{value:'expense',label:t('expense')},{value:'income',label:t('income')}]})}${formField('expense-amount',t('amount'),'','number',{required:true,min:0.01,step:'0.01'})}${formField('expense-category',t('category'),'food','select',{options:cats.map(value=>({value,label:value==='income'?t('incomeLabel'):t(value)}))})}${formField('expense-date',t('date'),todayKey(),'date',{required:true})}${formField('expense-description',t('description'),'','text',{span:true,placeholder:state.settings.lang==='en'?'What was this for?':'على ماذا كان هذا المبلغ؟'})}</div>${modalActions()}</form>`;modalShell(t('addExpense'),t('financeDesc'),body);
  }
  function openBudgetModal() {const body=`<form id="budget-form">${formField('budget-amount',t('budget'),String(state.settings.budget||0),'number',{min:0,step:'any',required:true})}<p class="fine-print">${escapeHTML(state.settings.lang==='en'?'The category bars will use an even split unless you configure more detailed budgets in a future version.':'تستخدم أشرطة الفئات تقسيمًا متساويًا حاليًا. يمكن إضافة ميزانيات مستقلة لكل فئة لاحقًا.')}</p>${modalActions()}</form>`;modalShell(t('setBudget'),t('financeDesc'),body);}
  function openSavingModal() {const body=`<form id="saving-form"><div class="form-grid">${formField('saving-name',t('savingName'),'','text',{span:true,required:true})}${formField('saving-target',t('savingTarget'),'1000','number',{min:1,required:true,step:'any'})}${formField('saving-current',t('savingCurrent'),'0','number',{min:0,step:'any'})}</div>${modalActions()}</form>`;modalShell(t('newSaving'),t('savings'),body);}
  function updateSaving(id) {const saving=state.savings.find(x=>x.id===id);if(!saving)return;const body=`<form id="saving-progress-form" data-saving-id="${saving.id}">${formField('saving-add',t('addSaving'),'100','number',{min:0.01,step:'any',required:true})}${modalActions()}</form>`;modalShell(t('addSaving'),saving.name,body);}
  function deleteExpense(id) {
    const entry = state.expenses.find(x => x.id === id);
    if (!entry) return;
    confirmDialog(t('delete'), `${t('confirmDelete')}<br><strong style="display:block;margin-top:10px">${escapeHTML(entry.description||entry.category)}</strong>`, t('yesDelete'), () => {
      state.expenses = state.expenses.filter(x => x.id !== id);
      queueSave(); closeModal(); renderPage(); toast(t('delete'));
    });
  }
  function deleteSaving(id) {
    const saving = state.savings.find(x => x.id === id);
    if (!saving) return;
    confirmDialog(t('delete'), `${t('confirmDelete')}<br><strong style="display:block;margin-top:10px">${escapeHTML(saving.name)}</strong>`, t('yesDelete'), () => {
      state.savings = state.savings.filter(x => x.id !== id);
      queueSave(); closeModal(); renderPage(); toast(t('delete'));
    });
  }

  function openRescue() {rescue={step:1,energy:'medium',must:'',time:45};renderRescueModal();}
  function renderRescueModal() {
    let body='';
    if(rescue.step===1){body=`<div class="rescue-step"><div class="small-muted">01 / 03</div><p style="font-size:13px;margin:0 0 4px">${escapeHTML(t('rescueQ1'))}</p>${[['low','☁','rescueLow'],['medium','◑','rescueMid'],['high','✦','rescueHigh']].map(([value,iconName,label])=>`<button type="button" class="rescue-choice ${rescue.energy===value?'selected':''}" data-rescue-energy="${value}"><span class="choice-icon">${iconName}</span><span><strong>${escapeHTML(t(label))}</strong></span></button>`).join('')}<div class="form-actions"><button class="btn primary" type="button" data-rescue-next>${escapeHTML(t('next'))} ${icon('arrow')}</button></div></div>`;}
    if(rescue.step===2){body=`<form id="rescue-must-form"><div class="small-muted">02 / 03</div><p style="font-size:13px;margin:0 0 12px">${escapeHTML(t('rescueQ2'))}</p>${formField('rescue-must',t('rescueMust'),rescue.must,'textarea',{required:true,placeholder:t('rescueMust')})}<div class="form-actions"><button class="btn subtle" type="button" data-rescue-back>${escapeHTML(t('cancel'))}</button><button class="btn primary" type="submit">${escapeHTML(t('next'))} ${icon('arrow')}</button></div></form>`;}
    if(rescue.step===3){body=`<div class="rescue-step"><div class="small-muted">03 / 03</div><p style="font-size:13px;margin:0">${escapeHTML(t('rescueQ3'))}</p>${[[20,'rescue20'],[45,'rescue45'],[90,'rescue90']].map(([value,label])=>`<button type="button" class="rescue-choice ${rescue.time===value?'selected':''}" data-rescue-time="${value}"><span class="choice-icon">◷</span><span><strong>${escapeHTML(t(label))}</strong></span></button>`).join('')}<div class="form-actions"><button class="btn subtle" type="button" data-rescue-back>${escapeHTML(t('cancel'))}</button><button class="btn primary" type="button" data-rescue-build>${escapeHTML(t('buildPlan'))}</button></div></div>`;}
    if(rescue.step===4){const secondary=rescue.time>=45?(rescue.energy==='low'?(state.settings.lang==='en'?'Take a proper reset break':'استراحة قصيرة تعيد توازنك'):(state.settings.lang==='en'?'Prepare the next small step':'جهّز الخطوة الصغيرة التالية')):'';body=`<div class="rescue-summary"><span class="tag green">${escapeHTML(t('rescuePlan'))}</span><h3 style="margin-top:12px">${escapeHTML(rescue.must)}</h3><p>${escapeHTML(rescue.energy==='low'?t('energyLow'):rescue.energy==='high'?t('energyHigh'):t('energyMid'))}</p><div class="subtle-line"></div><div class="insight-stat-row"><span>${escapeHTML(t('focus'))}</span><strong>${rescue.time} ${escapeHTML(t('minutes'))}</strong></div>${secondary?`<div class="insight-stat-row"><span>${escapeHTML(t('nextWeek'))}</span><strong>${escapeHTML(secondary)}</strong></div>`:''}<p style="margin-top:12px">${escapeHTML(t('rescueSkip'))}</p></div><div class="form-actions"><button class="btn subtle" type="button" data-close-modal>${escapeHTML(t('close'))}</button><button class="btn primary" type="button" data-rescue-create>${escapeHTML(t('rescueCreate'))} ✓</button></div>`;}
    modalShell(t('rescueTitle'),t('rescueIntro'),body);
  }
  function buildRescuePlan() {
    const title=rescue.must.trim();if(!title)return;
    const duration=rescue.time;const task={id:uid(),title,notes:state.settings.lang==='en'?'Rescue Mode · one must-do, one session.':'وضع الإنقاذ · أولوية واحدة، وجلسة واحدة.',dueDate:todayKey(),time:'',duration,priority:'high',urgent:true,important:true,area:'personal',status:'todo',top3:true,recurrence:'none',subtasks:[],dependsOn:'',createdAt:new Date().toISOString(),completedAt:null};
    state.tasks.filter(x=>x.top3&&x.status!=='completed').forEach(x=>x.top3=false);state.tasks.push(task);
    const secondary=rescue.time>=45?(rescue.energy==='low'?(state.settings.lang==='en'?'Take a reset break':'استراحة تعيد التوازن'):(state.settings.lang==='en'?'Prepare your next small step':'جهّز الخطوة الصغيرة التالية')):'';
    if(secondary){state.tasks.push({id:uid(),title:secondary,notes:'Rescue Mode',dueDate:todayKey(),time:'',duration:5,priority:'low',area:'personal',status:'todo',top3:false,recurrence:'none',subtasks:[],dependsOn:task.id,createdAt:new Date().toISOString(),completedAt:null});}
    state.settings.energy=rescue.energy==='low'?1:rescue.energy==='medium'?3:5;queueSave();closeModal();renderPage();toast(t('rescueCreated'));
  }

  function openWeeklyReview() {
    const stats=weekStats();const previous=state.reviews.find(x=>x.weekStart===localDateKey(stats.start));weekReviewValues={wentWell:previous?.wentWell||'',hardPart:previous?.hardPart||'',nextWeek:previous?.nextWeek||''};
    const leading = previous ? `<button class="btn danger" type="button" data-delete-review="${previous.id}">${escapeHTML(t('delete'))}</button>` : '';
    const body=`<div class="review-score"><div class="review-metric"><strong>${stats.completed}</strong><span>${escapeHTML(t('tasksDoneWeek'))}</span></div><div class="review-metric"><strong>${stats.habit}%</strong><span>${escapeHTML(t('habitRate'))}</span></div><div class="review-metric"><strong>${(stats.minutes/60).toFixed(1)}h</strong><span>${escapeHTML(t('focusHours'))}</span></div></div><form id="weekly-review-form" data-week-start="${localDateKey(stats.start)}"><div class="prompt-block"><label class="field-label" for="review-well">01 — ${escapeHTML(t('wentWell'))}</label><textarea class="textarea" id="review-well">${escapeHTML(weekReviewValues.wentWell)}</textarea></div><div class="prompt-block"><label class="field-label" for="review-hard">02 — ${escapeHTML(t('hardPart'))}</label><textarea class="textarea" id="review-hard">${escapeHTML(weekReviewValues.hardPart)}</textarea></div><div class="prompt-block"><label class="field-label" for="review-next">03 — ${escapeHTML(t('nextWeek'))}</label><textarea class="textarea" id="review-next">${escapeHTML(weekReviewValues.nextWeek)}</textarea></div>${modalActions(t('close'),t('save'),leading)}</form>`;modalShell(t('reviewTitle'),t('reviewIntro'),body,{wide:true});
  }
  function deleteReview(id) {
    const review = state.reviews.find(x => x.id === id);
    if (!review) return;
    confirmDialog(t('delete'), t('confirmDelete'), t('yesDelete'), () => {
      state.reviews = state.reviews.filter(x => x.id !== id);
      queueSave(); closeModal(); renderPage(); toast(t('delete'));
    });
  }
  function confirmDialog(title, body, confirmLabel, callback) {modalShell(title,'',`<div style="font-size:11px;color:var(--muted);line-height:1.8">${body}</div><div class="form-actions"><button class="btn subtle" type="button" data-close-modal>${escapeHTML(t('cancel'))}</button><button class="btn danger" type="button" id="confirm-dialog-action">${escapeHTML(confirmLabel)}</button></div>`);$('#confirm-dialog-action')?.addEventListener('click',callback,{once:true});}

  function startFocusTimer() {
    const focus=state.focus;
    if(focus.running)return;
    if(focus.remaining<=0)focus.remaining=(focus.mode==='shortBreak'?5:focus.mode==='longBreak'?15:focus.preset)*60;
    focus.running=true;focus.startedAt=focus.startedAt||new Date().toISOString();focus.endAt=Date.now()+focus.remaining*1000;queueSave();startFocusInterval();renderPage();
  }
  function pauseFocusTimer() {
    const f=state.focus;if(!f.running)return;f.remaining=Math.max(0,Math.ceil((f.endAt-Date.now())/1000));f.running=false;f.endAt=null;queueSave();stopFocusInterval();renderPage();
  }
  function resetFocusTimer() {const f=state.focus;f.running=false;f.endAt=null;f.startedAt=null;f.mode='focus';f.remaining=f.preset*60;queueSave();stopFocusInterval();renderPage();}
  function chooseFocusPreset(minutes) {const f=state.focus;f.running=false;f.endAt=null;f.startedAt=null;f.mode='focus';f.preset=minutes;f.remaining=minutes*60;queueSave();stopFocusInterval();renderPage();}
  function chooseFocusMode(mode) {const f=state.focus;f.running=false;f.endAt=null;f.startedAt=null;f.mode=mode;f.remaining=(mode==='shortBreak'?5:mode==='longBreak'?15:f.preset)*60;queueSave();stopFocusInterval();renderPage();}
  function updateTimerDisplay() {
    const f=state.focus;if(f.running&&f.endAt)f.remaining=Math.max(0,Math.ceil((f.endAt-Date.now())/1000));
    const readout=$('#timer-readout'),ring=$('#timer-ring'),button=$('#timer-main-button'),mode=$('#timer-mode-label');if(!readout)return;
    readout.innerHTML=`${pad(Math.floor(f.remaining/60))}:${pad(f.remaining%60)}<small>${escapeHTML(f.running?t('pause'):t('minutes'))}</small>`;
    const total=(f.mode==='focus'?f.preset: f.mode==='shortBreak'?5:15)*60;ring?.style.setProperty('--timer-progress',`${clamp(f.remaining/total*100,0,100)}%`);
    if(button)button.textContent=f.running?t('pause'):f.remaining<(f.mode==='focus'?f.preset:f.mode==='shortBreak'?5:15)*60?t('resume'):t('start');if(mode)mode.textContent=t(f.mode==='focus'?'focus':f.mode==='shortBreak'?'shortBreak':'longBreak');
    if(f.running&&f.remaining<=0){completeFocusTimer();}
  }
  function startFocusInterval() {stopFocusInterval();focusInterval=setInterval(()=>{if(state.ui.page==='focus')updateTimerDisplay();else if(state.focus.running&&state.focus.endAt&&Date.now()>=state.focus.endAt)completeFocusTimer();},250);}
  function stopFocusInterval(){if(focusInterval)clearInterval(focusInterval);focusInterval=null;}
  function finishFocusManually() {
    const f=state.focus;if(f.mode!=='focus'){f.running=false;f.endAt=null;f.startedAt=null;stopFocusInterval();f.mode='focus';f.remaining=f.preset*60;queueSave();renderPage();return;}let remaining=f.running&&f.endAt?Math.max(0,Math.ceil((f.endAt-Date.now())/1000)):f.remaining;const elapsed=Math.max(0,Math.round((f.preset*60-remaining)/60));
    if(elapsed<1){toast(state.settings.lang==='en'?'Complete at least one minute to log a session.':'أكمل دقيقة واحدة على الأقل لتسجيل جلسة.',true);return;}
    f.remaining=remaining;f.running=false;f.endAt=null;stopFocusInterval();openSessionWrapUp(elapsed);
  }
  function completeFocusTimer() {const f=state.focus;f.running=false;f.endAt=null;stopFocusInterval();if(f.mode==='focus'){const minutes=f.preset;f.remaining=0;openSessionWrapUp(minutes);}else{f.mode='focus';f.remaining=f.preset*60;f.startedAt=null;queueSave();renderPage();toast(state.settings.lang==='en'?'Break complete. Choose one next thing.':'انتهت الاستراحة. اختر شيئًا واحدًا تاليًا.');}}
  function openSessionWrapUp(minutes) {
    const task=taskById(state.focus.taskId);
    const body=`<form id="session-wrap-form" data-minutes="${minutes}"><p style="font-size:11px;color:var(--muted);line-height:1.7">${escapeHTML(task?.title||t('noLinkedTask'))} · ${minutes} ${escapeHTML(t('minutes'))}</p><div class="field" style="margin-top:15px"><label for="session-before-mood">${escapeHTML(t('beforeMood'))}</label><select class="select" id="session-before-mood">${[1,2,3,4,5].map(n=>`<option value="${n}" ${n===Number(state.focus.beforeMood||3)?'selected':''}>${n} / 5 · ${escapeHTML(t('mood'+n))}</option>`).join('')}</select></div><div class="field" style="margin-top:13px"><label for="session-after-mood">${escapeHTML(t('afterMood'))}</label><select class="select" id="session-after-mood">${[1,2,3,4,5].map(n=>`<option value="${n}" ${n===3?'selected':''}>${n} / 5 · ${escapeHTML(t('mood'+n))}</option>`).join('')}</select></div><div class="field" style="margin-top:13px"><label for="session-rating">${escapeHTML(t('productivity'))}</label><select class="select" id="session-rating"><option value="5">5 / 5 — ${escapeHTML(state.settings.lang==='en'?'Great':'ممتاز')}</option><option value="4">4 / 5</option><option value="3" selected>3 / 5</option><option value="2">2 / 5</option><option value="1">1 / 5</option></select></div><div class="field" style="margin-top:13px"><label for="session-notes">${escapeHTML(t('sessionNotes'))}</label><textarea class="textarea" id="session-notes"></textarea></div>${modalActions(t('cancel'),t('save'))}</form>`;modalShell(t('focusRating'),t('sessionSaved'),body);
  }
  function saveSessionForm(form) {
    const mins=Number(form.dataset.minutes||0);const task=taskById(state.focus.taskId);state.sessions.push({id:uid(),date:todayKey(),startedAt:state.focus.startedAt||new Date(Date.now()-mins*60000).toISOString(),minutes:mins,taskId:task?.id||'',taskTitle:task?.title||'',beforeMood:Number($('#session-before-mood')?.value||state.focus.beforeMood||3),afterMood:Number($('#session-after-mood')?.value||3),rating:Number($('#session-rating')?.value||3),notes:String($('#session-notes')?.value||'').trim()});
    state.focus.startedAt=null;state.focus.remaining=state.focus.preset*60;state.focus.running=false;state.focus.endAt=null;queueSave();closeModal();renderPage();toast(t('sessionSaved'));
  }

  function autoSchedule() {
    const tasks=activeTasks().filter(task=>!task.dueDate||!task.time).sort((a,b)=>priorityRank(b.priority)-priorityRank(a.priority));if(!tasks.length){toast(t('scheduleNone'));return;}
    const fixed=state.tasks.filter(task=>task.status!=='completed'&&task.dueDate&&task.time);const slots={};fixed.forEach(task=>{(slots[task.dueDate] ||= []).push({start:timeMinutes(task.time),end:timeMinutes(task.time)+Number(task.duration||45)});});
    let placed=0;const base=new Date();
    for(const task of tasks){let found=null;for(let offset=0;offset<14&&!found;offset++){const day=shiftDate(base,offset);const key=localDateKey(day);const busy=slots[key]||[];const earliest=offset===0?Math.max(9*60,Math.ceil((base.getHours()*60+base.getMinutes()+15)/15)*15):9*60;for(let min=earliest;min+(task.duration||45)<=17*60;min+=15){const end=min+Number(task.duration||45);if(!busy.some(slot=>min<slot.end&&end>slot.start)){found={date:key,time:`${pad(Math.floor(min/60))}:${pad(min%60)}`,start:min,end};break;}}}if(found){task.dueDate=found.date;task.time=found.time;slots[found.date] ||= [];slots[found.date].push({start:found.start,end:found.end});placed++;}}
    queueSave();renderPage();toast(`${placed} ${t('scheduled')}`);
  }
  function timeMinutes(time) {if(!time)return 0;const [h,m]=time.split(':').map(Number);return h*60+m;}

  function saveJournalForm() {
    const targetDate=state.ui.journalEditDate||todayKey();
    const existing=state.journal.find(item=>item.date===targetDate);
    const moodFromForm = Number($('#journal-form')?.dataset.mood || existing?.mood || 3);
    const entry={id:existing?.id||uid(),date:targetDate,mood:moodFromForm,well:$('#journal-well')?.value.trim()||'',drained:$('#journal-drained')?.value.trim()||'',tomorrow:$('#journal-tomorrow')?.value.trim()||'',gratitude:$('#journal-gratitude')?.value.trim()||'',updatedAt:new Date().toISOString()};
    if(existing)Object.assign(existing,entry);else state.journal.push(entry);
    queueSave();renderPage();toast(t('journalSaved'));
  }
  function deleteJournalEntry(dateKey) {
    const entry = state.journal.find(x => x.date === dateKey);
    if (!entry) return;
    confirmDialog(t('delete'), `${t('confirmDelete')}<br><strong style="display:block;margin-top:10px">${escapeHTML(fmtDate(dateKey,{weekday:'short',day:'numeric',month:'short'}))}</strong>`, t('yesDelete'), () => {
      state.journal = state.journal.filter(x => x.date !== dateKey);
      if (state.ui.journalEditDate === dateKey) state.ui.journalEditDate = todayKey();
      queueSave(); closeModal(); renderPage(); toast(t('delete'));
    });
  }
  function addHealthLog(type,value,unit='',title='') {state.health.push({id:uid(),type,value:Number(value),unit,title,date:todayKey(),createdAt:new Date().toISOString()});queueSave();renderPage();toast(t('healthSaved'));}
  function deleteHealthLog(id) {
    const entry = state.health.find(x => x.id === id);
    if (!entry) return;
    confirmDialog(t('delete'), t('confirmDelete'), t('yesDelete'), () => {
      state.health = state.health.filter(x => x.id !== id);
      queueSave(); closeModal(); renderPage(); toast(t('delete'));
    });
  }

  function exportJSON() {const data=JSON.stringify({...state,exportedAt:new Date().toISOString(),app:'NUQTA'},null,2);downloadBlob(data,`nuqta-backup-${todayKey()}.json`,'application/json');toast(t('backupDone'));}
  function exportCSV() {const headers=['title','status','priority','area','dueDate','time','duration','notes'];const rows=[headers,...state.tasks.map(task=>headers.map(key=>task[key]??''))];const csv=rows.map(row=>row.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\r\n');downloadBlob('\uFEFF'+csv,`nuqta-tasks-${todayKey()}.csv`,'text/csv;charset=utf-8');toast(t('backupDone'));}
  function downloadBlob(content,filename,type) {const blob=new Blob([content],{type});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=filename;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function importJSONFile(file) {if(!file)return;const reader=new FileReader();reader.onload=()=>{try{const parsed=JSON.parse(String(reader.result));const incoming=parsed?.state||parsed;if(!incoming||!Array.isArray(incoming.tasks)||!incoming.settings)throw new Error('invalid');confirmDialog(t('importData'),`${t('importDone')}<br><br>${escapeHTML(state.settings.lang==='en'?'This replaces the current NUQTA data. Export your current data first if you need to keep it.':'سيستبدل هذا بيانات NUQTA الحالية. صدّر بياناتك الحالية أولًا إن كنت تريد الاحتفاظ بها.')}`,t('importData'),()=>{state=mergeState(incoming);queueSave();closeModal();updateShell();renderPage();toast(t('dataImported'));});}catch(err){toast(t('invalidBackup'),true);}};reader.readAsText(file);}
  function wipeAllData() {confirmDialog(t('wipeData'),t('confirmDelete'),t('wipeData'),async()=>{state=freshState();try{const db=await openDB();await new Promise((resolve,reject)=>{const tx=db.transaction('state','readwrite');tx.objectStore('state').delete('app');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}catch{}try{localStorage.removeItem('nuqta_backup');}catch{}queueSave();closeModal();updateShell();renderPage();toast(t('deletedAll'));});}
  async function enableNotifications() {
    if(!('Notification' in window)){toast(state.settings.lang==='en'?'Browser notifications are not supported here.':'هذا المتصفح لا يدعم الإشعارات.',true);state.settings.notifications=false;queueSave();renderPage();return;}
    const permission=await Notification.requestPermission();if(permission==='granted'){state.settings.notifications=true;queueSave();toast(state.settings.lang==='en'?'Browser reminders enabled while NUQTA is open.':'تم تفعيل التذكيرات ما دام التطبيق مفتوحًا.');startNotificationChecks();}else{state.settings.notifications=false;queueSave();toast(state.settings.lang==='en'?'Notification permission was not granted.':'لم يُسمح بالإشعارات.',true);}renderPage();
  }
  function startNotificationChecks() {
    if(notificationInterval)clearInterval(notificationInterval);
    if(!state.settings.notifications||!('Notification' in window)||Notification.permission!=='granted')return;
    notificationInterval=setInterval(()=>{
      if(!state.settings.notifications||document.hidden)return;
      const now=new Date();const key=todayKey();
      if(state.notifications.lastDate!==key){state.notifications.lastDate=key;state.notifications.count=0;state.notifications.seenTaskIds=[];}
      if(state.notifications.count>=2)return;
      const due=state.tasks.find(task=>task.status!=='completed'&&task.dueDate===key&&task.time&&!state.notifications.seenTaskIds.includes(task.id)&&Math.abs(timeMinutes(task.time)-(now.getHours()*60+now.getMinutes()))<=2);
      if(due){
        try {
          new Notification(`NUQTA · ${due.title}`,{body:state.settings.lang==='en'?'A small reminder for the task you planned.':'تذكير هادئ بالمهمة التي خططت لها.',tag:`nuqta-${due.id}`});
          state.notifications.seenTaskIds.push(due.id);
          state.notifications.count++;
          state.notifications.unread=(state.notifications.unread||0)+1;
          queueSave();
          updateShell();
        } catch(err) { console.warn('NUQTA notification failed:', err?.message||err); }
      }
    },60000);
  }

  function handleAction(action, node) {
    switch(action){
      case 'add-task':openTaskModal();break;
      case 'add-habit':openHabitModal();break;
      case 'add-goal':openGoalModal();break;
      case 'add-expense':openExpenseModal();break;
      case 'set-budget':openBudgetModal();break;
      case 'add-saving':openSavingModal();break;
      case 'rescue':openRescue();break;
      case 'weekly-review':openWeeklyReview();break;
      case 'auto-schedule':autoSchedule();break;
      case 'calendar-today':
        if(state.ui.page === 'calendar'){state.ui.calendarDate = todayKey();state.ui.selectedCalendarDate = todayKey();}
        else if(state.ui.page === 'tasks'){state.ui.tasksCalendarDate = todayKey();}
        queueSave();renderPage();break;
      case 'export-json':exportJSON();break;
      case 'export-csv':exportCSV();break;
      case 'import-data':$('#import-file').click();break;
      case 'print-pdf':window.print();break;
      case 'wipe-data':wipeAllData();break;
      case 'log-sleep':openQuickHealthModal('sleep');break;
      case 'log-workout':openQuickHealthModal('workout');break;
      case 'add-water':{const amount=Number($('#water-amount')?.value||1);state.health.push({id:uid(),type:'water',value:amount,unit:t('glasses'),date:todayKey(),createdAt:new Date().toISOString()});queueSave();renderPage();toast(t('waterAdded'));break;}
      case 'save-sleep':{const value=Number($('#sleep-value')?.value);if(value>0&&value<=24)addHealthLog('sleep',value,t('hour'));else toast(state.settings.lang==='en'?'Enter sleep between 0 and 24 hours.':'أدخل مدة نوم بين 0 و24 ساعة.',true);break;}
      case 'save-weight':{const value=Number($('#weight-value')?.value);if(value>0&&value<=500)addHealthLog('weight',value,t('weightKg'));else toast(state.settings.lang==='en'?'Enter a valid weight.':'أدخل وزنًا صحيحًا.',true);break;}
      case 'save-workout':{const name=$('#workout-name')?.value.trim()||t('workout');const value=Number($('#workout-minutes')?.value);if(value>0&&value<=600)addHealthLog('workout',value,t('minutesShort'),name);else toast(state.settings.lang==='en'?'Enter valid activity minutes.':'أدخل عدد دقائق صحيحًا.',true);break;}
      default: break;
    }
  }
  function openQuickHealthModal(type) {
    if(type==='sleep')modalShell(t('sleepLog'),t('sleepTarget'),`<form id="quick-sleep-form">${formField('quick-sleep-value',t('sleepHours'),'7.5','number',{required:true,min:0.1,max:24,step:0.25})}${modalActions()}</form>`);
    else modalShell(t('workoutLog'),t('movementTarget'),`<form id="quick-workout-form">${formField('quick-workout-name',t('activityName'),'','text',{required:true})}${formField('quick-workout-value',t('minutesDuration'),'20','number',{required:true,min:1,max:600})}${modalActions()}</form>`);
  }

  function wirePageControls(root) {
    if (root.dataset.wired === 'true') return;
    root.dataset.wired = 'true';
    root.addEventListener('click', event => {
      if(event.target.closest('#timer-main-button')){state.focus.running?pauseFocusTimer():startFocusTimer();return;}
      if(event.target.closest('#timer-reset-button')){resetFocusTimer();return;}
      if(event.target.closest('#timer-finish-button')){finishFocusManually();return;}
      const nav=event.target.closest('[data-navigate]');if(nav){navigate(nav.dataset.navigate);return;}
      const action=event.target.closest('[data-action]');if(action){handleAction(action.dataset.action,action);return;}
      const complete=event.target.closest('[data-complete-task]');if(complete){toggleTask(complete.dataset.completeTask);return;}
      if(event.target.closest('.task-status-select'))return;
      const editTask=event.target.closest('[data-edit-task]');if(editTask){openTaskModal(editTask.dataset.editTask);return;}
      const delTask=event.target.closest('[data-delete-task]');if(delTask){deleteTask(delTask.dataset.deleteTask);return;}
      const view=event.target.closest('[data-task-view]');if(view){state.ui.taskView=view.dataset.taskView;queueSave();renderPage();return;}
      const hDone=event.target.closest('[data-toggle-habit]');if(hDone){toggleHabit(hDone.dataset.toggleHabit);return;}
      const hFreeze=event.target.closest('[data-freeze-habit]');if(hFreeze){freezeHabit(hFreeze.dataset.freezeHabit);return;}
      const hEdit=event.target.closest('[data-edit-habit]');if(hEdit){openHabitModal(hEdit.dataset.editHabit);return;}
      const hDel=event.target.closest('[data-delete-habit]');if(hDel){deleteHabit(hDel.dataset.deleteHabit);return;}
      const goalProgress=event.target.closest('[data-progress-goal]');if(goalProgress){updateGoalProgress(goalProgress.dataset.progressGoal);return;}
      const goalDel=event.target.closest('[data-delete-goal]');if(goalDel){deleteGoal(goalDel.dataset.deleteGoal);return;}
      const savingProgress=event.target.closest('[data-add-saving]');if(savingProgress){updateSaving(savingProgress.dataset.addSaving);return;}
      const savingDel=event.target.closest('[data-delete-saving]');if(savingDel){deleteSaving(savingDel.dataset.deleteSaving);return;}
      const expDel=event.target.closest('[data-delete-expense]');if(expDel){deleteExpense(expDel.dataset.deleteExpense);return;}
      const healthDel=event.target.closest('[data-delete-health]');if(healthDel){deleteHealthLog(healthDel.dataset.deleteHealth);return;}
      const journalDel=event.target.closest('[data-delete-journal]');if(journalDel){deleteJournalEntry(journalDel.dataset.deleteJournal);return;}
      const clearSearch=event.target.closest('[data-clear-search]');if(clearSearch){state.ui.taskSearch='';queueSave();renderPage();return;}
      const calDay=event.target.closest('[data-calendar-day]');
      if(calDay){
        if(state.ui.page === 'calendar'){
          state.ui.selectedCalendarDate=calDay.dataset.calendarDay;
          state.ui.calendarDate=calDay.dataset.calendarDay;
        } else if(state.ui.page === 'home'){
          state.ui.page = 'calendar';
          state.ui.calendarDate = calDay.dataset.calendarDay;
          state.ui.selectedCalendarDate = calDay.dataset.calendarDay;
        } else if(state.ui.page === 'tasks'){
          state.ui.tasksCalendarDate = calDay.dataset.calendarDay;
        }
        queueSave();renderPage();return;
      }
      const monthShift=event.target.closest('[data-month-shift]');if(monthShift){const base=dateFromKey(state.ui.calendarDate||todayKey());base.setDate(1);base.setMonth(base.getMonth()+Number(monthShift.dataset.monthShift));state.ui.calendarDate=localDateKey(base);state.ui.selectedCalendarDate=state.ui.calendarDate;queueSave();renderPage();return;}
      const energy=event.target.closest('[data-energy]');if(energy){state.settings.energy=Number(energy.dataset.energy);queueSave();renderPage();return;}
      const mood=event.target.closest('[data-mood]');if(mood){const jf=$('#journal-form');if(jf)jf.dataset.mood=mood.dataset.mood;$$('[data-mood]',root).forEach(node=>node.classList.toggle('active',node===mood));return;}
      const openJournal=event.target.closest('[data-open-journal]');if(openJournal){const entry=state.journal.find(x=>x.date===openJournal.dataset.openJournal);if(entry){state.ui.page='journal';state.ui.journalEditDate=entry.date;queueSave();renderPage();}return;}
      const timerPreset=event.target.closest('[data-timer-preset]');if(timerPreset){chooseFocusPreset(Number(timerPreset.dataset.timerPreset));return;}
      const timerMode=event.target.closest('[data-timer-mode]');if(timerMode){chooseFocusMode(timerMode.dataset.timerMode);return;}
      const rescueEnergy=event.target.closest('[data-rescue-energy]');if(rescueEnergy){rescue.energy=rescueEnergy.dataset.rescueEnergy;renderRescueModal();return;}
      const rescueTime=event.target.closest('[data-rescue-time]');if(rescueTime){rescue.time=Number(rescueTime.dataset.rescueTime);renderRescueModal();return;}
      if(event.target.closest('[data-rescue-next]')){rescue.step=2;renderRescueModal();return;}
      if(event.target.closest('[data-rescue-back]')){rescue.step=Math.max(1,rescue.step-1);renderRescueModal();return;}
      if(event.target.closest('[data-rescue-build]')){rescue.step=4;renderRescueModal();return;}
      if(event.target.closest('[data-rescue-create]')){buildRescuePlan();return;}
    });
    root.addEventListener('change', event => {
      const target=event.target;
      if(target.id==='task-filter'){state.ui.taskFilter=target.value;queueSave();renderPage();return;}
      if(target.id==='task-sort'){state.ui.taskSort=target.value;queueSave();renderPage();return;}
      if(target.id==='focus-task-select'){state.focus.taskId=target.value;queueSave();return;}
      if(target.id==='focus-before-mood'){state.focus.beforeMood=Number(target.value||3);queueSave();return;}
      if(target.matches('[data-milestone]')){const [goalId,indexText]=target.dataset.milestone.split(':');const goal=state.goals.find(x=>x.id===goalId);if(goal?.milestones?.[Number(indexText)])goal.milestones[Number(indexText)].done=target.checked;queueSave();renderPage();return;}
      if(target.matches('[data-task-status]')){const task=taskById(target.dataset.taskStatus);if(task){if((target.value==='completed'&&task.status!=='completed')||(task.status==='completed'&&target.value!=='completed')){toggleTask(task.id);return;}task.status=target.value;task.completedAt=null;queueSave();renderPage();}return;}
      if(target.id==='language-select'){state.settings.lang=target.value;queueSave();renderPage();return;}
      if(target.id==='theme-setting'){state.settings.theme=target.checked?'dark':'light';queueSave();renderPage();return;}
      if(target.id==='notifications-setting'){if(target.checked)enableNotifications();else{state.settings.notifications=false;state.notifications.unread=0;queueSave();if(notificationInterval)clearInterval(notificationInterval);renderPage();}return;}
    });
    root.addEventListener('input', event => {
      const target=event.target;
      if(target.id==='task-search'){
        const pos=target.selectionStart;state.ui.taskSearch=target.value;queueSave();renderPage();const next=$('#task-search');next?.focus();try{next?.setSelectionRange(pos,pos);}catch{}
      }
    });
    root.addEventListener('submit', event => {
      event.preventDefault();const form=event.target;
      if(form.id==='quick-capture-form'){captureTask($('#quick-capture-input').value);return;}
      if(form.id==='profile-form'){state.settings.name=$('#profile-name').value.trim()|| (state.settings.lang==='en'?'You':'أنت');queueSave();updateShell();renderPage();toast(t('settingsSaved'));return;}
      if(form.id==='journal-form'){saveJournalForm();return;}
    });
  }

  function closeSidebar(){ $('#sidebar').classList.remove('open');$('#sidebar-scrim').classList.remove('open'); }
  function openSidebar(){ $('#sidebar').classList.add('open');$('#sidebar-scrim').classList.add('open'); }
  function initGlobalEvents() {
    $$('.sidebar [data-page]').forEach(button=>button.addEventListener('click',()=>navigate(button.dataset.page)));
    $('#sidebar-capture').addEventListener('click',()=>openTaskModal());
    $('#rescue-link').addEventListener('click',openRescue);
    $('#lang-toggle').addEventListener('click',()=>{state.settings.lang=state.settings.lang==='ar'?'en':'ar';queueSave();renderPage();});
    $('#theme-toggle').addEventListener('click',()=>{state.settings.theme=state.settings.theme==='dark'?'light':'dark';queueSave();renderPage();});
    $('#notification-toggle').addEventListener('click',()=>{
      state.notifications.unread = 0;
      if(state.settings.notifications){state.settings.notifications=false;queueSave();if(notificationInterval)clearInterval(notificationInterval);renderPage();toast(state.settings.lang==='en'?'Reminders disabled.':'تم إيقاف التذكيرات.');}
      else { enableNotifications(); }
    });
    $('#menu-open').addEventListener('click',openSidebar);$('#sidebar-close').addEventListener('click',closeSidebar);$('#sidebar-scrim').addEventListener('click',closeSidebar);
    $('#profile-button').addEventListener('click',()=>navigate('settings'));
    $('#modal-root').addEventListener('click',event=>{
      if(event.target.closest('[data-close-modal]')){closeModal();return;}
      if(event.target.matches('[data-modal-backdrop]'))closeModal();
    });
    $('#modal-root').addEventListener('submit',event=>{
      event.preventDefault();const form=event.target;
      if(form.id==='task-form'){saveTaskForm(form);return;}
      if(form.id==='habit-form'){saveHabitForm(form);return;}
      if(form.id==='goal-form'){saveGoalForm(form);return;}
      if(form.id==='goal-progress-form'){const goal=state.goals.find(x=>x.id===form.dataset.goalId);if(goal){goal.current=Number(goal.current||0)+Number($('#goal-progress-value')?.value||0);queueSave();closeModal();renderPage();toast(t('progressAdded'));}return;}
      if(form.id==='expense-form'){const fd=new FormData(form);const amount=Number(fd.get('expense-amount'));if(amount<=0)return;state.expenses.push({id:uid(),type:String(fd.get('expense-type')||'expense'),amount,category:String(fd.get('expense-category')||'misc'),date:String(fd.get('expense-date')||todayKey()),description:String(fd.get('expense-description')||'').trim(),createdAt:new Date().toISOString()});queueSave();closeModal();renderPage();toast(t('expenseAdded'));return;}
      if(form.id==='budget-form'){state.settings.budget=Math.max(0,Number($('#budget-amount')?.value||0));queueSave();closeModal();renderPage();toast(t('budgetSet'));return;}
      if(form.id==='saving-form'){const name=$('#saving-name').value.trim();if(!name)return;state.savings.push({id:uid(),name,target:Number($('#saving-target').value||0),current:Number($('#saving-current').value||0),createdAt:new Date().toISOString()});queueSave();closeModal();renderPage();toast(t('goalAdded'));return;}
      if(form.id==='saving-progress-form'){const saving=state.savings.find(x=>x.id===form.dataset.savingId);if(saving){saving.current=Number(saving.current||0)+Number($('#saving-add').value||0);queueSave();closeModal();renderPage();toast(t('savingUpdated'));}return;}
      if(form.id==='rescue-must-form'){rescue.must=$('#rescue-must').value.trim();if(!rescue.must)return;rescue.step=3;renderRescueModal();return;}
      if(form.id==='weekly-review-form'){const weekStartKey=form.dataset.weekStart;const entry={id:state.reviews.find(x=>x.weekStart===weekStartKey)?.id||uid(),weekStart:weekStartKey,wentWell:$('#review-well').value.trim(),hardPart:$('#review-hard').value.trim(),nextWeek:$('#review-next').value.trim(),savedAt:new Date().toISOString()};const old=state.reviews.find(x=>x.weekStart===weekStartKey);if(old)Object.assign(old,entry);else state.reviews.push(entry);queueSave();closeModal();toast(t('reviewSaved'));return;}
      if(form.id==='session-wrap-form'){saveSessionForm(form);return;}
      if(form.id==='quick-sleep-form'){const value=Number($('#quick-sleep-value').value);if(value>0&&value<=24){state.health.push({id:uid(),type:'sleep',value,unit:t('hour'),date:todayKey(),createdAt:new Date().toISOString()});queueSave();closeModal();renderPage();toast(t('healthSaved'));}return;}
      if(form.id==='quick-workout-form'){const value=Number($('#quick-workout-value').value);if(value>0&&value<=600){state.health.push({id:uid(),type:'workout',value,unit:t('minutesShort'),title:$('#quick-workout-name').value.trim(),date:todayKey(),createdAt:new Date().toISOString()});queueSave();closeModal();renderPage();toast(t('healthSaved'));}return;}
    });
    $('#modal-root').addEventListener('change',event=>{
      if(event.target.matches('[data-milestone]')){const [goalId,indexText]=event.target.dataset.milestone.split(':');const goal=state.goals.find(x=>x.id===goalId);if(goal?.milestones?.[Number(indexText)])goal.milestones[Number(indexText)].done=event.target.checked;queueSave();renderPage();}
    });
    $('#modal-root').addEventListener('click',event=>{
      const taskDel = event.target.closest('[data-delete-task]');if(taskDel){deleteTask(taskDel.dataset.deleteTask);return;}
      const habitDel = event.target.closest('[data-delete-habit]');if(habitDel){deleteHabit(habitDel.dataset.deleteHabit);return;}
      const goalDel = event.target.closest('[data-delete-goal]');if(goalDel){deleteGoal(goalDel.dataset.deleteGoal);return;}
      const reviewDel = event.target.closest('[data-delete-review]');if(reviewDel){deleteReview(reviewDel.dataset.deleteReview);return;}
      const build=event.target.closest('[data-rescue-build]');if(build){rescue.step=4;renderRescueModal();return;}
      const create=event.target.closest('[data-rescue-create]');if(create){buildRescuePlan();return;}
      const next=event.target.closest('[data-rescue-next]');if(next){rescue.step=2;renderRescueModal();return;}
      const back=event.target.closest('[data-rescue-back]');if(back){rescue.step=Math.max(1,rescue.step-1);renderRescueModal();return;}
      const energy=event.target.closest('[data-rescue-energy]');if(energy){rescue.energy=energy.dataset.rescueEnergy;renderRescueModal();return;}
      const time=event.target.closest('[data-rescue-time]');if(time){rescue.time=Number(time.dataset.rescueTime);renderRescueModal();return;}
    });
    $('#import-file').addEventListener('change',event=>{const file=event.target.files?.[0];if(file)importJSONFile(file);event.target.value='';});
    document.addEventListener('keydown',event=>{
      if(event.key==='Escape'){closeModal();closeSidebar();}
      if((event.key==='q'||event.key==='Q')&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)&&!event.ctrlKey&&!event.metaKey){event.preventDefault();openTaskModal();}
      if(event.key==='Enter'&&event.target.id==='quick-capture-input'){event.preventDefault();captureTask(event.target.value);}
    });
  }

  async function init() {
    state=await loadState();
    if(state.focus.running && state.focus.endAt){
      const remaining = Math.max(0, Math.ceil((state.focus.endAt - Date.now()) / 1000));
      const endedAgoMs = Date.now() - state.focus.endAt;
      const wasFocus = state.focus.mode === 'focus';
      const presetMinutes = state.focus.preset;
      if(remaining > 0){
        state.focus.remaining = remaining;
      } else if(endedAgoMs < 24*60*60*1000 && wasFocus){
        state.focus.running = false;
        state.focus.endAt = null;
        state.focus.remaining = 0;
        queueSave();
        setTimeout(() => openSessionWrapUp(presetMinutes), 800);
      } else {
        state.focus.running = false;
        state.focus.endAt = null;
        state.focus.mode = 'focus';
        state.focus.remaining = presetMinutes * 60;
        state.focus.startedAt = null;
        queueSave();
      }
    }
    installIcons();updateShell();initGlobalEvents();renderPage();
    if(state.focus.running)startFocusInterval();
    if(state.settings.notifications)startNotificationChecks();
    setInterval(()=>{const clock=$('#live-clock');if(clock)clock.textContent=new Intl.DateTimeFormat(state.settings.lang==='en'?'en-US':'ar-EG',{hour:'numeric',minute:'2-digit'}).format(new Date());},15000);
    if('serviceWorker' in navigator && /^https?:$/.test(location.protocol)){navigator.serviceWorker.register('./sw.js').catch(err=>console.warn('NUQTA service worker:',err?.message||err));}
    if(!state.settings.name)state.settings.name=state.settings.lang==='en'?'You':'أنت';
  }
  init();
})();