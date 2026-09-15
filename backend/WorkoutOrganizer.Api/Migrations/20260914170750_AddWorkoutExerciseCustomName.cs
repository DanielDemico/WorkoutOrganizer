using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WorkoutOrganizer.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddWorkoutExerciseCustomName : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "exercise_id",
                table: "workout_exercise",
                type: "TEXT",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "TEXT");

            migrationBuilder.AddColumn<string>(
                name: "custom_name",
                table: "workout_exercise",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddCheckConstraint(
                name: "CK_workout_exercise_source",
                table: "workout_exercise",
                sql: "(exercise_id IS NULL AND custom_name IS NOT NULL) OR (exercise_id IS NOT NULL AND custom_name IS NULL)");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_workout_exercise_source",
                table: "workout_exercise");

            migrationBuilder.DropColumn(
                name: "custom_name",
                table: "workout_exercise");

            migrationBuilder.AlterColumn<string>(
                name: "exercise_id",
                table: "workout_exercise",
                type: "TEXT",
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "TEXT",
                oldNullable: true);
        }
    }
}
