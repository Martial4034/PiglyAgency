require('dotenv').config();
const Pushover = require('pushover-notifications');
const ovh = require('ovh')({
    endpoint: process.env.ENDPOINT,
    appKey: process.env.APPKEY,
    appSecret: process.env.APPSECRET,
    consumerKey: process.env.CONSUMERKEY,
});
const axios = require('axios');

// Configuration pour les notifications
const push = new Pushover({
    token: process.env.PUSHOVER_TOKEN,
    user: process.env.PUSHOVER_USER_KEY,
});

// Fonction pour purger le cache Cloudflare
async function purgerCacheCloudflare() {
    const urlcloudflare = process.env.URL_CLOUDFLARE;
    const cloudflare_token = process.env.CLOUDFLARE_TOKEN;

    try {
        const response = await axios.post(urlcloudflare, { purge_everything: true }, {
            headers: {
                Authorization: `Bearer ${cloudflare_token}`,
                'Content-Type': 'application/json',
            }
        });

        console.log('Réponse de la purge du cache Cloudflare:', response.data);
    } catch (error) {
        console.error('Erreur lors de la purge du cache Cloudflare:', error);
        throw error;
    }
}

// Fonction pour redémarrer un serveur
async function redemarrerServeur(domain) {
    const serviceName = process.env.SERVICE_NAME;
    try {
        const response = await ovh.requestPromised(
            'POST',
            `/hosting/web/${serviceName}/attachedDomain/${domain}/restart`
        );
        console.log(`Serveur redémarré pour ${domain}`, response);
    } catch (error) {
        console.error(`Erreur lors du redémarrage du serveur pour ${domain}`, error);
        throw error;
    }
}

// Fonction principale pour redémarrer tous les serveurs et purger les caches
async function ToutRedemmarer() {
    const domains = [
        'api2.pigly.fr',
        'roue.piglyagency.fr',
        'main.piglyagency.fr',
        'dashboard.piglyagency.fr',
    ];

    try {
        for (const domain of domains) {
            await redemarrerServeur(domain);
        }
        await purgerCacheCloudflare();

        // Envoi de la notification de succès
        await push.send({
            message: 'Tous les serveurs ont été redémarrés avec succès!',
            title: 'Redémarrage Serveurs',
            sound: 'magic',
            priority: 1
        });
    } catch (error) {
        // Envoi de la notification d'erreur
        await push.send({
            message: 'Échec du redémarrage des serveurs: ' + error.message,
            title: 'Erreur Redémarrage Serveurs',
            sound: 'falling',
            priority: 1
        });
    }
}

// Exécution du script
ToutRedemmarer();
