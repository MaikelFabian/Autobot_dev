const {
  createBot,
  createProvider,
  createFlow,
  addKeyword,
  MemoryDB,
  EVENTS,
} = require("@builderbot/bot");
const { BaileysProvider } = require("@builderbot/provider-baileys");
const qrcode = require("qrcode-terminal");
const http = require("http");
let QRImageLib;
try {
  QRImageLib = require("qrcode");
} catch (e) {
  QRImageLib = null;
}

let lastQR = null;
let lastQrPng = null;
let lastQrAt = null;
let lastInstructions = null;
let connected = false;

const startQRServer = () => {
  const PORT = process.env.PORT || 3000;
  const server = http.createServer(async (req, res) => {
    if (req.url === "/" || req.url === "/qr") {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      const status = connected
        ? "✅ Dispositivo conectado"
        : lastQR
        ? "📷 Escanea el QR para conectar"
        : "⏳ Esperando QR...";
      const repoUrl = process.env.REPO_URL || "";
      const version = process.env.APP_VERSION || process.env.RAILWAY_GIT_COMMIT_SHA || "";
      const instructionsHtml =
        !connected && Array.isArray(lastInstructions) && lastInstructions.length
          ? `<h2>Instrucciones</h2><pre style="text-align:left;white-space:pre-wrap;background:#f5f5f5;padding:12px;border-radius:8px">${lastInstructions
              .map((s) =>
                String(s)
                  .replaceAll("&", "&amp;")
                  .replaceAll("<", "&lt;")
                  .replaceAll(">", "&gt;")
              )
              .join("\n")}</pre>`
          : "";
      const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Autobot QR</title>
      <style>
        body{font-family:system-ui,Segoe UI,Arial;padding:20px;max-width:760px;margin:0 auto;text-align:center}
        img{max-width:320px}
        code{display:inline-block;background:#f5f5f5;padding:6px 8px;border-radius:6px}
        .row{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin:12px 0}
        .btn{appearance:none;border:1px solid #ddd;background:#111;color:#fff;padding:10px 14px;border-radius:10px;cursor:pointer;font-weight:600}
        .btn.secondary{background:#fff;color:#111}
        .card{background:#fafafa;border:1px solid #eee;border-radius:14px;padding:14px;margin:14px 0}
        .meta{color:#555;font-size:14px}
      </style>
      <meta http-equiv="refresh" content="5"></head><body>
      <h1>Autobot – QR de conexión</h1>
      <div class="meta">
        <div>${status}${lastQrAt ? " • " + new Date(lastQrAt).toLocaleString() : ""}</div>
        ${
          version
            ? `<div>Versión: <code>${String(version)
                .replaceAll("&", "&amp;")
                .replaceAll("<", "&lt;")
                .replaceAll(">", "&gt;")}</code></div>`
            : ""
        }
        ${
          repoUrl
            ? `<div>Repo: <a href="${String(repoUrl)
                .replaceAll("&", "&amp;")
                .replaceAll("<", "&lt;")
                .replaceAll(">", "&gt;")}" target="_blank" rel="noreferrer">${String(repoUrl)
                .replaceAll("&", "&amp;")
                .replaceAll("<", "&lt;")
                .replaceAll(">", "&gt;")}</a></div>`
            : ""
        }
      </div>
      <div class="row">
        <button class="btn" onclick="location.reload()">Actualizar</button>
        <a class="btn secondary" href="/status">Ver status</a>
      </div>
      <div class="card">
      ${
        connected
          ? "<p>El bot ya está conectado a WhatsApp.</p>"
          : lastQR
          ? QRImageLib
            ? '<img alt="QR" src="/qr.png"/>'
            : "<p>Instala el paquete <code>qrcode</code> para ver la imagen del QR.<br/>Contenido del QR:</p><code>" +
              lastQR +
              "</code>"
          : "<p>Sin QR por ahora, recargando...</p>"
      }
      </div>
      ${instructionsHtml}
      <p><small>Esta página se actualiza cada 5 segundos.</small></p>
      </body></html>`;
      res.end(html);
      return;
    }
    if (req.url === "/qr.png") {
      if (connected || !lastQrPng) {
        res.statusCode = 404;
        res.end("No hay QR disponible");
        return;
      }
      res.setHeader("Content-Type", "image/png");
      res.end(lastQrPng);
      return;
    }
    if (req.url === "/status") {
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          connected,
          lastQrAt,
          hasQR: !!lastQR,
        })
      );
      return;
    }
    res.statusCode = 404;
    res.end("Not Found");
  });
  server.listen(PORT, () =>
    console.log(`🌐 Servidor QR escuchando en http://localhost:${PORT}/qr`)
  );
};

// Función de navegación compartida para las opciones
const handleNavigation = async (ctx, { gotoFlow, fallBack }) => {
  const body = ctx.body.toLowerCase().trim();

  // Palabras clave de despedida
  const farewellKeywords = [
    "adios",
    "adiós",
    "hasta luego",
    "gracias",
    "chao",
    "bye",
    "muchas gracias",
    "ok gracias",
    "vale gracias",
  ];
  if (farewellKeywords.some((k) => body.includes(k))) {
    return gotoFlow(flowFarewell);
  }

  // Volver al menú
  if (["menu", "menú", "volver", "inicio", "0"].includes(body)) {
    return gotoFlow(flowWelcome);
  }

  // Navegación numérica rápida desde cualquier opción
  switch (body) {
    case "1":
      return gotoFlow(flowOption1);
    case "2":
      return gotoFlow(flowOption2);
    case "3":
      return gotoFlow(flowOption3);
    case "4":
      return gotoFlow(flowOption4);
    case "5":
      return gotoFlow(flowOption5);
    case "6":
      return gotoFlow(flowOption6);
  }

  // Si escribe algo inválido, mensaje de error y volver a intentar
  return fallBack(
    "⚠️ Opción no válida. Escribe *0* para volver al Menú Principal."
  );
};

// Opción 1: Información sobre cursos y certificados
const flowOption1 = addKeyword(EVENTS.ACTION)
  .addAnswer([
    "🟦 *Opción 1️⃣ – Información sobre cursos y certificados*",
    "",
    "📘 En *Educar Colombia* te ofrecemos una formación completa para que obtengas o refrendes tu licencia de conducción con seguridad y confianza. 🚦",
    "",
    "🏍️ *A2* – Motos",
    "🚗 *B1* – Carros particulares",
    "🚕 *C1* – Servicio público",
    "🚚 *C2* – Carga pesada",
    "",
    "✨ Cada curso incluye clases teóricas, prácticas, exámenes médicos y asesoría personalizada.",
    "🚗 ¡Con *Educar Colombia* tu proceso de aprendizaje es rápido, seguro y acompañado! 💚",
    "",
    "👉 Escribe *2* para Refrendación 🩺",
    "👉 Escribe *3* para Requisitos 📋",
  ])
  .addAnswer(
    "🔙 Escribe *0* para volver al Menú Principal o selecciona otra opción.",
    { capture: true },
    handleNavigation
  );

// Opción 2: Refrendación y categorización
const flowOption2 = addKeyword(EVENTS.ACTION)
  .addAnswer([
    "🩺 *Opción 2️⃣ – Refrendación y categorización*",
    "",
    "✅ Realizamos los exámenes médicos y trámites para refrendar tu licencia.",
    "",
    "💲 *Precios Refrendación:*",
    "📄 Una categoría: $400.000",
    "� Dos categorías: $600.000",
    "",
    "🎁 *¡Descuento especial!*",
    "Si te acercas a nuestra sede, recibirás un descuento de *$20.000* en tu trámite. 🏃�",
    "",
    "⏱️ Solo necesitas disponer de mínimo una hora para los examenes medicos.",
  ])
  .addAnswer(
    [
      "👇 *Siguientes opciones:*",
      "3️⃣ Requisitos",
      "4️⃣ Formas de pago",
      "5️⃣ Ubicación y Horarios",
      "",
      "🔙 Escribe *0* para volver al Menú Principal.",
    ],
    { capture: true },
    handleNavigation
  );

// Opción 3: Requisitos para inscribirte
const flowOption3 = addKeyword(EVENTS.ACTION)
  .addAnswer([
    "📋 *Opción 4️⃣ – Requisitos para inscribirte*",
    "",
    "🧾 *Solo necesitas:*",
    "🚫 No tener multas ni comparendos",
    "📄 Documento de identidad original",
    "🎂 Ser mayor de 16 años",
    "✍️ Saber leer y escribir",
  ])
  .addAnswer(
    [
      "👇 *Siguientes opciones:*",
      "5️⃣ Formas de pago",
      "6️⃣ Ubicación y Horarios",
      "7️⃣ Hablar con un asesor",
      "",
      "🔙 Escribe *0* para volver al Menú Principal.",
    ],
    { capture: true },
    handleNavigation
  );

// Opción 4: Formas de pago
const flowOption4 = addKeyword(EVENTS.ACTION)
  .addAnswer([
    "💳 *Opción 4️⃣ – Formas de pago*",
    "",
    "🏦 *Métodos disponibles:*",
    "💵 Efectivo",
    "🏦 Transferencia bancaria",
    "📱 Transferencia por código QR",
    "💳 Tarjeta de crédito o débito(cursos de conducción)",
  ])
  .addAnswer(
    [
      "👇 *Siguientes opciones:*",
      "5️⃣ Ubicación y Horarios",
      "6️⃣ Hablar con un asesor",
      "",
      "🔙 Escribe *0* para volver al Menú Principal.",
    ],
    { capture: true },
    handleNavigation
  );

// Opción 5: Ubicación y Horarios
const flowOption5 = addKeyword(EVENTS.ACTION)
  .addAnswer([
    "📍 *Opción 5️⃣ – Ubicación y Horarios*",
    "",
    "🏢 *Nuestra Sede:*",
    "Estamos ubicados en Carrera 2 #4-32.",
    "🗺️ *Ver en Google Maps:* https://maps.app.goo.gl/Ah2NJBJSsUFVcgDv5",
    "",
    "🕒 *Horarios de atención:*",
    "🗓️ Lunes a viernes: 7:00 a.m - 12:00 p.m | 2:00 p.m - 6:00 p.m",
    "🗓️ Sábados: 7:00 a.m - 12:00 p.m | 2:00 p.m - 4:00 p.m",
  ])
  .addAnswer(
    [
      "👇 *Siguiente opción:*",
      "6️⃣ Hablar con un asesor",
      "",
      "🔙 Escribe *0* para volver al Menú Principal.",
    ],
    { capture: true },
    handleNavigation
  );

// Opción 6: Hablar con un asesor
const flowOption6 = addKeyword(EVENTS.ACTION)
  .addAnswer([
    "👩‍💼 *Opción 6️⃣ – Hablar con un asesor*",
    "",
    "Perfecto, en unos momentos te vamos a comunicar con un asesor 🤝",
    "",
    "📞 Mientras tanto, si deseas atención inmediata puedes escribir directamente a:",
    "👉 *Mauricio Parra* – Administrador",
    "📱 *+57 317 677 9182*",
    "",
    "Desde este momento, las respuestas podrán ser dadas manualmente por un asesor. 🧑‍💼",
    '*(Escribe "menu" o "0" si deseas volver a hablar con el bot)*',
  ])
  .addAction(async (ctx, { state }) => {
    await state.update({ humanMode: true });
  });

// Flujo de Despedida
const flowFarewell = addKeyword([
  "adios",
  "adiós",
  "hasta luego",
  "gracias",
  "chao",
  "bye",
  "muchas gracias",
])
  .addAction(async (ctx, { state }) => {
    await state.update({ humanMode: false });
  })
  .addAnswer([
    "¡Con gusto! Ha sido un placer atenderte. 😊",
    "",
    "Recuerda que en *Educar Colombia* estamos comprometidos con tu seguridad vial. 🚦",
    "¡Que tengas un excelente día! 🚗💨",
  ]);

// Flujo Principal (Menú)
const flowWelcome = addKeyword([
  "hola",
  "holaaa",
  "buenas",
  "buenos días",
  "buenas tardes",
  "buenas noches",
  "qué tal",
  "menu",
  "menú",
  "opciones",
  "inicio",
  "0",
  EVENTS.WELCOME,
]).addAnswer(
  [
    "👋 ¡Hola! Soy *Autobot*, asistente virtual de *Educar Colombia* 🚦",
    "Estoy aquí para ayudarte con todo lo relacionado con nuestros cursos y licencias.",
    "",
    "Por favor, elige una opción escribiendo el número correspondiente 👇",
    "",
    "1️⃣ Información sobre cursos y certificados",
    "2️⃣ Refrendación y categorización",
    "3️⃣ Requisitos para inscribirte",
    "4️⃣ Formas de pago 💳",
    "5️⃣ Ubicación y Horarios 📍🕒",
    "6️⃣ Hablar con un asesor 👩‍💼",
    "",
    "👉 ¿Qué opción deseas?",
  ],
  { capture: true },
  async (ctx, { gotoFlow, fallBack, state, endFlow }) => {
    const input = ctx.body.toLowerCase().trim();

    // Si estamos en modo asesor humano, el bot debe quedarse en silencio
    const humanMode = state.get("humanMode");
    if (humanMode) {
      // Comandos para volver a activar el bot
      if (["menu", "menú", "volver", "inicio", "0", "bot"].includes(input)) {
        await state.update({ humanMode: false });
        // sigue el flujo normal del menú
      } else {
        // Despedida aunque esté en modo asesor
        const farewellKeywords = [
          "adios",
          "adiós",
          "hasta luego",
          "gracias",
          "chao",
          "bye",
          "muchas gracias",
          "ok gracias",
          "vale gracias",
        ];
        if (farewellKeywords.some((k) => input.includes(k))) {
          await state.update({ humanMode: false });
          return gotoFlow(flowFarewell);
        }

        // Cualquier otro texto: silencio total
        return endFlow();
      }
    }

    // Palabras clave de despedida
    const farewellKeywords = [
      "adios",
      "adiós",
      "hasta luego",
      "gracias",
      "chao",
      "bye",
      "muchas gracias",
      "ok gracias",
      "vale gracias",
    ];
    if (farewellKeywords.some((k) => input.includes(k))) {
      return gotoFlow(flowFarewell);
    }

    // Si el usuario escribe menú, simplemente volvemos a mostrar el menú (o no hacemos nada si ya estamos ahí)
    if (["menu", "menú", "volver", "inicio", "0"].includes(input)) {
      return gotoFlow(flowWelcome);
    }

    // Manejo de opción no válida
    if (!["1", "2", "3", "4", "5", "6"].includes(input)) {
      return fallBack([
        "😅 Disculpa, no entendí tu mensaje.",
        "Por favor, elige una opción del menú escribiendo el número correspondiente (por ejemplo: *1* o *5*).",
      ]);
    }

    // Router
    switch (input) {
      case "1":
        return gotoFlow(flowOption1);
      case "2":
        return gotoFlow(flowOption2);
      case "3":
        return gotoFlow(flowOption3);
      case "4":
        return gotoFlow(flowOption4);
      case "5":
        return gotoFlow(flowOption5);
      case "6":
        return gotoFlow(flowOption6);
    }
  }
);

const main = async () => {
  console.log("🚀 Iniciando Colombot...");
  startQRServer();
  const adapterDB = new MemoryDB();
  const PHONE_NUMBER = process.env.PHONE_NUMBER;
  const adapterProvider = createProvider(BaileysProvider, {
    browser: ["Mac OS", "Chrome", "14.4.1"],
    ...(PHONE_NUMBER
      ? {
          usePairingCode: true,
          phoneNumber: PHONE_NUMBER,
        }
      : {}),
    experimentalStore: true,
    timeRelease: 10800000,
  });

  adapterProvider.on("require_action", (payload) => {
    console.log("⚡ Require Action:", payload);
    const { instructions } = payload;
    lastInstructions = Array.isArray(instructions) ? instructions : null;
    if (instructions.length) console.log(instructions.join("\n"));

    const qr = payload.qr || payload.payload?.qr;
    if (qr) {
      connected = false;
      lastQR = qr;
      lastQrAt = Date.now();
      console.log("📷 Escanea este código QR para conectar:");
      qrcode.generate(qr, { small: true }, (q) => console.log(q));
      if (QRImageLib) {
        QRImageLib
          .toBuffer(qr, { type: "png", margin: 2, width: 320 })
          .then((buf) => {
            lastQrPng = buf;
          })
          .catch(() => {
            lastQrPng = null;
          });
      }
    }
  });

  adapterProvider.on("ready", () => {
    connected = true;
    lastQR = null;
    lastQrPng = null;
    lastInstructions = null;
    console.log("✅ Provider ready");
  });
  adapterProvider.on("auth_failure", () => {
    connected = false;
    lastInstructions = null;
    console.log("❌ Auth failure");
  });
  adapterProvider.on("message", () => console.log("📩 Message received"));

  // Registramos todos los flujos
  const adapterFlow = createFlow([
    flowWelcome,
    flowOption1,
    flowOption2,
    flowOption3,
    flowOption4,
    flowOption5,
    flowOption6,
    flowFarewell,
  ]);

  console.log("⚡ Creando bot...");
  try {
    await createBot({
      flow: adapterFlow,
      provider: adapterProvider,
      database: adapterDB,
    });
    console.log("✅ Bot creado exitosamente");
    console.log("⚡ Iniciando provider...");
    await adapterProvider.initVendor();

    // Mantener el proceso vivo para que no se cierre
    console.log("⏳ Esperando QR...");
    setInterval(() => {}, 1000 * 60 * 60);
  } catch (e) {
    console.error("❌ Error creando el bot:", e);
  }
};

main();
