require("dotenv").config(); // Pour charger les variables d'environnement
const admin = require("firebase-admin");
const serviceAccount = require("./jeu-concours-f0a5b-firebase-adminsdk-qy6t5-c047a45550.json");
// Initialiser l'application Firebase Admin
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  
const db = admin.firestore();

async function copyUsers(sourceRestaurantId, destinationRestaurantId) {
  try {
    // Récupérer les documents de la sous-collection 'users' du restaurant source
    const sourceUsersRef = db.collection('restaurant').doc(sourceRestaurantId).collection('users');
    const snapshot = await sourceUsersRef.get();

    // Vérifier s'il y a des documents à copier
    if (snapshot.empty) {
      console.log('Aucun utilisateur à copier.');
      return;
    }

    // Récupérer la référence de la sous-collection 'users' du restaurant de destination
    const destinationUsersRef = db.collection('restaurant').doc(destinationRestaurantId).collection('users');

    // Copier chaque utilisateur dans le restaurant de destination
    snapshot.docs.forEach(async (doc) => {
      const userData = doc.data();
      await destinationUsersRef.add(userData);
    });

    console.log('Tous les utilisateurs ont été copiés.');
  } catch (error) {
    console.error('Erreur lors de la copie des utilisateurs:', error);
  }
}

// Remplacez 'sourceRestaurantId' et 'destinationRestaurantId' par les ID appropriés
copyUsers('V2PGVr3ncYbiqZ1s7bxcVL5E', 'Vr3ncYbiqZ1s7bxcVL5E');