namespace WorkoutOrganizer.Api.Entities;

// Maps to the "exercises" table already populated by the exercises.json import script.
// Mapped read-mostly here so Workout/WorkoutExercise can reference it by foreign key.
public class Exercise
{
    public string Id { get; set; } = null!;
    public string Name { get; set; } = null!;
    public string? Category { get; set; }
    public string? BodyPart { get; set; }
    public string? Equipment { get; set; }
    public string? MuscleGroup { get; set; }
    public string? Target { get; set; }
    public string? Image { get; set; }
    public string? GifUrl { get; set; }
    public string? MediaId { get; set; }
    public string? CreatedAt { get; set; }
    public string? Attribution { get; set; }
}
