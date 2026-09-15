using System.Globalization;
using System.Text;

namespace WorkoutOrganizer.Api.Localization;

// Lowercase, accent-free form used by the search.
//
// SQLite's LIKE is case-insensitive for ASCII only, and an accent is not a case difference:
// 'ô' and 'o' are simply different characters, so "abdomen" would never match "Abdômen".
// exercise_i18n.name_norm stores this form; the search term goes through the same function
// before comparison (spec 004 §8.1).
//
// Must stay byte-identical to normalize() in build_translations.py — the two halves of that
// comparison are written by different languages.
public static class TextNormalizer
{
    public static string Normalize(string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return string.Empty;

        var decomposed = text.Normalize(NormalizationForm.FormD);
        var builder = new StringBuilder(decomposed.Length);

        foreach (var ch in decomposed)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(ch) != UnicodeCategory.NonSpacingMark)
                builder.Append(ch);
        }

        var collapsed = builder.ToString()
            .ToLowerInvariant()
            .Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries);

        return string.Join(' ', collapsed);
    }
}
