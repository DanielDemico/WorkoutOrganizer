using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WorkoutOrganizer.Api.Migrations
{
    /// <inheritdoc />
    public partial class UpdateWorkoutExercise : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_workout_exercise_dia",
                table: "workout_exercise");

            migrationBuilder.AddColumn<string>(
                name: "observacao",
                table: "workout_exercise",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddCheckConstraint(
                name: "CK_workout_exercise_dia",
                table: "workout_exercise",
                sql: "dia IN ('segunda','terça','quarta','quinta','sexta','sabado','domingo')");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_workout_exercise_dia",
                table: "workout_exercise");

            migrationBuilder.DropColumn(
                name: "observacao",
                table: "workout_exercise");

            migrationBuilder.AddCheckConstraint(
                name: "CK_workout_exercise_dia",
                table: "workout_exercise",
                sql: "dia IN ('seg','ter','qua','qui','sex','sab','dom')");
        }
    }
}
