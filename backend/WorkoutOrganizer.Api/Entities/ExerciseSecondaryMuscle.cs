namespace WorkoutOrganizer.Api.Entities;

// Maps to "exercise_secondary_muscles", already populated by the exercises.json import script.
public class ExerciseSecondaryMuscle
{
    public string ExerciseId { get; set; } = null!;
    public string Muscle { get; set; } = null!;
}
