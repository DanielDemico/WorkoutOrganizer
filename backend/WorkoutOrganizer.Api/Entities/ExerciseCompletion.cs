namespace WorkoutOrganizer.Api.Entities;

// Marks one WorkoutExercise (a recurring weekly slot, e.g. "Supino, segunda") as done on one
// specific calendar date. Keeping this separate from WorkoutExercise — instead of a "feito"
// column there — is what lets the same Monday slot be undone this week and done next week:
// see specs/0002-calendario-mensal/spec.md §3.1.
public class ExerciseCompletion
{
    public int Id { get; set; }

    public int WorkoutExerciseId { get; set; }
    public WorkoutExercise WorkoutExercise { get; set; } = null!;

    public DateOnly Date { get; set; }
    public bool Feito { get; set; } = true;
    public DateTime ConcludedAt { get; set; }
}
