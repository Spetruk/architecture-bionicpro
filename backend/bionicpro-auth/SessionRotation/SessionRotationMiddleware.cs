using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Http;

public class SessionRotationMiddleware
{
    private readonly RequestDelegate _next;

    public SessionRotationMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var endpoint = context.GetEndpoint();
        if (endpoint == null) 
        {
            await _next(context);
            return;
        } 
            
        var requiresRotation = endpoint.Metadata.GetMetadata<SessionRotationAttribute>() != null;
        if (!requiresRotation)
        {
            await _next(context);
            return;
        }

        if (context.User.Identity?.IsAuthenticated == true) // Сессия имеется и авторизован
        {
            Console.WriteLine($"--rotation---");
            await SessionRotationAsync(context);
        }

        await _next(context); // выполним endpoint
    }

    static async Task SessionRotationAsync(HttpContext httpContext)
    {
        Console.WriteLine($"Rotating session for Session ID: {httpContext.Session.Id}");

        httpContext.Session.Clear(); // Удаление старой сессии
        await httpContext.Session.CommitAsync(); // Принудительно сохраняем пустую сессию, чтобы сгенерировать новый ID

        Console.WriteLine($"t: {httpContext.Session.Id}");

        // ротация сессии
        var authInfo = await httpContext.AuthenticateAsync();
        if(authInfo is not null)
            authInfo.Properties.IssuedUtc = DateTimeOffset.UtcNow; // Обновляем время выдачи

        await httpContext.SignInAsync(
            scheme: CookieAuthenticationDefaults.AuthenticationScheme,
            principal: authInfo.Principal,
            properties: authInfo.Properties); // сохранены токены

        // После SignIn сессия обновлена — загружаем новый
        await httpContext.Session.LoadAsync();
    }
}