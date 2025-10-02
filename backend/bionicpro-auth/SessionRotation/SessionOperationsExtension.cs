public static class SessionOperationsExtension
{
    public static RouteHandlerBuilder RequreSessionRotation(this RouteHandlerBuilder routeHandlerBuilder) 
        => routeHandlerBuilder.WithMetadata(new SessionRotationAttribute());
}