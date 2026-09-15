using System.ComponentModel.DataAnnotations;
using WorkoutOrganizer.Api.Entities;
using WorkoutOrganizer.Api.Localization;

namespace WorkoutOrganizer.Api.Dtos;

public record CreateWorkoutRequest([Required, MinLength(1)] string Nome);

public record UpdateWorkoutRequest([Required, MinLength(1)] string Nome);

// ExerciseCount exists so the delete confirmation can say what is about to be lost — "apagar 12
// exercícios" and "apagar um treino vazio" are different decisions (spec 005 §3.3). The listing
// reads it from a correlated Count(); POST passes 0 and PUT the rows already there.
public record WorkoutResponse(int WorkoutId, string Nome, int UserId, int ExerciseCount)
{
    public static WorkoutResponse From(Workout workout, int exerciseCount) =>
        new(workout.WorkoutId, workout.Nome, workout.UserId, exerciseCount);
}

public record WorkoutDetailResponse(int WorkoutId, string Nome, int UserId, List<WorkoutExerciseResponse> Exercises)
{
    public static WorkoutDetailResponse From(
        Workout workout,
        IReadOnlyDictionary<string, string> namesByExerciseId,
        TermLabels terms,
        IReadOnlyDictionary<string, string> instructionsByExerciseId,
        IReadOnlyDictionary<string, List<string>> stepsByExerciseId) => new(
        workout.WorkoutId,
        workout.Nome,
        workout.UserId,
        workout.Exercises
            .Select(we => WorkoutExerciseResponse.From(we, namesByExerciseId, terms, instructionsByExerciseId, stepsByExerciseId))
            .ToList());
}

// Either ExerciseId or CustomName, never both: a free-named exercise has to be asked for
// on purpose, and an unknown ExerciseId stays a 404 rather than quietly becoming one
// (spec 0010 §5).
public record CreateWorkoutExerciseRequest(
    string? ExerciseId,
    [MaxLength(120)] string? CustomName,
    [Required] string Dia,
    [RegularExpression(@"^\d+x\d+$", ErrorMessage = "Series must be in the format 4x12 (sets x reps).")]
    string? Series,
    string? Observacao);

// Full replacement of what the slot *is* and what is written on it; id, dia and ordem stay,
// and with them the slot's completion history (spec 0011 §5). Same either/or rule as the POST.
public record UpdateWorkoutExerciseRequest(
    string? ExerciseId,
    [MaxLength(120)] string? CustomName,
    [RegularExpression(@"^\d+x\d+$", ErrorMessage = "Series must be in the format 4x12 (sets x reps).")]
    string? Series,
    string? Observacao);

// The whole day at once: the client sends the permutation, the server assigns ordem.
public record ReorderWorkoutExercisesRequest([Required] string Dia, [Required] List<int> WorkoutExerciseIds);

public record WorkoutExerciseOrderResponse(int WorkoutExerciseId, int Ordem);

public record ExerciseResponse(
    string Id,
    string Name,
    string? Category,
    string? BodyPart,
    string? Equipment,
    string? MuscleGroup,
    string? Target,
    string? Image,
    string? GifUrl)
{
    // Every text field arrives already in the requested language; a missing translation
    // falls back to the raw English value rather than to null (spec 004 §7.2).
    public static ExerciseResponse From(Exercise x, string? name, TermLabels terms) =>
        new(x.Id, name ?? x.Name, terms.BodyPart(x.Category), terms.BodyPart(x.BodyPart),
            terms.Equipment(x.Equipment), terms.Muscle(x.MuscleGroup), terms.Muscle(x.Target),
            x.Image, x.GifUrl);
}

// Fuller view of an exercise, used when the user has selected it and needs the full
// technique reference (instructions + ordered steps) while filling in series/observação.
public record ExerciseDetailResponse(
    string Id,
    string Name,
    string? Category,
    string? BodyPart,
    string? Equipment,
    string? MuscleGroup,
    string? Target,
    string? Image,
    string? GifUrl,
    string? Instructions,
    List<string> InstructionSteps)
{
    public static ExerciseDetailResponse From(
        Exercise x, string? name, TermLabels terms, string? instructions, List<string> steps) =>
        new(x.Id, name ?? x.Name, terms.BodyPart(x.Category), terms.BodyPart(x.BodyPart),
            terms.Equipment(x.Equipment), terms.Muscle(x.MuscleGroup), terms.Muscle(x.Target),
            x.Image, x.GifUrl, instructions, steps);
}

public record PagedResponse<T>(List<T> Items, int Page, int PageSize, int TotalCount, int TotalPages);

// muscle_group plays two roles at once: it is displayed *and* sent back as ?muscleGroup= to
// filter. Translating it in place would make the filter compare "Peitoral" against
// 'pectorals' and silently return nothing, so the key travels beside the label (spec §7.3).
public record MuscleGroupOption(string Value, string Label);

// ExerciseId/Exercise are null and CustomName is set for an exercise the catalog does not
// have; the client tells the two apart by `exercise === null` (spec 0010 §5).
public record WorkoutExerciseResponse(
    int Id,
    int WorkoutId,
    string? ExerciseId,
    string? CustomName,
    string Dia,
    int Ordem,
    string? Series,
    string? Observacao,
    ExerciseDetailResponse? Exercise)
{
    public static WorkoutExerciseResponse From(
        WorkoutExercise we,
        IReadOnlyDictionary<string, string> namesByExerciseId,
        TermLabels terms,
        IReadOnlyDictionary<string, string> instructionsByExerciseId,
        IReadOnlyDictionary<string, List<string>> stepsByExerciseId)
    {
        var exercise = we.Exercise is null
            ? null
            : ExerciseDetailResponse.From(
                we.Exercise,
                namesByExerciseId.GetValueOrDefault(we.Exercise.Id),
                terms,
                instructionsByExerciseId.GetValueOrDefault(we.Exercise.Id),
                stepsByExerciseId.GetValueOrDefault(we.Exercise.Id) ?? []);

        return new(we.Id, we.WorkoutId, we.ExerciseId, we.CustomName, we.Dia, we.Ordem, we.Series, we.Observacao, exercise);
    }
}

public record UserExerciseResponse(
    int WorkoutId,
    string WorkoutNome,
    int WorkoutExerciseId,
    string? ExerciseId,
    string? CustomName,
    string ExerciseName,
    string? Category,
    string? BodyPart,
    string? Equipment,
    string Dia,
    int Ordem,
    string? Series,
    string? Observacao);

public record SuggestedExerciseDto(string Id, string Name);

// Nothing is left pending: an item the catalog could not place is persisted as a
// custom-named exercise and comes back in Exercises like any other (spec 0010 §5).
public record WorkoutImportResponse(
    int WorkoutId,
    string Nome,
    int UserId,
    List<WorkoutExerciseResponse> Exercises,
    // Null on the normal path; set when the document-service had to read the file as
    // plain text because its own reader failed (spec 0009 §6).
    string? DegradedReason = null);

public record DocumentServiceParsedItem(
    string Dia,
    string? ExerciseId,
    string? MatchedName,
    string OriginalName,
    double Confidence,
    string? Series,
    string? Observacao,
    List<SuggestedExerciseDto> SuggestedExercises);

public record DocumentServiceParseResponse(
    string WorkoutName,
    List<DocumentServiceParsedItem> Items,
    string? DegradedReason = null);
