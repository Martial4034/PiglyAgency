require("dotenv").config(); // Pour charger les variables d'environnement
const cors = require("cors");
const admin = require("firebase-admin");
const serviceAccount = require("./jeu-concours-f0a5b-firebase-adminsdk-qy6t5-c047a45550.json");
const twilio = require("twilio");
const crypto = require("crypto");
const QRCode = require("qrcode");
const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const jwt = require("jsonwebtoken");
const Pushover = require("pushover-notifications");
const app = express();
const multer = require("multer");
const NodeCache = require("node-cache");
const { send } = require("process");

const ADMIN_PHONE_NUMBERS = ["+33768117913", "+33777905796"];

// La durée de vie du cache est définie ici en secondes. Ex: 604800 pour une semaine.
const myCache = new NodeCache({ stdTTL: 604800, checkperiod: 120 });

// Port d'écoute, utilise une variable d'environnement si disponible
const port = process.env.PORT;
const corsOptions = {
  origin: function (origin, callback) {
    // Autoriser les requêtes sans origine (par exemple, les requêtes de type curl, Postman)
    if (!origin) return callback(null, true);

    // Si l'origine est un sous-domaine de piglyagency.fr ou vient de localhost, autoriser la requête
    if (
      origin.endsWith(".piglyagency.fr") ||
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
const router = express.Router();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*", // Ou mettez "*" pour permettre à toutes les origines
    methods: ["GET", "POST"],
    allowedHeaders: ["my-custom-header"],
    credentials: true,
  },
});

