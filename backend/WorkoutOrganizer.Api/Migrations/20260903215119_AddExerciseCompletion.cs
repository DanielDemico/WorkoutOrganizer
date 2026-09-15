using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WorkoutOrganizer.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddExerciseCompletion : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "workout_exercise_completion",
                columns: table => new
                {
                    id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    workout_exercise_id = table.Column<int>(type: "INTEGER", nullable: false),
                    date = table.Column<DateOnly>(type: "TEXT", nullable: false),
                    feito = table.Column<bool>(type: "INTEGER", nullable: false),
                    concluded_at = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_workout_exercise_completion", x => x.id);
                    table.ForeignKey(
                        name: "FK_workout_exercise_completion_workout_exercise_workout_exercise_id",
                        column: x => x.workout_exercise_id,
                        principalTable: "workout_exercise",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_workout_exercise_completion_workout_exercise_id_date",
                table: "workout_exercise_completion",
                columns: new[] { "workout_exercise_id", "date" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "workout_exercise_completion");
        }
    }
}
