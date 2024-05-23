new Vue({
  el: "#app",
  data: {
    //SERVER_URL: "http://localhost:3003",
    SERVER_URL: "https://main.piglyagency.fr",
    alerteVisible: false,
    alerteMessage: "",
    sidebarVisible: true, // Initially visible
    selectedSection: localStorage.getItem("selectedSection"),
    filter: "all",
    selectedTimeframe: "all-time",
    restaurantId: localStorage.getItem("restaurantId"),
    donutChartInstance: null,
    showCard: false,
    restaurantCardUrl: "https://roue.piglyagency.fr/",
    chargementEnCours: false,
    donutChartData: [{ label: "", value: 0, color: "" }],
    barChartData: [{ label: "", value: 0, color: "" }],
    menuItems: [
      { text: "Dashboard", icon: "fa-tachometer-alt", active: true },
      { text: "Product", icon: "fa-box-open", active: false },
      { text: "Fichier clients", icon: "fa-user-circle", active: false },
      { text: "Joueurs", icon: "fa-users", active: false },
      { text: "Roulette", icon: "fa-bullhorn", active: false },
      { text: "Help", icon: "fa-question-circle", active: false },
    ],
    nbCadeaux: [{ title: "Cadeau", value: 0 }],
    showSortOptions: false,

    users: [
      // Static list of users for demonstration purposes
      {
        prenom: "Prénom",
        telephone: "01 23 45 67 89",
        email: "@email.com",
        dateDeVisite: "2021-04-01",
      },
    ],
    JoueursUsers: [
      {
        prenom: "Prenom",
        cadeau: "",
        valide: true,
        dateDeVisite: "7 Jul, 14:04",
      },
    ],
    showCreateCustomerForm: false,
    newCustomer: {
      prenom: '',
      nom: '',
      email: '',
      telephone: '',
      dateDeVisite: '' // This will be a string in 'YYYY-MM-DD' format
    },
    isSubmitting: false,
    formErrors: {
      prenom: '',
      nom: '',
      email: '',
      telephone: ''
    },
    currentSortColumn: "prenom",
    sortAscending: true,
    stats: [
      { title: "Joueurs", number: 0 },
      { title: "Joueurs revenus", number: 0 },
      { title: "Joueur en attente", number: 0 },
    ],
    restaurantData: {
      "Nom-du-restaurant": "Les bons Vivants",
      cadeau1: "",
      probabilite1: 0,
      "condition-cadeau1": "",
      "cadeau1-validite": "",
      cadeau2: "",
      probabilite2: 0,
      "condition-cadeau2": "",
      "cadeau2-validite": "",
      cadeau3: "",
      probabilite3: 0,
      "condition-cadeau3": "",
      "cadeau3-validite": "",
      cadeau4: "",
      probabilite4: 0,
      "condition-cadeau4": "",
      "cadeau4-validite": "",
      segmentNumber: 4,
      "url-logo-central": "",
      "couleur-selecteur": "#C4C4C4",
    },
    couleursParDefaut: {
      pair: {
        segment: "",
        texte: "",
      },
      impair: {
        segment: "",
        texte: "",
      },
    },
    outerRadius: 175,
    segments: [],
    token: localStorage.getItem("token"),
    establishments: [],
    selectedEstablishment: null,
    reviews: [],
  },
  async mounted() {
    if (!this.token) {
      window.location.href = "index.html";
      return;
    }
    console.log("Token:", this.token);
    console.log("Restaurant ID:", this.restaurantId);
    try {
      const response = await fetch(this.SERVER_URL + `/verifyToken`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token: this.token }),
      });

      const data = await response.json();

      if (!data.valid) {
        localStorage.removeItem("token"); // Clear the invalid token
        localStorage.removeItem("restaurantId");
        this.error = true;
        this.errorMessage = "Token invalide ou expiré";
        window.location.href = "index.html";
      } else {
        // si selectedsection est vide alors on met Dashboard par défaut
        if (this.selectedSection === null) {
          this.selectedSection = "Dashboard";
          localStorage.setItem('selectedSection', this.selectedSection);
        }
        if (this.selectedSection === "Dashboard") {
          this.fetchDonutChartData(this.restaurantId, this.selectedTimeframe);
        }
        if (this.selectedSection === "Fichier clients") {
          this.fetchFichierClient(this.restaurantId);
        }
        if (this.selectedSection === "Joueurs") {
          this.fetchJoueurs(this.restaurantId);
        }
        if (this.selectedSection === "Roulette") {
          this.fetchAndUpdateRoueRestaurant(this.restaurantId);
        }
        
      }
    } catch (error) {
      console.error("Erreur de vérification du token:", error);
    }
  },
  watch: {
    selectedTimeframe: function (newVal, oldVal) {
      if (newVal !== oldVal) {
        this.fetchDonutChartData(this.restaurantId, newVal);
      }
    },
    selectedSection: function (newVal) {
      if (newVal === "Dashboard") {
        localStorage.setItem('selectedSection', newVal);
        this.fetchDonutChartData(this.restaurantId, this.selectedTimeframe);
      }
      if (newVal === "Fichier clients") {
        localStorage.setItem('selectedSection', newVal);
        this.fetchFichierClient(this.restaurantId);
      }
      if (newVal === "Joueurs") {
        localStorage.setItem('selectedSection', newVal);
        this.fetchJoueurs(this.restaurantId);
      }
      if (newVal === "Roulette") {
        localStorage.setItem('selectedSection', newVal);
        this.fetchAndUpdateRoueRestaurant(this.restaurantId);
      }
    },
    restaurantData: {
      deep: true,
      handler() {
        console.log("Restaurant changed", this.restaurantData);
        this.updateSegments();
      },
    },
  },
  computed: {
    computedMenuItems() {
      return this.menuItems.map(item => ({
        ...item,
        active: item.text === this.selectedSection
      }));
    },
    nombreDeCadeaux() {
      // Assurez-vous que segmentNumber est bien un nombre et qu'il reflète le nombre actuel de cadeaux
      return this.restaurantData.segmentNumber;
    },
    filteredUsers: function () {
      if (this.filter === "all") {
        return this.JoueursUsers;
      } else if (this.filter === "Pas encore récupérer") {
        return this.JoueursUsers.filter((user) => user.valide);
      } else if (this.filter === "Récupérer") {
        return this.JoueursUsers.filter((user) => !user.valide);
      }
    },
    sortedJoueursUsers() {
      const filtered = this.filteredUsers; // Utilisez filteredUsers pour le filtre valide/pas encore récupérer
      return filtered.sort((a, b) => {
        let valueA = a[this.currentSortColumn];
        let valueB = b[this.currentSortColumn];
  
        // Convertir les dates en objets Date pour le tri par dateDeVisite
        if (this.currentSortColumn === "dateDeVisite") {
          valueA = new Date(valueA);
          valueB = new Date(valueB);
        }
  
        if (valueA < valueB) return this.sortAscending ? -1 : 1;
        if (valueA > valueB) return this.sortAscending ? 1 : -1;
        return 0;
      });
    },
    sortedUsers() {
      return [...this.users].sort((a, b) => {
        let valueA = a[this.currentSortColumn];
        let valueB = b[this.currentSortColumn];

        if (this.currentSortColumn === "dateDeVisite") {
          valueA = new Date(valueA);
          valueB = new Date(valueB);
        }

        if (valueA < valueB) return this.sortAscending ? -1 : 1;
        if (valueA > valueB) return this.sortAscending ? 1 : -1;
        return 0;
      });
    },
    timeframeTitle() {
      const titles = {
        "all-time": "Les données sont calculées sans filtre de dates",
        "this-week": "Les données sont calculées sur les 7 derniers jours",
        "this-month": "Les données sont calculées pour les 30 derniers jours",
        "last-six-months":
          "Les données sont calculées pour les 6 derniers mois",
      };
      return titles[this.selectedTimeframe];
    },
  },
  methods: {
    selectMenuItem(item) {
      this.selectedSection = item.text;
      localStorage.setItem('selectedSection', item.text);
      
      if (this.selectedSection === "Dashboard") {
        this.fetchDonutChartData(this.restaurantId, this.selectedTimeframe);
      }
      if (this.selectedSection === "Fichier clients") {
        this.fetchFichierClient(this.restaurantId);
      }
      if (this.selectedSection === "Joueurs") {
        this.fetchJoueurs(this.restaurantId);
      }
      if (this.selectedSection === "Roulette") {
        this.fetchAndUpdateRoueRestaurant(this.restaurantId);
      }
    },
    toggleSidebar() {
      this.sidebarVisible = !this.sidebarVisible;
    },
    // Chart for Donuts => Dashboard
    renderChartDonut() {
      if (this.donutChartInstance) {
        this.donutChartInstance.destroy();
      }
      const donutCtx = this.$refs.DonutCanvas.getContext("2d");
      this.donutChartInstance = new Chart(donutCtx, {
        type: "doughnut",
        data: {
          labels: this.donutChartData.map((item) => item.label),
          datasets: [
            {
              data: this.donutChartData.map((item) => item.value),
              backgroundColor: this.donutChartData.map((item) => item.color),
              borderWidth: 0, // Set this to 0 if you don't want borders on the segments
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutoutPercentage: 60, // This may need to be adjusted to 'cutout' for Chart.js version 3.x
          legend: {
            display: true,
            position: "right", // This positions the legend to the right of the chart
            labels: {
              boxWidth: 20, // Size of the legend color box
              padding: 16, // Padding between legend items
              // Optionally customize font size, color, etc.
              fontSize: 12,
              fontColor: "#333",
              fontStyle: "normal",
              fontFamily: "'Helvetica Neue', 'Helvetica', 'Arial', sans-serif",
            },
          },
          tooltips: {
            callbacks: {
              label: function (tooltipItem, data) {
                let label = data.labels[tooltipItem.index] || "";
                if (label) {
                  label += ": ";
                }
                const value = data.datasets[0].data[tooltipItem.index];
                label += `${value}%`;
                return label;
              },
            },
          },
          // Additional customization here if needed
        },
      });
    },
    // Fetch DATA => Dashboard
    async fetchDonutChartData(restaurantId, timeframe) {
      try {
        const response = await fetch(
          this.SERVER_URL + `/Dashboard/${restaurantId}/${timeframe}`
        );
        if (!response.ok) {
          throw new Error("Network response was not ok");
        }
        const { donutData, barData, stats, gainsData } = await response.json();

        // Mettre à jour les données des graphiques
        this.donutChartData = donutData;
        this.barChartData = barData;
        this.stats = stats;
        this.nbCadeaux = gainsData;
        this.renderChartDonut();
      } catch (error) {
        console.error("Fetch Donut Chart Data Error:", error);
        // Gérer l'erreur côté client, par exemple, afficher un message d'erreur
      }
    },
    // Fetch DATA => Fichier clients
    async fetchFichierClient(restaurantId) {
      try {
        const response = await fetch(
          this.SERVER_URL + `/Users/${restaurantId}`
        );
        if (!response.ok) {
          throw new Error("Network response was not ok");
        }
        const users = await response.json();

        // Mettre à jour les données des graphiques
        this.users = users;
      } catch (error) {
        console.error("Fetch users Data Error:", error);
      }
    },
    sortTable(column) {
      if (this.currentSortColumn === column) {
        this.sortAscending = !this.sortAscending;
      } else {
        this.currentSortColumn = column;
        this.sortAscending = true;
      }
    },
    exportToCSVClients() {
      // Construire un nouveau tableau d'objets avec les propriétés désirées
      const dataToExport = this.users.map((user) => ({
        prenom: user.prenom,
        telephone: user.telephone,
        email: user.email,
        dateDeVisite: user.dateDeVisite,
      }));

      // Utiliser PapaParse pour convertir les données en CSV
      const csv = Papa.unparse(dataToExport);

      // Créer un objet Blob avec les données CSV
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });

      // Créer un lien pour le téléchargement
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", "Clients_PiglyAgency.csv");
      link.style.visibility = "hidden";

      // Ajouter le lien au document et cliquer dessus
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    },
    validateForm() {
      // Reset errors
      this.formErrors = {
        prenom: '',
        nom: '',
        email: '',
        telephone: ''
      };
      
      let isValid = true;
      
      // Validate prenom
      if (!this.newCustomer.prenom) {
        this.formErrors.prenom = "Veuillez saisir votre prénom";
        isValid = false;
      }
      // Validate nom
      if (!this.newCustomer.nom) {
        this.formErrors.nom = "Veuillez saisir votre Nom";
        isValid = false;
      }
      
      // Validate email with regex
      const regex = /^[\w._%+-]+@[\w.-]+\.[a-zA-Z]{2,}$/;
      if (!regex.test(this.newCustomer.email)) {
        this.formErrors.email = "Veuillez saisir une adresse e-mail valide";
        isValid = false;
      }
      
      // Validate telephone
      if (!this.newCustomer.telephone.startsWith("+")) {
        this.formErrors.telephone = "Le numéro de téléphone doit être au format international";
        isValid = false;
      }
      
      return isValid;
    },
    async addCustomer() {
      if (this.validateForm()) {
        // Convert the date to a timestamp for Firestore
        const dateDeVisiteTimestamp = this.newCustomer.dateDeVisite
          ? new Date(`${this.newCustomer.dateDeVisite}T12:00:00Z`).toISOString()
          : null;
  
        const customerData = {
          ...this.newCustomer,
          dateDeVisite: dateDeVisiteTimestamp
        };
  
        try {
          this.isSubmitting = true;
          const response = await fetch(
            `${this.SERVER_URL}/AddManualClient/${this.restaurantId}`, 
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(customerData)
            }
          );
  
          if (!response.ok) {
            throw new Error("Network response was not ok");
          }
  
          // Assume the server sends back the added customer with an id field
          const addedCustomer = await response.json();
          this.users.push({
            ...addedCustomer,
            // Convert timestamp back to the format needed for display
            dateDeVisite: this.newCustomer.dateDeVisite
          });
          this.showCreateCustomerForm = false;
        } catch (error) {
          console.error("Error adding customer:", error);
        } finally {
          this.isSubmitting = false;
        }
      }
    },
    closeForm() {
      this.showCreateCustomerForm = false;
      this.newCustomer = {
        prenom: '',
        nom: '',
        email: '',
        telephone: '',
        dateDeVisite: ''
      };
      this.formErrors = {
        prenom: '',
        nom: '',
        email: '',
        telephone: ''
      };
    },
    // Fetch DATA => Joueurs
    async fetchJoueurs(restaurantId) {
      try {
        const response = await fetch(
          this.SERVER_URL + `/Joueurs/${restaurantId}`
        );
        if (!response.ok) {
          throw new Error("Network response was not ok");
        }
        const JoueursUsers = await response.json();

        //Mise à jour des données
        this.JoueursUsers = JoueursUsers;
      } catch (error) {
        console.error("Fetch Joueurs Data Error:", error);
      }
    },
    toggleSidebar: function () {
      this.sidebarVisible = !this.sidebarVisible;
    },
    selectMenuItem: function (selectedItem) {
      this.menuItems.forEach((item) => {
        item.active = false;
      });
      selectedItem.active = true;
      this.selectedSection = selectedItem.text; // Update the selected section
    },
    setFilter: function (filter) {
      this.filter = filter;
    },
    filterTable: function (filter) {
      // For now, we're not actually filtering, just logging to the console
      console.log("Filtering table by:", filter);
      // Here you would implement the actual filter logic
    },
    /* Pour la roulette */
    async fetchAndUpdateRoueRestaurant(restaurantId) {
      await this.fetchRoueRestaurant(restaurantId);
      this.updateSegments();
      this.initialiserCouleursParDefaut();
    },
    async fetchRoueRestaurant(restaurantId) {
      try {
        const response = await fetch(
          this.SERVER_URL + `/Roulette/${restaurantId}`
        );
        if (!response.ok) {
          throw new Error("Problème de réponse du réseau");
        }
        this.restaurantData = await response.json();
        console.log("Les données reçu du serveur sont :", this.restaurantData);
      } catch (error) {
        console.error(
          "Erreur lors de la récupération des détails du restaurant :",
          error
        );
      }
    },
    ajouterCadeau() {
      // Incrémentez le compteur de segments
      this.restaurantData.segmentNumber += 1;
      let nextIndex = this.restaurantData.segmentNumber;

      // Ajoutez les propriétés pour le nouveau cadeau
      Vue.set(this.restaurantData, `cadeau${nextIndex}`, "");
      Vue.set(this.restaurantData, `probabilite${nextIndex}`, "");
      Vue.set(this.restaurantData, `condition-cadeau${nextIndex}`, "");
      Vue.set(this.restaurantData, `cadeau${nextIndex}-validite`, "");

      // Déterminez les couleurs en fonction de l'index pair ou impair
      let couleurSegment =
        nextIndex % 2 === 0
          ? this.couleursParDefaut.pair.segment
          : this.couleursParDefaut.impair.segment;
      let couleurTexte =
        nextIndex % 2 === 0
          ? this.couleursParDefaut.pair.texte
          : this.couleursParDefaut.impair.texte;

      Vue.set(
        this.restaurantData,
        `couleur-segment${nextIndex}`,
        couleurSegment
      );
      Vue.set(
        this.restaurantData,
        `couleur-texte-segment${nextIndex}`,
        couleurTexte
      );
    },
    supprimerCadeau(indexSupprime) {
      if (this.restaurantData.segmentNumber > 4) {
        // Boucle pour réorganiser les cadeaux
        for (
          let i = indexSupprime;
          i < this.restaurantData.segmentNumber;
          i++
        ) {
          // Décalez chaque cadeau suivant vers le bas
          this.restaurantData[`cadeau${i}`] =
            this.restaurantData[`cadeau${i + 1}`] || "";
          this.restaurantData[`probabilite${i}`] =
            this.restaurantData[`probabilite${i + 1}`] || "";
          this.restaurantData[`condition-cadeau${i}`] =
            this.restaurantData[`condition-cadeau${i + 1}`] || "";
          this.restaurantData[`cadeau${i}-validite`] =
            this.restaurantData[`cadeau${i + 1}-validite`] || "";

          // Recalculer les couleurs pour l'index courant
          let couleurSegment =
            i % 2 === 0
              ? this.couleursParDefaut.pair.segment
              : this.couleursParDefaut.impair.segment;
          let couleurTexte =
            i % 2 === 0
              ? this.couleursParDefaut.pair.texte
              : this.couleursParDefaut.impair.texte;
          this.restaurantData[`couleur-segment${i}`] = couleurSegment;
          this.restaurantData[`couleur-texte-segment${i}`] = couleurTexte;
        }

        // Supprimer le dernier cadeau (en double)
        const dernierIndex = this.restaurantData.segmentNumber;
        Vue.delete(this.restaurantData, `cadeau${dernierIndex}`);
        Vue.delete(this.restaurantData, `probabilite${dernierIndex}`);
        Vue.delete(this.restaurantData, `condition-cadeau${dernierIndex}`);
        Vue.delete(this.restaurantData, `cadeau${dernierIndex}-validite`);
        Vue.delete(this.restaurantData, `couleur-segment${dernierIndex}`);
        Vue.delete(this.restaurantData, `couleur-texte-segment${dernierIndex}`);

        // Décrémenter le segmentNumber
        this.restaurantData.segmentNumber -= 1;
      } else {
        // Afficher une alerte si l'utilisateur essaie de supprimer un cadeau et qu'il en reste seulement quatre
        this.alerteVisible = true;
        this.alerteMessage = "Minimum 4 cadeaux pour votre roue";
        setTimeout(() => {
          this.alerteVisible = false;
        }, 5000);
      }
    },
    // Trouvez les couleurs des premiers deux cadeaux pour définir les couleurs pair et impair
    initialiserCouleursParDefaut() {
      if (
        this.restaurantData["couleur-segment1"] &&
        this.restaurantData["couleur-texte-segment1"]
      ) {
        this.couleursParDefaut.impair.segment =
          this.restaurantData["couleur-segment1"];
        this.couleursParDefaut.impair.texte =
          this.restaurantData["couleur-texte-segment1"];
      }
      if (
        this.restaurantData["couleur-segment2"] &&
        this.restaurantData["couleur-texte-segment2"]
      ) {
        this.couleursParDefaut.pair.segment =
          this.restaurantData["couleur-segment2"];
        this.couleursParDefaut.pair.texte =
          this.restaurantData["couleur-texte-segment2"];
      }
      console.log(this.couleursParDefaut);
    },
    updateSegments() {
      this.segments = [];
      for (let i = 1; i <= this.nombreDeCadeaux; i++) {
        if (this.restaurantData[`cadeau${i}`]) {
          this.segments.push({
            label: this.restaurantData[`cadeau${i}`],
            color: this.restaurantData[`couleur-segment${i}`],
            probability: parseInt(this.restaurantData[`probabilite${i}`], 10),
            textColor: this.restaurantData[`couleur-texte-segment${i}`],
          });
        }
      }
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
    getLineCoordinates(index, numSegments) {
      const radius = this.outerRadius; // Assurez-vous que cette valeur est définie et correcte
      let angle = index * (360 / numSegments);

      // Ajustez l'angle si nécessaire pour les nombres spécifiques de segments
      if (numSegments === 5) {
        angle -= 18;
      } else if (numSegments === 6) {
        // Pour 6 segments, l'angle de 60 degrés est ajusté de 30 degrés pour chaque ligne de séparation
        angle += 30;
      } else if (numSegments === 7) {
        angle += 13;
      } else if (numSegments === 8) {
        // Pas besoin d'ajustement pour 8 segments car 45 degrés * index donne les angles corrects
      }

      const radians = this.degreesToRadians(angle);
      return {
        x2: radius * Math.cos(radians),
        y2: radius * Math.sin(radians),
      };
    },
    async publierDonnees() {
      const resultatVerification = this.verifierDonnees();
      this.showCard = false;
      if (resultatVerification === null) {
        this.chargementEnCours = true; // Commence le chargement
        try {
          const response = await fetch(
            this.SERVER_URL + "/updateRestaurantData/" + this.restaurantId,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(this.restaurantData),
            }
          );

          if (!response.ok) {
            throw new Error("Erreur lors de la mise à jour des données");
          }
          this.alerteMessage = "Données mises à jour avec succès.";
          setTimeout(() => {
            this.alerteVisible = false;
          }, 5000);
        } catch (error) {
          console.error("Erreur lors de la mise à jour:", error);
          this.alerteMessage = "Erreur lors de la mise à jour des données";
        } finally {
          this.chargementEnCours = false; // Arrête le chargement
          this.displayCardWithQrCode(this.restaurantId);
        }
      } else {
        this.alerteMessage = resultatVerification;
      }
      this.alerteVisible = true;
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
    /* Verification des données */
    verifierDonnees() {
      // Vérifier le nombre de cadeaux
      if (this.nombreDeCadeaux > 10) {
        return "Le nombre de cadeaux ne doit pas dépasser 10.";
      }

      let sommeProbabilites = 0;

      for (let i = 1; i <= this.nombreDeCadeaux; i++) {
        // Vérifier si les champs de chaque cadeau sont bien remplis
        const cadeau = this.restaurantData["cadeau" + i];
        const probabilite = this.restaurantData["probabilite" + i];
        const validite = this.restaurantData["cadeau" + i + "-validite"];

        if (!cadeau || cadeau.length > 30) {
          return `Le nom du cadeau ${i} doit être rempli et ne doit pas dépasser 30 caractères (actuellement ${
            cadeau ? cadeau.length : 0
          }/30).`;
        }

        if (
          probabilite === undefined ||
          probabilite === null ||
          isNaN(probabilite)
        ) {
          return `La probabilité pour le cadeau ${i} doit être un nombre valide.`;
        }

        sommeProbabilites += parseFloat(probabilite);

        if (validite !== "now" && validite !== "next") {
          return `La validité pour le cadeau ${i} doit être définie à 'now' ou 'next'.`;
        }
      }

      // Vérifier si la somme des probabilités est égale à 100
      if (sommeProbabilites !== 100) {
        return `La somme des probabilités doit être égale à 100 (actuellement ${sommeProbabilites}).`;
      }

      return null; // Toutes les vérifications sont passées
    },
    logout() {
      // Supprimer toutes les données du localStorage
      localStorage.clear();
  
      // Rafraîchir la page pour appliquer les changements
      window.location.reload();
    },
  },
});
