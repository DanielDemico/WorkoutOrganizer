namespace WorkoutOrganizer.Api.Entities;

// Maps to "exercise_i18n" (one row per exercise+language), populated by build_translations.py.
//
// Deliberately not a lang='pt' row inside exercise_instructions: build_database.py deletes
// every language of an exercise before re-importing exercises.json, which has no Portuguese —
// a re-import would wipe the translations (spec 004 §5.2).
public class ExerciseI18n
{
    public string ExerciseId { get; set; } = null!;
    public string Lang { get; set; } = null!;
    public string Name { get; set; } = null!;

    // Name lowercased and stripped of accents, for the search — see TextNormalizer.
    public string NameNorm { get; set; } = null!;

    // Derived from the translated steps, never translated on its own: in the English dataset
    // exercise_instructions.text is exactly ' '.join(steps) for all 1324 exercises.
    public string? Instructions { get; set; }
}
