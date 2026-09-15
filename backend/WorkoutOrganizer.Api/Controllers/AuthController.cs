using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WorkoutOrganizer.Api.Data;
using WorkoutOrganizer.Api.Dtos;
using WorkoutOrganizer.Api.Services;

namespace WorkoutOrganizer.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(AppDbContext db, TokenService tokenService) : ControllerBase
{
    [HttpPost("login")]
    public async Task<ActionResult<TokenResponse>> Login(LoginRequest request)
    {
        var user = await db.Users.SingleOrDefaultAsync(u => u.Name == request.Name);
        if (user is null || !BCrypt.Net.BCrypt.Verify(request.Password, user.HashPass))
            return Unauthorized("Invalid credentials.");

        return Ok(await IssueTokens(user));
    }

    [HttpPost("refresh")]
    public async Task<ActionResult<TokenResponse>> Refresh(RefreshRequest request)
    {
        var user = await db.Users.SingleOrDefaultAsync(u => u.RefreshToken == request.RefreshToken);
        if (user is null || user.RefreshTokenExpiryTime is null || user.RefreshTokenExpiryTime <= DateTime.UtcNow)
            return Unauthorized("Invalid or expired refresh token.");

        return Ok(await IssueTokens(user));
    }

    [HttpPost("logout")]
    public async Task<IActionResult> Logout(RefreshRequest request)
    {
        var user = await db.Users.SingleOrDefaultAsync(u => u.RefreshToken == request.RefreshToken);
        if (user is not null)
        {
            user.RefreshToken = null;
            user.RefreshTokenExpiryTime = null;
            await db.SaveChangesAsync();
        }

        return NoContent();
    }

    private async Task<TokenResponse> IssueTokens(Entities.User user)
    {
        var accessToken = tokenService.CreateAccessToken(user);
        var refreshToken = TokenService.CreateRefreshToken();
        var expiresAt = tokenService.RefreshTokenExpiry();

        user.RefreshToken = refreshToken;
        user.RefreshTokenExpiryTime = expiresAt;
        await db.SaveChangesAsync();

        return new TokenResponse(accessToken, refreshToken, expiresAt);
    }
}
