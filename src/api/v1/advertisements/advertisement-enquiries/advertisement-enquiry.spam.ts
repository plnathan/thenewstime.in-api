import { createHmac } from "node:crypto";
import type { RequestHandler } from "express";
import type { Pool } from "pg";
import {
  consumeEnquiryQuota,
  enquiryLimit,
  EnquiryRateLimitError
} from "./advertisement-enquiry.rate-limit.js";

export const enquiryFingerprintKey = "advertisementEnquiryFingerprint";

/** Persistent counters prevent bypass by serverless instance rotation. */
export function createEnquirySpamProtection(pool: Pool): RequestHandler {
  return async (req, res, next) => {
    try {
      const production = process.env.NODE_ENV === "production";
      const secret = process.env.ENQUIRY_RATE_LIMIT_SECRET;
      const allowedHostnames = (process.env.ENQUIRY_TURNSTILE_HOSTNAME ?? "")
        .split(",")
        .map((hostname) => hostname.trim().toLowerCase())
        .filter(Boolean);
      if (
        production &&
        (!secret ||
          secret.length < 32 ||
          !process.env.TURNSTILE_SECRET_KEY ||
          allowedHostnames.length === 0)
      ) {
        res.status(503).json({
          success: false,
          message: "Enquiry protection is not configured."
        });
        return;
      }
      if (Buffer.byteLength(JSON.stringify(req.body ?? {}), "utf8") > 8192) {
        res
          .status(413)
          .json({ success: false, message: "Enquiry request is too large." });
        return;
      }
      if (req.body?.website) {
        res
          .status(202)
          .json({ success: true, message: "Your enquiry has been received." });
        return;
      }
      const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
      const fingerprint = createHmac(
        "sha256",
        secret || "local-development-only"
      )
        .update(ip)
        .digest("hex");
      await consumeEnquiryQuota(
        pool,
        `ip:hour:${fingerprint}`,
        enquiryLimit("ENQUIRY_ATTEMPT_IP_HOUR_LIMIT"),
        3600
      );
      await consumeEnquiryQuota(
        pool,
        `ip:day:${fingerprint}`,
        enquiryLimit("ENQUIRY_ATTEMPT_IP_DAY_LIMIT"),
        86400
      );
      if (production) {
        const token = req.body?.captchaToken;
        if (typeof token !== "string" || !token || token.length > 4096) {
          res.status(400).json({
            success: false,
            message: "Please complete the security check."
          });
          return;
        }
        const form = new URLSearchParams({
          secret: process.env.TURNSTILE_SECRET_KEY!,
          response: token,
          remoteip: ip
        });
        const verification = await fetch(
          "https://challenges.cloudflare.com/turnstile/v0/siteverify",
          {
            method: "POST",
            body: form,
            signal: AbortSignal.timeout(5000)
          }
        );
        if (!verification.ok)
          throw new Error("Turnstile verification unavailable");
        const outcome = (await verification.json()) as {
          success?: boolean;
          hostname?: string;
          action?: string;
          "error-codes"?: string[];
        };
        const verifiedHostname =
          typeof outcome.hostname === "string"
            ? outcome.hostname.trim().toLowerCase()
            : "";
        if (
          !outcome.success ||
          outcome.action !== "advertisement_enquiry" ||
          !allowedHostnames.includes(verifiedHostname)
        ) {
          console.warn(
            "[Advertisement Enquiry] Turnstile verification rejected",
            {
              success: outcome.success,
              hostname: outcome.hostname,
              allowedHostnames,
              action: outcome.action,
              expectedAction: "advertisement_enquiry",
              errorCodes: outcome["error-codes"] ?? []
            }
          );
          res.status(400).json({
            success: false,
            message: "Security check failed. Please try again."
          });
          return;
        }
      }
      res.locals[enquiryFingerprintKey] = fingerprint;
      next();
    } catch (error) {
      if (error instanceof EnquiryRateLimitError) {
        res.setHeader("Retry-After", String(error.retryAfter));
        res
          .status(429)
          .json({
            success: false,
            message: error.message,
            retryAfter: error.retryAfter
          });
        return;
      }
      // Fail closed if DB/Turnstile is unavailable, never silently skip protection.
      next(error);
    }
  };
}
