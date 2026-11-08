/** Every SMS gateway (Text.lk, Notify.lk, Dialog, console) implements this. */
export interface SmsSendResult {
  ok: boolean;
  /** Gateway's message id, used to match delivery reports. */
  providerMessageId?: string;
  error?: string;
}

export interface SmsProvider {
  /** Stored in sms_messages.provider */
  readonly name: string;
  /** `to` is E.164, e.g. +94771234567. */
  send(to: string, body: string): Promise<SmsSendResult>;
}
