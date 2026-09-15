namespace WorkoutOrganizer.Api.Entities;

// Maps to "muscle_mapping": one dataset term -> one body-muscles SVG region (N:N).
// A term with zero rows here is a known term with no region to paint ('cardiovascular system').
public class MuscleMapping
{
    public string Term { get; set; } = null!;
    public MuscleTerm MuscleTerm { get; set; } = null!;
    public string MuscleId { get; set; } = null!;
}
