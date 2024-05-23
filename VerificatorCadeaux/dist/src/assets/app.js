new Vue({
  el: "#app",
  data: {
      // Affichage
      afficherChargement: true,
      valid: false,
      wrong: false,
      dateClaimError: false,
      alreadyClaimError: false,
      api: "https://api2.pigly.fr/",
      //api: "http://localhost:3003/",

      // Erreur
      error: false,
      errorMessage: "",

      // Données
      collection: null,
      idUtilisateur: null,
      gain: null,
      dateValidation: "",
      dateCreation: "",
      dateScanner: "",
      condition: "",
      prenom: "",
      ServerMessage: "",

  },
  mounted() {
      const params = Qs.parse(location.search, { ignoreQueryPrefix: true });
      this.collection = params.collection;
      this.idUtilisateur = params.idUtilisateur;
      this.gain = params.gain;
      this.verifyParams();
      },
  methods: {
      verifyParams() {
          if (!this.collection || !this.idUtilisateur || !this.gain || typeof this.collection !== "string" || typeof this.idUtilisateur !== "string" || typeof this.gain !== "string") {
              this.error = true;
              this.errorMessage = "Paramètres de l'URL invalides ou manquants";
              return;
          }

          this.checkUserData();
      },
      async checkUserData() {
        try {
            const response = await axios.post(this.api + "verification", {

            collection: this.collection,
                idUtilisateur: this.idUtilisateur,
                gain: this.gain,
            });
            console.log(response.data);
            if (response.status === 200 && response.data.utilisateurFound && response.data.gainIsValid) {
                this.wrong = false; 
                this.valid = true;
                this.gain = response.data.gain;
                this.prenom = response.data.prenom;
                this.afficherChargement = false;
                this.condition = response.data.condition;
            } else if (response.status === 200 && response.data.utilisateurFound === false) {
                this.error = true;
                this.errorMessage = response.data.message;
                this.afficherChargement = false;
            } else if (response.status === 200 && response.data.utilisateurFound) {
              this.wrong = true;              
              switch (response.data.errorCode) {
                  case "DATE_EXPIRED":
                      this.dateClaimError = true;
                      this.prenom = response.data.prenom;
                      this.dateValidation = response.data.dateValidation;
                      this.dateCreation = response.data.dateCreation;
                      break;
                  case "QR_ALREADY_VALIDATED":
                    this.prenom = response.data.prenom;
                    this.alreadyClaimError = true;
                    this.dateScanner = response.data.dateScanner;
                      break;
                  default:
                      break;
              }
              this.ServerMessage = response.data.message;
              this.afficherChargement = false;
            }
        } catch (error) {
            this.handleError(error);
        }
    },
       
      handleError(error) {
        this.error = true;
        this.errorMessage = "Une erreur est survenue lors de la vérification du QRCode.";
        console.error("Erreur lors de la vérification :", error);
    },    
  },
});