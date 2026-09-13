/** The subset of Better Auth's user object our controllers actually consume. */
export interface AuthenticatedUser {
  id: string;
  email: string;
  name?: string | null;
  emailVerified: boolean;
}
