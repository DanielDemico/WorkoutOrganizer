using System.ComponentModel.DataAnnotations;

namespace WorkoutOrganizer.Api.Dtos;

public record MarkExerciseDoneRequest([Required] DateOnly Date);

public record ExerciseCompletionResponse(int WorkoutExerciseId, DateOnly Date, bool Feito, bool DiaConcluido);

public record ExerciseCompletionSummary(int WorkoutExerciseId, DateOnly Date);

public record CalendarDayResponse(DateOnly Date, int TotalExercises, int DoneExercises, bool Completo);

// Sets arrive ordered and without a number: the position in the array is the set. The server
// rewrites 1..N from it, which is what keeps set_number contiguous without the client having
// to renumber after every removal (spec 006 §5.2).
public record NoteSetRequest(double Weight);

public record SaveNoteRequest(string? Text, List<NoteSetRequest>? Sets);

// Same shape as the rows of GET /notes/latest on purpose: the client drops the PUT response
// straight into its map of latest notes instead of refetching (spec 006 §6.6).
public record ExerciseNoteResponse(int WorkoutExerciseId, DateOnly Date, string? Text, List<double> Sets);