app.use(cors(corsOptions));
app.use(express.json());
try {
  // Initialisation de Firebase
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://jeu-concours-f0a5b.firebaseio.com",
  });

  // Initialisation de Twilio avec les variables d'environnement
  const twilioClient = new twilio(
    process.env.TWILIO_SID,
    process.env.TWILIO_AUTH_TOKEN
  );

  // Initialisation de Firestore
  const db = admin.firestore();
  const bucket = admin.storage().bucket(process.env.FIREBASE_STORAGE_BUCKET);

  // DEBUT code pour vérification de la connexion ADMINISTRATEUR
  const SECRET_KEY = process.env.SECRET_KEY;
  const REFRESH_SECRET = process.env.REFRESH_SECRET;

  function generateJWT(uid) {
    const payload = { uid: uid };
    return jwt.sign(payload, SECRET_KEY, { expiresIn: "10d" }); // Token d'accès d'une durée de vie de 10j
  }

  function generateRefreshToken(uid) {
    const payload = { uid: uid };
    return jwt.sign(payload, REFRESH_SECRET, { expiresIn: "30d" }); // Token de rafraîchissement d'une durée de vie de 30 jours
  }

  app.post("/verifyToken", (req, res) => {
    const token = req.body.token;

    try {
      jwt.verify(token, SECRET_KEY);
      res.json({ valid: true });
    } catch (error) {
      res.json({ valid: false });
    }
  });

  const push = new Pushover({
    token: process.env.PUSHOVER_TOKEN,
    user: process.env.PUSHOVER_USER_KEY,
  });

  app.post("/auth", async (req, res) => {
    const idToken = req.body.token;

    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      const email = decodedToken.email;

      const emailQuery = await db
        .collection("utilisateur")
        .where("email", "==", email)
        .get();

      if (!emailQuery.empty) {
        const userDoc = emailQuery.docs[0];
        const restaurantId = userDoc.data().restaurant;
        const accessToken = generateJWT(decodedToken.uid);
        const refreshToken = generateRefreshToken(decodedToken.uid);

        // Si le compte est un compte administrateur
        if (restaurantId === "admin") {
          res.send({
            isAdmin: true,
            uid: decodedToken.uid,
            accessToken,
            refreshToken,
            restaurantId,
          });

          const msgAdminConnected = {
            message: `L'administrateur avec l'adresse e-mail ${email} s'est connecté.`,
            title: "Connexion administrateur réussie",
            priority: 1,
          };

          push.send(msgAdminConnected, (err, result) => {
            if (err) {
              console.error(
                "Erreur lors de l’envoi de la notification admin :",
                err
              );
            }
            console.log("Notification d'admin envoyée avec succès :", result);
          });
        } else {
          // Si le compte est un compte utilisateur normal
          res.send({
            success: true,
            uid: decodedToken.uid,
            accessToken,
            refreshToken,
            restaurantId,
          });

          const msgSuccess = {
            message: `Utilisateur avec l'adresse e-mail ${email} s'est connecté avec succès.`,
            title: "Connexion réussie",
            priority: 1,
          };

          push.send(msgSuccess, (err, result) => {
            if (err) {
              console.error("Erreur lors de l’envoi de la notification :", err);
            }
            console.log("Notification envoyée avec succès :", result);
          });
        }
      } else {
        res
          .status(401)
          .send({ success: false, message: "Adresse e-mail non autorisée." });

        const msgAlert = {
          message: `Tentative de connexion avec une adresse e-mail non autorisée: ${email}`,
          title: "Tentative de connexion non autorisée",
          priority: 1,
        };

        push.send(msgAlert, (err) => {
          if (err) {
            console.error(
              "Erreur lors de l’envoi de la notification d’alerte :",
              err
            );
          }
        });
      }
    } catch (error) {
      res.status(401).send({ success: false, message: error.message });

      const msgError = {
        message: `Erreur lors de la connexion: ${error.message}`,
        title: "Erreur de connexion",
        priority: 1,
      };

      push.send(msgError, (err) => {
        if (err) {
          console.error(
            "Erreur lors de l’envoi de la notification d’erreur :",
            err
          );
        }
      });
    }
  });
  // FIN code pour vérification de la connexion ADMINISTRATEUR

  // DEBUT code pour la gestion d'envoie de SMS
  app.post("/toggleSMS", async (req, res) => {
    const smsEnabled = req.body.smsEnabled;
    const updated = await updateSMSConfig(smsEnabled);

    if (updated) {
      res.json({ success: true, smsEnabled });
    } else {
      res.json({ success: false });
    }
  });
  app.get("/getSMSConfig", async (req, res) => {
    try {
      const smsConfig = await db.collection("server").doc("smsConfig").get();
      const data = smsConfig.data();
      log("Configuration SMS:", data);
      res.json({ smsEnabled: data.envoieSMS });
    } catch (error) {
      res
        .status(500)
        .send("Erreur lors de la récupération de la configuration SMS");
    }
  });
  async function updateSMSConfig(smsEnabled) {
    try {
      await db.collection("server").doc("smsConfig").update({
        envoieSMS: smsEnabled,
      });

      return true;
    } catch (error) {
      console.error(
        "Erreur lors de la mise à jour de la configuration SMS:",
        error
      );
      return false;
    }
  }
  // FIN code pour la gestion d'envoie de SMS

  // DEBUT code pour la gestion des restaurants
  app.get("/AdminRestaurants", async (req, res) => {
    try {
      // Assurez-vous d'avoir correctement configuré votre accès à Firebase.
      const restaurantsRef = db.collection("restaurant");
      const snapshot = await restaurantsRef.get();
      let restaurants = [];
      snapshot.forEach((doc) => {
        let restaurantData = doc.data();
        restaurantData.docId = doc.id; // Pour identifier le document lors de la mise à jour
        restaurants.push(restaurantData);
      });
      res.json(restaurants);
    } catch (error) {
      res.status(500).json({ message: "Erreur serveur", error: error.message });
      console.error(
        "Erreur serveur lors de la récupération des restaurants:",
        error
      );
    }
  });

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB par exemple
    },
  }).fields([
    { name: "image", maxCount: 1 },
    { name: "headerImage", maxCount: 1 },
    { name: "newLogoImage", maxCount: 1 },
    { name: "newHeaderImage", maxCount: 1 },
  ]);

  app.post("/AddRestaurant", upload, async (req, res) => {
    console.log("Requête reçue");

    const promises = [];

    // Traiter le logo
    if (req.files["image"] && req.files["image"][0]) {
      const logoFile = req.files["image"][0];
      const logoBlob = bucket.file("logo-restaurant/" + logoFile.originalname);
      const logoBlobStream = logoBlob.createWriteStream();

      logoBlobStream.end(logoFile.buffer);
      promises.push(
        new Promise((resolve, reject) => {
          logoBlobStream.on("finish", async () => {
            try {
              await logoBlob.makePublic();
              console.log("Logo file is now public.");
              resolve(
                `https://storage.googleapis.com/${bucket.name}/${logoBlob.name}`
              );
            } catch (error) {
              console.error("Error making logo file public:", error);
              reject(error);
            }
          });
          logoBlobStream.on("error", reject);
        })
      );
    }

    // Traiter l'image de fond du header
    if (req.files["headerImage"] && req.files["headerImage"][0]) {
      const headerFile = req.files["headerImage"][0];
      const headerBlob = bucket.file(
        "header-images/" + headerFile.originalname
      );
      const headerBlobStream = headerBlob.createWriteStream();

      headerBlobStream.end(headerFile.buffer);
      promises.push(
        new Promise((resolve, reject) => {
          headerBlobStream.on("finish", async () => {
            try {
              await headerBlob.makePublic();
              console.log("Header image file is now public.");
              resolve(
                `https://storage.googleapis.com/${bucket.name}/${headerBlob.name}`
              );
            } catch (error) {
              console.error("Error making header image file public:", error);
              reject(error);
            }
          });
          headerBlobStream.on("error", reject);
        })
      );
    }

    try {
      // Attendre la fin des téléchargements
      const [logoUrl, headerUrl] = await Promise.all(promises);

      // Parsez les données de restaurant à partir du corps de la requête
      let restaurantData = JSON.parse(req.body.restaurantData);

      // Supprimer les propriétés inutiles
      delete restaurantData["url-logo-central"]; // Supprimez si c'est un blob ou une URL temporaire
      delete restaurantData["url-img-header"]; // Supprimez si c'est un blob ou une URL temporaire

      // Ajouter les URL publiques aux données
      if (logoUrl) restaurantData["url-logo-central"] = logoUrl;
      if (headerUrl) restaurantData["url-header"] = headerUrl;

      // Ajout du restaurant à la base de données
      const restaurantsRef = db.collection("restaurant");
      const addedRestaurantRef = await restaurantsRef.add(restaurantData);

      console.log("Restaurant ajouté avec succès");
      res.status(200).send({
        message: "Restaurant ajouté avec succès !",
        imageUrl: { logoUrl, headerUrl },
        docId: addedRestaurantRef.id,
      });
    } catch (error) {
      console.error("Erreur serveur lors de l'ajout du restaurant:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });
  async function uploadToStorage(file, folder) {
    return new Promise((resolve, reject) => {
      if (!file) {
        reject("Aucun fichier à uploader");
      }

      const filename = `${folder}/${Date.now()}-${file.originalname}`;
      const fileUpload = bucket.file(filename);

      const blobStream = fileUpload.createWriteStream({
        metadata: {
          contentType: file.mimetype,
        },
      });

      blobStream.on("error", (error) => reject(error));

      blobStream.on("finish", async () => {
        try {
          // Rendre le fichier public
          await fileUpload.makePublic();

          // Résoudre l'URL du fichier
          resolve(`https://storage.googleapis.com/${bucket.name}/${filename}`);
        } catch (error) {
          reject(error);
        }
      });

      blobStream.end(file.buffer);
    });
  }

  app.post("/updateRestaurant", upload, async (req, res) => {
    try {
      console.log("Requête reçue pour mise à jour");

      const restaurantData = JSON.parse(req.body.restaurantData);
      const docId = restaurantData.docId;

      // Supprimer docId car ce n'est pas un champ du document Firebase
      delete restaurantData.docId;

      // Récupérer les fichiers image s'ils existent
      const logoFile = req.files.newLogoImage
        ? req.files.newLogoImage[0]
        : null;
      const headerFile = req.files.newHeaderImage
        ? req.files.newHeaderImage[0]
        : null;

      // Récupérer les URLs existantes du document pour les supprimer si nécessaire
      const restaurantRef = db.collection("restaurant").doc(docId);
      const currentRestaurantDoc = await restaurantRef.get();
      const currentRestaurantData = currentRestaurantDoc.data();

      let logoUrlPromise, headerUrlPromise;

      if (logoFile) {
        logoUrlPromise = handleImageUpdate(
          logoFile,
          "logo-restaurant",
          currentRestaurantData["url-logo-central"]
        );
      } else {
        logoUrlPromise = Promise.resolve(null);
      }

      if (headerFile) {
        headerUrlPromise = handleImageUpdate(
          headerFile,
          "header-images",
          currentRestaurantData["url-header"]
        );
      } else {
        headerUrlPromise = Promise.resolve(null);
      }

      // Attendre que les deux images soient traitées
      const [newLogoUrl, newHeaderUrl] = await Promise.all([
        logoUrlPromise,
        headerUrlPromise,
      ]);

      // Mise à jour des URLs dans l'objet restaurantData
      if (newLogoUrl) {
        restaurantData["url-logo-central"] = newLogoUrl;
      }
      if (newHeaderUrl) {
        restaurantData["url-header"] = newHeaderUrl;
      }

      // Mise à jour du document Firebase avec les nouvelles données
      await restaurantRef.update(restaurantData);

      // Répondre au client avec succès
      res.status(200).send({ success: true, docId });
    } catch (error) {
      console.error("Erreur lors de la mise à jour du restaurant :", error);
      res.status(500).send("Erreur interne du serveur");
    }
  });

  // Fonction pour gérer la mise à jour d'une image (upload de la nouvelle et suppression de l'ancienne)
  async function handleImageUpdate(file, folder, currentUrl) {
    // Supprimer l'ancienne image si elle existe
    if (currentUrl) {
      await deleteImageFromBucket(currentUrl, folder);
    }

    // Uploader la nouvelle image
    return uploadToStorage(file, folder);
  }

  // Fonction pour supprimer une image du bucket
  async function deleteImageFromBucket(url, folder) {
    if (!url) return;
    const fileName = url.split(`${folder}/`).pop();
    const file = bucket.file(`${folder}/${fileName}`);
    try {
      await file.delete();
      console.log(`Le fichier ${fileName} a été supprimé avec succès.`);
    } catch (error) {
      console.error(
        `Erreur lors de la suppression du fichier ${fileName}:`,
        error
      );
    }
  }
  // Fin code pour la gestion des datas a afficher dans le dashboard

  // DEBUT code pour la suppresion d'un restaurant
  app.post("/DeleteRestaurant", async (req, res) => {
    const { docId } = req.body;

    if (!docId) {
      return res.status(400).json({ message: "Document ID manquant" });
    }

    try {
      await db.collection("restaurant").doc(docId).delete();
      res.json({ success: true, message: "Restaurant supprimé avec succès" });
    } catch (error) {
      console.error("Erreur lors de la suppression:", error);
      res
        .status(500)
        .json({ message: "Erreur serveur lors de la suppression" });
    }
  });

  // FIN code pour la suppresion d'un restaurant
  // DEBUT Récupération des logs
  function requestLogger(req, res, next) {
    console.log(
      `[${new Date().toISOString()}] Requête reçue - Méthode: ${
        req.method
      }, URL: ${req.url}, IP: ${req.ip}`
    );
    next(); // Passez au middleware/routeur suivant
  }
  app.use(requestLogger);
  // FIN Récupération des logs

  //  DEBUT Récupération des informations du restaurant
  app.get("/restaurant/:idRestaurant", async (req, res) => {
    log("Requête reçue:", req.params);
    let idRestaurant = req.params.idRestaurant;
    // Modifier l'ID du restaurant si nécessaire
    if (idRestaurant.startsWith("V2PG")) {
      idRestaurant = idRestaurant.substring(4);
    }

    if (!idRestaurant) {
      return res.status(400).send("Identifiant du restaurant manquant");
    }

    console.log("Requête reçue pour le restaurant:", idRestaurant);

    // Vérifiez si les données sont déjà mises en cache.
    const value = myCache.get(idRestaurant);
    if (value) {
      return res.json(value);
    }
    const restaurantRef = db.collection("restaurant").doc(idRestaurant);
    const doc = await restaurantRef.get();

    console.log("Données du restaurant:", doc.data());

    if (!doc.exists) {
      console.log("Aucun document correspondant");
      return res.status(404).send("Restaurant non trouvé");
    }
    // Mettre les données en cache avant de les renvoyer.
    myCache.set(idRestaurant, doc.data());
    log(`Restaurant ${idRestaurant} trouvé, et data mise en cache`);
    return res.json(doc.data());
  });
  // FIN Récupération des informations du restaurant

  // DEBUT Récupération des informations du client == VERICATION DE SON EXISTENCE
  app.post("/:idRestaurant/verifierUtilisateur", async (req, res) => {
    try {
      console.log("Requête reçue:", req.body, req.params);
      log("Requête reçue:", req.body, req.params);
      // IP du client
      let clientIP =
        req.headers["x-forwarded-for"] || req.connection.remoteAddress;
      if (clientIP.includes(",")) {
        clientIP = clientIP.split(",")[0];
      }
      console.log("Adresse IP du client:", clientIP);
      let { email, telephone } = req.body;
      const idRestaurant = req.params.idRestaurant;

      if (!email || !telephone || !idRestaurant) {
        console.error("Erreur: Paramètres manquants");
        return res.status(400).send("Paramètres manquants");
      }

      // Adapter le format du numéro de téléphone pour le format international
      if (telephone.startsWith("0")) {
        telephone = "+33" + telephone.substr(1);
      } else if (!telephone.startsWith("+")) {
        telephone = "+33" + telephone;
      }

      // Si le numéro de téléphone est l'un des numéros administrateurs, retournez `true`
      if (ADMIN_PHONE_NUMBERS.includes(telephone)) {
        console.log("Numéro d'administrateur détecté. Vérification sautée.");
        log("Numéro d'administrateur détecté. Vérification sautée.");
        return res.json({ exists: false });
      }

      const exists = await verifierUtilisateurExist(
        email,
        telephone,
        idRestaurant,
        clientIP
      );
      console.log("Existe :", exists);
      return res.json({ exists });
    } catch (err) {
      console.error("Erreur lors de la vérification de l'utilisateur:", err);
      log("Erreur lors de la vérification de l'utilisateur:", err);
      return res.status(500).json({ message: "Erreur interne du serveur." });
    }
  });
  async function verifierUtilisateurExist(
    email,
    telephone,
    idRestaurant,
    clientIP
  ) {
    try {
      const usersRef = db
        .collection("restaurant")
        .doc(idRestaurant)
        .collection("users");
      const snapshotEmail = await usersRef.where("email", "==", email).get();
      const snapshotTelephone = await usersRef
        .where("telephone", "==", telephone)
        .get();
      const snapshotIP = await usersRef.where("ip", "==", clientIP).get();

      return (
        !snapshotEmail.empty || !snapshotTelephone.empty || !snapshotIP.empty
      );
    } catch (err) {
      console.error(
        "Erreur lors de la vérification dans la base de données:",
        err
      );
      log("Erreur lors de la vérification dans la base de données:", err);
      throw err;
    }
  }
  // FIN Récupération des informations du client == VERICATION DE SON EXISTENCE

  // DEBUT Enregistrement d'un utilisateur
  app.post("/:idRestaurant/enregistrerUtilisateur", async (req, res) => {
    console.log(
      "Requête d'enregistrement d'utilisateur reçue pour le restaurant:",
      req.params.idRestaurant
    );
    log(
      "Requête d'enregistrement d'utilisateur reçue pour le restaurant:",
      req.params.idRestaurant
    );
    // IP du client
    let clientIP =
      req.headers["x-forwarded-for"] || req.connection.remoteAddress;
    if (clientIP.includes(",")) {
      clientIP = clientIP.split(",")[0];
    }
    console.log("Adresse IP du client:", clientIP);
    log("Adresse IP du client:", clientIP);
    let { prenom, email, telephone, recevoirCadeaux } = req.body;
    let idRestaurant = req.params.idRestaurant;

    // Modifier l'ID du restaurant si nécessaire
    if (idRestaurant.startsWith("V2PG")) {
      idRestaurant = idRestaurant.substring(4);
    }

    if (
      !prenom ||
      !email ||
      !telephone ||
      recevoirCadeaux === undefined ||
      !idRestaurant
    ) {
      console.warn("Erreur: Paramètres manquants dans la requête.");
      log("Erreur: Paramètres manquants dans la requête.");
      return res.status(400).send("Paramètres manquants");
    }

    // Adapter le format du numéro de téléphone pour le format international
    if (telephone.startsWith("0")) {
      telephone = "+33" + telephone.substr(1);
    } else if (!telephone.startsWith("+")) {
      telephone = "+33" + telephone;
    }

    const usersRef = db
      .collection("restaurant")
      .doc(idRestaurant)
      .collection("users");

    try {
      console.log(
        `Tentative d'enregistrement de l'utilisateur: ${prenom}, ${email}, ${telephone}.`
      );
      log("Tentative d'enregistrement de l'utilisateur:", req.body);

      let docRef = await usersRef.add({
        prenom,
        email,
        telephone,
        recevoirCadeaux,
        dateCreation: new Date().toISOString(),
        ip: clientIP,
      });

      console.log(
        `Utilisateur enregistré avec succès avec l'ID: ${docRef.id}.`
      );
      log(`Utilisateur enregistré avec succès avec l'ID: ${docRef.id}.`);
      const DocumentRef = docRef;

      // Ajouter également l'utilisateur dans la sous-collection 'clients' avec un timestamp
      const clientRef = db
        .collection("restaurant")
        .doc(idRestaurant)
        .collection("clients");

      let clientDocRef = await clientRef.add({
        email,
        prenom, 
        nom: "",
        telephone, 
        dateCreation: admin.firestore.Timestamp.fromDate(new Date()), 
      });

      console.log(
        `Utilisateur également enregistré dans 'clients' avec l'ID: ${clientDocRef.id}.`
      );
      log(
        `Utilisateur également enregistré dans 'clients' avec l'ID: ${clientDocRef.id}.`
      );

      return res.status(200).json({
        message: "Utilisateur enregistré avec succès dans 'users' et 'clients'.",
        userId: docRef.id,
        clientId: clientDocRef.id
      });
    } catch (err) {
      console.error("Erreur lors de l'enregistrement de l'utilisateur :", err);
      log("Erreur lors de l'enregistrement de l'utilisateur :", err);
      return res
        .status(500)
        .send({ message: "Erreur lors de l'enregistrement de l'utilisateur." });
    }
  });
  // FIN Enregistrement d'un utilisateur
  // DEBUT Determination du segment gagnant
  app.post("/:idRestaurant/determinerGain", async (req, res) => {
    try {
      let idRestaurant = req.params.idRestaurant;
      // Modifier l'ID du restaurant si nécessaire
      if (idRestaurant.startsWith("V2PG")) {
        idRestaurant = idRestaurant.substring(4);
      }
      const delay = req.body.delay || 7000;
      console.log(
        "Requête reçue pour le restaurant: et un delai de ",
        idRestaurant,
        delay
      );
      const idDocument = req.body.docRef;

      // Obtenez le document de restaurant
      const restaurantDoc = await db
        .collection("restaurant")
        .doc(idRestaurant)
        .get();
      if (!restaurantDoc.exists) {
        console.log(
          "Aucun document pour le restaurant avec l'ID:",
          idRestaurant
        );
        return res.status(404).send("Restaurant non trouvé.");
      }

      const restaurantData = restaurantDoc.data();
      const segmentNumber = parseInt(restaurantData.segmentNumber);
      let accumulatedProbabilities = [];
      let accumulatedProbability = 0;

      // Construire le tableau des probabilités cumulées
      for (let i = 1; i <= segmentNumber; i++) {
        accumulatedProbability += restaurantData[`probabilite${i}`];
        accumulatedProbabilities.push(accumulatedProbability);
      }

      // Choisissez un nombre aléatoire entre 0 et le total des probabilités
      let randomProbability = Math.random() * 100;
      let winningSegmentIndex = accumulatedProbabilities.findIndex(
        (endAngle) => randomProbability <= endAngle
      );

      // Si aucun segment n'est trouvé, utilisez le dernier segment
      if (winningSegmentIndex === -1) {
        winningSegmentIndex = segmentNumber - 1;
      }

      // Calculs pour la rotation
      let degreesPerSegment = 360 / segmentNumber;
      let startAngleOfWinningSegment = winningSegmentIndex * degreesPerSegment;
      let middleOfWinningSegment =
        startAngleOfWinningSegment + degreesPerSegment / 2;
      let variationRange = degreesPerSegment * 0.25;
      let randomVariation = (Math.random() - 0.5) * variationRange;
      let stopAngle = middleOfWinningSegment + randomVariation;
      stopAngle = (stopAngle + 360) % 360;
      let extraRotations = 360 * Math.floor(Math.random() * 14 + 9);
      const rotationGain = extraRotations + (360 - stopAngle);
      const winningSegmentLabel =
        restaurantData[`cadeau${winningSegmentIndex + 1}`];

      // Récupérer le message correspondant
      const gainMessageKey = `cadeau${winningSegmentIndex + 1}-message`;
      const gainMessage =
        restaurantData[gainMessageKey] || "Félicitations pour votre gain !";

      const gainValiditeKey = `cadeau${winningSegmentIndex + 1}-validite`;
      const gainValidite = restaurantData[gainValiditeKey] || "next"; // Default à "next"

      // Calculer les dates de début et de fin de validation
      let dateDebutValidation, dateDeValidation;
      const now = new Date();
      if (gainValidite === "next") {
        // Le gain est valide à partir de demain
        dateDebutValidation = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      } else {
        // Le gain est valide immédiatement
        dateDebutValidation = now;
      }
      // La date de fin de validation est fixée à 122 jours après aujourd'hui
      dateDeValidation = new Date(now.getTime() + 122 * 24 * 60 * 60 * 1000);

      // Enregistrement du gain + qr code dans la base de données
      const senderName = restaurantData["sender"];
      const userDocRef = db
        .collection("restaurant")
        .doc(idRestaurant)
        .collection("users")
        .doc(idDocument);

      let token = crypto.randomBytes(16).toString("hex");
      const fileName = `${token}.png`;
      const file = bucket.file(`${senderName}/${fileName}`);
      const baseURL = process.env.URL || "https://verification.piglyagency.fr";
      const qrCodeDataURL = await QRCode.toDataURL(
        `${baseURL}/?collection=${encodeURIComponent(
          idRestaurant
        )}&idUtilisateur=${idDocument}&gain=${encodeURIComponent(
          winningSegmentLabel
        )}`
      );

      let buffer = Buffer.from(
        qrCodeDataURL.replace("data:image/png;base64,", ""),
        "base64"
      );
      await file.save(buffer, { metadata: { contentType: "image/png" } });
      await file.makePublic();

      const qrCodeImageURL = `https://storage.googleapis.com/${bucket.name}/${senderName}/${fileName}`;
      await userDocRef.update({
        gain: winningSegmentLabel,
        dateDebutValidation: dateDebutValidation.toISOString(),
        dateDeValidation: dateDeValidation.toISOString(),
        qrCodeImageURL: qrCodeImageURL,
        qrCodeValide: true,
      });

      console.log(
        `Gain "${winningSegmentLabel}" enregistré pour l'utilisateur ${idDocument} du restaurant ${idRestaurant}.`
      );
      const shortId = generateShortId();
      const sixMonthsFromNow = new Date();
      sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);
      let longUrl = `https://qr-code2.piglyagency.fr/?c=${encodeURIComponent(
        idRestaurant
      )}&i=${idDocument}`;
      console.log("longUrl:", longUrl);
      const shortLinkDoc = {
        originalUrl: longUrl,
        createdAt: new Date(),
        expiresAt: sixMonthsFromNow,
      };
      console.log("shortLinkDoc:", shortLinkDoc);

      await db.collection("shortLinks").doc(shortId).set(shortLinkDoc);
      // executer l'envoie de sms dans 10 secondes
      setTimeout(async () => {
        const shouldSendMessage = await shouldSendSMS();
        console.log("shouldSendMessage:", shouldSendMessage);
        if (shouldSendMessage) {
          const userData = await userDocRef.get();
          const prenom = userData.data().prenom;
          const telephone = userData.data().telephone;
          const customMessage = `Félicitations ${prenom}, vous remportez : ${winningSegmentLabel},${gainMessage} Pour le récupérer, montrez ce QR Code : https://pigly.fr/${shortId}`;
          try {
            const message = await twilioClient.messages.create({
              body: customMessage,
              from: senderName,
              to: telephone,
            });
            console.log(`Message envoyé à ${telephone}:`, message.sid);
            log(`Message envoyé à ${telephone}:`, message.sid);
            console.log("SMS SENT");
            console.log(
              `Gain "${winningSegmentLabel}" enregistré et QRCode envoyé pour l'utilisateur ${idDocument} du restaurant ${idRestaurant}.`
            );
            log(
              `Gain "${winningSegmentLabel}" enregistré et QRCode envoyé pour l'utilisateur ${idDocument} du restaurant ${idRestaurant}.`
            );
          } catch (error) {
            console.log("SMS NOT SENT: SMS sending is disabled.");
            log("SMS NOT SENT: SMS sending is disabled.");
          }
        }
      }, delay);

      res.json({
        winningSegmentIndex: rotationGain,
        winningSegmentLabel: winningSegmentLabel,
      });
    } catch (err) {
      console.error(
        "Erreur lors de la détermination du gain et de l'enregistrement:",
        err
      );
      return res.status(500).json({ message: "Erreur interne du serveur." });
    }
  });
  // FIN Determination du segment gagnant et Enregistrement du gain + qr code
  function generateShortId() {
    const characters =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    const charactersLength = characters.length;
    for (let i = 0; i < 7; i++) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
  }

  // Fonction pour vérifier si l'envoi de SMS est activé
  async function shouldSendSMS() {
    try {
      const serverDoc = await db.collection("server").doc("smsConfig").get();
      return serverDoc.data().envoieSMS;
    } catch (error) {
      console.error(
        "Erreur lors de la récupération de la configuration d'envoi de SMS:",
        error
      );
      return false; // par défaut, n'envoie pas de SMS en cas d'erreur
    }
  }

  // DEBUT Récupération des données de l'utilisateur
  app.get("/getUserData", async (req, res) => {
    let collection = req.query.collection;
    const idUtilisateur = req.query.idUtilisateur;
    // Modifier l'ID du restaurant si nécessaire
    if (collection.startsWith("V2PG")) {
      collection = collection.substring(4);
    }

    console.log("Reçu Collection:", collection);
    log("Reçu Collection:", collection);
    console.log("Reçu ID Utilisateur:", idUtilisateur);
    log("Reçu ID Utilisateur:", idUtilisateur);

    try {
      docRestaurantdata = await db
        .collection("restaurant")
        .doc(collection)
        .get();
      if (!docRestaurantdata.exists) {
        console.log("Document du restaurant non trouvé");
        log("Document du restaurant non trouvé");
        return res.status(404).send("Document du restaurant non trouvé.");
      }
      //recupérer le champs achat dans le doc du restaurant
      const restaurantachatData = docRestaurantdata.data();
      const achat = restaurantachatData.achat;

      const docRef = db
        .collection("restaurant")
        .doc(collection)
        .collection("users")
        .doc(idUtilisateur);
      const doc = await docRef.get();

      if (!doc.exists) {
        console.log("Document non trouvé");
        log("Document non trouvé");
        return res.status(404).send("Document non trouvé.");
      }

      const data = doc.data();
      console.log("Données de la base de données:", data);
      log("Données de la base de données:", data);

      const restaurantDocRef = db.collection("restaurant").doc(collection);
      const restaurantDoc = await restaurantDocRef.get();

      if (!restaurantDoc.exists) {
        console.log("Document du restaurant non trouvé");
        log("Document du restaurant non trouvé");
        return res.status(404).send("Document du restaurant non trouvé.");
      }

      const restaurantData = restaurantDoc.data();
      console.log("Restaurant data :", restaurantData);
      log("Restaurant data :", restaurantData);
      // Trouvez le numéro du cadeau que l'utilisateur a gagné
      let cadeauNumber;
      for (let i = 1; i <= parseInt(restaurantData.segmentNumber); i++) {
        if (data.gain === restaurantData["cadeau" + i]) {
          cadeauNumber = i;
          break;
        }
      }

      // Si on ne trouve pas de correspondance, renvoyez une erreur ou gérez ce cas comme vous le souhaitez.
      if (!cadeauNumber) {
        return res
          .status(400)
          .send("Gain non trouvé dans les données du restaurant.");
      }

      // Convertissez les dates
      const dateCreation = formatDate(data.dateCreation);
      const dateDeValidation = formatDate(data.dateDeValidation);
      const dateDebutValidation = data.dateDebutValidation
        ? new Date(data.dateDebutValidation)
        : new Date();

      // Maintenant que vous avez le numéro du cadeau, récupérez la condition associée
      const condition = restaurantData["condition-cadeau" + cadeauNumber];

      // Vérifier si la dateDebutValidation est dans le futur
      const today = new Date();
      if (dateDebutValidation > today) {
        // La date de début de validation est dans le futur
        return res.status(201).json({
          achat: achat,
          gain: data.gain,
          dateCreation: dateCreation,
          dateDeValidation: dateDeValidation,
          dateDebutValidation: dateDebutValidation.toISOString(),
          condition: condition,
          message:
            "Votre cadeau sera valide à partir de " +
            dateDebutValidation.toLocaleDateString(),
        });
      }

      // Envoyez toutes les données nécessaires au client
      res.status(200).json({
        achat: achat,
        gain: data.gain,
        qrCodeImageURL: data.qrCodeImageURL,
        dateCreation: dateCreation,
        dateDeValidation: dateDeValidation,
        condition: condition,
      });
    } catch (error) {
      console.error("Erreur lors de la récupération du document:", error);
      log("Erreur lors de la récupération du document:", error);
      res.status(500).send("Erreur interne du serveur.");
    }
  });
  // FIN Récupération des données de l'utilisateur

  // DEBUT MISE DE LA DATE AU BON FORMAT
  function formatDate(dateString) {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0"); // Les mois commencent à 0
    const year = String(date.getFullYear()).slice(-2);
    return `${day}/${month}/${year}`;
  }
  function formatDisplayDate(dateString) {
    const options = {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    };
    return new Intl.DateTimeFormat("fr-FR", options).format(
      new Date(dateString)
    );
  }
  // FIN MISE DE LA DATE AU BON FORMAT

  // DEBUT Verification du QRCode
  app.post("/verification", async (req, res) => {
    console.log("--- Début de la vérification du QRCode ---");
    log("--- Début de la vérification du QRCode ---");

    let collectionName = decodeURIComponent(req.body.collection);

    if (collectionName.startsWith("V2PG")) {
      // Supprimer 'V2PG' du début du nom de la collection
      collectionName = collectionName.substring(4);
    }

    const idUtilisateur = req.body.idUtilisateur;
    const gain = decodeURIComponent(req.body.gain);

    console.log(`Collection: ${collectionName}`);
    log(`Collection: ${collectionName}`);
    console.log(`ID Utilisateur: ${idUtilisateur}`);
    log(`ID Utilisateur: ${idUtilisateur}`);
    console.log(`Gain: ${gain}`);
    log(`Gain: ${gain}`);

    // Cherchez le document dans la collection "restaurant"
    const usersRef = db
      .collection("restaurant")
      .doc(collectionName)
      .collection("users");
    const doc = await usersRef.doc(idUtilisateur).get();

    if (!doc.exists) {
      console.log("Utilisateur non trouvé");
      log("Utilisateur non trouvé");
      res.send({
        utilisateurFound: false,
        message:
          "Utilisateur non trouvé, il semble que le QrCode ai tenté d'être modifier",
      }); // Utilisez le code d'état 200 par défaut
      return;
    }

    const userData = doc.data();
    // Accéder au document du restaurant pour obtenir le segmentNumber et les cadeaux
    const restaurantDocRef = db.collection("restaurant").doc(collectionName);
    const restaurantDoc = await restaurantDocRef.get();
    const restaurantData = restaurantDoc.data();

    const normalizedUserGain = userData.gain.trim().toLowerCase();
    const normalizedGain = gain.trim().toLowerCase();

    // Vérification de la date de validation
    const dateNow = new Date();
    const dateDeValidation = new Date(userData.dateDeValidation);

    // On fixe l'heure de dateNow à minuit pour compter toute la journée en marge
    dateNow.setHours(0, 0, 0, 0);
    dateDeValidation.setHours(0, 0, 0, 0);

    log(`Gain attendu: ${normalizedUserGain}`);
    log(`Gain reçu: ${normalizedGain}`);
    log(`QR Code valide: ${userData.qrCodeValide}`);
    log(`Date de validation: ${userData.dateDeValidation}`);

    // Trouvez le numéro du cadeau que l'utilisateur a gagné
    let cadeauNumber;
    for (let i = 1; i <= parseInt(restaurantData.segmentNumber); i++) {
      if (
        normalizedGain === restaurantData["cadeau" + i].trim().toLowerCase()
      ) {
        cadeauNumber = i;
        break;
      }
    }

    // Si nous ne trouvons pas le cadeau, renvoyons une erreur
    if (!cadeauNumber) {
      console.log("Gain non reconnu ou absent du restaurant");
      log("Gain non reconnu ou absent du restaurant");
      res.send({
        utilisateurFound: true,
        gainIsValid: false,
        prenom: userData.prenom,
        dateValidation: formatDate(userData.dateDeValidation),
        dateCreation: formatDate(userData.dateCreation),
        message: "Navré, le gain n'est pas reconnu.",
      });
      return;
    }

    // Vérification combinée de la date de validation, du gain et du statut qrCodeValide
    if (
      dateNow > dateDeValidation ||
      normalizedUserGain !== normalizedGain ||
      !userData.qrCodeValide
    ) {
      console.log(
        "Date de validation dépassée, gain incorrect ou QR Code déjà validé"
      );
      log("Date de validation dépassée, gain incorrect ou QR Code déjà validé");
      let message;
      let errorCode;
      if (dateNow > dateDeValidation) {
        message = "La date limite est dépassée.";
        errorCode = "DATE_EXPIRED";
      } else if (!userData.qrCodeValide) {
        message = "Ce QrCode a déjà été validé...";
        errorCode = "QR_ALREADY_VALIDATED";
      } else {
        message = "Le QrCode est falsifié : Gain incorrect";
        errorCode = "INVALID_QR";
      }

      let responsePayload = {
        utilisateurFound: true,
        gainIsValid: false,
        prenom: userData.prenom,
        dateValidation: formatDate(userData.dateDeValidation),
        dateCreation: formatDate(userData.dateCreation),
        message: message,
        errorCode: errorCode,
      };

      if (userData.dateScanner) {
        responsePayload.dateScanner = formatDisplayDate(userData.dateScanner);
      }

      res.send(responsePayload);
      console.log(responsePayload);
      return;
    }

    // Si tout est valide
    const conditionCadeau = restaurantData["condition-cadeau" + cadeauNumber];
    console.log("Verification réussie");

    res.status(200).send({
      utilisateurFound: true,
      gainIsValid: true,
      gain: userData.gain,
      prenom: userData.prenom,
      dateValidation: formatDate(userData.dateDeValidation),
      dateCreation: formatDate(userData.dateCreation),
      condition: conditionCadeau,
    });
    setTimeout(async () => {
      console.log(
        "Mise à jour du document pour marquer le QRCode comme invalide"
      );
      log("Mise à jour du document pour marquer le QRCode comme invalide");
      await usersRef.doc(idUtilisateur).update({
        qrCodeValide: false,
        dateScanner: new Date().toISOString(),
      });
    }, 15 * 1000); // 120 secondes

    console.log("--- Fin de la vérification du QRCode ---");
    log("--- Fin de la vérification du QRCode ---");
  });
  // FIN Verification du QRCode

  // DEBUT Récupération des logs

  // Formater la date des logs
  function formatDate(isoDate) {
    const date = new Date(isoDate);
    return date.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
    });
  }
  function formatDatelog(isoDate) {
    const date = new Date(isoDate);
    const milliseconds = date.getMilliseconds();
    const formattedTime = date.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    const formattedDate = date.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
    });
    // Ajoutez "0" devant si les millisecondes sont inférieures à 100 pour avoir toujours 3 chiffres
    const formattedMilliseconds = milliseconds.toString().padStart(3, "0");

    return `${formattedDate} ${formattedTime},${formattedMilliseconds}`;
  }

  function formatLogObject(logObject) {
    return (
      `[${logObject.date || "Date inconnue"}] ${
        logObject.message || "Message non spécifié"
      }` + (logObject.restaurantName ? ` - ${logObject.restaurantName}` : "")
    );
  }

  let logs = [];

  function log(message, data = null) {
    let formattedDate = formatDatelog(new Date().toISOString());
    const logObject = {
      date: formattedDate,
      message: message,
      restaurantName: data ? data["Nom-du-restaurant"] : null,
      data: data,
    };
    logs.push(logObject);
    console.log(`[${formattedDate}] ${message}`);
    // Limiter la taille des logs si nécessaire
    while (logs.length > 1000) {
      logs.shift();
    }
    io.emit("newLog", logObject);
  }
  // FIN Récupération des logs

  // Gestion des erreurs Express
  app.use((err, req, res, next) => {
    console.error("Erreur dans le middleware Express :", err);
    log("Erreur dans le middleware Express :", err);
    res.status(500).json({ error: err.message });
  });

  // Écoute sur le port spécifié
  server.listen(port, "0.0.0.0", () => {
    console.log(`Server listening on port ${port}`);
    log(`Server listening on port ${port}`);
  });
  io.on("connection", (socket) => {
    let formattedLogs = logs.map((logObject) => formatLogObject(logObject));
    socket.emit("logs", formattedLogs);
    console.log("Administrateur connecté");
    log("Administrateur connected");
  });
} catch (error) {
  console.error("Erreur lors de l'initialisation :", error);
  log("Erreur lors de l'initialisation :", error);
}
