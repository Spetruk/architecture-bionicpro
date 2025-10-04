using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.IdentityModel.Tokens;
using System.Security.Claims;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<AutorizationEnrichHandler>();

builder.Services.AddSession(options =>
{
    options.Cookie.Name = ".auth.session";
    options.Cookie.HttpOnly = true;
    options.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest; // только dev
    options.Cookie.SameSite = SameSiteMode.Lax;
    options.IdleTimeout = TimeSpan.FromDays(1);
});
builder.Services.AddStackExchangeRedisCache(options =>
{
    options.Configuration = builder.Configuration["REDIS_HOST"];
    options.InstanceName = ".auth.tokens";
});

builder.Services.AddOpenApi();
builder.Services.AddAuthentication("Keycloak")
                .AddOpenIdConnect
                (
                    authenticationScheme: "Keycloak",
                    options =>
                    {
                        options.ClientId = builder.Configuration["KEYCLOAK_CLIENTID"];
                        options.ClientSecret = builder.Configuration["KEYCLOAK_CLIENT_SECRET"];
                        options.Authority = builder.Configuration["KEYCLOAK_REALM_URL"];
                        options.Scope.Add("bionic-pro.all");
                        options.ResponseType = OpenIdConnectResponseType.Code;
                        options.SaveTokens = true;
                        options.SignInScheme = CookieAuthenticationDefaults.AuthenticationScheme;
                        options.RequireHttpsMetadata = false; // только dev
                        options.UsePkce = true;
                        options.MapInboundClaims = false;
                        options.PushedAuthorizationBehavior = Microsoft.AspNetCore.Authentication.OpenIdConnect.PushedAuthorizationBehavior.Disable;
                        options.TokenValidationParameters = new TokenValidationParameters
                        {
                            ValidateAudience = true,
                            ValidateIssuer = true,
                            ValidateIssuerSigningKey = true,
                            // Принимаем оба возможных issuer: внешний (localhost) и внутренний (keycloak)
                            ValidIssuers = new[]
                            {
                                "http://localhost:8080/realms/reports-realm",
                                "http://keycloak:8080/realms/reports-realm"
                            }
                        };
                        // Используем внутренний discovery для backchannel-запросов
                        options.MetadataAddress = "http://keycloak:8080/realms/reports-realm/.well-known/openid-configuration";

                        // Браузер должен идти на localhost, а backchannel-трафик — на keycloak (внутрисеть)
                        options.Events = new OpenIdConnectEvents
                        {
                            OnRedirectToIdentityProvider = context =>
                            {
                                var browserAuthEndpoint = "http://localhost:8080/realms/reports-realm/protocol/openid-connect/auth";
                                context.ProtocolMessage.IssuerAddress = browserAuthEndpoint;
                                return Task.CompletedTask;
                            }
                        };                        
                    }
                )
                .AddCookie(CookieAuthenticationDefaults.AuthenticationScheme);

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins("http://localhost:3000") // фронтенд
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials();
    });
});

builder.Services.AddScoped<ReportsApiClient>();
builder.Services.AddHttpClient<ReportsApiClient>()
                .AddHttpMessageHandler<AutorizationEnrichHandler>(); // обогащаем все запросы Токенами из текущей сессии

builder.Services.AddAuthorization();

var app = builder.Build();

app.MapOpenApi(pattern: "docs");

app.UseCors();
app.UseRouting();

app.UseSession();
app.UseAuthentication();
app.UseMiddleware<SessionRotationMiddleware>();
app.UseMiddleware<RefreshTokenMiddleware>(); // middleware для обновления access token используя refresh token
app.UseAuthorization();

app.MapGet("/api/auth/status", async (HttpContext context) =>
{
    var user = context.User;
    var isAuthenticated = user.Identity?.IsAuthenticated == true;

    string? name = null;
    if (isAuthenticated)
    {
        name =
            user.FindFirst("preferred_username")?.Value ??
            user.FindFirst(ClaimTypes.Name)?.Value ??
            user.FindFirst("name")?.Value ??
            user.FindFirst("email")?.Value ??
            user.FindFirst(ClaimTypes.Email)?.Value ??
            user.FindFirst("sub")?.Value;

        var given = user.FindFirst("given_name")?.Value;
        var family = user.FindFirst("family_name")?.Value;
        if (string.IsNullOrWhiteSpace(name) && (!string.IsNullOrWhiteSpace(given) || !string.IsNullOrWhiteSpace(family)))
        {
            name = ($"{given} {family}").Trim();
        }
    }

    // Пробуем достать CRM user_id из клеймов, если он есть
    int? userId = null;
    try
    {
        var userIdClaim =
            user.FindFirst("user_id")?.Value ??
            user.FindFirst("userId")?.Value;
        if (!string.IsNullOrWhiteSpace(userIdClaim) && int.TryParse(userIdClaim, out var parsed))
            userId = parsed;
    }
    catch { }

    Console.WriteLine($"[/api/auth/status] isAuthenticated={isAuthenticated} name={name} userId={userId}");
    return Results.Json(new { isAuthenticated, name, userId });
});

