import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Minimal config for the initial scaffold. Cache overrides (R2 incremental
// cache, etc.) can be added here later once ISR/data-cache persistence is needed.
export default defineCloudflareConfig();
