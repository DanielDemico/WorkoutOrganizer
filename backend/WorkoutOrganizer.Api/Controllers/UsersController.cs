using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WorkoutOrganizer.Api.Data;
using WorkoutOrganizer.Api.Dtos;
using WorkoutOrganizer.Api.Entities;

namespace WorkoutOrganizer.Api.Controllers;

[ApiController]
[Route("api/users")]
public class UsersController(AppDbContext db) : ControllerBase
{
    [HttpPost]
    [AllowAnonymous]
    public async Task<ActionResult<UserResponse>> Create(CreateUserRequest request)
    {
        if (await db.Users.AnyAsync(u => u.Name == request.Name))
            return Conflict("A user with this name already exists.");

        var user = new User
        {
            Name = request.Name,
            HashPass = BCrypt.Net.BCrypt.HashPassword(request.Password),
        };

        db.Users.Add(user);
        await db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = user.Id }, UserResponse.From(user));
    }

    [HttpGet]
    [Authorize]
    public async Task<ActionResult<List<UserResponse>>> GetAll()
    {
        var users = await db.Users.Select(u => UserResponse.From(u)).ToListAsync();
        return Ok(users);
    }

    [HttpGet("{id:int}")]
    [Authorize]
    public async Task<ActionResult<UserResponse>> GetById(int id)
    {
        var user = await db.Users.FindAsync(id);
        return user is null ? NotFound() : Ok(UserResponse.From(user));
    }

    [HttpPut("{id:int}")]
    [Authorize]
    public async Task<ActionResult<UserResponse>> Update(int id, UpdateUserRequest request)
    {
        var user = await db.Users.FindAsync(id);
        if (user is null) return NotFound();

        if (!string.IsNullOrWhiteSpace(request.Name))
            user.Name = request.Name;

        if (!string.IsNullOrWhiteSpace(request.Password))
            user.HashPass = BCrypt.Net.BCrypt.HashPassword(request.Password);

        await db.SaveChangesAsync();
        return Ok(UserResponse.From(user));
    }

    [HttpDelete("{id:int}")]
    [Authorize]
    public async Task<IActionResult> Delete(int id)
    {
        var user = await db.Users.FindAsync(id);
        if (user is null) return NotFound();

        db.Users.Remove(user);
        await db.SaveChangesAsync();
        return NoContent();
    }
}
