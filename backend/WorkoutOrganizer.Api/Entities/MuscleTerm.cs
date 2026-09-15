namespace WorkoutOrganizer.Api.Entities;

// Maps to "muscle_term", populated by build_muscle_mapping.py.
// One row per muscle term used by the dataset, in either role (target or secondary).
public class MuscleTerm
{
    public string Term { get; set; } = null!;
    public string LabelPt { get; set; } = null!;
    public List<MuscleMapping> Mappings { get; set; } = [];
}
