import { ApiOperation, ApiResponse } from "@nestjs/swagger"

export const postAuthLoginDocs = {
  operation: ApiOperation({
    summary: "Login",
    description:
      "Exchanges email and password for a JWT access token. Use it in the `Authorize` button as a Bearer token. " +
      "Limited to 10 attempts per minute per IP."
  }),
  responses: {
    success: ApiResponse({
      status: 201,
      description: "Logged in successfully.",
      schema: {
        example: {
          success: true,
          message: "You have successfully logged in!",
          data: {
            accessToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
            user: {
              id: "0b8f3c1e-6a3b-4f7e-9d2a-1c5e8f7a9b10",
              email: "sales1@techkraft.test",
              role: "SALES"
            }
          }
        }
      }
    }),
    badRequest: ApiResponse({
      status: 400,
      description: "Validation failed.",
      schema: {
        example: { success: false, message: "Validation failed", details: ["Email must be a valid email address"] }
      }
    }),
    unauthorized: ApiResponse({
      status: 401,
      description: "Wrong email or password.",
      schema: { example: { success: false, message: "Invalid email or password" } }
    }),
    tooManyRequests: ApiResponse({
      status: 429,
      description: "Too many login attempts.",
      schema: { example: { success: false, message: "ThrottlerException: Too Many Requests" } }
    })
  }
}
