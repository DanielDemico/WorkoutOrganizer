using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WorkoutOrganizer.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddExerciseNote : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "exercise_note",
                columns: table => new
                {
                    id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    completion_id = table.Column<int>(type: "INTEGER", nullable: false),
                    text = table.Column<string>(type: "TEXT", nullable: true),
                    created_at = table.Column<DateTime>(type: "TEXT", nullable: false),
                    updated_at = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_exercise_note", x => x.id);
                    table.ForeignKey(
                        name: "FK_exercise_note_workout_exercise_completion_completion_id",
                        column: x => x.completion_id,
                        principalTable: "workout_exercise_completion",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "exercise_note_set",
                columns: table => new
                {
                    id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    note_id = table.Column<int>(type: "INTEGER", nullable: false),
                    set_number = table.Column<int>(type: "INTEGER", nullable: false),
                    weight = table.Column<double>(type: "REAL", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_exercise_note_set", x => x.id);
                    table.CheckConstraint("CK_exercise_note_set_weight", "weight > 0 AND weight <= 1000");
                    table.ForeignKey(
                        name: "FK_exercise_note_set_exercise_note_note_id",
                        column: x => x.note_id,
                        principalTable: "exercise_note",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_exercise_note_completion_id",
                table: "exercise_note",
                column: "completion_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_exercise_note_set_note_id_set_number",
                table: "exercise_note_set",
                columns: new[] { "note_id", "set_number" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "exercise_note_set");

            migrationBuilder.DropTable(
                name: "exercise_note");
        }
    }
}
