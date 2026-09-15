using Microsoft.EntityFrameworkCore;
using WorkoutOrganizer.Api.Entities;

namespace WorkoutOrganizer.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Exercise> Exercises => Set<Exercise>();
    public DbSet<ExerciseInstruction> ExerciseInstructions => Set<ExerciseInstruction>();
    public DbSet<ExerciseInstructionStep> ExerciseInstructionSteps => Set<ExerciseInstructionStep>();
    public DbSet<Workout> Workouts => Set<Workout>();
    public DbSet<WorkoutExercise> WorkoutExercises => Set<WorkoutExercise>();
    public DbSet<ExerciseCompletion> ExerciseCompletions => Set<ExerciseCompletion>();
    public DbSet<ExerciseNote> ExerciseNotes => Set<ExerciseNote>();
    public DbSet<ExerciseNoteSet> ExerciseNoteSets => Set<ExerciseNoteSet>();
    public DbSet<ExerciseSecondaryMuscle> ExerciseSecondaryMuscles => Set<ExerciseSecondaryMuscle>();
    public DbSet<MuscleTerm> MuscleTerms => Set<MuscleTerm>();
    public DbSet<MuscleMapping> MuscleMappings => Set<MuscleMapping>();
    public DbSet<ExerciseI18n> ExerciseTranslations => Set<ExerciseI18n>();
    public DbSet<ExerciseInstructionStepI18n> ExerciseInstructionStepTranslations => Set<ExerciseInstructionStepI18n>();
    public DbSet<TermI18n> TermTranslations => Set<TermI18n>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // "user" and "exercises" already exist (created by the exercises.json import script).
        // ExcludeFromMigrations keeps them queryable/writable without EF trying to re-create them;
        // the two new refresh-token columns are added via a hand-written ALTER TABLE in the initial migration.
        modelBuilder.Entity<User>(e =>
        {
            e.ToTable("user", t => t.ExcludeFromMigrations());
            e.Property(u => u.Id).HasColumnName("id");
            e.Property(u => u.Name).HasColumnName("name");
            e.Property(u => u.HashPass).HasColumnName("hash_pass");
            e.Property(u => u.RefreshToken).HasColumnName("refresh_token");
            e.Property(u => u.RefreshTokenExpiryTime).HasColumnName("refresh_token_expiry");
        });

        modelBuilder.Entity<Exercise>(e =>
        {
            e.ToTable("exercises", t => t.ExcludeFromMigrations());
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.Name).HasColumnName("name");
            e.Property(x => x.Category).HasColumnName("category");
            e.Property(x => x.BodyPart).HasColumnName("body_part");
            e.Property(x => x.Equipment).HasColumnName("equipment");
            e.Property(x => x.MuscleGroup).HasColumnName("muscle_group");
            e.Property(x => x.Target).HasColumnName("target");
            e.Property(x => x.Image).HasColumnName("image");
            e.Property(x => x.GifUrl).HasColumnName("gif_url");
            e.Property(x => x.MediaId).HasColumnName("media_id");
            e.Property(x => x.CreatedAt).HasColumnName("created_at");
            e.Property(x => x.Attribution).HasColumnName("attribution");
        });

        modelBuilder.Entity<ExerciseInstruction>(e =>
        {
            e.ToTable("exercise_instructions", t => t.ExcludeFromMigrations());
            e.HasKey(x => new { x.ExerciseId, x.Lang });
            e.Property(x => x.ExerciseId).HasColumnName("exercise_id");
            e.Property(x => x.Lang).HasColumnName("lang");
            e.Property(x => x.Text).HasColumnName("text");
        });

        modelBuilder.Entity<ExerciseInstructionStep>(e =>
        {
            e.ToTable("exercise_instruction_steps", t => t.ExcludeFromMigrations());
            e.HasKey(x => new { x.ExerciseId, x.Lang, x.StepOrder });
            e.Property(x => x.ExerciseId).HasColumnName("exercise_id");
            e.Property(x => x.Lang).HasColumnName("lang");
            e.Property(x => x.StepOrder).HasColumnName("step_order");
            e.Property(x => x.Text).HasColumnName("text");
        });

        modelBuilder.Entity<ExerciseSecondaryMuscle>(e =>
        {
            e.ToTable("exercise_secondary_muscles", t => t.ExcludeFromMigrations());
            e.HasKey(x => new { x.ExerciseId, x.Muscle });
            e.Property(x => x.ExerciseId).HasColumnName("exercise_id");
            e.Property(x => x.Muscle).HasColumnName("muscle");
        });

        // "muscle_term" and "muscle_mapping" are reference data derived from the dataset,
        // created and populated by build_muscle_mapping.py — read-only from here.
        modelBuilder.Entity<MuscleTerm>(e =>
        {
            e.ToTable("muscle_term", t => t.ExcludeFromMigrations());
            e.HasKey(x => x.Term);
            e.Property(x => x.Term).HasColumnName("term");
            e.Property(x => x.LabelPt).HasColumnName("label_pt");
        });

        modelBuilder.Entity<MuscleMapping>(e =>
        {
            e.ToTable("muscle_mapping", t => t.ExcludeFromMigrations());
            e.HasKey(x => new { x.Term, x.MuscleId });
            e.Property(x => x.Term).HasColumnName("term");
            e.Property(x => x.MuscleId).HasColumnName("muscle_id");

            e.HasOne(x => x.MuscleTerm)
                .WithMany(t => t.Mappings)
                .HasForeignKey(x => x.Term)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // The three translation tables are created and populated by build_translations.py,
        // which owns them exclusively — read-only from here (spec 004 §5.2).
        modelBuilder.Entity<ExerciseI18n>(e =>
        {
            e.ToTable("exercise_i18n", t => t.ExcludeFromMigrations());
            e.HasKey(x => new { x.ExerciseId, x.Lang });
            e.Property(x => x.ExerciseId).HasColumnName("exercise_id");
            e.Property(x => x.Lang).HasColumnName("lang");
            e.Property(x => x.Name).HasColumnName("name");
            e.Property(x => x.NameNorm).HasColumnName("name_norm");
            e.Property(x => x.Instructions).HasColumnName("instructions");
        });

        modelBuilder.Entity<ExerciseInstructionStepI18n>(e =>
        {
            e.ToTable("exercise_instruction_step_i18n", t => t.ExcludeFromMigrations());
            e.HasKey(x => new { x.ExerciseId, x.Lang, x.StepOrder });
            e.Property(x => x.ExerciseId).HasColumnName("exercise_id");
            e.Property(x => x.Lang).HasColumnName("lang");
            e.Property(x => x.StepOrder).HasColumnName("step_order");
            e.Property(x => x.Text).HasColumnName("text");
        });

        modelBuilder.Entity<TermI18n>(e =>
        {
            e.ToTable("term_i18n", t => t.ExcludeFromMigrations());
            e.HasKey(x => new { x.Kind, x.Term, x.Lang });
            e.Property(x => x.Kind).HasColumnName("kind");
            e.Property(x => x.Term).HasColumnName("term");
            e.Property(x => x.Lang).HasColumnName("lang");
            e.Property(x => x.Label).HasColumnName("label");
        });

        modelBuilder.Entity<Workout>(e =>
        {
            e.ToTable("workout");
            e.Property(w => w.WorkoutId).HasColumnName("workout_id");
            e.Property(w => w.Nome).HasColumnName("nome");
            e.Property(w => w.UserId).HasColumnName("user_id");
            e.HasOne(w => w.User)
                .WithMany(u => u.Workouts)
                .HasForeignKey(w => w.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<WorkoutExercise>(e =>
        {
            e.ToTable("workout_exercise", t =>
            {
                t.HasCheckConstraint(
                    "CK_workout_exercise_dia",
                    "dia IN ('segunda','terça','quarta','quinta','sexta','sabado','domingo')");
                // A slot is either a catalog exercise or a free-named one, never both and
                // never neither (spec 0010 §4).
                t.HasCheckConstraint(
                    "CK_workout_exercise_source",
                    "(exercise_id IS NULL AND custom_name IS NOT NULL) OR (exercise_id IS NOT NULL AND custom_name IS NULL)");
            });
            e.Property(we => we.Id).HasColumnName("id");
            e.Property(we => we.WorkoutId).HasColumnName("workout_id");
            e.Property(we => we.ExerciseId).HasColumnName("exercise_id");
            e.Property(we => we.CustomName).HasColumnName("custom_name");
            e.Property(we => we.Dia).HasColumnName("dia");
            e.Property(we => we.Ordem).HasColumnName("ordem");
            e.Property(we => we.Series).HasColumnName("series");
            e.Property(we => we.Observacao).HasColumnName("observacao");

            e.HasOne(we => we.Workout)
                .WithMany(w => w.Exercises)
                .HasForeignKey(we => we.WorkoutId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(we => we.Exercise)
                .WithMany()
                .HasForeignKey(we => we.ExerciseId)
                .IsRequired(false)
                .OnDelete(DeleteBehavior.Restrict);

            // Prevents two exercises from sharing the same slot on the same day.
            e.HasIndex(we => new { we.WorkoutId, we.Dia, we.Ordem }).IsUnique();
        });

        modelBuilder.Entity<ExerciseCompletion>(e =>
        {
            e.ToTable("workout_exercise_completion");
            e.Property(c => c.Id).HasColumnName("id");
            e.Property(c => c.WorkoutExerciseId).HasColumnName("workout_exercise_id");
            e.Property(c => c.Date).HasColumnName("date");
            e.Property(c => c.Feito).HasColumnName("feito");
            e.Property(c => c.ConcludedAt).HasColumnName("concluded_at");

            e.HasOne(c => c.WorkoutExercise)
                .WithMany()
                .HasForeignKey(c => c.WorkoutExerciseId)
                .OnDelete(DeleteBehavior.Cascade);

            // One completion record per exercise slot per date — marking it done twice for
            // the same date is an upsert, not a new row.
            e.HasIndex(c => new { c.WorkoutExerciseId, c.Date }).IsUnique();
        });

        modelBuilder.Entity<ExerciseNote>(e =>
        {
            e.ToTable("exercise_note");
            e.Property(n => n.Id).HasColumnName("id");
            e.Property(n => n.CompletionId).HasColumnName("completion_id");
            e.Property(n => n.Text).HasColumnName("text");
            e.Property(n => n.CreatedAt).HasColumnName("created_at");
            e.Property(n => n.UpdatedAt).HasColumnName("updated_at");

            // One-to-one, so the FK column carries a UNIQUE index: a completion has at most one
            // note. Without it a repeated PUT would fork into parallel rows and "the note for
            // that day" would stop being a question with a single answer (spec 006 §4.2).
            e.HasOne(n => n.Completion)
                .WithOne()
                .HasForeignKey<ExerciseNote>(n => n.CompletionId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ExerciseNoteSet>(e =>
        {
            e.ToTable("exercise_note_set", t => t.HasCheckConstraint(
                "CK_exercise_note_set_weight",
                "weight > 0 AND weight <= 1000"));
            e.Property(s => s.Id).HasColumnName("id");
            e.Property(s => s.NoteId).HasColumnName("note_id");
            e.Property(s => s.SetNumber).HasColumnName("set_number");
            e.Property(s => s.Weight).HasColumnName("weight");

            e.HasOne(s => s.Note)
                .WithMany(n => n.Sets)
                .HasForeignKey(s => s.NoteId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasIndex(s => new { s.NoteId, s.SetNumber }).IsUnique();
        });
    }
}
