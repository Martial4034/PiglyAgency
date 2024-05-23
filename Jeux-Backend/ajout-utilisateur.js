const admin = require("firebase-admin");
const serviceAccount = require("./jeu-concours-f0a5b-firebase-adminsdk-qy6t5-c047a45550.json");
const inquirer = require('inquirer');

// Initialiser l'application Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function main() {
  // Demander l'email de l'utilisateur
  const { email } = await inquirer.prompt([
    {
      type: 'input',
      name: 'email',
      message: 'Entrez l\'email de l\'utilisateur :',
      validate: (input) => input.includes('@'), // Vérification sommaire de l'email
    },
  ]);


  // Récupérer la liste des restaurants
  const restaurantsSnapshot = await db.collection('restaurant').get();
  const restaurants = restaurantsSnapshot.docs.map(doc => ({
    name: `${doc.data()['Nom-du-restaurant']} (${doc.id})`, // Nom du restaurant et ID
    value: doc.id,
  }));

  // Demander à l'utilisateur de sélectionner un restaurant
  const { restaurantId } = await inquirer.prompt([
    {
      type: 'list',
      name: 'restaurantId',
      message: 'Sélectionnez un restaurant :',
      choices: restaurants,
    },
  ]);
// Ask for admin status
const { isAdmin } = await inquirer.prompt([
  {
    type: 'list',
    name: 'isAdmin',
    message: 'Est-ce que l\'utilisateur est un administrateur ?',
    choices: [
      { name: 'Oui', value: true },
      { name: 'Non', value: false }
    ],
  },
]);


// Ask for the password
const passwordAnswers = await inquirer.prompt([
  {
    type: 'password',
    name: 'password',
    message: 'Entrez un mot de passe pour les utilisateurs:',
    mask: '*',
    validate: function(value) {
      if (value.length < 6) {
        return 'Le mot de passe doit contenir au moins 6 caractères.';
      }
      return true;
    }
  },
  {
    type: 'password',
    name: 'confirmPassword',
    message: 'Confirmez le mot de passe:',
    mask: '*',
    validate: function(value, answers) {
      if (value !== answers.password) {
        return 'Les mots de passe ne correspondent pas.';
      }
      return true;
    }
  }
]);

const { password, confirmPassword } = passwordAnswers;

// Create users in Firebase Authentication and Firestore
  try {
    // Create the user in Firebase Authentication
    const userRecord = await admin.auth().createUser({
      email,
      emailVerified: true, // Set to true if you want to mark the email as verified
      password, // Use the password provided in the prompt
      disabled: false
    });

    console.log(`Successfully created new user with UID: ${userRecord.uid}`);

    // Create a document in Firestore 'utilisateurs' collection with the same UID
    await db.collection('utilisateur').doc(userRecord.uid).set({
      email,
      restaurantId,
      isAdmin,
      // Add any additional fields you want to include in the Firestore document
    });

    console.log(`Firestore document created for user with UID: ${userRecord.uid}`);
  } catch (error) {
    console.error(`Error creating user for ${email}: ${error.message}`);
  }
}


main().catch(console.error);
