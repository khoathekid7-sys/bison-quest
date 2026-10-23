import type { LocationCheck } from "@/lib/geo";

/** The photo checker's answer. Only "pass" can ever award a gem. */
export type PhotoVerdict = "pass" | "retry" | "uncertain";

export type PhotoCheck = {
  verdict: PhotoVerdict;
  /** Short, plain-English reason shown to the player. */
  reason: string;
  /** Concrete next step, e.g. "Step back so the whole entrance fits." */
  feedback: string;
  /** "live" = real vision model; "simulated" = Demo Mode; "precheck" = rejected before the model (blank/too small). */
  source: "live" | "simulated" | "precheck";
};

/** Response body of the photo checker's POST /verify. */
export type VerifyResponse =
  | {
      ok: true;
      location: LocationCheck;
      /** null when the photo was not checked because location failed. */
      photo: PhotoCheck | null;
      /** True only when BOTH checks passed. */
      approved: boolean;
    }
  | {
      ok: false;
      /** Machine-readable reason; the client keeps the pending photo for every one of these. */
      error:
        | "not_configured"
        | "bad_request"
        | "unsupported_image"
        | "image_too_large"
        | "provider_error"
        | "rate_limited"
        | "server_error";
      message: string;
      retryable: boolean;
    };

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
