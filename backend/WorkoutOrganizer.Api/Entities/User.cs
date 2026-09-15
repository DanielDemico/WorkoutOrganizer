namespace WorkoutOrganizer.Api.Entities;

public class User
{
    public int Id { get; set; }
    public string Name { get; set; } = null!;
    public string HashPass { get; set; } = null!;
    public string? RefreshToken { get; set; }
    public DateTime? RefreshTokenExpiryTime { get; set; }

    public List<Workout> Workouts { get; set; } = [];
}
