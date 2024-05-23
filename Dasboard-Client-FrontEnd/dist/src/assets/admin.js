new Vue({
  el: "#app",
  data: {
    // Affichage
    page: true,
    afficherChargement: false,
    darkMode: false, // initialement en mode clair
    sidebarExpanded: false, // initialement réduit
    // Erreur
    error: false,
    errorMessage: null,

    //api: "http://localhost:3003/",
    api: "https://api2.pigly.fr/",

    // Catégories
    selectedCategory: "accueil",

    // Accueil
    smsEnabled: false,

    // Restaurants
    restaurants: [], // Pour stocker la liste des restaurants
    selectedRestaurant: null, // Pour stocker le restaurant sélectionné``
    restaurantDocId: null, // contiendra l'ID du document
    showCard: false,
    restaurantUrl: "",
    restaurantCardUrl: "https://roue.piglyagency.fr/",

    // Ajout d'un restaurant
    showForm: false,
    newRestaurant: {
      sender: "testtest",
      "verbe-du-formulaire": "occupent",
      slogan: "souhaite te gater",
      "Nom-du-restaurant": "LeLocal1",
      "Simple-nom-du-restaurant": "LOCAL",
      "preposition-slogan": "DUU",
      "couleur-selecteur": "#FFFFFF",
      "couleur-slogan": "#FFFFFF",
      "url-logo-central": "",
      cadeau1: "Serviette80P",
      probabilite1: 80,
      "condition-cadeau1": "",
      "couleur-segment1": "#ff0000",
      "couleur-texte-segment1": "#ffffff",
      cadeau2: "2Sushi16M",
      probabilite2: 16,
      "condition-cadeau2": "",
      "couleur-segment2": "#000000",
      "couleur-texte-segment2": "#ffffff",
      cadeau3: "3Jonyaliday1P",
      probabilite3: 1,
      "condition-cadeau3": "",
      "couleur-segment3": "#00b3ff",
      "couleur-texte-segment3": "#000000",
      cadeau4: "4SushiM",
      probabilite4: 1,
      "condition-cadeau4": "",
      "couleur-segment4": "#ff00dd",
      "couleur-texte-segment4": "#eeff00",
      cadeau5: "5Gueppe1P",
      probabilite5: 1,
      "condition-cadeau5": "",
      "couleur-segment5": "#66ff00",
      "couleur-texte-segment5": "#1100ff",
      cadeau6: "6Orange1P",
      probabilite6: 1,
      "condition-cadeau6": "",
      "couleur-segment6": "#ae00ff",
      "couleur-texte-segment6": "#000000",
    },
    mode: "create",
    segments: [],
    outerRadius: 175, // Assurez-vous que cette valeur est appropriée pour votre SVG
    giftFieldsCount: 1,
    restaurantData: {
      // Assurez-vous que restaurantData est bien initialisé
      "Nom-du-restaurant": "",
      slogan: "",
    },

    // Logs
    logs: [],
    socket: null,

    // Notifications
    showToast: false,
    toastMessage: "",
  },
  watch: {
    newRestaurant: {
      deep: true,
      handler(newVal) {
        if (this.mode === "create") {
          this.updateRestaurantData();
          this.updateSegments();
        }
      },
    },
    selectedRestaurant: {
      deep: true,
      handler(newVal) {
        if (this.mode === "update") {
          this.updateRestaurantDataSelected();
          this.updateSegmentsSelected();
        }
      },
    },
    giftFieldsCount(newCount, oldCount) {
      if (newCount !== oldCount) {
        this.updateSegments();
      }
    },
  },

  async mounted() {
    //const SERVER_URL = "http://localhost:3003";
    const SERVER_URL = "https://api2.pigly.fr/";

    const token = localStorage.getItem("token");

    if (!token) {
      window.location.href = "index.html";
      return;
    }

    try {
      const response = await fetch(`${SERVER_URL}/verifyToken`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token }),
      });

      const data = await response.json();

      if (!data.valid) {
        this.error = true;
        this.errorMessage = "Token invalide ou expiré";
        window.location.href = "index.html";
      } else {
        this.page = true;
        try {
          const response = await fetch(this.api + `getSMSConfig`);
          const data = await response.json();
          this.smsEnabled = data.smsEnabled;
        } catch (error) {
          console.error(
            "Erreur lors de la récupération de la configuration SMS:",
            error
          );
        }
      }
    } catch (error) {
      console.error("Erreur de vérification du token:", error);
    }
  },
  methods: {
    toggleSidebar() {
      this.sidebarExpanded = !this.sidebarExpanded;
      if (this.sidebarExpanded) {
        document.getElementById("adminSidebar").style.width = "200px";
        document.getElementById("adminSidebar").classList.add("expanded");
        let menuTexts = document.getElementsByClassName("menu-text");
        for (let text of menuTexts) {
          text.style.display = "inline";
        }
      } else {
        document.getElementById("adminSidebar").style.width = "60px";
        document.getElementById("adminSidebar").classList.remove("expanded");
        let menuTexts = document.getElementsByClassName("menu-text");
        for (let text of menuTexts) {
          text.style.display = "none";
        }
      }
    },
    toggleDarkMode() {
      if (this.darkMode) {
        document.body.classList.replace("bg-dark", "bg-light");
        document.body.classList.replace("text-light", "text-dark");
      } else {
        document.body.classList.replace("bg-light", "bg-dark");
        document.body.classList.replace("text-dark", "text-light");
      }
    },
    setCategory(category) {
      this.selectedCategory = category;
      if (category === "restaurant") {
        this.fetchRestaurants();
        this.toggleViews();
      }
      // Afficher les logs
      if (category === "logs" && !this.socket) {
        this.connectSocket();
      }
    },
    // Accueil
    async toggleSMS() {
      try {
        const response = await fetch(this.api + `toggleSMS`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ smsEnabled: this.smsEnabled }),
        });

        const data = await response.json();
        if (data.success) {
          this.smsEnabled = data.smsEnabled;

          console.log(this.smsEnabled);

          // Afficher la notification
          if (this.smsEnabled) {
            this.toastMessage =
              "L'envoie de SMS a bien été réactivé sur tous les sites.";
          } else {
            this.toastMessage =
              "L'envoie de SMS a bien été désactivé sur tous les sites.";
          }
          this.displayToast();
        } else {
          console.error("Erreur côté serveur");
        }
      } catch (error) {
        console.error("Erreur lors de la mise à jour:", error);
      }
    },
    // Restaurants
    async fetchRestaurants() {
      try {
        const response = await fetch(this.api + `AdminRestaurants`);

        this.restaurants = await response.json();
      } catch (error) {
        console.error("Erreur lors de la récupération des restaurants:", error);
      }
    },
    selectRestaurant(restaurant) {
      this.selectedRestaurant = JSON.parse(JSON.stringify(restaurant)); // Pour éviter des problèmes de référence
      this.mode = "update";
      this.updateRestaurantDataSelected();
      this.toggleViews();
    },
    backToRestaurants() {
      this.selectedRestaurant = null;
      this.mode = "create";
      this.toggleViews();
    },
    toggleViews() {
      const list = document.querySelector(".list-restaurants");
      const details = document.querySelector(".details-restaurant");

      if (!list || !details) {
        return; // Sortir de la fonction si l'un des éléments n'est pas trouvé
      }

      if (this.selectedRestaurant) {
        list.classList.remove("active");
        details.classList.add("active");
      } else {
        details.classList.remove("active");
        list.classList.add("active");
      }
    },
    showForm() {
      // permettre au formulaire de s'afficher ou de se cacher
      this.showForm = !this.showForm;

      const list = document.querySelector(".list-restaurants");
      const details = document.querySelector(".details-restaurant");
      if (this.showForm === true) {
        //masquer les noms des restaurants
        list.classList.remove("active");
        details.classList.remove("active");
      }
    },
    addGiftField() {
      this.giftFieldsCount++;
    },
    removeGiftField() {
      if (this.giftFieldsCount > 0) {
        this.giftFieldsCount--;
      }
    },
    // pour le logo
    handleImageChange() {
      const file = this.$refs.imageInput.files[0];
      if (file && file.type.startsWith("image/")) {
        const imageUrl = URL.createObjectURL(file);
        if (this.mode === "create") {
          this.newRestaurant["url-logo-central"] = imageUrl;
          this.newRestaurant["logoFile"] = file;
          console.log("mode create");
          console.log(
            "url-logo-central",
            this.newRestaurant["url-logo-central"]
          );
          console.log("logoFile", this.newRestaurant["logoFile"]);
        } else {
          this.selectedRestaurant["url-logo-central"] = imageUrl;
          this.selectedRestaurant["newLogoImage"] = file;
          console.log("mode update");
          console.log(
            "url-logo-central",
            this.selectedRestaurant["url-logo-central"]
          );
          console.log("newLogoImage", this.selectedRestaurant["newLogoImage"]);
        }
      }
    },
    clearImageURL() {
      if (this.newRestaurant["url-logo-central"]) {
        URL.revokeObjectURL(this.newRestaurant["url-logo-central"]);
        this.newRestaurant["url-logo-central"] = "";
        this.restaurantData["url-logo-central"] =
          this.newRestaurant["url-logo-central"];
      }
    },
    //pour le header
    handleHeaderImageChange() {
      const file = this.$refs.headerImageInput.files[0];
      if (file && file.type.startsWith("image/")) {
        const imageUrl = URL.createObjectURL(file);
        if (this.mode === "create") {
          this.newRestaurant["url-header"] = imageUrl;
          this.newRestaurant["headerFile"] = file;
          console.log("mode create");
          console.log("url-header", this.newRestaurant["url-header"]);
          console.log("headerFile", this.newRestaurant["headerFile"]);
        } else {
          this.selectedRestaurant["url-header"] = imageUrl;
          this.selectedRestaurant["newHeaderImage"] = file;
          console.log("mode update");
          console.log("url-header", this.selectedRestaurant["url-header"]);
          console.log("headerFile", this.selectedRestaurant["newHeaderImage"]);
        }
      }
    },
    clearHeaderImageURL() {
      if (this.newRestaurant["url-img-header"]) {
        URL.revokeObjectURL(this.newRestaurant["url-img-header"]);
        this.newRestaurant["url-img-header"] = "";
        this.restaurantData["url-img-header"] =
          this.newRestaurant["url-img-header"];
      }
    },
    // Nettoyez l'URL de l'objet lorsque le composant est détruit
    destroyed() {
      this.clearImageURL();
    },
    getSegmentPath(index) {
      const numSegments = this.segments.length;
      const anglePerSegment = (Math.PI * 2) / numSegments;
      const startAngle = index * anglePerSegment;
      const endAngle = startAngle + anglePerSegment;

      // Coordonnées du point de départ (sur le cercle extérieur)
      const startX = this.outerRadius * Math.cos(startAngle - Math.PI / 2);
      const startY = this.outerRadius * Math.sin(startAngle - Math.PI / 2);

      // Coordonnées du point final (sur le cercle extérieur)
      const endX = this.outerRadius * Math.cos(endAngle - Math.PI / 2);
      const endY = this.outerRadius * Math.sin(endAngle - Math.PI / 2);

      // Path definition for the SVG `path` element
      const d = [
        `M ${startX} ${startY}`, // Move to the start point
        `A ${this.outerRadius} ${this.outerRadius} 0 0 1 ${endX} ${endY}`, // Arc to the end point
        `L 0 0`, // Line to the center of the wheel
      ].join(" ");

      return d;
    },
    getTextPath(index) {
      const numSegments = this.segments.length;
      const anglePerSegment = (Math.PI * 2) / numSegments;
      const startAngle = index * anglePerSegment - Math.PI / 2; // Ajustement pour commencer en haut
      const endAngle = startAngle + anglePerSegment;

      // Calculer la position de début du chemin de texte
      const textRadius = this.outerRadius - 20; // Un peu à l'intérieur du cercle extérieur

      const startX = textRadius * Math.cos(startAngle);
      const startY = textRadius * Math.sin(startAngle);
      const endX = textRadius * Math.cos(endAngle);
      const endY = textRadius * Math.sin(endAngle);

      // Créez un arc pour la position du texte
      const d = [
        `M ${startX} ${startY}`, // Move to the start point
        `A ${textRadius} ${textRadius} 0 0 1 ${endX} ${endY}`, // Arc to the end point
      ].join(" ");

      return d;
    },
    getTspansForSegment(index) {
      // Utilisez la longueur de la chaîne de référence pour déterminer si un retour à la ligne est nécessaire
      const maxChars = 20;
      const words = index.split(" "); // Diviser le texte en mots
      let currentLine = "";
      let tspans = [];

      words.forEach((word) => {
        if ((currentLine + word).length > maxChars) {
          // Si l'ajout du mot dépasse la longueur maximale, créez un nouveau tspan
          tspans.push(currentLine.trim());
          currentLine = word + " ";
        } else {
          // Sinon, ajoutez le mot à la ligne actuelle
          currentLine += word + " ";
        }
      });

      // Ajoutez la dernière ligne restante
      if (currentLine.trim().length) {
        tspans.push(currentLine.trim());
      }

      return tspans;
    },
    degreesToRadians(degrees) {
      return (degrees * Math.PI) / 180;
    },
    getTextTransform(index) {
      const numSegments = this.segments.length;
      const anglePerSegment = 360 / numSegments;
      const angle = index * anglePerSegment + anglePerSegment / 2; // Angle au centre du segment
      const adjustment = angle + 90; // Ajuster de 90 degrés pour que le texte soit orienté avec le rayon

      // Positionner le texte un peu à l'intérieur du bord extérieur du segment
      const textRadius = this.outerRadius - 20; // Réduisez ce nombre si le texte est trop près du bord
      const x =
        textRadius *
        Math.cos(this.degreesToRadians(angle - anglePerSegment / 2));
      const y =
        textRadius *
        Math.sin(this.degreesToRadians(angle - anglePerSegment / 2));

      return `rotate(${adjustment}) translate(${x}, ${y})`;
    },
    updateRestaurantData() {
      // Copie les valeurs de newRestaurant dans restaurantData
      this.restaurantData = this.newRestaurant;
      this.restaurantData.restaurantName =
        this.newRestaurant["Nom-du-restaurant"];
      this.restaurantData.restaurantSlogan = this.newRestaurant["slogan"];
      this.restaurantData.restaurantPreposition =
        this.newRestaurant["preposition-slogan"];
      this.restaurantData.restaurantSimple =
        this.newRestaurant["Simple-nom-du-restaurant"];
      this.restaurantData.couleurSelecteur =
        this.newRestaurant["couleurSelecteur"];
      this.restaurantData.couleurSlogan = this.newRestaurant["couleur-slogan"];
      console.log(this.restaurantData);
    },
    updateRestaurantDataSelected() {
      // Copie les valeurs de SelectedRestaurant dans restaurantData
      this.restaurantData = { ...this.selectedRestaurant };
      this.restaurantData.restaurantName =
        this.selectedRestaurant["Nom-du-restaurant"];
      this.restaurantData.restaurantSlogan = this.selectedRestaurant["slogan"];
      this.restaurantData.restaurantPreposition =
        this.selectedRestaurant["preposition-slogan"];
      this.restaurantData.restaurantSimple =
        this.selectedRestaurant["Simple-nom-du-restaurant"];
      this.restaurantData.couleurSelecteur =
        this.selectedRestaurant["couleurSelecteur"];
      this.restaurantData.couleurSlogan =
        this.selectedRestaurant["couleur-slogan"];
      console.log(this.restaurantData);
    },

    updateSegments() {
      this.segments = []; // Réinitialiser les segments avant de les remplir

      // Créer de nouveaux segments basés sur les entrées de l'utilisateur
      for (let i = 1; i <= this.giftFieldsCount; i++) {
        // Vérifier si le cadeau existe
        if (this.newRestaurant[`cadeau${i}`]) {
          this.segments.push({
            label: this.newRestaurant[`cadeau${i}`],
            color: this.newRestaurant[`couleur-segment${i}`],
            probability: this.newRestaurant[`probabilite${i}`],
            textColor: this.newRestaurant[`couleur-texte-segment${i}`],
          });
        }
      }
    },
    updateSegmentsSelected() {
      this.segments = []; // Réinitialiser les segments avant de les remplir

      // Créer de nouveaux segments basés sur les entrées de l'utilisateur
      for (let i = 1; i <= this.giftFieldsCount; i++) {
        // Vérifier si le cadeau existe
        if (this.newRestaurant[`cadeau${i}`]) {
          this.newRestaurant[`cadeau${i}`] =
            this.selectedRestaurant[`cadeau${i}`];
          this.newRestaurant[`probabilite${i}`] =
            this.selectedRestaurant[`probabilite${i}`];
          this.newRestaurant[`couleur-segment${i}`] =
            this.selectedRestaurant[`couleur-segment${i}`];
          this.newRestaurant[`couleur-texte-segment${i}`] =
            this.selectedRestaurant[`couleur-texte-segment${i}`];

          this.segments.push({
            label: this.newRestaurant[`cadeau${i}`],
            color: this.newRestaurant[`couleur-segment${i}`],
            probability: this.newRestaurant[`probabilite${i}`],
            textColor: this.newRestaurant[`couleur-texte-segment${i}`],
          });
        }
      }
    },

    processGooglePageInput() {
      let inputValue = this.newRestaurant.googlePage;

      // Supprime les parties non désirées de l'URL ou du code
      const patternsToRemove = [
        /^https?:\/\/g\.page\/r\//,
        /^g\./,
        /^\//,
        /\/$/,
      ];
      patternsToRemove.forEach((pattern) => {
        inputValue = inputValue.replace(pattern, "");
      });

      // Mettre à jour la valeur nettoyée
      this.newRestaurant.googlePage = inputValue;
    },
    async addRestaurant() {
      // Vérification des données
      if (!this.newRestaurant["Nom-du-restaurant"]) {
        this.toastMessage = "Veuillez saisir le nom du restaurant.";
        this.displayToast();
        return;
      }
      if (!this.newRestaurant["slogan"]) {
        this.toastMessage = "Veuillez saisir le slogan du restaurant.";
        this.displayToast();
        return;
      }

      if (!this.newRestaurant["couleur-selecteur"]) {
        this.toastMessage = "Veuillez sélectionner une couleur.";
        this.displayToast();
      }

      if (this.giftFieldsCount < 3) {
        this.toastMessage = "Veuillez ajouter au moins 3 cadeaux.";
        this.displayToast();
      }
      // Mise à jour des messages de cadeau en fonction de la validité
      for (let i = 1; i <= this.giftFieldsCount; i++) {
        const validityKey = `cadeau${i}-validite`;
        const messageKey = `cadeau${i}-message`;

        if (this.newRestaurant[validityKey] === "next") {
          this.newRestaurant[messageKey] =
            "Réclamez-le lors de votre prochain dîner chez nous.";
        } else if (this.newRestaurant[validityKey] === "now") {
          this.newRestaurant[messageKey] = "Ce gain est valable dès à présent.";
        }
      }

      // Convertir les probabilités en nombres
      Object.keys(this.newRestaurant).forEach((key) => {
        if (key.startsWith("probabilite")) {
          this.newRestaurant[key] = parseFloat(this.newRestaurant[key]);
        }
      });

      const totalProbability = Object.keys(this.newRestaurant).reduce(
        (total, key) => {
          if (key.startsWith("probabilite")) {
            return total + this.newRestaurant[key];
          }
          return total;
        },
        0
      );

      if (totalProbability !== 100) {
        this.toastMessage = "L'addition des probabilités doit faire 100.";
        this.displayToast();
        return; // Arrêtez l'exécution si la condition n'est pas remplie
      }

      this.newRestaurant.segmentNumber = this.giftFieldsCount;
      // Créez une copie propre de restaurantData sans les propriétés inutiles
      let cleanRestaurantData = { ...this.newRestaurant };
      delete cleanRestaurantData.logoFile;
      delete cleanRestaurantData.headerFile;
      delete cleanRestaurantData["url-img-header"];
      delete cleanRestaurantData["couleurSlogan"];
      delete cleanRestaurantData["restaurantName"];
      delete cleanRestaurantData["restaurantSimple"];
      delete cleanRestaurantData["restaurantSlogan"];
      delete cleanRestaurantData["restaurantPreposition"];
      console.log("cleanRestaurantData", cleanRestaurantData);

      // Envoi des données au serveur
      let formData = new FormData();
      if (this.newRestaurant["logoFile"]) {
        formData.append("image", this.newRestaurant["logoFile"]);
      }
      if (this.newRestaurant["headerFile"]) {
        formData.append("headerImage", this.newRestaurant["headerFile"]);
      }
      formData.append("restaurantData", JSON.stringify(cleanRestaurantData));
      console.log(formData);
      try {
        const response = await fetch(this.api + `AddRestaurant`, {
          method: "POST",
          body: formData,
        });

        if (response.ok) {
          const data = await response.json();
          console.log(data);
          this.toastMessage = "Restaurant ajouté avec succès !";
          this.displayToast();
          this.showForm = false;
          this.displayCardWithQrCode(data.docId); // Assurez-vous que data.docId est correct
        } else {
          throw new Error("Erreur de réponse du serveur");
        }
      } catch (error) {
        console.error("Erreur lors de l'ajout d'un restaurant:", error);
        this.toastMessage = "Erreur lors de l'ajout du restaurant";
        this.displayToast();
      }
    },
    async updateRestaurant() {
      let formData = new FormData();
    
      // Vérifier si de nouvelles images ont été ajoutées et les ajouter au formData
      if (this.selectedRestaurant.newLogoImage) {
        formData.append('newLogoImage', this.selectedRestaurant.newLogoImage);
      }
      if (this.selectedRestaurant.newHeaderImage) {
        formData.append('newHeaderImage', this.selectedRestaurant.newHeaderImage);
      }
    
      // Préparer les autres données du restaurant à envoyer
      const restaurantData = { ...this.selectedRestaurant };
      delete restaurantData.newLogoImage;
      delete restaurantData.newHeaderImage;
      delete restaurantData.urlHeader; // Assurez-vous que c'est le bon nom de champ
      delete restaurantData.urlLogoCentral; // Assurez-vous que c'est le bon nom de champ
    
      formData.append('restaurantData', JSON.stringify(restaurantData));
    
      try {
        const response = await fetch(this.api + 'updateRestaurant', {
          method: 'POST',
          body: formData,
        });
    
        if (!response.ok) {
          throw new Error('Erreur de réponse du serveur');
        }
    
        const data = await response.json();
        if (data.success) {
          // Gérer la réponse du serveur
          console.log('Restaurant mis à jour avec succès !');
          // Autres actions après la mise à jour...
          this.toastMessage = "Restaurant mis à jour avec succès !";
          this.displayToast();
          this.backToRestaurants();
          this.displayCardWithQrCode(data.docId); // Assurez-vous que data.docId est correct
        
        }
      } catch (error) {
        console.error('Erreur lors de la mise à jour du restaurant:', error);
      }
    },    
    async deleteRestaurant() {
      if (!this.selectedRestaurant || !this.selectedRestaurant.docId) {
        alert("Aucun restaurant sélectionné !");
        return;
      }

      if (confirm("Êtes-vous sûr de vouloir supprimer ce restaurant ?")) {
        try {
          const response = await fetch(this.api + `DeleteRestaurant`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ docId: this.selectedRestaurant.docId }),
          });

          if (response.ok) {
            const data = await response.json();
            if (data.success) {
              this.toastMessage = "Restaurant supprimé avec succès !";
              this.displayToast();
              this.fetchRestaurants(); // Mettre à jour la liste des restaurants
              this.backToRestaurants();
            }
          } else {
            throw new Error("Erreur de réponse du serveur");
          }
        } catch (error) {
          console.error("Erreur lors de la suppression du restaurant:", error);
          this.toastMessage = "Erreur lors de la suppression du restaurant";
          this.displayToast();
        }
      }
    },
    displayCardWithQrCode(docId) {
      // Construction de l'URL complète
      this.restaurantUrl = this.restaurantCardUrl + docId;
      console.log(this.restaurantUrl);
      this.showCard = true;

      // Assurez-vous que l'élément qrcode existe déjà dans le DOM
      this.$nextTick(() => {
        // Générer le QR Code
        new QRCode(
          document.getElementById("qrcode"),
          this.restaurantUrl,
          function (error) {
            if (error) console.error(error);
            else console.log("QR Code généré avec succès !");
          }
        );
      });

      // Supprimer la carte après 2 minutes (30 * 60 * 1000 pour 30 minutes)
      setTimeout(() => {
        this.showCard = false;
      }, 2 * 60 * 1000);
    },

    // Logs
    formatLogData(data) {
      let formatted = "";
      if (data) {
        for (let [key, value] of Object.entries(data)) {
          formatted += `<strong>${key}:</strong> <span style="color: green;">${value}</span><br>`;
        }
      }
      return formatted;
    },
    toggleDetails(index) {
      this.$set(
        this.logs[index],
        "detailsVisible",
        !this.logs[index].detailsVisible
      );
    },
    connectSocket() {
      this.socket = io.connect("http://localhost:3003");
      console.log("Connexion à la socket");

      this.socket.on("logs", (logs) => {
        this.logs = logs.map((log) => ({
          content: typeof log === "string" ? log : this.formatLogData(log),
          detailsVisible: false,
        }));
      });
      
      this.socket.on("newLog", (logObject) => {
        let logEntry = {
          content: `
                        [${logObject.date || "Date inconnue"}] ${
            logObject.message || "Message non spécifié"
          }
                        ${
                          logObject.restaurantName
                            ? ` - ${logObject.restaurantName}`
                            : ""
                        }`,
          data: this.formatLogData(logObject.data),
          detailsVisible: false,
        };
        this.logs.push(logEntry);
        console.log("Nouveau log:", logObject);
      });
    },
    // Notifications
    displayToast() {
      this.showToast = true;
      setTimeout(() => {
        this.showToast = false;
      }, 5000);
    },
  },
});
