new Vue({
  el: "#app",
  data: {
    restaurantData: {
      restaurantName: "test",
      "url-img-header": "",
      "url-logo-central": "",
      prepositionSlogan: "",
      restaurantNameCourt: "",
      couleurSelecteur: "",
      // ... autres données
    },
    segments: [
      // Exemple de segments, vous pouvez les initialiser selon vos besoins
      { label: "Cadeau 1", color: "#FF0000", textColor: "#FFFFFF" },
      // ... autres segments
    ],
  },
  methods: {
    updatePreview() {
      // Logique de mise à jour de l'aperçu
    },
    getSegmentPath(index) {
      // Votre logique pour le chemin du segment
      const numSegments = this.segments.length;
      const anglePerSegment = (Math.PI * 2) / numSegments;
      const startAngle = index * anglePerSegment;
      const endAngle = startAngle + anglePerSegment;

      const startX = this.outerRadius * Math.cos(startAngle - Math.PI / 2);
      const startY = this.outerRadius * Math.sin(startAngle - Math.PI / 2);
      const endX = this.outerRadius * Math.cos(endAngle - Math.PI / 2);
      const endY = this.outerRadius * Math.sin(endAngle - Math.PI / 2);

      return `M ${startX} ${startY} A ${this.outerRadius} ${this.outerRadius} 0 0 1 ${endX} ${endY} L 0 0`;
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
    degreesToRadians(degrees) {
      return (degrees * Math.PI) / 180;
    },
    getTspansForSegment(segmentLabel) {
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
      return [segmentLabel];
    },
  },
  computed: {
    outerRadius() {
      return this.wheelSize / 2;
    },
    wheelSize() {
      return 350; // Taille fixe pour l'instant, peut être rendue dynamique si nécessaire
    },
  },
  mounted() {
    // Initialisation ou chargement des données si nécessaire
  },
});
