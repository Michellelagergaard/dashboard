import { mkdir, writeFile } from "node:fs/promises";

const tenantId = process.env.AZURE_TENANT_ID;

if (!tenantId || !/^[0-9a-f-]{36}$/i.test(tenantId)) {
  throw new Error("AZURE_TENANT_ID mangler eller er ugyldigt.");
}

const config = {
  navigationFallback: { rewrite: "/index.html" },
  routes: [
    { route: "/login", redirect: "/.auth/login/aad" },
    { route: "/*", allowedRoles: ["authenticated"] },
  ],
  responseOverrides: {
    401: {
      statusCode: 302,
      redirect: "/.auth/login/aad?post_login_redirect_uri=.referrer",
    },
  },
  auth: {
    identityProviders: {
      azureActiveDirectory: {
        registration: {
          openIdIssuer: `https://login.microsoftonline.com/${tenantId}/v2.0`,
          clientIdSettingName: "AZURE_CLIENT_ID",
          clientSecretSettingName: "AZURE_CLIENT_SECRET",
        },
      },
    },
  },
};

await mkdir(new URL("../public/", import.meta.url), { recursive: true });
await writeFile(
  new URL("../public/staticwebapp.config.json", import.meta.url),
  `${JSON.stringify(config, null, 2)}\n`,
  "utf8",
);
