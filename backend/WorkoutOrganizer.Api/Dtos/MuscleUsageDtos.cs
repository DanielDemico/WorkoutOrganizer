namespace WorkoutOrganizer.Api.Dtos;

public record MuscleUsageResponse(
    int TotalExercises,
    int MaxPoints,
    List<MuscleIntensity> Muscles,
    List<MuscleTermBreakdown> Breakdown,
    List<IgnoredTerm> Ignored);

// One body-muscles SVG region and how hard the user's plan hits it.
public record MuscleIntensity(string MuscleId, int Points, int Intensity);

// Score per dataset term, before it is exploded into regions. MuscleIds carries the regions
// the term paints so the UI can filter this list by a clicked region without another request.
//
// Term stays in English: it is the join key with muscle_mapping, not display text. Label is
// the translated name, read from term_i18n in the requested language (spec 004 §7.4).
public record MuscleTermBreakdown(
    string Term,
    string Label,
    int PrimaryCount,
    int SecondaryCount,
    int Points,
    List<string> MuscleIds);

// Known term with no anatomical region to paint ('cardiovascular system').
public record IgnoredTerm(string Term, string Label, int ExerciseCount);
