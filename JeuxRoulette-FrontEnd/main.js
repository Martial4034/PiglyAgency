require("dotenv").config(); // Pour charger les variables d'environnement
const express = require("express");

//const sslify = require('express-sslify');

const path = require("path");
const app = express();
const port = process.env.PORT || 8080;
// Utilisez express-sslify pour forcer HTTPS.
//app.use(sslify.HTTPS({ trustProtoHeader: true }));



// DEBUT Récupération des logs
function requestLogger(req, res, next) {
  // Log uniquement les requêtes principales (et non les ressources comme les images, css, js...)
  if (req.url === "/" || !req.url.includes(".")) {
    console.log(
      `[${new Date().toISOString()}] Visite du site - URL: ${req.url}, IP: ${
        req.ip
      }, User-Agent: ${req.headers["user-agent"]}`
    );
  }
  next();
}

app.use(requestLogger);

// FIN Récupération des logs

// Servez les fichiers statiques du répertoire "dist".
app.use(express.static(path.join(__dirname, "dist")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

app.listen(port, () => {
  console.log(`Serveur démarré sur le port ${port}`);
});
