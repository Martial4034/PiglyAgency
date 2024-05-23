new Vue({
  el: "#app",
  data: {
    // Affichage
    afficherChargement: true,
    page: true,

    // Données
    gain: null,
    qrCodeImageURL: null,
    conditionGain: "",
    achat: "",


    // Dates
    dateCreation: '',
    dateValidation: '',
    dateDebutValidation: null,
    compteARebours: '',
    
    // Erreur
    error: false,
    errorMessage: null,
  },
  methods: {
    onImageLoaded() {
      this.afficherChargement = false;
    },
    updateCompteARebours() {
      const maintenant = new Date();
      const debutValidation = new Date(this.dateDebutValidation);
      const diff = debutValidation - maintenant;
  
      if (diff > 0) {
        const heures = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff / (1000 * 60)) % 60);
        const secondes = Math.floor((diff / 1000) % 60);
  
      
        this.compteARebours = `${heures}:${minutes.toString().padStart(2, '0')}:${secondes.toString().padStart(2, '0')}`;
        // Masquer le chargement
        this.afficherChargement = false;
      } else {
        this.compteARebours = "Vous avez une machine pour aller dans le futur ??";
        clearInterval(this.intervalID);
        // Masquer le chargement
        this.afficherChargement = false;
      }
    },
  },
  destroyed() {
    if (this.intervalID) {
      clearInterval(this.intervalID);
    }
  },  
  mounted() {
    //const api = "http://localhost:3003/"
    const api = "https://api2.pigly.fr/"
    const params = new
    URLSearchParams(window.location.search);
    const collection = params.get("c");
    const idUtilisateur = params.get("i");

    // console.log("Collection:", collection);
    // console.log("ID Utilisateur:", idUtilisateur);

    axios
      .get( api + "getUserData", {
        params: { collection, idUtilisateur },
      })
      .then((response) => {
        console.log("Réponse du serveur:", response.data);
        if (response.status === 201) {
          // Afficher le message si le cadeau n'est pas encore valide
          this.message = response.data.message;
          console.log("Message:", this.message);
          this.gain = response.data.gain;

          // Masquer ou désactiver le lien du QR Code
          this.qrCodeImageURL = null;
          

          this.dateCreation = response.data.dateCreation;
          this.dateValidation = response.data.dateDeValidation;
          this.dateDebutValidation = response.data.dateDebutValidation;
          this.conditionGain = response.data.condition;
          this.achat = response.data.achat;
          
          // Déclencher le compte à rebours
          this.intervalID = setInterval(this.updateCompteARebours, 1000);

        }
        else {
          if (response.status === 200) {
            this.gain = response.data.gain;
            this.qrCodeImageURL = response.data.qrCodeImageURL;
            this.dateCreation = response.data.dateCreation;
            this.dateValidation = response.data.dateDeValidation;
            this.conditionGain = response.data.condition;
            this.achat = response.data.achat;
            console.log("VALIDE");
          }
        }
      })
      .catch((error) => {
        console.error("Erreur lors de la récupération des données:", error);
        this.error = true;
        this.page = false;
        this.errorMessage = "Hmm, le QrCode semble valsifié ou invalide...";
        this.afficherChargement = false;
      });
      
  },
});
