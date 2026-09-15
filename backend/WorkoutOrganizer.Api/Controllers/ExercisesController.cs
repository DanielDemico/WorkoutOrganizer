using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WorkoutOrganizer.Api.Data;
using WorkoutOrganizer.Api.Dtos;
using WorkoutOrganizer.Api.Localization;
using WorkoutOrganizer.Api.Services;

namespace WorkoutOrganizer.Api.Controllers;

// Read-only browsing of the exercises.json dataset, used by the frontend to pick exercises
// when assigning them to a workout day. Not documented in API.md originally; added alongside
// the frontend because there was no way to discover exercise ids otherwise.
[ApiController]
[Route("api/exercises")]
[Authorize]
public class ExercisesController(AppDbContext db, LocalizationService localization) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<PagedResponse<ExerciseResponse>>> GetAll(
        [FromQuery] string? search,
        [FromQuery] string? muscleGroup,
        [FromQuery] string? lang,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 30)
    {
        var language = Lang.TryResolve(lang);
        if (language is null) return BadRequest($"lang must be one of: {string.Join(", ", Lang.All)}");

        page = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var terms = await localization.GetTermLabelsAsync(language);
        var query = db.Exercises.AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();

            // The translated name is matched through name_norm, which is accent-free: someone
            // typing "torcao" has to find "Torção" (spec 004 §8.1). The English columns stay in
            // the OR so an exercise the translation pass has not reached is still findable.
            var normalized = TextNormalizer.Normalize(term);
            var bodyParts = terms.TermsMatching(TermLabels.BodyPartKind, normalized);

            query = query.Where(x =>
                EF.Functions.Like(x.Name, $"%{term}%") ||
                (x.BodyPart != null && EF.Functions.Like(x.BodyPart, $"%{term}%")) ||
                (x.Category != null && EF.Functions.Like(x.Category, $"%{term}%")) ||
                (x.BodyPart != null && bodyParts.Contains(x.BodyPart)) ||
                db.ExerciseTranslations.Any(t =>
                    t.ExerciseId == x.Id && t.Lang == language && EF.Functions.Like(t.NameNorm, $"%{normalized}%")));
        }

        if (!string.IsNullOrWhiteSpace(muscleGroup))
        {
            // Always the raw English key — the filter dropdown is built from
            // MuscleGroupOption.Value precisely so this comparison never sees a label.
            query = query.Where(x => x.MuscleGroup == muscleGroup);
        }

        var totalCount = await query.CountAsync();

        var exercises = await query
            // Ordered by the name actually shown, which in Portuguese is a different
            // alphabetical order than the English one.
            .OrderBy(x => db.ExerciseTranslations
                .Where(t => t.ExerciseId == x.Id && t.Lang == language)
                .Select(t => t.NameNorm)
                .FirstOrDefault() ?? x.Name)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var names = await localization.GetNamesAsync(exercises.Select(x => x.Id).ToList(), language);
        var items = exercises.Select(x => ExerciseResponse.From(x, names.GetValueOrDefault(x.Id), terms)).ToList();

        var totalPages = totalCount == 0 ? 0 : (int)Math.Ceiling(totalCount / (double)pageSize);

        return Ok(new PagedResponse<ExerciseResponse>(items, page, pageSize, totalCount, totalPages));
    }

    // Distinct muscle groups present in the dataset, used to populate the group filter dropdown.
    [HttpGet("muscle-groups")]
    public async Task<ActionResult<List<MuscleGroupOption>>> GetMuscleGroups([FromQuery] string? lang)
    {
        var language = Lang.TryResolve(lang);
        if (language is null) return BadRequest($"lang must be one of: {string.Join(", ", Lang.All)}");

        var terms = await localization.GetTermLabelsAsync(language);

        var groups = await db.Exercises
            .Where(x => x.MuscleGroup != null && x.MuscleGroup != "")
            .Select(x => x.MuscleGroup!)
            .Distinct()
            .ToListAsync();

        var options = groups
            .Select(value => new MuscleGroupOption(value, terms.Muscle(value)!))
            // Ordered on the accent-free label so "Ômega" sorts next to "Ombros" instead of
            // after Z, without depending on the server's culture.
            .OrderBy(option => TextNormalizer.Normalize(option.Label), StringComparer.Ordinal)
            .ToList();

        return Ok(options);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<ExerciseDetailResponse>> GetById(string id, [FromQuery] string? lang)
    {
        var language = Lang.TryResolve(lang);
        if (language is null) return BadRequest($"lang must be one of: {string.Join(", ", Lang.All)}");

        var exercise = await db.Exercises.FindAsync(id);
        if (exercise is null) return NotFound();

        var terms = await localization.GetTermLabelsAsync(language);
        var names = await localization.GetNamesAsync([id], language);
        var (instructions, steps) = await localization.GetInstructionsAsync([id], language);

        return Ok(ExerciseDetailResponse.From(
            exercise,
            names.GetValueOrDefault(id),
            terms,
            instructions.GetValueOrDefault(id),
            steps.GetValueOrDefault(id) ?? []));
    }
}
