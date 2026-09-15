namespace WorkoutOrganizer.Api.Localization;

// Languages the API serves dataset text in. Closed set, so an unknown ?lang= is a 400 and
// never a silent fallback (spec 004 §7.1).
public static class Lang
{
    public const string Portuguese = "pt";
    public const string English = "en";

    // The dataset ships in English, so English is what every missing translation falls back
    // to — a partially translated exercise degrades, it does not blank out (spec §7.2).
    public const string Fallback = English;
    public const string Default = Portuguese;

    public static readonly string[] All = [Portuguese, English];

    // Returns null for an unsupported value so the caller can answer 400; an absent
    // parameter means the default, not an error.
    public static string? TryResolve(string? lang)
    {
        if (string.IsNullOrWhiteSpace(lang)) return Default;

        var normalized = lang.Trim().ToLowerInvariant();
        return Array.IndexOf(All, normalized) >= 0 ? normalized : null;
    }
}
