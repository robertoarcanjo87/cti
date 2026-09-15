import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const targetUrl = "https://cti-injetaveis-clinica.dr-robertoarcanjo.chatgpt.site/";
const outputDir = join(process.cwd(), ".vercel", "output", "static");

mkdirSync(outputDir, { recursive: true });

writeFileSync(
  join(outputDir, "index.html"),
  `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta http-equiv="refresh" content="0; url=${targetUrl}" />
    <title>CTI Injetáveis</title>
    <style>
      :root {
        color-scheme: light;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #f4f8fb;
        color: #09214a;
      }
      body {
        align-items: center;
        display: grid;
        margin: 0;
        min-height: 100vh;
        padding: 24px;
      }
      main {
        background: #ffffff;
        border: 1px solid #dbe7f1;
        border-radius: 8px;
        box-shadow: 0 18px 45px rgba(9, 33, 74, 0.12);
        margin: 0 auto;
        max-width: 520px;
        padding: 32px;
      }
      h1 {
        font-size: 1.35rem;
        line-height: 1.2;
        margin: 0 0 12px;
      }
      p {
        color: #4f647d;
        font-size: 1rem;
        line-height: 1.55;
        margin: 0 0 20px;
      }
      a {
        background: #073a78;
        border-radius: 6px;
        color: #ffffff;
        display: inline-flex;
        font-weight: 700;
        padding: 12px 16px;
        text-decoration: none;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>CTI Injetáveis</h1>
      <p>Redirecionando para o sistema operacional com banco de dados ativo.</p>
      <a href="${targetUrl}">Abrir sistema</a>
    </main>
    <script>window.location.replace(${JSON.stringify(targetUrl)});</script>
  </body>
</html>
`,
  "utf8",
);
