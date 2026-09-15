namespace WorkoutOrganizer.Api.Entities;

// Weekday names used in the "dia" column.
public static class WeekDay
{
    public const string Segunda = "segunda";
    public const string Terca = "terça";
    public const string Quarta = "quarta";
    public const string Quinta = "quinta";
    public const string Sexta = "sexta";
    public const string Sabado = "sabado";
    public const string Domingo = "domingo";

    public static readonly string[] All = [Segunda, Terca, Quarta, Quinta, Sexta, Sabado, Domingo];

    public static bool IsValid(string dia) => All.Contains(dia);

    // System.DayOfWeek is Sunday = 0 .. Saturday = 6, same order the frontend uses for
    // WEEK_DAYS (types.ts) and week-start math (lib/weekCycle.ts).
    public static string FromDayOfWeek(DayOfWeek dayOfWeek) => dayOfWeek switch
    {
        DayOfWeek.Sunday => Domingo,
        DayOfWeek.Monday => Segunda,
        DayOfWeek.Tuesday => Terca,
        DayOfWeek.Wednesday => Quarta,
        DayOfWeek.Thursday => Quinta,
        DayOfWeek.Friday => Sexta,
        DayOfWeek.Saturday => Sabado,
        _ => throw new ArgumentOutOfRangeException(nameof(dayOfWeek)),
    };
}

// One exercise assigned to one weekday of a Workout, with its position ("ordem") within that day.
public class WorkoutExercise
{
    public int Id { get; set; }

    public int WorkoutId { get; set; }
    public Workout Workout { get; set; } = null!;

    // Exactly one of ExerciseId/CustomName is set (CK_workout_exercise_source). A row with
    // CustomName is an exercise the catalog does not have, kept under the name the user's
    // sheet gave it — free display text, never a key (spec 0010 §4).
    public string? ExerciseId { get; set; }
    public Exercise? Exercise { get; set; }

    public string? CustomName { get; set; }

    public string Dia { get; set; } = null!;

    // Position of the exercise within its day; assigned server-side (next value for that workout+dia).
    public int Ordem { get; set; }

    // Format "4x12" (sets x reps), e.g. "4x12", "5x10".
    public string? Series { get; set; }

    public string? Observacao { get; set; }
}
