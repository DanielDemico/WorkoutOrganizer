namespace WorkoutOrganizer.Api.Entities;

// Maps to "term_i18n", populated by build_translations.py: the label for every value of the
// dataset's controlled vocabulary, in every supported language.
//
// Keyed by (Kind, Term) and not by Term alone because 'back', 'chest' and 'shoulders' are
// both body parts and muscles — two vocabularies that come from different dataset columns
// and are free to diverge (spec 004 §3.2).
//
// This is the single authority for these labels. muscle_term.label_pt seeded the muscle rows
// once and is no longer read by the API (spec §5.3).
public class TermI18n
{
    public string Kind { get; set; } = null!;
    public string Term { get; set; } = null!;
    public string Lang { get; set; } = null!;
    public string Label { get; set; } = null!;
}
