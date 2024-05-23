new Vue({
  el: "#app",
  data: {
    idRedirection: window.location.pathname.split("/")[1],
    //api: "http://localhost:3003/",
    api: "https://main.piglyagency.fr/",
    errorMessage: '',
    loading: true,
  },
  async mounted() {
    axios.get(this.api + `r/${this.idRedirection}`).then((response) => {
      this.loading = false;
      window.location.replace(response.data.url);
    })
    .catch(error => {
      this.loading = false;
      // Gestion des erreurs
      if (error.response && error.response.status === 410) {
        this.errorMessage = 'Ce lien a expiré.';
        console.log(this.errorMessage);
      } else {
        this.errorMessage = 'Une erreur est survenue.';
        console.log(this.errorMessage);
      }
    }); 
  },
});