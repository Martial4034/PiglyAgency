const admin = require("firebase-admin");
const serviceAccount = require("./jeu-concours-f0a5b-firebase-adminsdk-qy6t5-c047a45550.json");

// Initialiser l'application Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function copierDocument(collection, documentId) {
  const docRef = db.collection(collection).doc(documentId);
  const newDocId = `AZAZA${documentId}`;

  // Lire le document original
  const doc = await docRef.get();
  if (!doc.exists) {
      console.log('Aucun document trouvé!');
      return;
  }
  const docData = doc.data();

  // Lire la sous-collection 'users'
  const usersCollection = await docRef.collection('users').get();
  const usersData = usersCollection.docs.map(doc => ({ id: doc.id, data: doc.data() }));

  // Créer un nouveau document avec un ID modifié
  const newDocRef = db.collection(collection).doc(newDocId);
  await newDocRef.set(docData);

  // Copier les données de la sous-collection 'users'
  const usersBatch = db.batch();
  usersData.forEach(user => {
      const newUserDocRef = newDocRef.collection('users').doc(user.id);
      usersBatch.set(newUserDocRef, user.data);
  });
  await usersBatch.commit();

  console.log(`Document copié avec succès: ${newDocId}`);
}

// Utilisez cette fonction pour copier le document
copierDocument('restaurant', 'Vr3ncYbiqZ1s7bxcVL5E');