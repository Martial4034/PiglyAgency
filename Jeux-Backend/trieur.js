require("dotenv").config(); // Pour charger les variables d'environnement
const admin = require("firebase-admin");
const serviceAccount = require("./jeu-concours-f0a5b-firebase-adminsdk-qy6t5-c047a45550.json");

// Initialiser l'application Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const storage = admin.storage().bucket(process.env.FIREBASE_STORAGE_BUCKET);

const ADMIN_PHONE_NUMBERS = ["+33768117913", "+33777905796"];

async function supprimerDocumentsEtImages(collection, documentId) {
  const docRef = db.collection(collection).doc(documentId);
  const usersCollection = await docRef.collection('users').where("telephone", "in", ADMIN_PHONE_NUMBERS).get();

  if (usersCollection.empty) {
    console.log('Aucun document à supprimer.');
    return;
  }

  let count = 0;
  const batch = db.batch();

  for (const doc of usersCollection.docs) {
    const userData = doc.data();
    if (userData.qrCodeImageURL) {
        try {
          // Extraire le chemin correct du fichier dans Firebase Storage
          const url = new URL(userData.qrCodeImageURL);
          const filePath = url.pathname.split('/').slice(2).join('/'); // Supprimer le premier élément du chemin ('/jeu-concours-f0a5b.appspot.com/')
  
          const file = storage.file(filePath);
          await file.delete();
          console.log('Image supprimée:', filePath);
        } catch (error) {
          console.error('Erreur lors de la suppression de l\'image:', error);
        }
      }

    // Suppression du document
    await doc.ref.delete();
    count++;
  }


  // Supprimer tous les documents
  await batch.commit();
  console.log(`${count} document(s) supprimé(s) avec succès.`);
}

// Utilisez cette fonction pour supprimer les documents et images
supprimerDocumentsEtImages('restaurant', 'Vr3ncYbiqZ1s7bxcVL5E');
