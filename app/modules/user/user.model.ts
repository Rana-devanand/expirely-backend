export type UserStatus = "active" | "blocked" | "pending";
export type AuthProvider = "local" | "google";
export type Role = "ADMIN" | "USER";

export interface IUser {
  id: string;
  email: string;
  username?: string;
  password?: string;
  google_id?: string;
  avatar_url?: string;
  auth_provider: AuthProvider;
  role: Role;
  account_intent?: "personal" | "vendor";
  status: UserStatus;
  is_verified: boolean;
  daily_reminder_enabled?: boolean;
  daily_reminder_time?: string | null;
  daily_reminder_timezone?: string | null;
  last_daily_reminder_sent_at?: Date | string | null;
  last_login?: Date | string;
  created_at: Date | string;
  updated_at: Date | string;
  opt_out?: boolean;
}

export interface IUpdateUser {
  username?: string;
  avatar_url?: string;
  status?: UserStatus;
  last_login?: Date | string;
}

export interface IAuthResponse {
  user: Partial<IUser>;
  token: string;
}
