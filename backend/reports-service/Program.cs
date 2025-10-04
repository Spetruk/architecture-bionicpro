using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Minio;
var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddStackExchangeRedisCache(options =>
{
    options.Configuration = builder.Configuration["REDIS_HOST"];
});

builder.Services.AddMinio(options => options.WithEndpoint(builder.Configuration["MINIO_END_POINT"])
                                            .WithCredentials(builder.Configuration["MINIO_ACCESS_KEY"], builder.Configuration["MINIO_SECRET_KEY"])
                                            .WithRegion(builder.Configuration["MINIO_REGION"])
                                            .WithSSL(false)); // dev 

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
                .AddJwtBearer(options =>
                {
                    options.Authority = "http://keycloak:8080/realms/reports-realm";
                    options.RequireHttpsMetadata = false; // Только для dev (HTTP)
                    options.Audience = "backend-auth";

                    // Позволяем issuer быть localhost, даже если качаем ключи с keycloak
                    options.TokenValidationParameters = new TokenValidationParameters
                    {
                        ValidateIssuer = true,
                        // Разрешаем issuer быть localhost (как в токене)
                        ValidIssuer = "http://localhost:8080/realms/reports-realm",
                        ValidateLifetime = true,
                        ValidateAudience = true,
                        ValidAudience = "backend-auth"
                    };
                    options.Events = new JwtBearerEvents
                    {
                        OnAuthenticationFailed = context =>
                        {
                            Console.WriteLine($"❌ Auth failed: {context.Exception.Message}");
                            return Task.CompletedTask;
                        },
                        OnTokenValidated = context =>
                        {
                            Console.WriteLine("✅ Token successfully validated!");
                            Console.WriteLine($"User: {context.Principal.Identity.Name}");
                            return Task.CompletedTask;
                        },
                        OnChallenge = context =>
                        {
                            Console.WriteLine($"💡 OnChallenge: {context.Response.StatusCode} | {context.Error} | {context.ErrorDescription}");
                            return Task.CompletedTask;
                        },
                        OnMessageReceived = context =>
                        {
                            Console.WriteLine("📩 Token received: " + context.Token?.Substring(0, 50) + "...");
                            return Task.CompletedTask;
                        }
                    };
                });

builder.Services.AddScoped<ReportsService>();

var app = builder.Build();

app.UseSwagger();
app.UseSwaggerUI();

app.UseAuthentication();
app.UseAuthorization();

app.MapPost("/generate-reports", async Task<IResult> (HttpContext context, ReportsService extractionService) =>
{
    int? userId = ExtractUserId(context.User);
    if (userId is null)
        return TypedResults.NotFound("user id not found");

    var exists = await extractionService.IsGeneratedReportExistsAsync(userId.Value);
    if (!exists)
    {
        var isReportGenerated = await extractionService.GenerateAndSaveReportAsync(userId.Value);
        if (isReportGenerated)
        {
            return TypedResults.Ok(extractionService.GenerateCdnReportLink(userId.Value));
        }
        else
        {
            // Данных в olap пока что нет
            // Можно, например, запустить DAG для выгрузке данных для одного пользователя через Ariflow Admin API

            return TypedResults.NotFound("Данные для отчета пока не найдены");
        }
    }
    else
    {
        return TypedResults.Ok(extractionService.GenerateCdnReportLink(userId.Value));
    }
}).RequireAuthorization();

app.MapGet("/reports", async (HttpContext context, ReportsService extractionService) =>
{
    int? userId = ExtractUserId(context.User);
    if (userId is null)
        return TypedResults.NotFound("user id not found");

    var exists = await extractionService.IsGeneratedReportExistsAsync(userId.Value);
    if (!exists)
    {
        await extractionService.GenerateAndSaveReportAsync(userId.Value);
    }

    return await extractionService.GetReportFile(userId.Value);
}).RequireAuthorization();

app.Run();

static int? ExtractUserId(ClaimsPrincipal user)
{
    var claims = user.Claims;

    // Попробуем по разным возможным Issuer'ам
    foreach (var claimType in new[] { JwtRegisteredClaimNames.Sub, "user_id", "userId" })
    {
        var claim = claims.FirstOrDefault(c => c.Type == claimType);
        if (claim != null && int.TryParse(claim.Value, out var userId))
            return userId;
    }

    return null;
}
