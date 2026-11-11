import { createHmac } from "node:crypto";
import type { RequestHandler } from "express";
import type { Pool } from "pg";

/** Persistent counters prevent bypass by serverless instance rotation. */
export function createEnquirySpamProtection(pool: Pool): RequestHandler {
  return async (req, res, next) => {
    try {
      const production = process.env.NODE_ENV === "production";
      const secret = process.env.ENQUIRY_RATE_LIMIT_SECRET;
      if (
        production &&
        (!secret ||
          secret.length < 32 ||
          !process.env.TURNSTILE_SECRET_KEY ||
          !process.env.ENQUIRY_TURNSTILE_HOSTNAME)
      ) {
        res
          .status(503)
          .json({
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
      const mobile = String(req.body?.mobileNumber ?? "").replace(/\D/g, "");
      const phoneHash = createHmac("sha256", secret || "local-development-only")
        .update(mobile)
        .digest("hex");
      // Atomic UPSERT: one shared bucket per IP and phone, with a rolling reset.
      const limits: Array<[string, number, number]> = [
        [`ip:hour:${fingerprint}`, 5, 3600],
        [`ip:day:${fingerprint}`, 20, 86400]
      ];
      for (const [key, max, seconds] of limits) {
        const result = await pool.query<{ requests: number }>(
          `
          INSERT INTO advertisement_enquiry_rate_limits(bucket_key,requests,expires_at)
          VALUES($1,1,now()+($2::int * interval '1 second'))
          ON CONFLICT(bucket_key) DO UPDATE SET
            requests = CASE WHEN advertisement_enquiry_rate_limits.expires_at <= now()
              THEN 1 ELSE advertisement_enquiry_rate_limits.requests+1 END,
            expires_at = CASE WHEN advertisement_enquiry_rate_limits.expires_at <= now()
              THEN now()+($2::int * interval '1 second') ELSE advertisement_enquiry_rate_limits.expires_at END
          RETURNING requests`,
          [key, seconds]
        );
        if ((result.rows[0]?.requests ?? 0) > max) {
          res.setHeader("Retry-After", String(seconds));
          res
            .status(429)
            .json({
              success: false,
              message: "Too many enquiries. Please try again later."
            });
          return;
        }
      }
      if (production) {
        const token = req.body?.captchaToken;
        if (typeof token !== "string" || !token || token.length > 4096) {
          res
            .status(400)
            .json({
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
        };
        const hostname = process.env.ENQUIRY_TURNSTILE_HOSTNAME;
        if (
          !outcome.success ||
          outcome.action !== "advertisement_enquiry" ||
          outcome.hostname !== hostname
        ) {
          res
            .status(400)
            .json({
              success: false,
              message: "Security check failed. Please try again."
            });
          return;
        }
      }
      // Limit repeat submissions for a single phone only after bot verification.
      // A bot cannot exhaust another person's phone quota without passing Turnstile.
      const phoneLimit = await pool.query<{ requests: number }>(
        `
        INSERT INTO advertisement_enquiry_rate_limits(bucket_key,requests,expires_at)
        VALUES($1,1,now() + interval '1 day')
        ON CONFLICT(bucket_key) DO UPDATE SET
          requests=CASE WHEN advertisement_enquiry_rate_limits.expires_at <= now() THEN 1
            ELSE advertisement_enquiry_rate_limits.requests+1 END,
          expires_at=CASE WHEN advertisement_enquiry_rate_limits.expires_at <= now() THEN now()+interval '1 day'
            ELSE advertisement_enquiry_rate_limits.expires_at END RETURNING requests`,
        [`phone:day:${phoneHash}`]
      );
      if ((phoneLimit.rows[0]?.requests ?? 0) > 3) {
        res.setHeader("Retry-After", "86400");
        res
          .status(429)
          .json({
            success: false,
            message: "Too many enquiries. Please try again later."
          });
        return;
      }
      next();
    } catch (error) {
      // Fail closed if DB/Turnstile is unavailable, never silently skip protection.
      next(error);
    }
  };
}
