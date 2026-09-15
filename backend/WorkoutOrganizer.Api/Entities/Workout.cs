namespace WorkoutOrganizer.Api.Entities;

public class Workout
{
    public int WorkoutId { get; set; }
    public string Nome { get; set; } = null!;
    public int UserId { get; set; }
    public User User { get; set; } = null!;

    public List<WorkoutExercise> Exercises { get; set; } = [];
}
