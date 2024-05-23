const admin = require("firebase-admin");
const inquirer = require('inquirer');
const xlsx = require('xlsx');
const serviceAccount = require("./jeu-concours-f0a5b-firebase-adminsdk-qy6t5-c047a45550.json");

// Initialisez Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

function formatPhoneNumber(phone) {
  // Convertit les numéros de téléphone au format international avec '+'
  let formattedPhone = phone.toString();
  if (formattedPhone.includes('E+')) {
    const parts = formattedPhone.split('E+');
    const base = parts[0].replace('.', '');
    const exponent = parseInt(parts[1], 10) - (base.length - 1);
    formattedPhone = '+' + base + '0'.repeat(exponent);
  } else {
    formattedPhone = '+' + formattedPhone;
  }
  return formattedPhone;
}

function formatDateToTimestamp(excelDateValue) {
  // Convertissez la date en objet Date JavaScript
  let jsDate;
  if (typeof excelDateValue === 'number') {
    // Convertir les nombres de jours Excel en dates JavaScript
    const excelEpoch = new Date(1899, 11, 30); // Le point de départ de l'époque Excel
    jsDate = new Date(excelEpoch.getTime() + excelDateValue * 86400000);
  } else if (typeof excelDateValue === 'string') {
    // Si c'est une chaîne, on suppose qu'elle est au format MM/JJ/AAAA
    const parts = excelDateValue.split('/');
    if (parts.length === 3) {
      const [month, day, year] = parts.map(part => parseInt(part, 10));
      jsDate = new Date(year, month - 1, day);
    }
  }

  // Retournez un timestamp Firebase ou null si la date n'est pas valide
  return jsDate ? admin.firestore.Timestamp.fromDate(jsDate) : null;
}

async function selectRestaurant() {
  const restaurantsSnapshot = await db.collection('restaurant').get();
  const restaurants = restaurantsSnapshot.docs.map(doc => ({
    name: `${doc.data()['Nom-du-restaurant']} (${doc.id})`,
    value: doc.id,
  }));

  return inquirer.prompt([
    {
      type: 'list',
      name: 'restaurantId',
      message: 'Choisissez un restaurant :',
      choices: restaurants
    }
  ]);
}

async function processExcelFile(filePath, restaurantId) {
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(sheet);

  for (const row of data) {
    if (row['Numero de telephone']) {
      const phone = formatPhoneNumber(row['Numero de telephone']);
      const dateCreation = formatDateToTimestamp(row['Date d\'enregistrement']);

      if (dateCreation) {
        // Créez l'objet client
        const client = {
          email: row['Adresse email'],
          prenom: row['Prenom'],
          nom: row['Nom'],
          telephone: phone,
          dateCreation: dateCreation
        };

        // Ajoutez-le à Firestore
        await db.collection('restaurant').doc(restaurantId).collection('clients').add(client);
      } else {
        console.error('Date d\'enregistrement non valide pour:', row);
      }
    }
  }
}

async function run() {
  const { restaurantId } = await selectRestaurant();
  const filePath = './les-bons-vivants-lyon-optin-contacts.xlsx';
  await processExcelFile(filePath, restaurantId);
}

run().catch(console.error);