// Явная точка входа: инициирует OpenID Connect challenge и после успешного входа ведет на /auth
app.MapGet("/login", (HttpContext context) =>
{
    Console.WriteLine("[/login] challenge -> Keycloak");
    var props = new AuthenticationProperties
    {
        RedirectUri = "/auth"
    };
    return Results.Challenge(props, new[] { "Keycloak" });
});

app.MapGet("/auth", (HttpContext context) =>
{
    Console.WriteLine("[/auth] success -> redirect to frontend");
    return Results.Redirect("http://localhost:3000");
}).RequireAuthorization();

// Public endpoint to land after Keycloak logout
app.MapGet("/after-logout", (HttpContext context) => Results.Redirect("http://localhost:3000"));

app.MapMethods("/auth/logout", new[] { "GET", "POST" }, async (HttpContext context) =>
{
    Console.WriteLine("[/auth/logout] clearing session and redirecting to frontend");
    // Считываем id_token для RP-initiated logout
    string? idToken = null;
    try { idToken = await context.GetTokenAsync("id_token"); } catch { }

    // Чистим локальные сессии/куки
    try { await context.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme); } catch { }
    try { await context.SignOutAsync("Keycloak"); } catch { }
    context.Session.Clear();
    context.Response.Cookies.Delete(".auth.session");

    // Формируем browser-facing logout URL Keycloak
    var realmUrlInternal = app.Configuration["KEYCLOAK_REALM_URL"] ?? "http://keycloak:8080/realms/reports-realm";
    var realmUrlBrowser = realmUrlInternal.Replace("http://keycloak:8080", "http://localhost:8080");
    // Use BFF public endpoint as post_logout_redirect_uri to satisfy Keycloak validation
    var frontendUrl = "http://localhost:5001/after-logout";
    var logoutBase = $"{realmUrlBrowser}/protocol/openid-connect/logout";
    var postLogout = System.Net.WebUtility.UrlEncode(frontendUrl);
    var clientId = app.Configuration["KEYCLOAK_CLIENTID"] ?? "backend-auth";
    var logoutUrl = $"{logoutBase}?client_id={clientId}&post_logout_redirect_uri={postLogout}";
    if (!string.IsNullOrWhiteSpace(idToken))
    {
        var hint = System.Net.WebUtility.UrlEncode(idToken);
        logoutUrl += $"&id_token_hint={hint}";
    }
    return Results.Redirect(logoutUrl);
});

app.MapGet("/reports", async (HttpContext context, [FromServices] ReportsApiClient reportsClient) => await reportsClient.GetReportsAsync(context))
   .RequireAuthorization()
   .RequreSessionRotation();

app.MapGet("/generate-reports", async (HttpContext context, [FromServices] ReportsApiClient reportsClient) =>
    {
        return TypedResults.Json(new
        {
            url = await reportsClient.GenerateReportsAsync(context)
        });
    })
   .RequireAuthorization()
   .RequreSessionRotation();

app.Run();

public class ReportsApiClient
{
    private readonly HttpClient reportsApiClient;
    private readonly string _generateReportsUrl;
    private readonly string _getReportsUrl;
    public ReportsApiClient(HttpClient httpClient, IConfiguration configuration)
    {
        reportsApiClient = httpClient;
        _getReportsUrl = $"{configuration["REPORTS_API_URL"]}/reports";
        _generateReportsUrl = $"{configuration["REPORTS_API_URL"]}/generate-reports";
    }

    public async Task<string> GenerateReportsAsync(HttpContext context)
    {
        var response = await reportsApiClient.PostAsync(_generateReportsUrl, null, context.RequestAborted);
        return await response.Content.ReadFromJsonAsync<string>();
    }

    public async Task<IResult> GetReportsAsync(HttpContext context)
    {
        var response = await reportsApiClient.GetAsync(_getReportsUrl, context.RequestAborted);
        // Возвращаем JSON в ответ, без принудительной загрузки файла
        var text = await response.Content.ReadAsStringAsync(context.RequestAborted);
        try
        {
            var json = System.Text.Json.JsonSerializer.Deserialize<object>(text);
            return Results.Json(json);
        }
        catch
        {
            // Если не JSON — вернем как text
            return Results.Text(text, "application/json");
        }
    }
}