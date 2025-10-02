using System.Text.Json;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.Extensions.Options;

public class RefreshTokenMiddleware
{
    private readonly RequestDelegate _next;
    private readonly IOptionsMonitor<OpenIdConnectOptions> _oidcOptions;

    public RefreshTokenMiddleware(RequestDelegate next, IOptionsMonitor<OpenIdConnectOptions> oidcOptions)
    {
        _next = next;
        _oidcOptions = oidcOptions;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        // Проверяем, аутентифицирован ли пользователь
        if (context.User.Identity?.IsAuthenticated == true)
        {
            if (await IsAccessTokenExpiredAsync(context))
            {
                var refreshToken = await context.GetTokenAsync("refresh_token");
                if (!string.IsNullOrEmpty(refreshToken))
                {
                    var newTokens = await RefreshAccessTokenAsync(context, refreshToken);
                    if (newTokens != null)
                    {
                        // Обновляем свойства аутентификации (куда входят токены)
                        var authInfo = await context.AuthenticateAsync();
                        if (authInfo.Succeeded)
                        {
                            var props = authInfo.Properties;
                            var setExp = DateTimeOffset.UtcNow.AddSeconds(newTokens.Value.ExpiresIn).ToString();
                            Console.WriteLine(setExp);
                            Console.WriteLine(DateTimeOffset.UtcNow);
                            props.UpdateTokenValue("access_token", newTokens.Value.AccessToken);
                            props.UpdateTokenValue("refresh_token", newTokens.Value.RefreshToken);
                            props.UpdateTokenValue("expires_at", setExp);

                            // Перезаписываем cookie с новыми токенами
                            await context.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, authInfo.Principal, props);
                        }
                    }
                    else
                    {
                        // Не удалось обновить — можно разлогинить
                        await context.SignOutAsync();
                    }
                }
            }
        }

        // Передаём управление следующему middleware
        await _next(context);
    }

    private static async Task<bool> IsAccessTokenExpiredAsync(HttpContext context)
    {
        var expiresAtString = await context.GetTokenAsync("expires_at");
        if (string.IsNullOrEmpty(expiresAtString))
            return true; // Если нет даты — считаем просроченным

        if (DateTimeOffset.TryParse(expiresAtString, out var parsed))
        {
            return parsed < DateTimeOffset.UtcNow;
        }

        return true; // Ошибка парсинга → токен недействителен
    }

    private async Task<(string AccessToken, string RefreshToken, int ExpiresIn)?> RefreshAccessTokenAsync(
        HttpContext context,
        string refreshToken)
    {
        using var client = new HttpClient();
        var options = _oidcOptions.Get("Keycloak");
        var form = new Dictionary<string, string>
        {
            ["grant_type"] = "refresh_token",
            ["refresh_token"] = refreshToken,
            ["client_id"] = options.ClientId,
            ["client_secret"] = options.ClientSecret,
        };
        var url = $"{options.Authority}/protocol/openid-connect/token";
        var request = new HttpRequestMessage(HttpMethod.Post, url)
        {
            Content = new FormUrlEncodedContent(form)
        };

        var response = await client.SendAsync(request);
        if (!response.IsSuccessStatusCode)
            return null;

        var json = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(json);

        var accessToken = doc.RootElement.GetProperty("access_token").GetString();
        var newRefreshToken = doc.RootElement.TryGetProperty("refresh_token", out var rt) ? rt.GetString() : refreshToken;
        var expiresIn = doc.RootElement.GetProperty("expires_in").GetInt32();

        return (accessToken, newRefreshToken, expiresIn);
    }
}