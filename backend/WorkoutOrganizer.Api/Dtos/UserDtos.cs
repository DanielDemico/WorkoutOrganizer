using System.ComponentModel.DataAnnotations;

namespace WorkoutOrganizer.Api.Dtos;

public record CreateUserRequest(
    [Required, MinLength(1)] string Name,
    [Required, MinLength(6)] string Password);

public record UpdateUserRequest(
    string? Name,
    [MinLength(6)] string? Password);

public record UserResponse(int Id, string Name)
{
    public static UserResponse From(Entities.User user) => new(user.Id, user.Name);
}
