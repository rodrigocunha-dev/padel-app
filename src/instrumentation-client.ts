import posthog from "posthog-js";

// Métricas (PostHog) só inicializam se a chave estiver configurada —
// assim o site continua funcionando normalmente sem ela (ex.: dev local).
const chave = process.env.NEXT_PUBLIC_POSTHOG_KEY;

if (chave) {
  posthog.init(chave, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
    defaults: "2025-05-24",
  });
}
