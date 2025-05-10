declare module 'passport-google-oauth20' {
  import { Strategy as PassportStrategy } from 'passport';
  
  export interface StrategyOptions {
    clientID: string;
    clientSecret: string;
    callbackURL: string;
    passReqToCallback?: boolean;
    scope?: string[];
    state?: boolean;
    enableProof?: boolean;
  }

  export interface StrategyEmailField {
    value: string;
    type?: string;
  }

  export interface Profile {
    id: string;
    displayName: string;
    name?: {
      familyName: string;
      givenName: string;
      middleName?: string;
    };
    emails?: StrategyEmailField[];
    photos?: {
      value: string;
    }[];
    provider: string;
  }

  export type VerifyCallback = (err?: Error | null, user?: any, info?: any) => void;

  export class Strategy extends PassportStrategy {
    constructor(
      options: StrategyOptions,
      verify: (accessToken: string, refreshToken: string, profile: Profile, done: VerifyCallback) => void
    );
    name: string;
    authenticate(req: any, options?: any): void;
  }
}