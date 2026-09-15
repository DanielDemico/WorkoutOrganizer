using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi;
using Scalar.AspNetCore;
using WorkoutOrganizer.Api.Auth;
using WorkoutOrganizer.Api.Data;
using WorkoutOrganizer.Api.Services;

var builder = WebApplication.CreateBuilder(args);

// Secrets and machine-specific values (Jwt__Key, DocumentService__BaseUrl) live in
// backend/WorkoutOrganizer.Api/.env, gitignored — copy .env.example to get started. Keys use the
// "Section__Key" form so they land on the same IConfiguration sections as appsettings.json.
// NoClobber keeps real environment variables (CI, hosting) winning over the file.
DotNetEnv.Env.Load(Path.Combine(builder.Environment.ContentRootPath, ".env"), DotNetEnv.LoadOptions.NoClobber());
builder.Configuration.AddEnvironmentVariables();

// The exercises.json import script writes workout.db (and the images/videos folders) at the repo root,
// two levels above this project.
var repoRoot = Path.GetFullPath(Path.Combine(builder.Environment.ContentRootPath, "..", ".."));
var dbPath = Path.Combine(repoRoot, "workout.db");
var connectionString = string.Format(builder.Configuration.GetConnectionString("DefaultConnection")!, dbPath);

builder.Services.AddDbContext<AppDbContext>(options => options.UseSqlite(connectionString));

const string FrontendCorsPolicy = "FrontendCorsPolicy";
builder.Services.AddCors(options =>
{
    options.AddPolicy(FrontendCorsPolicy, policy =>
    {
        // Vite bumps to the next free port (5174, 5175, ...) whenever 5173 is already taken,
        // so pin to a fixed origin list only breaks CORS unpredictably. Any localhost/127.0.0.1
        // origin is fine here since this policy only applies in Development (see below).
        policy.SetIsOriginAllowed(origin =>
            {
                if (!Uri.TryCreate(origin, UriKind.Absolute, out var uri)) return false;
                return uri.Host is "localhost" or "127.0.0.1";
            })
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

builder.Services.Configure<JwtSettings>(builder.Configuration.GetSection(JwtSettings.SectionName));
builder.Services.AddScoped<TokenService>();
builder.Services.AddScoped<LocalizationService>();

var docServiceBaseUrl = builder.Configuration.GetValue<string>("DocumentService:BaseUrl")
    ?? throw new InvalidOperationException("DocumentService:BaseUrl is not configured (appsettings.json or DocumentService__BaseUrl in .env).");
builder.Services.AddHttpClient<DocumentServiceClient>(client =>
{
    client.BaseAddress = new Uri(docServiceBaseUrl);
    client.Timeout = TimeSpan.FromSeconds(90);
});


var jwtSettings = builder.Configuration.GetSection(JwtSettings.SectionName).Get<JwtSettings>()!;
// Fail at startup, not on the first login: a missing key used to surface as a NullReferenceException
// deep inside TokenService. 32 bytes is the minimum HMAC-SHA256 accepts.
if (string.IsNullOrWhiteSpace(jwtSettings.Key))
{
    throw new InvalidOperationException(
        "Jwt:Key is not configured. Set Jwt__Key in backend/WorkoutOrganizer.Api/.env (see .env.example) "
        + "to a base64 string of at least 32 random bytes.");
}
if (Convert.FromBase64String(jwtSettings.Key).Length < 32)
{
    throw new InvalidOperationException("Jwt:Key must decode to at least 32 bytes.");
}
builder.Services.AddAuthentication(options =>
    {
        options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
        options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
    })
    .AddJwtBearer(options =>
    {
        options.MapInboundClaims = false;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwtSettings.Issuer,
            ValidateAudience = true,
            ValidAudience = jwtSettings.Audience,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Convert.FromBase64String(jwtSettings.Key)),
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromSeconds(30),
        };
    });
builder.Services.AddAuthorization();

builder.Services.AddControllers();
builder.Services.AddOpenApi(options =>
{
    options.AddDocumentTransformer((document, context, cancellationToken) =>
    {
        document.Components ??= new OpenApiComponents();
        document.Components.SecuritySchemes ??= new Dictionary<string, IOpenApiSecurityScheme>();
        document.Components.SecuritySchemes["Bearer"] = new OpenApiSecurityScheme
        {
            Type = SecuritySchemeType.Http,
            Scheme = "bearer",
            BearerFormat = "JWT",
            Description = "Access token retornado por /api/auth/login ou /api/auth/refresh.",
        };
        return Task.CompletedTask;
    });

    options.AddOperationTransformer((operation, context, cancellationToken) =>
    {
        var metadata = context.Description.ActionDescriptor.EndpointMetadata;
        var requiresAuth = metadata.OfType<AuthorizeAttribute>().Any()
            && !metadata.OfType<AllowAnonymousAttribute>().Any();

        if (requiresAuth)
        {
            operation.Security =
            [
                new OpenApiSecurityRequirement
                {
                    [new OpenApiSecuritySchemeReference("Bearer", context.Document)] = []
                }
            ];
        }

        return Task.CompletedTask;
    });
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference();
}

app.UseHttpsRedirection();

// Not gated on IsDevelopment(): ASPNETCORE_ENVIRONMENT is only set to "Development" via
// launchSettings.json (dotnet run / IDE debug). Running the built exe/dll directly leaves it
// unset (defaults to Production), which used to silently skip this and break CORS for the
// frontend every time. The policy itself already restricts origins to localhost/127.0.0.1,
// so it's safe to apply unconditionally.
app.UseCors(FrontendCorsPolicy);

// Serves the exercises.json dataset's image/gif files (e.g. "images/0001-xxx.jpg") at /images and /videos,
// matching the relative paths stored in exercises.image / exercises.gif_url.
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(Path.Combine(repoRoot, "images")),
    RequestPath = "/images",
});
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(Path.Combine(repoRoot, "videos")),
    RequestPath = "/videos",
});

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();
