namespace WorkoutOrganizer.Api.Entities;

// Maps to "exercise_instruction_steps" (one row per exercise+lang+step), populated by the exercises.json import script.
public class ExerciseInstructionStep
{
    public string ExerciseId { get; set; } = null!;
    public string Lang { get; set; } = null!;
    public int StepOrder { get; set; }
    public string Text { get; set; } = null!;
}
