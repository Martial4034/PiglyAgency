require("dotenv").config(); // Pour charger les variables d'environnement
const cors = require("cors");
const admin = require("firebase-admin");
const serviceAccount = require("./jeu-concours-f0a5b-firebase-adminsdk-qy6t5-c047a45550.json");
const Pushover = require("pushover-notifications");
const jwt = require("jsonwebtoken");
const express = require("express");
const moment = require("moment");
const axios = require("axios");

var ovh = require("ovh")({
  endpoint: process.env.ENDPOINT,
  appKey: process.env.APPKEY,
  appSecret: process.env.APPSECRET,
  consumerKey: process.env.CONSUMERKEY,
});
const app = express();

// Port d'écoute, utilise une variable d'environnement si disponible
const port = process.env.PORT;
const corsOptions = {
  origin: function (origin, callback) {
    // Autoriser les requêtes sans origine (par exemple, les requêtes de type curl, Postman)
    if (!origin) return callback(null, true);

    // Si l'origine est un sous-domaine de piglyagency.fr ou vient de localhost, autoriser la requête
    if (
      origin.endsWith(".piglyagency.fr") ||
      origin.endsWith("pigly.fr") ||
      origin.includes("localhost") ||
      origin.includes("127.0.0.1") ||
      origin.includes("https://dashboard.piglyagency.fr")
    ) {
      return callback(null, true);
    }
    // Sinon, refuser la requête
    console.log("Requête non autorisée par la politique CORS:", origin);
    callback(new Error("Non autorisé par la politique CORS"));
  },
};

