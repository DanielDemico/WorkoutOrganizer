namespace WorkoutOrganizer.Api.Entities;

// One set of one execution. SetNumber is always contiguous 1..N because the labels are
// positional ("first set", "second set") — a gap would be a lie on screen, so the server
// renumbers on every write instead of trusting the client (spec 006 §4.2).
//
// Weight is a real number, not text: 22.5 has to fit (2.5 kg is the standard plate), and a
// free-text column would kill the load-progression reading this data exists to enable.
// The unit is kg, implicit — "60 each side" belongs in ExerciseNote.Text (spec 006 §4.3).
public class ExerciseNoteSet
{
    public int Id { get; set; }

    public int NoteId { get; set; }
    public ExerciseNote Note { get; set; } = null!;

    public int SetNumber { get; set; }
    public double Weight { get; set; }
}
