namespace WorkoutOrganizer.Api.Entities;

// Maps to "exercise_instruction_step_i18n", populated by build_translations.py.
// Mirrors ExerciseInstructionStep, for the languages the dataset does not ship.
public class ExerciseInstructionStepI18n
{
    public string ExerciseId { get; set; } = null!;
    public string Lang { get; set; } = null!;
    public int StepOrder { get; set; }
    public string Text { get; set; } = null!;
}
