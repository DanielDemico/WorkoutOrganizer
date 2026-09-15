using WorkoutOrganizer.Api.Entities;

namespace WorkoutOrganizer.Api.Localization;

// The controlled vocabulary of one language, ready to translate a raw dataset value.
// 88 pairs, so it is loaded whole once per request instead of joined row by row.
public sealed class TermLabels
{
    public const string BodyPartKind = "body_part";
    public const string EquipmentKind = "equipment";
    public const string MuscleKind = "muscle";

    private readonly Dictionary<(string Kind, string Term), string> labels = [];
    private readonly List<(string Kind, string Term, string NormLabel)> searchable = [];

    public TermLabels(IEnumerable<TermI18n> rows)
    {
        foreach (var row in rows)
        {
            labels[(row.Kind, row.Term)] = row.Label;
            searchable.Add((row.Kind, row.Term, TextNormalizer.Normalize(row.Label)));
        }
    }

    // exercises.category is a literal copy of exercises.body_part in all 1324 rows, so the
    // two columns share one translation (spec 004 §3.1).
    public string? BodyPart(string? term) => Lookup(BodyPartKind, term);

    public string? Equipment(string? term) => Lookup(EquipmentKind, term);

    public string? Muscle(string? term) => Lookup(MuscleKind, term);

    // Raw dataset values whose translated label matches the (already normalized) query.
    // Lets a search for "peito" filter on body_part = 'chest' without translating the column.
    public List<string> TermsMatching(string kind, string normalizedQuery)
    {
        if (normalizedQuery.Length == 0) return [];

        return searchable
            .Where(entry => entry.Kind == kind && entry.NormLabel.Contains(normalizedQuery, StringComparison.Ordinal))
            .Select(entry => entry.Term)
            .Distinct()
            .ToList();
    }

    // Falls back to the raw value: an untranslated term shows in English, never as null.
    private string? Lookup(string kind, string? term)
    {
        if (string.IsNullOrWhiteSpace(term)) return term;

        return labels.TryGetValue((kind, term.Trim().ToLowerInvariant()), out var label) ? label : term;
    }
}
