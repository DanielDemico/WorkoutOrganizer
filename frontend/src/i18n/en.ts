import type { Dictionary } from './pt';

// 1st, 2nd, 3rd, 4th — and 11th/12th/13th, which is the whole reason this is not `${n}th`.
// Portuguese glues one suffix onto every number, so only English needs it (spec 006 §7).
function ordinal(n: number): string {
  const suffix = n % 100 >= 11 && n % 100 <= 13
    ? 'th'
    : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th');
  return `${n}${suffix}`;
}

// Typed as Dictionary, so a key added to pt.ts and forgotten here fails the build — which is
// exactly why the interface vocabulary lives in code and not in the database (spec 004 §4).
export const en: Dictionary = {
  app: {
    name: 'WorkoutOrganizer',
  },

  common: {
    close: 'Close',
    back: 'Back',
    openMenu: 'Open menu',
    loading: 'Loading',
    done: 'Done',
    language: 'Language',
    logout: 'Log out',
    cancel: 'Cancel',
    yes: 'Yes',
    no: 'No',
  },

  nav: {
    workouts: 'My workout',
    calendar: 'Calendar',
    muscleUse: 'Muscle Use',
  },

  weekDays: {
    // Keyed by the invariant Portuguese values stored in workout_exercise.dia, which are
    // identifiers under a CHECK constraint and are never translated (spec §3.3).
    full: {
      segunda: 'Monday',
      terça: 'Tuesday',
      quarta: 'Wednesday',
      quinta: 'Thursday',
      sexta: 'Friday',
      sabado: 'Saturday',
      domingo: 'Sunday',
    },
    short: {
      segunda: 'Mon',
      terça: 'Tue',
      quarta: 'Wed',
      quinta: 'Thu',
      sexta: 'Fri',
      sabado: 'Sat',
      domingo: 'Sun',
    },
    picker: 'Day of the week',
  },

  months: [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ],

  auth: {
    loginSubtitle: 'Sign in to see your workouts',
    registerSubtitle: 'Create your account to get started',
    username: 'Username',
    password: 'Password',
    submitting: 'Please wait...',
    login: 'Sign in',
    register: 'Create account',
    toRegister: 'No account? Create one',
    toLogin: 'Already have an account? Sign in',
    invalidCredentials: 'Wrong username or password.',
    nameTaken: 'That username is already taken.',
    shortPassword: 'The password must be at least 6 characters.',
    genericError: 'Something went wrong. Try again.',
    offline: 'Could not reach the API.',
  },

  workouts: {
    title: 'My workout',
    loadError: 'Could not load your workouts.',
    emptyTitle: 'No workouts yet',
    emptySubtitle: 'Tap + to create your first workout.',
    create: 'Create workout',
    importWorkout: 'Import document',
    delete: (name: string) => `Delete workout ${name}`,
    deleteTitle: (name: string) => `Delete “${name}”?`,
    deleteBody: (count: number) => {
      if (count === 0) return 'This workout has no exercises. This cannot be undone.';
      const exercises = count === 1 ? '1 exercise' : `${count} exercises`;
      return `${exercises} and the whole completion history will be deleted. This cannot be undone.`;
    },
    deleteConfirm: 'Delete',
    deleteError: 'Could not delete this workout.',
  },

  createWorkout: {
    title: 'New workout',
    tabManual: 'Build manually',
    tabImport: 'Import from document',
    nameLabel: 'Workout name',
    namePlaceholder: 'e.g. Workout A - Chest and triceps',
    creating: 'Creating...',
    submit: 'Create workout',
    createError: 'Could not create the workout.',
    finish: 'Finish',
    emptyDayTitle: 'No exercises on this day',
    emptyDaySubtitle: 'Tap “Add exercise” to get started.',
    addExercise: '+ Add exercise',
    dragHandle: 'Drag to reorder',
    editExercise: 'Edit exercise',
    deleteExercise: 'Delete exercise',
    deleteError: 'Could not delete the exercise.',
    reorderError: 'Could not save the new order.',
    importTitle: 'Import routine or document',
    importSubtitle: 'Upload a photo, PDF, or spreadsheet of your workout',
    importDropzone: 'Drag your file here or tap to select',
    aiDisclaimerNotice: 'AI can make mistakes, please review.',
    importAcceptedFormats: 'Photos, PDFs, or spreadsheets (XLSX, CSV)',
    importSelectFile: 'Select file',
    importChangeFile: 'Change file',
    importSubmit: 'Process document',
    importingState1: 'Reading document...',
    importingState2: 'Identifying exercises and sets with AI...',
    importingState3: 'Structuring days and building your workout...',
    importDegradedNotice: 'This file was read in degraded mode — please check the exercises carefully.',
    importCustomNotice: (count: number) =>
      count === 1
        ? '1 exercise was not found in the catalog and was kept under its name from the sheet.'
        : `${count} exercises were not found in the catalog and were kept under their names from the sheet.`,
    importErrorUnreadable: 'Could not identify a workout routine in this file.',
    importErrorGeneric: 'Error processing document. Please try again.',
    importErrorTooLarge: 'The file exceeds the maximum 15 MB limit.',
  },

  workoutView: {
    fallbackTitle: 'Workout',
    loadError: 'Could not load this workout.',
    markError: 'Could not mark this exercise as done. Try again.',
    emptyDayTitle: 'No exercises on this day',
    emptyDaySubtitle: 'This workout has no exercises assigned to that day.',
    next: 'Next',
    confirmQuestion: 'Finish this exercise?',
  },

  celebration: {
    title: "Today's workout is done!",
    subtitle: 'You finished every exercise for today. Nice work!',
  },

  notes: {
    title: 'How did it go?',
    textLabel: 'Note',
    textPlaceholder: 'e.g. bench two notches higher, last set failed at 10...',
    weightLabel: 'Weight per set',
    unit: 'kg',
    setLabel: (n: number) => `${ordinal(n)} set`,
    removeSet: (n: number) => `Remove ${ordinal(n)} set`,
    addSet: '+ Add set',
    skip: 'Skip',
    save: 'Save',
    chip: (weight: number) => `Last note: ${weight} kg`,
    chipEmpty: 'View last note',
    lastTime: (date: string) => `Last time · ${date}`,
    delete: 'Delete note',
    weightError: 'Each weight must be a number between 0 and 1000 kg.',
    saveError: 'Could not save the note.',
    deleteError: 'Could not delete the note.',
  },

  calendar: {
    title: 'Calendar',
    loadError: 'Could not load the calendar.',
    previousMonth: 'Previous month',
    nextMonth: 'Next month',
    legendCompleted: 'Completed',
    legendScheduled: 'Has workout',
    emptyTitle: 'Nothing scheduled for this day',
    emptySubtitle: 'No workout has exercises assigned to that day.',
  },

  exerciseCard: {
    viewToggle: 'Switch between gif and details',
    gif: 'Gif',
    details: 'Details',
    noGif: 'No gif available',
    steps: (count: number) => `Step by step (${count})`,
    customBadge: 'Not in the catalog — no similar exercise identified',
  },

  media: {
    none: 'No media',
    toggle: 'Photo or GIF',
    photo: 'Photo',
    gif: 'GIF',
  },

  picker: {
    dialogLabel: (day: string) => `Add exercise - ${day}`,
    heading: (day: string) => `Add to ${day}`,
    searchPlaceholder: 'Search by name, category...',
    groupFilter: 'Filter by muscle group',
    allGroups: 'All groups',
    searchError: 'Could not search exercises.',
    noResults: 'No exercises found.',
    previous: 'Previous',
    next: 'Next',
    pagination: (page: number, totalPages: number, totalCount: number) =>
      `Page ${page} of ${totalPages} · ${totalCount} exercises`,
  },

  exerciseDetail: {
    dialogLabel: (name: string) => `${name} details`,
    category: 'Category',
    bodyPart: 'Body part',
    muscleGroup: 'Muscle group',
    target: 'Target',
    equipment: 'Equipment',
    instructions: 'Instructions',
    steps: 'Step by step',
    formTitle: 'Sets and notes',
    sets: 'Sets',
    reps: 'Reps',
    note: 'Note (optional)',
    notePlaceholder: 'e.g. load, tempo, bench adjustment...',
    needReps: 'Enter the reps as well.',
    needSets: 'Enter the sets as well.',
    addError: 'Could not add the exercise.',
    add: 'Add exercise',
    save: 'Save',
    swap: 'Swap exercise',
    saveError: 'Could not save the changes.',
  },

  customExercise: {
    dialogLabel: (name: string) => `Edit ${name}`,
    nameLabel: 'Exercise name',
    notInCatalog: 'This exercise is not in the catalog. You can keep the name or swap it for a catalog exercise.',
    needName: 'Enter the exercise name.',
  },

  muscleUse: {
    title: 'Muscle Use',
    loadError: 'Could not load the muscle map.',
    viewGroup: 'Body view',
    front: 'Front',
    back: 'Back',
    emptyTitle: 'No data yet',
    emptySubtitle: 'Add exercises to your workouts to see which muscles get the most work.',
    exerciseCount: (count: number) => `${count} ${count === 1 ? 'exercise' : 'exercises'}`,
    heatmapLabel: (view: string) => `Muscle map, ${view.toLowerCase()} view`,
    panelTitle: 'Most worked',
    clearFilter: 'Clear region filter',
    noMuscleInRegion: 'No muscle in your plan reaches that region.',
    roles: (primary: number, secondary: number) =>
      `${primary} as primary · ${secondary} as secondary`,
    less: 'less',
    more: 'more',
    explanation:
      'Each exercise gives 2 points to its primary muscle and 1 to each secondary one, across all of your workouts. The most worked muscle is always the strongest colour.',
    ignoredNote: (count: number, label: string) =>
      `${count} ${count === 1 ? 'exercise does not appear' : 'exercises do not appear'} on the map: ${label.toLowerCase()} is not a body region.`,
  },
};
