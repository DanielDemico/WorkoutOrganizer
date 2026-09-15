using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WorkoutOrganizer.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddWorkoutExerciseSeries : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "series",
                table: "workout_exercise",
                type: "INTEGER",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "series",
                table: "workout_exercise");
        }
    }
}