app.use(cors(corsOptions));
app.use(express.json());
try {
  // Initialisation de Firebase
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://jeu-concours-f0a5b.firebaseio.com",
  });
  // Initialisation de Firestore
  const db = admin.firestore();

  // DEBUT code pour vérification de la connexion ADMINISTRATEUR
  const SECRET_KEY = process.env.SECRET_KEY;
  const REFRESH_SECRET = process.env.REFRESH_SECRET;
  // const verifierTokenCloudflare = async () => {
  //   const url = "https://api.cloudflare.com/client/v4/user/tokens/verify";
  //   const cloudflare_token = process.env.CLOUDFLARE_TOKEN; // Remplacez par votre token

  //   try {
  //     const response = await fetch(url, {
  //       method: 'GET',
  //       headers: {
  //         'Authorization': `Bearer ${cloudflare_token}`,
  //         'Content-Type': 'application/json'
  //       }
  //     });

  //     const jsonResponse = await response.json();
  //     console.log('Vérification du Token Cloudflare:', jsonResponse);
  //   } catch (error) {
  //     console.error('Erreur lors de la vérification du token Cloudflare:', error);
  //   }
  // };

  const redemarrerServeur = async (domain) => {
    const serviceName = process.env.SERVICE_NAME;
    try {
      const response = await ovh.requestPromised(
        "POST",
        `/hosting/web/${serviceName}/attachedDomain/${domain}/restart`
      );
      console.log(`Serveur redémarré pour ${domain}`, response);
    } catch (error) {
      console.error(
        `Erreur lors du redémarrage du serveur pour ${domain}`,
        error
      );
    }
  };

  const purgerCacheCloudflare = async () => {
    const urlcloudflare = process.env.URL_CLOUDFLARE;
    const cloudflare_token = process.env.CLOUDFLARE_TOKEN; // Remplacez par votre token

    try {
      const response = await fetch(urlcloudflare, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cloudflare_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ purge_everything: true }),
      });

      const jsonResponse = await response.json();
      console.log("Réponse de la purge du cache Cloudflare:", jsonResponse);
    } catch (error) {
      console.error("Erreur lors de la purge du cache Cloudflare:", error);
    }
  };

  const push = new Pushover({
    token: process.env.PUSHOVER_TOKEN,
    user: process.env.PUSHOVER_USER_KEY,
  });
  app.post("/verifyToken", async (req, res) => {
    const { token } = req.body;
    console.log("token", token);

    try {
      const decoded = jwt.verify(token, SECRET_KEY);
      // Optionally, add more checks, like token expiration or user roles
      res.send({ valid: true, uid: decoded.uid });
      console.log("Valid token", decoded);
    } catch (error) {
      res
        .status(401)
        .send({ valid: false, message: "Token invalide ou expiré" });
    }
  });
  app.post("/sessionLogin", async (req, res) => {
    const { idToken } = req.body;
    console.log("idToken", idToken);
    try {
      const decodedIdToken = await admin.auth().verifyIdToken(idToken);
      console.log("decodedIdToken", decodedIdToken);
      const userSnapshot = await admin
        .firestore()
        .collection("utilisateur")
        .doc(decodedIdToken.uid)
        .get();
      console.log("userSnapshot", userSnapshot);
      if (!userSnapshot.exists) {
        console.log("Utilisateur inexistant");
        return res.status(401).send({ message: "Utilisateur inexistant" });
      }

      const userData = userSnapshot.data();
      console.log("userData", userData);
      // Check if the user is an admin
      const isAdmin = userData.isAdmin || false;
      const restaurantId = userData.restaurantId || "";

      // Here you might want to create a session token or simply return the restaurantId
      // and the admin status to the client.

      const token = jwt.sign({ uid: decodedIdToken.uid }, SECRET_KEY, {
        expiresIn: "99999h",
      }); // Expires in 1 hour
      res.send({ token: token, isAdmin, restaurantId });
      console.log("token renvoyé : ", token);
    } catch (error) {
      console.error("Error verifying Firebase ID token:", error);
      res.status(500).send({ message: "Internal server error" });
    }
  });
  // FIN code pour vérification de la connexion ADMINISTRATEUR

  // Tableau de couleurs prédéfinies
  const colors = [
    "#B1E3FF", // Bleu ciel clair
    "#FF4500", // Orange rougeâtre
    "#32CD32", // Vert lime
    "#8A2BE2", // Bleu violet
    "#FFD700", // Or
    "#FF69B4", // Rose vif
    "#1E90FF", // Bleu dodger
    "#FF8C00", // Orange foncé
    "#6A5ACD", // Bleu ardoise
    "#DC143C", // Rouge cramoisi
  ];
  // const colors = [
  //   "#B1E3FF",
  //   "#95A4FC",
  //   "#B1C2FF",
  //   "#B1FFC2",
  //   "#FFC0CB",
  //   "#C2B1FF",
  //   "#FFD1A4",
  //   "#A4FFD1",
  //   "#FFA4F0",
  //   "#FF4500",
  // ];
  /* Fonction pour le donut graphique */
  async function getDonutChartData(restaurantId, timeframe) {
    try {
      const restaurantDoc = await db
        .collection("restaurant")
        .doc(restaurantId)
        .get();
      const restaurantData = restaurantDoc.data();
      const segmentNumber = restaurantData.segmentNumber;

      // Récupérer les noms des cadeaux
      const cadeaux = [];
      for (let i = 1; i <= segmentNumber; i++) {
        cadeaux.push(restaurantData[`cadeau${i}`]);
      }

      // Compter les gains pour chaque cadeau
      const gainsCount = {};
      cadeaux.forEach((cadeau) => (gainsCount[cadeau] = 0)); // Initialiser les compteurs

      // Récupérer tous les utilisateurs et compter leurs gains
      const usersSnapshot = await db
        .collection("restaurant")
        .doc(restaurantId)
        .collection("users")
        .get();
      // Filtrez les utilisateurs en fonction de la timeframe
      let totalGains = 0;
      usersSnapshot.forEach((userDoc) => {
        const userData = userDoc.data();
        const gain = userData.gain;
        const dateCreation = userData.dateCreation;

        // Vérifiez si le gain doit être inclus en fonction de la timeframe
        if (
          gain &&
          gainsCount.hasOwnProperty(gain) &&
          isDateInRange(dateCreation, timeframe)
        ) {
          gainsCount[gain]++;
          totalGains++;
        }
      });

      // Générer les données pour le graphique
      const donutChartData = cadeaux.map((cadeau, index) => {
        const count = gainsCount[cadeau] || 0;
        return {
          label: cadeau,
          value: ((count / totalGains) * 100).toFixed(1), // Pourcentage avec une décimale
          color: colors[index % colors.length], // Utiliser une couleur fixe de la liste
        };
      });

      return donutChartData;
    } catch (error) {
      console.error("Error getting document:", error);
      throw error; // Propager l'erreur pour la gérer côté client
    }
  }
  /* Fonction pour le Bar Graphique */
  async function getBarChartData(restaurantId, timeframe) {
    try {
      const restaurantDoc = await db
        .collection("restaurant")
        .doc(restaurantId)
        .get();
      const restaurantData = restaurantDoc.data();
      const segmentNumber = restaurantData.segmentNumber;

      // Récupérer les noms des cadeaux
      const cadeaux = [];
      for (let i = 1; i <= segmentNumber; i++) {
        cadeaux.push(restaurantData[`cadeau${i}`]);
      }

      // Initialiser le compteur pour chaque cadeau
      const cadeauxCount = cadeaux.reduce((acc, cadeau) => {
        acc[cadeau] = { total: 0, qrCodeInvalides: 0 };
        return acc;
      }, {});

      // Récupérer tous les utilisateurs et compter leurs gains et les validations QR
      const usersSnapshot = await db
        .collection("restaurant")
        .doc(restaurantId)
        .collection("users")
        .get();

      usersSnapshot.forEach((userDoc) => {
        const userData = userDoc.data();
        const gain = userData.gain;
        const dateCreation = userData.dateCreation;
        const qrCodeValide = userData.qrCodeValide;

        if (
          gain &&
          cadeauxCount.hasOwnProperty(gain) &&
          isDateInRange(dateCreation, timeframe)
        ) {
          cadeauxCount[gain].total++;
          if (!qrCodeValide) {
            cadeauxCount[gain].qrCodeInvalides++;
          }
        }
      });

      // Générer les données pour le graphique en barres
      const barChartData = cadeaux.map((cadeau, index) => {
        const totalGainsPourCadeau = cadeauxCount[cadeau].total;
        const qrCodeInvalidesPourCadeau = cadeauxCount[cadeau].qrCodeInvalides;
        // Calculer le pourcentage de QR codes invalides
        const pourcentageQrCodeInvalides =
          totalGainsPourCadeau > 0
            ? (qrCodeInvalidesPourCadeau / totalGainsPourCadeau) * 100
            : 0;

        return {
          label: cadeau,
          value: pourcentageQrCodeInvalides.toFixed(1), // Pourcentage avec une décimale
          color: colors[index % colors.length], // Utiliser une couleur fixe de la liste
        };
      });

      console.log(barChartData);
      return barChartData;
    } catch (error) {
      console.error("Error getting document:", error);
      throw error;
    }
  }
  /* Fonction pour les statistiques */
  async function getStats(restaurantId, timeframe) {
    // Récupérer tous les utilisateurs
    const usersSnapshot = await db
      .collection("restaurant")
      .doc(restaurantId)
      .collection("users")
      .get();

    // Initialiser les compteurs
    let totalJoueurs = 0;
    let joueursRevenus = 0;
    let joueursEnAttente = 0;

    // Calculer les statistiques
    usersSnapshot.forEach((userDoc) => {
      const userData = userDoc.data();
      const creationDate = userData.dateCreation;

      // Filtrer les données en fonction de la timeframe
      if (isDateInRange(creationDate, timeframe)) {
        totalJoueurs++;

        if (userData.qrCodeValide === false) {
          joueursRevenus++;
        } else if (userData.qrCodeValide === true) {
          joueursEnAttente++;
        }
      }
    });

    // Construire l'objet de statistiques
    const stats = [
      { title: "Joueurs", number: totalJoueurs },
      { title: "Joueurs revenus", number: joueursRevenus },
      { title: "Joueur en attente", number: joueursEnAttente },
    ];
    console.log(stats);
    return stats;
  }
  /* Fonctione pour le Nb de Cadeau gagné */
  async function getGainsParCadeau(restaurantId, timeframe) {
    try {
      // Récupérer les informations du restaurant
      const restaurantDoc = await db
        .collection("restaurant")
        .doc(restaurantId)
        .get();
      const restaurantData = restaurantDoc.data();
      const segmentNumber = restaurantData.segmentNumber;

      // Récupérer les noms des cadeaux
      const cadeaux = {};
      for (let i = 1; i <= segmentNumber; i++) {
        const cadeauName = restaurantData[`cadeau${i}`];
        cadeaux[cadeauName] = 0; // Initialiser le compteur pour chaque cadeau
      }

      // Récupérer tous les utilisateurs et compter leurs gains
      const usersSnapshot = await db
        .collection("restaurant")
        .doc(restaurantId)
        .collection("users")
        .get();
      usersSnapshot.forEach((doc) => {
        const user = doc.data();
        const gain = user.gain;
        const dateCreation = user.dateCreation;

        if (
          gain &&
          cadeaux.hasOwnProperty(gain) &&
          isDateInRange(dateCreation, timeframe)
        ) {
          cadeaux[gain]++;
        }
      });

      // Convertir l'objet en tableau de données pour le front-end
      const gainsData = Object.keys(cadeaux).map((key) => {
        return { title: key, value: cadeaux[key] };
      });

      return gainsData;
    } catch (error) {
      console.error("Error getting gains data:", error);
      throw error;
    }
  }

  /* Fonction pour filtrer selon les dates */
  function isDateInRange(date, timeframe) {
    const now = moment();
    switch (timeframe) {
      case "this-week":
        return moment(date).isSame(now, "week");
      case "last-30":
        return moment(date).isAfter(now.subtract(30, "days"));
      case "last-six-months":
        return moment(date).isAfter(now.subtract(6, "months"));
      default:
        // 'all-time' ne nécessite pas de filtre
        return true;
    }
  }
  /* requete pour transmettre les données au front */
  app.get("/Dashboard/:restaurantId/:timeframe", async (req, res) => {
    try {
      const { restaurantId, timeframe } = req.params;
      const donutData = await getDonutChartData(restaurantId, timeframe);
      const barData = await getBarChartData(restaurantId, timeframe);
      const stats = await getStats(restaurantId, timeframe);
      const gainsData = await getGainsParCadeau(restaurantId, timeframe); // Nouvelle ligne

      res.json({ donutData, barData, stats, gainsData }); // Inclure gainsData dans la réponse
    } catch (error) {
      res
        .status(500)
        .send("Erreur lors de la récupération des données des graphiques");
    }
  });

  /* requete pour transmettre les données au front : Tableau FICHIER CLIENT */
  app.get("/Users/:restaurantId", async (req, res) => {
    const { restaurantId } = req.params;
    console.log("Requête reçue:", req.params);
    try {
      const clientsSnapshot = await db
        .collection("restaurant")
        .doc(restaurantId)
        .collection("clients") // Modification ici pour pointer vers la sous-collection 'clients'
        .get();

      const clients = clientsSnapshot.docs.map((doc) => {
        const clientData = doc.data();
        // Conversion du Timestamp Firebase en date au format ISO désiré
        const formattedDate = clientData.dateCreation
          ? moment(clientData.dateCreation.toDate()).format("YYYY MMMM D") // Utilisation de toDate() pour convertir le Timestamp en objet Date
          : "";

        return {
          id: doc.id, // Ajout de l'ID du document Firestore comme identifiant unique
          prenom: clientData.prenom || "",
          telephone: clientData.telephone || "",
          email: clientData.email || "",
          dateDeVisite: formattedDate, // Utilisation de la date formatée
        };
      });
      console.log("Clients récupérés:", clients);
      res.json(clients);
    } catch (error) {
      console.error("Error getting clients:", error);
      res.status(500).send("Erreur lors de la récupération des clients");
    }
  });
  /* requete pour ajouté manuelement un utilisateur au data clients */
  app.post("/AddManualClient/:restaurantId", async (req, res) => {
    const { restaurantId } = req.params;
    const { prenom, nom, email, telephone, dateDeVisite } = req.body;
    // verifier si les champs sont bien conformes, email ressemble a une email, prénom idem
    if (!prenom || !email || !telephone || !dateDeVisite) {
      return res.status(400).send("Veuillez remplir tous les champs");
    }
    // Adapter le format du numéro de téléphone pour le format international
    if (telephone.startsWith("0")) {
      telephone = "+33" + telephone.substr(1);
    } else if (!telephone.startsWith("+")) {
      telephone = "+33" + telephone;
    }
    try {
      // Assurez-vous que la date est au format YYYY-MM-DD
      const dateParts = req.body.dateDeVisite.split("-");
      const year = parseInt(dateParts[0], 10);
      const month = parseInt(dateParts[1], 10) - 1; // Mois en JavaScript sont de 0-11
      const day = parseInt(dateParts[2], 10);

      // Créez une date JavaScript avec l'heure fixée à 12:00:00
      const dateDeVisite = new Date(year, month, day, 12, 0, 0);
      const clientRef = db
        .collection("restaurant")
        .doc(restaurantId)
        .collection("clients");
      const clientDoc = await clientRef.add({
        prenom,
        nom,
        email,
        telephone,
        dateCreation: admin.firestore.Timestamp.fromMillis(dateDeVisite), // Use Timestamp for Firestore
      });

      res
        .status(200)
        .send({ id: clientDoc.id, message: "Customer created successfully" });
    } catch (error) {
      console.error("Error creating customer:", error);
      res.status(500).send("Error creating customer");
    }
  });

  /* requete pour transmettre les données au front : Tableau Joueurs  */
  app.get("/Joueurs/:restaurantId", async (req, res) => {
    const { restaurantId } = req.params;

    try {
      const usersRef = db
        .collection("restaurant")
        .doc(restaurantId)
        .collection("users");
      const usersSnapshot = await usersRef.get();

      const joueursUsers = usersSnapshot.docs.map((doc) => {
        const user = doc.data();
        return {
          id: doc.id,
          prenom: user.prenom || "Inconnu",
          cadeau: user.gain || "Aucun",
          valide: user.qrCodeValide || false,
          dateDeVisite: moment(user.dateCreation).format("YYYY MMMM D, HH:mm"),
        };
      });

      res.json(joueursUsers);
      console.log("Joueurs récupérés:", joueursUsers);
    } catch (error) {
      console.error(
        "Erreur lors de la récupération des détails des utilisateurs :",
        error
      );
      res.status(500).send("Erreur interne du serveur");
    }
  });

  /* requete pour transmettre les données au front : Roue du Restaurant  */
  app.get("/Roulette/:restaurantId", async (req, res) => {
    const { restaurantId } = req.params;
    console.log("Requête reçue:", req.params);

    try {
      const restaurantDoc = await db
        .collection("restaurant")
        .doc(restaurantId)
        .get();
      const restaurantData = restaurantDoc.data();
      const segmentNumber = parseInt(restaurantData.segmentNumber, 10);

      const responseData = {
        "url-logo-central": restaurantData["url-logo-central"],
        "couleur-selecteur": restaurantData["couleur-selecteur"],
        segmentNumber: segmentNumber,
      };

      for (let i = 1; i <= segmentNumber; i++) {
        responseData[`cadeau${i}`] = restaurantData[`cadeau${i}`];
        responseData[`probabilite${i}`] = restaurantData[`probabilite${i}`];
        responseData[`condition-cadeau${i}`] =
          restaurantData[`condition-cadeau${i}`];
        responseData[`cadeau${i}-validite`] =
          restaurantData[`cadeau${i}-validite`];
        responseData[`couleur-segment${i}`] =
          restaurantData[`couleur-segment${i}`];
        responseData[`couleur-texte-segment${i}`] =
          restaurantData[`couleur-texte-segment${i}`];
      }

      res.json(responseData);
      console.log("Réponse envoyée:", responseData);
    } catch (error) {
      console.error(
        "Erreur lors de la récupération des détails du restaurant :",
        error
      );
      res.status(500).send("Erreur interne du serveur");
    }
  });

  /* requete ppour mettre a jour la roue du restaurant */
  app.post("/updateRestaurantData/:restaurantId", async (req, res) => {
    const { restaurantId } = req.params;
    const restaurantData = req.body;
    console.log("Requête reçue:", req.body);

    // Effectuez les vérifications nécessaires ici
    if (Object.keys(restaurantData).length === 0) {
      return res.status(400).send("Aucune donnée fournie.");
    }

    try {
      // Vérifications et transformations des données
      // Exemple de validation et de transformation
      let sommeProbabilites = 0;
      const segmentNumber = parseInt(restaurantData.segmentNumber, 10);

      for (let i = 1; i <= segmentNumber; i++) {
        const cadeau = restaurantData[`cadeau${i}`];
        let probabilite = restaurantData[`probabilite${i}`];
        const validite = restaurantData[`cadeau${i}-validite`];

        // Validation des champs cadeau et validite
        // ...

        // Conversion de probabilite en nombre
        if (typeof probabilite === "string") {
          probabilite = parseFloat(probabilite.replace(",", "."));
        }

        // Ajout du message selon validite
        if (validite === "next") {
          restaurantData[`cadeau${i}-message`] =
            "Réclamez le lors de votre prochain dîner chez nous.";
        } else if (validite === "now") {
          restaurantData[`cadeau${i}-message`] =
            "Ce gain est valable dès à présent.";
        }

        sommeProbabilites += probabilite;
      }

      // Vérification de la somme des probabilités
      if (sommeProbabilites !== 100) {
        throw new Error(
          `La somme des probabilités doit être égale à 100 (actuellement ${sommeProbabilites}).`
        );
      }

      // Mettez à jour les données dans Firestore
      await db
        .collection("restaurant")
        .doc(restaurantId)
        .update(restaurantData);

      res.status(200).send("Données mises à jour avec succès.");
      console.log("Données mises à jour avec succès.", restaurantData);
      ToutRedemmarer();
    } catch (error) {
      console.error("Erreur lors de la mise à jour des données :", error);
      res.status(500).send("Erreur interne du serveur");
    }
  });
  // Fonction pour récupérer les établissements depuis Google My Business
  app.get("/user/establishments", async (req, res) => {
    const accessToken = req.headers.authorization.split(" ")[1];

    try {
      console.log("Envoi de la requête à l'API Google My Business");
      const response = await axios.get(
        "https://mybusinessaccountmanagement.googleapis.com/v1/accounts",
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      console.log("Réponse reçue de l'API:", response.data);
      res.json(response.data);
    } catch (error) {
      console.error(
        "Erreur lors de la récupération des établissements:",
        error
      );
      res
        .status(500)
        .send("Erreur lors de la récupération des établissements.");
    }
  });

  /* fonction pour redemarer les serveurs et purger les caches */
  async function ToutRedemmarer() {
    const domains = [
      "api2.pigly.fr",
      "roue.piglyagency.fr",
      "main.piglyagency.fr",
      "dashboard.piglyagency.fr",
    ];
    domains.forEach((domain) => redemarrerServeur(domain));
    purgerCacheCloudflare();
  }

  // Redirection de l'utilisateur pour son gain
  app.get("/r/:shortId", async (req, res) => {
    const shortId = req.params.shortId;
    const docRef = db.collection("shortLinks").doc(shortId);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).send("Lien non trouvé");
    }

    const data = doc.data();
    const now = new Date();
    if (now > data.expiresAt.toDate()) {
      await docRef.delete(); // Supprimer le document expiré
      return res.status(410).send("Lien expiré");
    }

    res.json({ url: data.originalUrl });
    console.log(`Redirection vers ${data.originalUrl}`);
  });

  // Gestion des erreurs Express
  app.use((err, req, res, next) => {
    console.error("Erreur dans le middleware Express :", err);
    res.status(500).json({ error: err.message });
  });
} catch (error) {
  console.error("Erreur lors de l'initialisation :", error);
}
app.listen(port, () => {
  console.log(`Serveur démarré sur le port ${port}`);
});
