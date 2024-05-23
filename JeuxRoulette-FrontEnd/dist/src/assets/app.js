new Vue({
  el: "#app",
  // Toutes les données

  data: {
    // Informations du restaurant
    idRestaurant: window.location.pathname.split("/")[1],
    idDocument: "",

    //api: "http://localhost:3003/",
    api: "https://api2.pigly.fr/",
    restaurantData: {
      "url-logo-central": "",
      couleurSelecteur: "white",
      restaurantName: "Restaurant",
      restaurantSlogan: "",
      verbeDuFormulaire: "occupe",
      restaurantNameCourt: "Restaurant",
      prepositionSlogan: "du",
      boutonColor: "white",
      sloganColor: "",
    },
    restaurantMessage: "Le restaurant vous envoi votre cadeau par SMS.",
    wheelSize: 350,
    outerRadius: 175, // Half the size of the wheel
    segments: [],
    segmentProbabilities: [],

    // pour stocker l'image préchargée
    preloadedGiftImg: null,

    // ERREUR 404
    page: true,
    error: false,
    errorMessage: "",

    // Roue
    wheelSpin: false,
    btnShowForm: true,

    // Apparition, Disparition des popups
    afficherPopup: false,
    afficherChargement: false,
    afficherSuccess: false,
    afficherFlou: false,
    afficherFlouApresGain: false,
    redirectionTime: null,
    ready: false,
    afficherPopupApresGain: false,

    // Affichage et informations du futur gagnant
    afficherForm: false,
    isSubmitting: false,
    prenom: "",
    telephone: "",
    email: "",
    formSubmitted: false,
    recevoirCadeaux: false,
    prenomError: "",
    telephoneError: "",
    emailError: "",

    // Affichage des cadeaux
    tsparticles: false,
    winningMessage: false,
    gaintext: "",
  },
  // Ordre des script et des fonctions lors du chargement de la page
  async mounted() {
    // Vérifier si le cookie existe
    const hasSeenPopup = Cookies.get("hasSeenPopup");
    console.log("hasSeenPopup", hasSeenPopup);

    // Processus normal de chargement
    this.afficherFlou = true;
    this.afficherChargement = true;

    await this.chargerInformationsRestaurant();
    if (this.idRestaurant.startsWith("Vr3ncYbiqZ1s7bxcVL5E")) {
      // Redirection vers la nouvelle URL
      window.location.href = '/V2PGVr3ncYbiqZ1s7bxcVL5E';
    }
    this.afficherChargement = false;

    // Afficher le popup seulement si l'utilisateur ne l'a pas déjà vu
    if (this.idRestaurant.startsWith("V2PG")) {
      this.afficherFlou = false;
      this.afficherPopup = false;
    } 

    if (!this.idRestaurant.startsWith("V2PG") && !hasSeenPopup) {
      this.afficherFlou = true;
      this.afficherPopup = true;
      this.popupTitle = "Votre avis compte !";
    }

    else {
      this.afficherFlou = false;
      this.afficherPopup = false;
    }

    document.addEventListener("visibilitychange", this.showLoadingOnTabFocus);
    window.addEventListener("keyup", this.handleKeyUp);
  },
  // Fonction pour détruire les popups
  beforeDestroy() {
    document.removeEventListener(
      "visibilitychange",
      this.showSuccessMessage,
      this.showLoadingOnTabFocus
    );
    window.removeEventListener("keyup", this.handleKeyUp);
  },
  // Fonction pour valier les champs du formulaire
  computed: {
    isValid: function () {
      return (
        this.isPrenomValid() && this.isTelephoneValid() && this.isEmailValid()
      );
    },
  },
  // Toutes les fonctions
  methods: {
    // Fonction pour valider si l'ID est conforme aux attentes
    async validerIdRestaurant(id) {
      // Vérifie que l'ID n'est pas vide, qu'il ne contient que des caractères alphanumériques et qu'il a une longueur d'au moins 1
      const regex = /^[a-z0-9]{17,25}$/i;
      return regex.test(id);
    },
    // Fonction pour récuperer les informations du restaurant
    async chargerInformationsRestaurant() {
      try {
        // Valide l'ID du restaurant
        if (!this.validerIdRestaurant(this.idRestaurant)) {
          throw new Error("ID du restaurant invalide");
        }

        // Récupère les informations du restaurant
        const response = await fetch(
          this.api + `restaurant/${this.idRestaurant}`
        );
        if (response.ok) {
          const data = await response.json();

          // Mettre à jour les données du restaurant
          this.restaurantData["url-logo-central"] = data["url-logo-central"];
          this.restaurantData["url-img-header"] = data["url-header"];
          this.restaurantData.restaurantName = data["Nom-du-restaurant"];
          this.restaurantData.restaurantNameCourt =
            data["Simple-nom-du-restaurant"];
          this.restaurantData.restaurantSlogan = data["slogan"];
          this.restaurantData.boutonColor = data["couleur-bouton"];
          this.restaurantData.sloganColor = data["couleur-slogan"];
          this.restaurantData.verbeDuFormulaire = data["verbe-du-formulaire"];
          this.restaurantData.prepositionSlogan = data["preposition-slogan"];
          this.restaurant = data;
          this.restaurantData["couleurSelecteur"] = data["couleur-selecteur"];
          document.documentElement.style.setProperty(
            "--text-color",
            this.restaurantData.boutonColor
          );
          document.documentElement.style.setProperty(
            "--slogan-color",
            this.restaurantData.sloganColor
          );
          this.loadAndChangeSVGColor(this.restaurantData.boutonColor, [
            "svgContainer1",
            "svgContainer2",
            "svgContainer3",
          ]);

          // Création dynamique des segments
          this.segments = [];
          for (let i = 1; i <= data.segmentNumber; i++) {
            this.segments.push({
              label: data[`cadeau${i}`],
              color: data[`couleur-segment${i}`],
              probability: data[`probabilite${i}`],
              textColor: data[`couleur-texte-segment${i}`],
            });
          }
        } else if (response.status == 404) {
          this.error404 = true;
        } else {
          throw new Error(
            "Erreur lors de la récupération des informations du restaurant"
          );
        }
      } catch (error) {
        this.error = true;
        this.errorMessage =
          "Oh, non mince il semble que vous ayez atterit sur une mauvaise page.. :(, ou alors on a un problème de connexion...";
        this.page = false;
        console.error(
          "Erreur lors de la récupération des informations du restaurant :",
          error
        );
      }
    },

    // Fonction pour charger le SVG et changer la couleur
    async loadAndChangeSVGColor(color, selectors) {
      try {
        const svgResponse = await fetch(
          "./src/assets/pop-up/verify-certif.svg"
        );
        const svgText = await svgResponse.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(svgText, "image/svg+xml");
        const path = doc.querySelector("path");

        if (path) {
          path.setAttribute("fill", color);
          const svgFinal = doc.documentElement.outerHTML;

          selectors.forEach((selector) => {
            const elements = this.$refs[selector];
            if (elements) {
              if (Array.isArray(elements)) {
                elements.forEach((el) => (el.innerHTML = svgFinal));
              } else {
                elements.innerHTML = svgFinal;
              }
            }
          });
        } else {
          console.error("Élément 'path' introuvable dans le SVG");
        }
      } catch (error) {
        console.error("Erreur lors du chargement du SVG :", error);
      }
    },

    // Cette méthode génère un chemin pour le texte de chaque segment
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
    degreesToRadians(degrees) {
      return (degrees * Math.PI) / 180;
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

    // Fonction pour rediriger vers la fonction de redirection de Google
    redirigerVersGoogle() {
      if (!document.hidden) {
        this.afficherPopup = false;
        this.afficherFlou = false; // Ajouté pour cacher le flou
        this.redirectionTime = Date.now();
        this.ouvrirGoogle();
      }
    },
    // Fonction pour Ouvrir la page de GoogleMyBusiness
    ouvrirGoogle(i) {
      const t =
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
          navigator.userAgent
        );
      let r;
      t
        ? (r = `https://g.page/r/${this.restaurant.googlePage}/review`)
        : (r = `https://g.page/r/${this.restaurant.googlePage}/review`),
        i || window.open(r, "_blank");
    },
    // Fonction pour afficher le chargement ou non etc...
    showLoadingOnTabFocus() {
      if (document.hidden || this.ready) return;
      const elapsedTime = Date.now() - this.redirectionTime;

      if (elapsedTime < 3e3) {
        this.loadAndChangeSVGColor(this.restaurantData.boutonColor, [
          "svgContainer1",
          "svgContainer2",
          "svgContainer3",
        ]);
        this.afficherPopup = true;
        this.popupTitle = "Avez-vous bien compris ?";
        this.afficherFlou = true;
        return;
      }

      let displayTime = elapsedTime < 4e3 ? 5e3 : 4e3;

      this.afficherChargement = true;
      this.afficherFlou = true;
      setTimeout(() => {
        this.showSuccessMessage();
        // Définir un cookie pour indiquer que l'utilisateur a vu le popup
        Cookies.set("hasSeenPopup", "true", { expires: 1 }); // Expirera après 1 jour
      }, displayTime);
    },

    // Fonction pour afficher le message de succès
    showSuccessMessage() {
      if (this.afficherChargement == true) {
        this.afficherChargement = false;
        this.afficherSuccess = true;
        setTimeout(() => {
          this.afficherSuccess = false;
          this.afficherFlou = false; // Ajouté pour cacher le flou après la fin de afficherSuccess
          this.ready = true;
        }, 1.5e3);
      }
    },
    // Fonction pour afficher le POP_UP FORMULAIRE
    showPopUpFormulaire() {
      this.afficherForm = true;
      this.afficherFlou = true; // Ajouté pour montrer le flou
      this.popupClass = "popup-animation"; // Classe pour l'animation d'affichage du popup
    },
    isPrenomValid: function () {
      if (this.formSubmitted && this.prenom.length === 0) {
        this.prenomError = "Veuillez saisir votre prénom";
        document.querySelector(".phone-input-wrapper").style.marginTop = "18%";
        return false;
      } else {
        this.prenomError = "";
        document.querySelector(".phone-input-wrapper").style.marginTop = "16%";
        return true;
      }
    },
    isTelephoneValid: function () {
      let i;
      if (this.telephone.startsWith("0")) {
        // Si le numéro commence par un "0", il doit avoir 9 chiffres en + du 0
        i = /^0\d{9}$/;
      } else {
        i = /^(\d{9})$/; // 9 chiffres
      }
      const isValidPhone = this.formSubmitted && !i.test(this.telephone);
      if (isValidPhone) {
        this.telephoneError = "Téléphone invalide";
        document.querySelector(".error-phone").style.position = "absolute";
        document.querySelector(".error-phone").style.right = "10px";
      } else {
        this.telephoneError = " ";
      }
      return !isValidPhone;
    },
    isEmailValid: function () {
      const regex = /^[\w._%+-]+@[\w.-]+\.[a-zA-Z]{2,}$/;
      if (this.formSubmitted && !regex.test(this.email)) {
        this.emailError = "Veuillez saisir une adresse e-mail valide";
        return false;
      } else {
        this.emailError = " ";
        return true;
      }
    },
    async verifierUtilisateurExist(email, telephone, prenom) {
      // Valider l'id du restaurant
      if (!this.validerIdRestaurant(this.idRestaurant)) {
        throw new Error("L'ID du restaurant n'est pas valide.");
      }
      // Valider le Prénom
      if (!this.isPrenomValid(prenom)) {
        throw new Error("Le prénom n'est pas valide.");
      }
      // Valider le téléphone
      if (!this.isTelephoneValid(telephone)) {
        throw new Error("Le numéro de téléphone n'est pas valide.");
      }
      // Valider l'email
      if (!this.isEmailValid(email)) {
        throw new Error("L'adresse email n'est pas valide.");
      }
      const response = await fetch(
        this.api + `${this.idRestaurant}/verifierUtilisateur`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email, telephone }),
        }
      );
      const data = await response.json();

      if (response.ok) {
        return data.exists;
      } else {
        throw new Error(
          data.message ||
            "Erreur réseau lors de la vérification de l'utilisateur."
        );
      }
    },
    // Fonction pour valider le formulaire
    async validerForm() {
      // Marquer le formulaire comme soumis
      this.formSubmitted = true;

      // Validez si le formulaire est correct
      if (this.isValid && !this.isSubmitting) {
        try {
          this.isSubmitting = true;

          // Vérifiez si l'utilisateur existe déjà
          const userExists = await this.verifierUtilisateurExist(
            this.email,
            this.telephone,
            this.restaurant.id
          );

          if (userExists) {
            this.error = true;
            this.errorMessage =
              "Oh, non mince il semble que vous ayez déja joué... Mais vous pouvez toujours aller voir notre insta ;)";
            this.page = false;
          } else {
            // Créer un utilisateur
            const response = await fetch(
              this.api + `${this.idRestaurant}/enregistrerUtilisateur`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  prenom: this.prenom,
                  telephone: this.telephone,
                  email: this.email,
                  recevoirCadeaux: this.recevoirCadeaux,
                }),
              }
            );

            const data = await response.json();
            this.userId = data.userId;
            if (!response.ok) {
              throw new Error(
                data.message ||
                  "Erreur lors de l'enregistrement de l'utilisateur."
              );
            } else {
              this.popupClass = "popup-hide-animation"; // Classe pour l'animation de masquage
              setTimeout(() => {
                this.afficherForm = false;
                this.afficherFlou = false;
              }, 500); // Assurez-vous que cela correspond à la durée de l'animation
              this.startSpin(this.userId); // Lancer la roue
              // faire remonté la page au top avec un leger effet de scroll
              window.scrollTo({
                top: 0,
                behavior: "smooth",
              });
            }
          }
        } catch (error) {
          console.error(
            "Erreur lors de la vérification de l'existence de l'utilisateur :",
            error
          );
        }
      }
    },
    //Fonction pour charger le gif et les img de gains :
    preloadAssets() {
      // Préchargement du GIF
      const giftImg = new Image();
      giftImg.src = "./src/assets/success/cadeaux.gif";
      giftImg.onload = () => {
        this.preloadedGiftImg = giftImg;
      };

      // Préchargement des confettis (si nécessaire)
      // Par exemple, charger le script des confettis ici
      const script = document.createElement("script");
      script.src =
        "https://cdn.jsdelivr.net/npm/tsparticles-confetti@2.9.3/tsparticles.confetti.bundle.min.js";
      document.head.appendChild(script);
    },
    // Start the wheel spinning animation if ENTREE is pressed
    handleKeyUp(event) {
      if (event.key === "Enter" && this.afficherForm) {
        this.validerForm();
      }
    },
    // Fonction pour faire tourner la roue
    async startSpin() {
      this.btnShowForm = false;
      if (this.wheelSpin == false) {
        try {
          // Définir le délai en fonction de l'ID du restaurant
          let delay = this.idRestaurant.startsWith("V2PG") ? 300000 : 7000; // 300000 millisecondes pour 5 minutes, 7000 millisecondes pour 7 secondes

          const response = await fetch(
            this.api + `${this.idRestaurant}/determinerGain`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                docRef: this.userId,
                delay: delay,
              }),
            }
          );

          const data = await response.json();
          if (!response.ok) {
            throw new Error(
              data.message || "Erreur lors de la détermination du gain."
            );
          }
          let finalRotation = data.winningSegmentIndex;
          this.wheelSpinning = true;
          gsap.to(this.$refs.wheelSvg.querySelector(".wheel"), {
            rotation: `+=${finalRotation}`,
            transformOrigin: "50% 50%",
            ease: "power4.out",
            duration: 7,
            onComplete: async () => {
              this.gain = data.winningSegmentLabel;
              console.log(`Le segment gagnant est: ${this.gain}`);
              this.wheelSpinning = false;
            },
          });
        } catch (error) {
          console.error("Erreur lors de la détermination du gain :", error);
        }

        setTimeout(() => {
          this.alertPrize();
        }, 9000);
      }
    },

    alertPrize() {
      this.gaintext = this.gain;
      this.page = false;
      this.winningMessage = true;
      this.tsparticles = true;

      this.$nextTick(() => {
        // Affichage du GIF
        if (this.preloadedGiftImg) {
          const winningGifElement = document.getElementById("winning-gif");
          if (winningGifElement) {
            // Nettoyer les enfants existants s'il y en a
            while (winningGifElement.firstChild) {
              winningGifElement.removeChild(winningGifElement.firstChild);
            }
            winningGifElement.appendChild(this.preloadedGiftImg);
          }
        }

        // Affichage des confettis
        // Supposons que 'displayWinning' est la méthode qui initialise les confettis
        if (typeof this.displayWinning === "function") {
          this.restaurantMessage = "Recevez votre cadeau par sms une fois votre avis publié";
          this.displayWinning();
        }
        console.log("Vérification de l'ID du restaurant");
        setTimeout(async() => {
          // Vérifie si l'ID commence par "V2PG"
        
          if (this.idRestaurant.startsWith("V2PG")) {
            this.afficherFlouApresGain = true;
            this.afficherPopupApresGain = true;
            this.winningMessage = true;
            console.log("Affichage du POPUP");
          }  else {
          // Processus normal de chargement
          console.log("Pas d'affichage du POPUP");
        }
        }, 2500);
        console.log("Fin de la vérification de l'ID du restaurant", this.idRestaurant.startsWith("V2PG"));
      });
    },
    // Fonction pour afficher les confettis
    displayWinning() {
      // Configuration des confettis
      const confettiOptions = {
        spread: 125,
        ticks: 200,
        gravity: 0.3,
        decay: 1,
        startVelocity: 10,
        particleCount: 4, // 4 x particules à la fois
        scalar: 2,
        shapes: ["image"],
        shapeOptions: {
          image: [
            {
              src: "./src/assets/success/point-blanc.png",
              width: 25,
              height: 25,
            },
            {
              src: "./src/assets/success/zigoui-marron.png",
              width: 34,
              height: 34,
            },
            {
              src: "./src/assets/success/leger-zigouigoui.png",
              width: 30,
              height: 30,
            },
            {
              src: "./src/assets/success/zigouigoui-marron.png",
              width: 38,
              height: 38,
            },
            {
              src: "./src/assets/success/serpent-blanc.png",
              width: 29,
              height: 29,
            },
            {
              src: "./src/assets/success/leger-zigouigoui.png",
              width: 39,
              height: 39,
            },
            {
              src: "./src/assets/success/zigoui-marron.png",
              width: 34,
              height: 34,
            },
          ],
        },
      };

      // Fonction pour créer des confettis périodiquement
      function createConfetti() {
        let skew = 1; // Définissez la variable skew ici
        const yOffset = -0.1;
        confetti({
          ...confettiOptions,
          origin: {
            x: Math.random(),
            y: Math.random() * skew - 0.2 + yOffset, // Ajustement vertical
          },
        });
      }

      // Créer une pluie continue de confettis à intervalles réguliers
      const confettiInterval = setInterval(createConfetti, 100); // Réglez l'intervalle comme vous le souhaitez

      // Arrêter la pluie de confettis après un certain délai (par exemple, 5000 ms)
      setTimeout(() => {
        clearInterval(confettiInterval); // Arrêtez l'intervalle
      }, 500000); // Changez cette valeur pour ajuster la durée de la pluie
    },
  },
});
