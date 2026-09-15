using Microsoft.EntityFrameworkCore;
using WorkoutOrganizer.Api.Data;
using WorkoutOrganizer.Api.Localization;

namespace WorkoutOrganizer.Api.Services;

// Reads the translation tables written by build_translations.py and resolves the fallback
// chain "requested language -> English" in one place, so no controller has to know that
// English lives in the base columns while everything else lives in *_i18n (spec 004 §7.2).
public class LocalizationService(AppDbContext db)
{
    public async Task<TermLabels> GetTermLabelsAsync(string lang)
    {
        var rows = await db.TermTranslations.Where(t => t.Lang == lang).ToListAsync();
        return new TermLabels(rows);
    }

    // Translated names for the given exercises, keyed by id. English is served straight from
    // exercises.name, so it needs no rows and returns empty — callers apply `?? x.Name`,
    // which doubles as the fallback for an exercise the translation pass has not reached.
    public async Task<Dictionary<string, string>> GetNamesAsync(IReadOnlyCollection<string> exerciseIds, string lang)
    {
        if (lang == Lang.Fallback || exerciseIds.Count == 0) return [];

        return await db.ExerciseTranslations
            .Where(t => t.Lang == lang && exerciseIds.Contains(t.ExerciseId))
            .ToDictionaryAsync(t => t.ExerciseId, t => t.Name);
    }

    // Instructions and ordered steps, already resolved: an exercise missing from the
    // translation tables comes back in English rather than empty.
    public async Task<(Dictionary<string, string> Instructions, Dictionary<string, List<string>> Steps)>
        GetInstructionsAsync(IReadOnlyCollection<string> exerciseIds, string lang)
    {
        if (exerciseIds.Count == 0) return ([], []);

        var instructions = new Dictionary<string, string>();
        var steps = new Dictionary<string, List<string>>();

        if (lang != Lang.Fallback)
        {
            instructions = await db.ExerciseTranslations
                .Where(t => t.Lang == lang && exerciseIds.Contains(t.ExerciseId) && t.Instructions != null)
                .ToDictionaryAsync(t => t.ExerciseId, t => t.Instructions!);

            var translatedSteps = await db.ExerciseInstructionStepTranslations
                .Where(s => s.Lang == lang && exerciseIds.Contains(s.ExerciseId))
                .OrderBy(s => s.StepOrder)
                .ToListAsync();

            steps = translatedSteps
                .GroupBy(s => s.ExerciseId)
                .ToDictionary(g => g.Key, g => g.Select(s => s.Text).ToList());
        }

        // Only the exercises still missing pay for the English query.
        var missingInstructions = exerciseIds.Where(id => !instructions.ContainsKey(id)).ToList();
        if (missingInstructions.Count > 0)
        {
            var fallback = await db.ExerciseInstructions
                .Where(x => x.Lang == Lang.Fallback && missingInstructions.Contains(x.ExerciseId))
                .ToListAsync();

            foreach (var row in fallback) instructions[row.ExerciseId] = row.Text;
        }

        var missingSteps = exerciseIds.Where(id => !steps.ContainsKey(id)).ToList();
        if (missingSteps.Count > 0)
        {
            var fallback = await db.ExerciseInstructionSteps
                .Where(x => x.Lang == Lang.Fallback && missingSteps.Contains(x.ExerciseId))
                .OrderBy(x => x.StepOrder)
                .ToListAsync();

            foreach (var group in fallback.GroupBy(x => x.ExerciseId))
                steps[group.Key] = group.Select(x => x.Text).ToList();
        }

        return (instructions, steps);
    }
}
