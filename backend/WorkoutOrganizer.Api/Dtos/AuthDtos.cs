using System.ComponentModel.DataAnnotations;

namespace WorkoutOrganizer.Api.Dtos;

public record LoginRequest(
    [Required] string Name,
    [Required] string Password);

public record RefreshRequest([Required] string RefreshToken);

public record TokenResponse(string AccessToken, string RefreshToken, DateTime RefreshTokenExpiresAt);
