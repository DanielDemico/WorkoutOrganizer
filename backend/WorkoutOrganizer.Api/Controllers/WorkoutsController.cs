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

[ApiController]
[Route("api/workouts")]
[Authorize]
public class WorkoutsController(
    AppDbContext db,
    LocalizationService localization,
    DocumentServiceClient documentService) : ControllerBase
{
    // Sanity ceilings, not training rules (spec 006 §4.3, §5.2). The weight one mirrors the
    // CHECK on exercise_note_set so a bad value fails as a 400, never as a constraint violation.
    private const int MaxSetsPerNote = 20;
    private const double MaxWeightKg = 1000;
    private const long MaxFileSizeBytes = 15 * 1024 * 1024; // 15 MB
    // Mirrors [MaxLength] on CreateWorkoutExerciseRequest.CustomName; the import path
    // truncates instead of rejecting, since the name came from the LLM, not the user.
    private const int MaxCustomNameLength = 120;

    [HttpPost]
    public async Task<ActionResult<WorkoutResponse>> CreateWorkout(CreateWorkoutRequest request)
    {
        var workout = new Workout { UserId = CurrentUserId(), Nome = request.Nome };
        db.Workouts.Add(workout);
        await db.SaveChangesAsync();

        return CreatedAtAction(
            nameof(GetById), new { id = workout.WorkoutId }, WorkoutResponse.From(workout, 0));
    }

    [HttpPost("import")]
    [Consumes("multipart/form-data")]
    public async Task<ActionResult<WorkoutImportResponse>> ImportWorkout(
        IFormFile file,
        [FromQuery] string? lang,
        CancellationToken cancellationToken)
    {
        var language = Lang.TryResolve(lang);
        if (language is null) return BadRequest($"lang must be one of: {string.Join(", ", Lang.All)}");

        if (file is null || file.Length == 0)
            return BadRequest("Nenhum arquivo enviado ou o arquivo está vazio.");

        if (file.Length > MaxFileSizeBytes)
            return BadRequest("O arquivo excede o limite máximo permitido de 15 MB.");

        var (parsed, statusCode, errorMessage) = await documentService.ParseDocumentAsync(file, language, cancellationToken);
        if (parsed is null)
        {
            return StatusCode(statusCode, errorMessage ?? "Erro ao processar o documento.");
        }

        if (parsed.Items is null || parsed.Items.Count == 0)
        {
            return UnprocessableEntity("Não foi possível identificar exercícios no documento.");
        }

        var candidateExerciseIds = parsed.Items
            .Where(i => !string.IsNullOrEmpty(i.ExerciseId))
            .Select(i => i.ExerciseId!)
            .Distinct()
            .ToList();

        var existingExercises = await db.Exercises
            .Where(e => candidateExerciseIds.Contains(e.Id))
            .ToDictionaryAsync(e => e.Id, cancellationToken);

        await using var tx = await db.Database.BeginTransactionAsync(cancellationToken);

        var workout = new Workout
        {
            UserId = CurrentUserId(),
            Nome = string.IsNullOrWhiteSpace(parsed.WorkoutName) ? "Treino Importado" : parsed.WorkoutName.Trim(),
        };
        db.Workouts.Add(workout);
        await db.SaveChangesAsync(cancellationToken);

        var createdWorkoutExercises = new List<WorkoutExercise>();
        var dayOrders = new Dictionary<string, int>();

        var seriesRegex = new System.Text.RegularExpressions.Regex(@"^\d+x\d+$");

        foreach (var item in parsed.Items)
        {
            var dia = WeekDay.IsValid(item.Dia) ? item.Dia : "segunda";
            var currentOrder = dayOrders.GetValueOrDefault(dia, 0) + 1;
            dayOrders[dia] = currentOrder;

            string? series = null;
            string? obs = item.Observacao;

            if (!string.IsNullOrWhiteSpace(item.Series))
            {
                if (seriesRegex.IsMatch(item.Series.Trim()))
                {
                    series = item.Series.Trim();
                }
                else
                {
                    obs = string.IsNullOrWhiteSpace(obs)
                        ? $"Séries: {item.Series}"
                        : $"{obs} (Séries: {item.Series})";
                }
            }

            var we = new WorkoutExercise
            {
                WorkoutId = workout.WorkoutId,
                Dia = dia,
                Ordem = currentOrder,
                Series = series,
                Observacao = obs,
            };

            if (!string.IsNullOrEmpty(item.ExerciseId) && existingExercises.TryGetValue(item.ExerciseId, out var exercise))
            {
                we.ExerciseId = exercise.Id;
                we.Exercise = exercise;
            }
            else
            {
                // The catalog has nothing for this line ("Face pull", "Cardio moderado"). It
                // still goes into the workout under the sheet's own name — the observação
                // already carries the "Não identificado no catálogo" provenance from the
                // document-service, and the UI badges the row (spec 0010 §5).
                var customName = item.OriginalName.Trim();
                we.CustomName = customName.Length <= MaxCustomNameLength
                    ? customName
                    : customName[..MaxCustomNameLength];
            }

            db.WorkoutExercises.Add(we);
            createdWorkoutExercises.Add(we);
        }

        await db.SaveChangesAsync(cancellationToken);
        await tx.CommitAsync(cancellationToken);

        var resolvedExerciseIds = createdWorkoutExercises
            .Where(we => we.ExerciseId is not null)
            .Select(we => we.ExerciseId!)
            .Distinct()
            .ToList();
        var terms = await localization.GetTermLabelsAsync(language);
        var names = await localization.GetNamesAsync(resolvedExerciseIds, language);
        var (instructions, steps) = await localization.GetInstructionsAsync(resolvedExerciseIds, language);

        var exerciseResponses = createdWorkoutExercises
            .Select(we => WorkoutExerciseResponse.From(we, names, terms, instructions, steps))
            .ToList();

        var response = new WorkoutImportResponse(
            workout.WorkoutId,
            workout.Nome,
            workout.UserId,
            exerciseResponses,
            parsed.DegradedReason);

        return CreatedAtAction(nameof(GetById), new { id = workout.WorkoutId }, response);
    }

    [HttpGet]
    public async Task<ActionResult<List<WorkoutResponse>>> GetAll()
    {
        var workouts = await db.Workouts
            .Where(w => w.UserId == CurrentUserId())
            // Projected inline rather than through WorkoutResponse.From so the count stays a
            // correlated subquery instead of a lazy navigation that would come back as 0.
            .Select(w => new WorkoutResponse(w.WorkoutId, w.Nome, w.UserId, w.Exercises.Count()))
            .ToListAsync();

        return Ok(workouts);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<WorkoutDetailResponse>> GetById(int id, [FromQuery] string? lang)
    {
        var language = Lang.TryResolve(lang);
        if (language is null) return BadRequest($"lang must be one of: {string.Join(", ", Lang.All)}");

        var workout = await db.Workouts
            .Include(w => w.Exercises).ThenInclude(we => we.Exercise)
            .FirstOrDefaultAsync(w => w.WorkoutId == id);
        if (workout is null) return NotFound();
        if (workout.UserId != CurrentUserId()) return Forbid();

        // Bulk-loaded for the whole workout so N exercises don't turn into N queries each.
        var exerciseIds = workout.Exercises
            .Where(we => we.ExerciseId is not null)
            .Select(we => we.ExerciseId!)
            .Distinct()
            .ToList();
        var terms = await localization.GetTermLabelsAsync(language);
        var names = await localization.GetNamesAsync(exerciseIds, language);
        var (instructions, steps) = await localization.GetInstructionsAsync(exerciseIds, language);

        return Ok(WorkoutDetailResponse.From(workout, names, terms, instructions, steps));
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<WorkoutResponse>> Update(int id, UpdateWorkoutRequest request)
    {
        var workout = await db.Workouts.FindAsync(id);
        if (workout is null) return NotFound();
        if (workout.UserId != CurrentUserId()) return Forbid();

        workout.Nome = request.Nome;
        await db.SaveChangesAsync();

        var exerciseCount = await db.WorkoutExercises.CountAsync(we => we.WorkoutId == id);
        return Ok(WorkoutResponse.From(workout, exerciseCount));
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var workout = await db.Workouts.FindAsync(id);
        if (workout is null) return NotFound();
        if (workout.UserId != CurrentUserId()) return Forbid();

        db.Workouts.Remove(workout);
        await db.SaveChangesAsync();

        return NoContent();
    }

    [HttpPost("{workoutId:int}/exercises")]
    public async Task<ActionResult<WorkoutExerciseResponse>> AddExercise(
        int workoutId, CreateWorkoutExerciseRequest request, [FromQuery] string? lang)
    {
        // The response carries the full exercise text, so it needs the language too —
        // otherwise the card just added renders in English until the next page load.
        var language = Lang.TryResolve(lang);
        if (language is null) return BadRequest($"lang must be one of: {string.Join(", ", Lang.All)}");

        if (!WeekDay.IsValid(request.Dia))
            return BadRequest($"dia must be one of: {string.Join(", ", WeekDay.All)}");

        // One or the other, on purpose: a free-named exercise is an explicit choice, and an
        // exerciseId the catalog does not know stays a 404 below (spec 0010 §5).
        var hasExerciseId = !string.IsNullOrWhiteSpace(request.ExerciseId);
        var hasCustomName = !string.IsNullOrWhiteSpace(request.CustomName);
        if (hasExerciseId == hasCustomName)
            return BadRequest("Send exactly one of exerciseId or customName.");

        var workout = await db.Workouts.FindAsync(workoutId);
        if (workout is null) return NotFound("Workout not found.");
        if (workout.UserId != CurrentUserId()) return Forbid();

        Exercise? exercise = null;
        if (hasExerciseId)
        {
            exercise = await db.Exercises.FindAsync(request.ExerciseId);
            if (exercise is null) return NotFound("Exercise not found.");
        }

        var nextOrdem = await db.WorkoutExercises
            .Where(x => x.WorkoutId == workoutId && x.Dia == request.Dia)
            .Select(x => (int?)x.Ordem)
            .MaxAsync() ?? 0;

        var workoutExercise = new WorkoutExercise
        {
            WorkoutId = workoutId,
            ExerciseId = exercise?.Id,
            Exercise = exercise,
            CustomName = hasCustomName ? request.CustomName!.Trim() : null,
            Dia = request.Dia,
            Ordem = nextOrdem + 1,
            Series = request.Series,
            Observacao = request.Observacao,
        };

        db.WorkoutExercises.Add(workoutExercise);
        await db.SaveChangesAsync();

        string[] ids = exercise is null ? [] : [exercise.Id];
        var terms = await localization.GetTermLabelsAsync(language);
        var names = await localization.GetNamesAsync(ids, language);
        var (instructions, steps) = await localization.GetInstructionsAsync(ids, language);

        return CreatedAtAction(nameof(AddExercise), new { workoutId },
            WorkoutExerciseResponse.From(workoutExercise, names, terms, instructions, steps));
    }

    [HttpPut("{workoutId:int}/exercises/{workoutExerciseId:int}")]
    public async Task<ActionResult<WorkoutExerciseResponse>> UpdateExercise(
        int workoutId, int workoutExerciseId, UpdateWorkoutExerciseRequest request, [FromQuery] string? lang)
    {
        var language = Lang.TryResolve(lang);
        if (language is null) return BadRequest($"lang must be one of: {string.Join(", ", Lang.All)}");

        var hasExerciseId = !string.IsNullOrWhiteSpace(request.ExerciseId);
        var hasCustomName = !string.IsNullOrWhiteSpace(request.CustomName);
        if (hasExerciseId == hasCustomName)
            return BadRequest("Send exactly one of exerciseId or customName.");

        var workoutExercise = await db.WorkoutExercises
            .Include(we => we.Workout)
            .FirstOrDefaultAsync(we => we.Id == workoutExerciseId && we.WorkoutId == workoutId);
        if (workoutExercise is null) return NotFound("Workout exercise not found.");
        if (workoutExercise.Workout.UserId != CurrentUserId()) return Forbid();

        Exercise? exercise = null;
        if (hasExerciseId)
        {
            exercise = await db.Exercises.FindAsync(request.ExerciseId);
            if (exercise is null) return NotFound("Exercise not found.");
        }

        // Replacement, not patch: a form that always holds all four values has no way to
        // say "clear the note" under omitted-means-unchanged semantics (spec 0011 §5).
        workoutExercise.ExerciseId = exercise?.Id;
        workoutExercise.Exercise = exercise;
        workoutExercise.CustomName = hasCustomName ? request.CustomName!.Trim() : null;
        workoutExercise.Series = request.Series;
        workoutExercise.Observacao = request.Observacao;
        await db.SaveChangesAsync();

        string[] ids = exercise is null ? [] : [exercise.Id];
        var terms = await localization.GetTermLabelsAsync(language);
        var names = await localization.GetNamesAsync(ids, language);
        var (instructions, steps) = await localization.GetInstructionsAsync(ids, language);

        return Ok(WorkoutExerciseResponse.From(workoutExercise, names, terms, instructions, steps));
    }

    [HttpDelete("{workoutId:int}/exercises/{workoutExerciseId:int}")]
    public async Task<IActionResult> DeleteExercise(int workoutId, int workoutExerciseId)
    {
        var workoutExercise = await db.WorkoutExercises
            .Include(we => we.Workout)
            .FirstOrDefaultAsync(we => we.Id == workoutExerciseId && we.WorkoutId == workoutId);
        if (workoutExercise is null) return NotFound("Workout exercise not found.");
        if (workoutExercise.Workout.UserId != CurrentUserId()) return Forbid();

        await using var tx = await db.Database.BeginTransactionAsync();

        // Completions and their notes go with the slot — ON DELETE CASCADE in the database.
        db.WorkoutExercises.Remove(workoutExercise);
        await db.SaveChangesAsync();

        // Close the gap in the same transaction: POST's MAX+1 and the reorder route both
        // assume each day runs 1..N (spec 0011 §5).
        var remaining = await db.WorkoutExercises
            .Where(we => we.WorkoutId == workoutId && we.Dia == workoutExercise.Dia)
            .OrderBy(we => we.Ordem)
            .ToListAsync();
        await RenumberAsync(remaining);

        await tx.CommitAsync();
        return NoContent();
    }

    // Declared before the {workoutExerciseId:int} routes only for reading order — the :int
    // constraint already keeps "order" from matching them.
    [HttpPut("{workoutId:int}/exercises/order")]
    public async Task<ActionResult<List<WorkoutExerciseOrderResponse>>> ReorderExercises(
        int workoutId, ReorderWorkoutExercisesRequest request)
    {
        if (!WeekDay.IsValid(request.Dia))
            return BadRequest($"dia must be one of: {string.Join(", ", WeekDay.All)}");

        var workout = await db.Workouts.FindAsync(workoutId);
        if (workout is null) return NotFound("Workout not found.");
        if (workout.UserId != CurrentUserId()) return Forbid();

        var slots = await db.WorkoutExercises
            .Where(we => we.WorkoutId == workoutId && we.Dia == request.Dia)
            .ToDictionaryAsync(we => we.Id);

        // Exactly the day's set, once each: a partial list has no safe reading of where the
        // missing slots go (spec 0011 §5).
        var ids = request.WorkoutExerciseIds;
        if (ids.Count != slots.Count || ids.Distinct().Count() != ids.Count || ids.Any(id => !slots.ContainsKey(id)))
            return BadRequest($"workoutExerciseIds must list every exercise of {request.Dia} exactly once.");

        await using var tx = await db.Database.BeginTransactionAsync();
        await RenumberAsync(ids.Select(id => slots[id]).ToList());
        await tx.CommitAsync();

        return Ok(ids.Select(id => new WorkoutExerciseOrderResponse(id, slots[id].Ordem)).ToList());
    }

    // Assigns ordem 1..N in list order, in two passes: negatives first, then the real values.
    // A single pass would collide with the UNIQUE (workout_id, dia, ordem) index whenever a
    // row moves onto a number another row still holds (spec 0011 §1.2). Caller owns the
    // transaction.
    private async Task RenumberAsync(List<WorkoutExercise> inOrder)
    {
        for (var i = 0; i < inOrder.Count; i++) inOrder[i].Ordem = -(i + 1);
        await db.SaveChangesAsync();
        for (var i = 0; i < inOrder.Count; i++) inOrder[i].Ordem = i + 1;
        await db.SaveChangesAsync();
    }

    [HttpPost("{workoutId:int}/exercises/{workoutExerciseId:int}/completions")]
    public async Task<ActionResult<ExerciseCompletionResponse>> MarkExerciseDone(
        int workoutId, int workoutExerciseId, MarkExerciseDoneRequest request)
    {
        var workoutExercise = await db.WorkoutExercises
            .Include(we => we.Workout)
            .FirstOrDefaultAsync(we => we.Id == workoutExerciseId && we.WorkoutId == workoutId);
        if (workoutExercise is null) return NotFound("Workout exercise not found.");
        if (workoutExercise.Workout.UserId != CurrentUserId()) return Forbid();

        var expectedDia = WeekDay.FromDayOfWeek(request.Date.DayOfWeek);
        if (workoutExercise.Dia != expectedDia)
            return BadRequest($"{request.Date} is a {expectedDia}, but this exercise is scheduled for {workoutExercise.Dia}.");

        var existing = await db.ExerciseCompletions
            .FirstOrDefaultAsync(c => c.WorkoutExerciseId == workoutExerciseId && c.Date == request.Date);

        if (existing is null)
        {
            db.ExerciseCompletions.Add(new ExerciseCompletion
            {
                WorkoutExerciseId = workoutExerciseId,
                Date = request.Date,
                Feito = true,
                ConcludedAt = DateTime.UtcNow,
            });
            await db.SaveChangesAsync();
        }
        else if (!existing.Feito)
        {
            existing.Feito = true;
            existing.ConcludedAt = DateTime.UtcNow;
            await db.SaveChangesAsync();
        }

        var diaConcluido = await IsDayCompleted(workoutExercise.Workout.UserId, request.Date);

        return Ok(new ExerciseCompletionResponse(workoutExerciseId, request.Date, true, diaConcluido));
    }

    [HttpGet("{workoutId:int}/completions")]
    public async Task<ActionResult<List<ExerciseCompletionSummary>>> GetCompletions(
        int workoutId, [FromQuery] DateOnly start, [FromQuery] DateOnly end)
    {
        var workout = await db.Workouts.FindAsync(workoutId);
        if (workout is null) return NotFound();
        if (workout.UserId != CurrentUserId()) return Forbid();

        var completions = await db.ExerciseCompletions
            .Where(c => c.Feito && c.WorkoutExercise.WorkoutId == workoutId && c.Date >= start && c.Date <= end)
            .Select(c => new ExerciseCompletionSummary(c.WorkoutExerciseId, c.Date))
            .ToListAsync();

        return Ok(completions);
    }

    // Upsert. The note is addressed by the completion it hangs off — {workoutExerciseId} plus
    // {date} — rather than by a note id: the client already holds both when it saves, and it
    // never generated the id (spec 006 §5.2).
    [HttpPut("{workoutId:int}/exercises/{workoutExerciseId:int}/completions/{date}/note")]
    public async Task<ActionResult<ExerciseNoteResponse>> SaveNote(
        int workoutId, int workoutExerciseId, DateOnly date, SaveNoteRequest request)
    {
        var sets = request.Sets ?? [];
        if (sets.Count > MaxSetsPerNote)
            return BadRequest($"A note holds at most {MaxSetsPerNote} sets.");
        if (sets.Any(s => s.Weight <= 0 || s.Weight > MaxWeightKg))
            return BadRequest($"Each weight must be greater than 0 and at most {MaxWeightKg} kg.");

        var completion = await FindCompletion(workoutId, workoutExerciseId, date);
        if (completion is null) return NotFound("No completion for that exercise on that date.");
        if (completion.WorkoutExercise.Workout.UserId != CurrentUserId()) return Forbid();

        var note = await db.ExerciseNotes
            .Include(n => n.Sets)
            .FirstOrDefaultAsync(n => n.CompletionId == completion.Id);

        var text = string.IsNullOrWhiteSpace(request.Text) ? null : request.Text.Trim();

        // An empty note is not a note: it would render a chip that says nothing and open a
        // blank sheet, so the PUT that would produce one deletes instead (spec 006 §4.2).
        if (text is null && sets.Count == 0)
        {
            if (note is not null)
            {
                db.ExerciseNotes.Remove(note);
                await db.SaveChangesAsync();
            }
            return NoContent();
        }

        if (note is not null && note.Sets.Count > 0)
        {
            // Dropped in their own round trip: the unique (note_id, set_number) index has no
            // way to tolerate EF interleaving the new inserts with these deletes.
            db.ExerciseNoteSets.RemoveRange(note.Sets);
            note.Sets.Clear();
            await db.SaveChangesAsync();
        }

        var now = DateTime.UtcNow;
        if (note is null)
        {
            note = new ExerciseNote { CompletionId = completion.Id, CreatedAt = now };
            db.ExerciseNotes.Add(note);
        }

        note.Text = text;
        note.UpdatedAt = now;

        // Numbered from the array's order — the only place contiguity can be guaranteed, since
        // every write passes through here and the labels on screen are positional.
        for (var i = 0; i < sets.Count; i++)
            note.Sets.Add(new ExerciseNoteSet { SetNumber = i + 1, Weight = sets[i].Weight });

        await db.SaveChangesAsync();

        return Ok(new ExerciseNoteResponse(
            workoutExerciseId,
            date,
            note.Text,
            note.Sets.OrderBy(s => s.SetNumber).Select(s => s.Weight).ToList()));
    }

    [HttpDelete("{workoutId:int}/exercises/{workoutExerciseId:int}/completions/{date}/note")]
    public async Task<IActionResult> DeleteNote(int workoutId, int workoutExerciseId, DateOnly date)
    {
        var completion = await FindCompletion(workoutId, workoutExerciseId, date);
        if (completion is null) return NotFound("No completion for that exercise on that date.");
        if (completion.WorkoutExercise.Workout.UserId != CurrentUserId()) return Forbid();

        var note = await db.ExerciseNotes.FirstOrDefaultAsync(n => n.CompletionId == completion.Id);
        if (note is not null)
        {
            db.ExerciseNotes.Remove(note);
            await db.SaveChangesAsync();
        }

        // Idempotent: nothing to delete is the same outcome as having deleted it.
        return NoContent();
    }

    // The most recent note of *each* exercise in the workout. Deliberately without a date cut-off:
    // "the latest before the selected date" sounds more correct and behaves worse — it would need
    // a refetch on every day-tab switch and would hide the note just written today, which is the
    // one the user wants to re-read before the next set (spec 006 §5.2).
    [HttpGet("{workoutId:int}/notes/latest")]
    public async Task<ActionResult<List<ExerciseNoteResponse>>> GetLatestNotes(int workoutId)
    {
        var workout = await db.Workouts.FindAsync(workoutId);
        if (workout is null) return NotFound();
        if (workout.UserId != CurrentUserId()) return Forbid();

        // One round trip for the whole workout rather than one query per exercise; the MAX(date)
        // per exercise is picked in memory because a correlated "latest row plus its collection"
        // has no SQLite translation.
        var notes = await db.ExerciseNotes
            .Where(n => n.Completion.WorkoutExercise.WorkoutId == workoutId)
            .Select(n => new
            {
                n.Completion.WorkoutExerciseId,
                n.Completion.Date,
                n.Text,
                Sets = n.Sets.OrderBy(s => s.SetNumber).Select(s => s.Weight).ToList(),
            })
            .ToListAsync();

        var latest = notes
            .GroupBy(n => n.WorkoutExerciseId)
            .Select(g => g.OrderByDescending(n => n.Date).First())
            .Select(n => new ExerciseNoteResponse(n.WorkoutExerciseId, n.Date, n.Text, n.Sets))
            .ToList();

        return Ok(latest);
    }

    private Task<ExerciseCompletion?> FindCompletion(int workoutId, int workoutExerciseId, DateOnly date) =>
        db.ExerciseCompletions
            .Include(c => c.WorkoutExercise).ThenInclude(we => we.Workout)
            .FirstOrDefaultAsync(c =>
                c.WorkoutExerciseId == workoutExerciseId
                && c.WorkoutExercise.WorkoutId == workoutId
                && c.Date == date);

    // A day counts as "concluído" when every exercise across every one of the user's workouts
    // that is scheduled on that weekday has a completion row for that exact date.
    private async Task<bool> IsDayCompleted(int userId, DateOnly date)
    {
        var dia = WeekDay.FromDayOfWeek(date.DayOfWeek);

        var total = await db.WorkoutExercises.CountAsync(we => we.Workout.UserId == userId && we.Dia == dia);
        if (total == 0) return false;

        var done = await db.ExerciseCompletions.CountAsync(c =>
            c.Feito && c.Date == date && c.WorkoutExercise.Dia == dia && c.WorkoutExercise.Workout.UserId == userId);

        return done == total;
    }

    private int CurrentUserId() => int.Parse(User.FindFirstValue(JwtRegisteredClaimNames.Sub)!);
}
