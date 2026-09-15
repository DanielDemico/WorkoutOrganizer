namespace WorkoutOrganizer.Api.Entities;

// Maps to "exercise_instructions" (one row per exercise+lang), populated by the exercises.json import script.
public class ExerciseInstruction
{
    public string ExerciseId { get; set; } = null!;
    public string Lang { get; set; } = null!;
    public string Text { get; set; } = null!;
}
