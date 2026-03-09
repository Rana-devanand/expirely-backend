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
  status: UserStatus;
  is_verified: boolean;
  last_login?: Date | string;
  created_at: Date | string;
  updated_at: Date | string;
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
