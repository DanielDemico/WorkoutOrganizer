using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WorkoutOrganizer.Api.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // "user" already exists (created by the exercises.json import script); add the
            // refresh-token columns needed for JWT auth instead of re-creating the table.
            migrationBuilder.Sql("ALTER TABLE user ADD COLUMN refresh_token TEXT NULL;");
            migrationBuilder.Sql("ALTER TABLE user ADD COLUMN refresh_token_expiry TEXT NULL;");

            migrationBuilder.CreateTable(
                name: "workout",
                columns: table => new
                {
                    workout_id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    user_id = table.Column<int>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_workout", x => x.workout_id);
                    table.ForeignKey(
                        name: "FK_workout_user_user_id",
                        column: x => x.user_id,
                        principalTable: "user",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "workout_exercise",
                columns: table => new
                {
                    id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    workout_id = table.Column<int>(type: "INTEGER", nullable: false),
                    exercise_id = table.Column<string>(type: "TEXT", nullable: false),
                    dia = table.Column<string>(type: "TEXT", nullable: false),
                    ordem = table.Column<int>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_workout_exercise", x => x.id);
                    table.CheckConstraint("CK_workout_exercise_dia", "dia IN ('seg','ter','qua','qui','sex','sab','dom')");
                    table.ForeignKey(
                        name: "FK_workout_exercise_exercises_exercise_id",
                        column: x => x.exercise_id,
                        principalTable: "exercises",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_workout_exercise_workout_workout_id",
                        column: x => x.workout_id,
                        principalTable: "workout",
                        principalColumn: "workout_id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_workout_user_id",
                table: "workout",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "IX_workout_exercise_exercise_id",
                table: "workout_exercise",
                column: "exercise_id");

            migrationBuilder.CreateIndex(
                name: "IX_workout_exercise_workout_id_dia_ordem",
                table: "workout_exercise",
                columns: new[] { "workout_id", "dia", "ordem" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "workout_exercise");

            migrationBuilder.DropTable(
                name: "workout");

            migrationBuilder.Sql("ALTER TABLE user DROP COLUMN refresh_token;");
            migrationBuilder.Sql("ALTER TABLE user DROP COLUMN refresh_token_expiry;");
        }
    }
}
