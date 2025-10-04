using Microsoft.AspNetCore.Authentication;

public class AutorizationEnrichHandler : DelegatingHandler
{
    private readonly IHttpContextAccessor _httpContextAccessor;

    public AutorizationEnrichHandler(IHttpContextAccessor httpContextAccessor)
    {
        _httpContextAccessor = httpContextAccessor;
    }

    protected override async Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request,
        CancellationToken cancellationToken)
    {
        var httpContext = _httpContextAccessor.HttpContext;
        if (httpContext?.User?.Identity?.IsAuthenticated == true)
        {
            var accessToken = await httpContext.GetTokenAsync("access_token");
            request.Headers.Authorization = new("Bearer", accessToken);
        }

        return await base.SendAsync(request, cancellationToken);
    }
}