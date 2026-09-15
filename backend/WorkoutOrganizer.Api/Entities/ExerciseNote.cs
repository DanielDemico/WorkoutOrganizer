namespace WorkoutOrganizer.Api.Entities;

// What the user wrote about one execution: a free-text remark plus the weight of each set.
// It hangs off the completion, not off WorkoutExercise, so every week leaves its own row and
// "the last note" is a MAX(date) query rather than a field someone has to remember to update
// (spec 006 §4.1). Not to be confused with WorkoutExercise.Observacao, which is a note about
// the *plan* and holds for every Monday forever.
public class ExerciseNote
{
    public int Id { get; set; }

    public int CompletionId { get; set; }
    public ExerciseCompletion Completion { get; set; } = null!;

    public string? Text { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public List<ExerciseNoteSet> Sets { get; set; } = [];
}
