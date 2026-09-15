using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WorkoutOrganizer.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddWorkoutNome : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "nome",
                table: "workout",
                type: "TEXT",
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "nome",
                table: "workout");
        }
    }
}
