/**
 * Minimal ambient declarations for the `africastalking` package.
 *
 * The SDK is plain CommonJS with no bundled types, so TypeScript cannot
 * resolve it under `moduleResolution: NodeNext` with `strict: true`.
 * These declarations are intentionally narrow: only the surface the Alert
 * Engine uses is described. No credentials appear here.
 */
declare module "africastalking" {
  export interface AfricasTalkingRecipient {
    statusCode?: number
    number?: string
    status?: string
    cost?: string
    messageId?: string
  }

  export interface AfricasTalkingSendResponse {
    SMSMessageData?: {
      Message?: string
      Recipients?: AfricasTalkingRecipient[]
    }
  }

  export interface AfricasTalkingSmsService {
    send(params: {
      to: string | string[]
      message: string
      from?: string
      senderId?: string
      enqueue?: boolean
    }): Promise<AfricasTalkingSendResponse>
  }

  export interface AfricasTalkingClient {
    SMS: AfricasTalkingSmsService
  }

  export interface AfricasTalkingOptions {
    username: string
    apiKey: string
    format?: "json" | "xml"
  }

  function AfricasTalking(
    options: AfricasTalkingOptions
  ): AfricasTalkingClient

  export default AfricasTalking
}
