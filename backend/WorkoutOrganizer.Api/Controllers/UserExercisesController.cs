using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WorkoutOrganizer.Api.Data;
using WorkoutOrganizer.Api.Dtos;
using WorkoutOrganizer.Api.Entities;
using WorkoutOrganizer.Api.Localization;
using WorkoutOrganizer.Api.Services;

namespace WorkoutOrganizer.Api.Controllers;

// Lists every exercise assigned to any workout of the logged-in user.
[ApiController]
[Route("api/user-exercises")]
[Authorize]
public class UserExercisesController(AppDbContext db, LocalizationService localization) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<List<UserExerciseResponse>>> GetAll([FromQuery] string? lang)
    {
        var language = Lang.TryResolve(lang);
        if (language is null) return BadRequest($"lang must be one of: {string.Join(", ", Lang.All)}");

        var userId = int.Parse(User.FindFirstValue(JwtRegisteredClaimNames.Sub)!);

        var rows = await db.WorkoutExercises
            .Where(we => we.Workout.UserId == userId)
            // Left-joined by EF because the FK is optional: a custom-named row has no
            // Exercise, and its dataset columns come back null (spec 0010 §5).
            .Select(we => new
            {
                we.WorkoutId,
                WorkoutNome = we.Workout.Nome,
                WorkoutExerciseId = we.Id,
                we.ExerciseId,
                we.CustomName,
                ExerciseName = we.Exercise != null ? we.Exercise.Name : null,
                Category = we.Exercise != null ? we.Exercise.Category : null,
                BodyPart = we.Exercise != null ? we.Exercise.BodyPart : null,
                Equipment = we.Exercise != null ? we.Exercise.Equipment : null,
                we.Dia,
                we.Ordem,
                we.Series,
                we.Observacao,
            })
            .ToListAsync();

        var terms = await localization.GetTermLabelsAsync(language);
        var catalogIds = rows.Where(r => r.ExerciseId != null).Select(r => r.ExerciseId!).Distinct().ToList();
        var names = await localization.GetNamesAsync(catalogIds, language);

        var results = rows
            .Select(r => new UserExerciseResponse(
                r.WorkoutId,
                r.WorkoutNome,
                r.WorkoutExerciseId,
                r.ExerciseId,
                r.CustomName,
                r.ExerciseId is null
                    ? r.CustomName ?? string.Empty
                    : names.GetValueOrDefault(r.ExerciseId) ?? r.ExerciseName ?? string.Empty,
                terms.BodyPart(r.Category),
                terms.BodyPart(r.BodyPart),
                terms.Equipment(r.Equipment),
                r.Dia,
                r.Ordem,
                r.Series,
                r.Observacao))
            .ToList();

        var ordered = results
            .OrderBy(r => r.WorkoutId)
            .ThenBy(r => Array.IndexOf(WeekDay.All, r.Dia))
            .ThenBy(r => r.Ordem)
            .ToList();

        return Ok(ordered);
    }

    // Powers the Calendário module's month matrix: for each date in the month that has at
    // least one exercise scheduled on that weekday (across all of the user's workouts), how
    // many of those are done for that specific date.
    [HttpGet("calendar")]
    public async Task<ActionResult<List<CalendarDayResponse>>> GetCalendar([FromQuery] int year, [FromQuery] int month)
    {
        if (month is < 1 or > 12) return BadRequest("month must be between 1 and 12.");

        var userId = int.Parse(User.FindFirstValue(JwtRegisteredClaimNames.Sub)!);

        var totalsByDia = await db.WorkoutExercises
            .Where(we => we.Workout.UserId == userId)
            .GroupBy(we => we.Dia)
            .Select(g => new { Dia = g.Key, Total = g.Count() })
            .ToDictionaryAsync(x => x.Dia, x => x.Total);

        var daysInMonth = DateTime.DaysInMonth(year, month);
        var monthStart = new DateOnly(year, month, 1);
        var monthEnd = new DateOnly(year, month, daysInMonth);

        var doneByDate = await db.ExerciseCompletions
            .Where(c => c.Feito && c.WorkoutExercise.Workout.UserId == userId && c.Date >= monthStart && c.Date <= monthEnd)
            .GroupBy(c => c.Date)
            .Select(g => new { Date = g.Key, Done = g.Count() })
            .ToDictionaryAsync(x => x.Date, x => x.Done);

        var result = new List<CalendarDayResponse>();
        for (var day = 1; day <= daysInMonth; day++)
        {
            var date = new DateOnly(year, month, day);
            var dia = WeekDay.FromDayOfWeek(date.DayOfWeek);
            if (!totalsByDia.TryGetValue(dia, out var total) || total == 0) continue;

            var done = doneByDate.GetValueOrDefault(date, 0);
            result.Add(new CalendarDayResponse(date, total, done, done == total));
        }

        return Ok(result);
    }

    // Powers the Muscle Use heatmap: scores every muscle worked by the user's plan.
    // Each workout_exercise row gives 2 points to its primary muscle (exercises.target) and
    // 1 point to each of its secondary muscles; the score is then spread over the SVG regions
    // that muscle_mapping links the term to. Scope is the plan, not the history — completions
    // are deliberately not consulted, so there is no period filter.
    [HttpGet("muscle-usage")]
    public async Task<ActionResult<MuscleUsageResponse>> GetMuscleUsage([FromQuery] string? lang)
    {
        var language = Lang.TryResolve(lang);
        if (language is null) return BadRequest($"lang must be one of: {string.Join(", ", Lang.All)}");

        var userId = int.Parse(User.FindFirstValue(JwtRegisteredClaimNames.Sub)!);

        // One row per workout_exercise: the same exercise on two days is twice the volume,
        // so there is no DISTINCT here. Custom-named rows are left out entirely — there is
        // no target and no secondary list to score without inventing muscles (spec 0010 §5).
        var assigned = await db.WorkoutExercises
            .Where(we => we.Workout.UserId == userId && we.ExerciseId != null)
            .Select(we => new { ExerciseId = we.ExerciseId!, we.Exercise!.Target })
            .ToListAsync();

        var exerciseIds = assigned.Select(a => a.ExerciseId).Distinct().ToList();

        var secondaryByExercise = (await db.ExerciseSecondaryMuscles
                .Where(s => exerciseIds.Contains(s.ExerciseId))
                .ToListAsync())
            .GroupBy(s => s.ExerciseId)
            .ToDictionary(g => g.Key, g => g.Select(s => Normalize(s.Muscle)).ToList());

        var primaryCounts = new Dictionary<string, int>();
        var secondaryCounts = new Dictionary<string, int>();

        foreach (var item in assigned)
        {
            var target = Normalize(item.Target);
            if (target.Length > 0)
                primaryCounts[target] = primaryCounts.GetValueOrDefault(target) + 1;

            foreach (var muscle in secondaryByExercise.GetValueOrDefault(item.ExerciseId, []))
            {
                if (muscle.Length > 0)
                    secondaryCounts[muscle] = secondaryCounts.GetValueOrDefault(muscle) + 1;
            }
        }

        var muscleTerms = await db.MuscleTerms.Include(t => t.Mappings).ToListAsync();

        // Labels come from term_i18n, the single translation authority — muscle_term.label_pt
        // only seeded it and is no longer read here (spec 004 §5.3).
        var labels = await localization.GetTermLabelsAsync(language);

        var breakdown = new List<MuscleTermBreakdown>();
        var ignored = new List<IgnoredTerm>();
        var pointsByRegion = new Dictionary<string, int>();

        foreach (var term in muscleTerms)
        {
            var primary = primaryCounts.GetValueOrDefault(term.Term);
            var secondary = secondaryCounts.GetValueOrDefault(term.Term);
            if (primary == 0 && secondary == 0) continue;

            // A term with no mapped region has no place on the body — 'cardiovascular system'
            // scores nothing, but the secondary muscles of those exercises still do.
            if (term.Mappings.Count == 0)
            {
                ignored.Add(new IgnoredTerm(term.Term, labels.Muscle(term.Term)!, primary + secondary));
                continue;
            }

            var points = primary * 2 + secondary;
            breakdown.Add(new MuscleTermBreakdown(
                term.Term, labels.Muscle(term.Term)!, primary, secondary, points,
                term.Mappings.Select(m => m.MuscleId).Order().ToList()));

            foreach (var mapping in term.Mappings)
            {
                // Points go to each region whole, never divided: how many sub-regions the SVG
                // draws for a muscle is a drawing choice, not a difference in training volume.
                pointsByRegion[mapping.MuscleId] = pointsByRegion.GetValueOrDefault(mapping.MuscleId) + points;
            }
        }

        // The scale is relative to this user's own hardest-worked muscle: the point is to see
        // imbalance inside the current plan, not to compare one plan against another.
        var maxPoints = pointsByRegion.Count == 0 ? 0 : pointsByRegion.Values.Max();

        var muscles = pointsByRegion
            .Where(kv => kv.Value > 0)
            .Select(kv => new MuscleIntensity(
                kv.Key,
                kv.Value,
                // The floor of 1 keeps a barely-worked region visible instead of rounding it
                // down to 0, which would look identical to "never trained".
                Math.Max(1, (int)Math.Round(kv.Value / (double)maxPoints * 10, MidpointRounding.AwayFromZero))))
            .OrderByDescending(m => m.Points)
            .ThenBy(m => m.MuscleId)
            .ToList();

        return Ok(new MuscleUsageResponse(
            assigned.Count,
            maxPoints,
            muscles,
            breakdown.OrderByDescending(b => b.Points).ThenBy(b => b.Label).ToList(),
            ignored.OrderByDescending(i => i.ExerciseCount).ThenBy(i => i.Label).ToList()));
    }

    // The dataset stores muscle names free-form; muscle_term keys are lowercase and trimmed.
    private static string Normalize(string? muscle) => muscle?.Trim().ToLowerInvariant() ?? string.Empty;
}
