import { jwtDecode } from "jwt-decode";
import { getLogger } from "../../utils/logger";

interface DecodedJwt {
  aud: string[];
  exp: number;
  subdomain: string;
}

export class SpaceliftJwt {
  private readonly aud: string[];
  private readonly exp: number;
  private readonly raw: string;
  private readonly subdomain: string;
  private readonly expireAllowedDeltaSec: number;

  constructor(jwt: string, expireAllowedDeltaSec = 30) {
    const decodedJwt: DecodedJwt = jwtDecode(jwt);
    if (decodedJwt === undefined || decodedJwt === null) {
      throw new Error("Failed to decode JWT");
    }
    if (!Object.prototype.hasOwnProperty.call(decodedJwt, "aud")) {
      throw new Error("Spacelift token is missing aud claim");
    }
    if (!Object.prototype.hasOwnProperty.call(decodedJwt, "exp")) {
      throw new Error("Spacelift token is missing exp claim");
    }
    if (!Object.prototype.hasOwnProperty.call(decodedJwt, "subdomain")) {
      throw new Error("Spacelift token is missing subdomain claim");
    }

    this.aud = decodedJwt.aud;
    this.exp = decodedJwt.exp;
    this.raw = jwt;
    this.subdomain = decodedJwt.subdomain;
    this.expireAllowedDeltaSec = expireAllowedDeltaSec;

    getLogger().debug("Created spaceliftJwt with exp: " + this.exp + ", aud: " + this.aud.join(", ") + ", raw: " + this.raw.substring(0, 5) + "...");
  }

  isExpired(): boolean {
    const currentEpochTimeSeconds = Date.now() / 1000;
    getLogger().trace("Checking fi token is expired. Expires at " + this.exp + ", allowed delta: " + this.expireAllowedDeltaSec + " sec, now: " + currentEpochTimeSeconds);
    if (this.exp - this.expireAllowedDeltaSec < currentEpochTimeSeconds) {
      getLogger().trace("Token is expired");
      return true;
    } else {
      getLogger().trace("Token is not expired");
      return false;
    }
  }

  get expiresAt(): number {
    return this.exp;
  }

  get rawToken(): string {
    return this.raw;
  }

  get audience(): string[] {
    return this.aud;
  }

  get spaceliftTenantID(): string {
    return this.subdomain;
  }
}
