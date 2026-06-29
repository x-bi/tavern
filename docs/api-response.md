# API Response And Error Convention

Tavern Lite REST APIs return one JSON envelope. Streaming endpoints and file downloads can opt out of the envelope.

## Success Response

Controllers should return business data directly. The global response interceptor wraps it:

```json
{
  "success": true,
  "data": {
    "id": "seed_user_demo",
    "username": "demo"
  },
  "message": null,
  "error": null
}
```

For empty success payloads, return an explicit object such as `{ "loggedOut": true }`.

## Error Response

Exceptions are mapped by the global exception filter:

```json
{
  "success": false,
  "data": null,
  "message": "Invalid username or password.",
  "error": {
    "code": "AUTH_INVALID_CREDENTIALS",
    "message": "Invalid username or password."
  }
}
```

Validation errors use `VALIDATION_ERROR` and put field-level messages in `error.details`.

## Error Code Naming

Use stable uppercase snake case:

- Common HTTP-style codes: `BAD_REQUEST`, `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `INTERNAL_SERVER_ERROR`.
- Domain codes: `<DOMAIN>_<REASON>`, for example `AUTH_INVALID_CREDENTIALS`, `MODEL_CONFIG_NOT_FOUND`, `CHARACTER_NAME_REQUIRED`.
- Do not expose provider raw errors, API keys, stack traces, database paths, or internal prompt text in `message` or `details`.

## Controller Pattern

```ts
@Get('me')
async me() {
  return this.authService.me();
}
```

Throw `HttpException` with a stable code when a business error needs a specific code:

```ts
throw new UnauthorizedException({
  code: 'AUTH_INVALID_CREDENTIALS',
  message: 'Invalid username or password.'
});
```

## SSE And File Downloads

Normal JSON wrapping must not be applied to SSE or file responses. A route can opt out with:

```ts
@SkipResponseWrap()
@Post('stream')
stream() {
  // write text/event-stream frames
}
```

Requests with `Accept: text/event-stream` are also skipped by the response interceptor.
