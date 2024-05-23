require("dotenv").config(); // Pour charger les variables d'environnement
const express = require('express');

//const sslify = require('express-sslify');

const path = require('path');
const app = express();
const port = process.env.PORT || 8080;
// Utilisez express-sslify pour forcer HTTPS.
//app.use(sslify.HTTPS({ trustProtoHeader: true }));

// Servez les fichiers statiques du répertoire "dist".
app.use(express.static(path.join(__dirname, 'dist')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, () => {
  console.log(`Serveur démarré sur le port ${port}`);
}
);
