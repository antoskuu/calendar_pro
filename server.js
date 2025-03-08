const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const cron = require('node-cron');
const app = express();
const port = process.env.PORT || 3001;
const BASE_PATH = '/calendar-pro';
// Activer CORS pour toutes les routes
app.use(cors());

// Servir les fichiers statiques du répertoire actuel
app.use(`${BASE_PATH}`, express.static('public'));

// Créer le dossier de cache s'il n'existe pas
const cacheDir = path.join(__dirname, 'cache');
if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
}

// Configuration des périodes à précharger
const PROMOS = [4, 3];
const GROUPES_4A = [3];  // Uniquement le groupe 3 pour la promo 4
const GROUPES_3A = [1, 2, 3];  // Groupes 1, 2 et 3 pour la promo 3
const WEEK_OFFSETS = [-1, 0, 1, 2];  // Semaines courante, précédente et 2 suivantes

// Durée de validité du cache en millisecondes (24 heures)
const CACHE_DURATION = 24 * 60 * 60 * 1000;
const WEEK_IN_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Calculer le timestamp pour le début d'une semaine spécifique
 * @param {number} weekOffset - Nombre de semaines à ajouter/soustraire par rapport à la semaine actuelle
 * @returns {number} Timestamp en millisecondes pour le début de la semaine demandée
 */
function getWeekTimestamp(weekOffset = 0) {
    // Obtenir la date actuelle
    const now = new Date();
    
    // Déterminer le premier jour de la semaine (lundi = 1, dimanche = 0)
    const dayOfWeek = now.getDay() || 7; // Transformer dimanche (0) en 7
    
    // Calculer le nombre de jours depuis le lundi de la semaine en cours
    const daysFromMonday = dayOfWeek - 1;
    
    // Obtenir le lundi de la semaine en cours
    const monday = new Date(now);
    monday.setDate(now.getDate() - daysFromMonday);
    monday.setHours(0, 0, 0, 0); // Mettre l'heure à minuit
    
    // Ajouter/soustraire des semaines selon l'offset
    const targetDate = new Date(monday);
    targetDate.setDate(monday.getDate() + (weekOffset * 7));
    
    // Retourner le timestamp en millisecondes
    return targetDate.getTime();
}

/**
 * Génère le chemin du fichier de cache pour un calendrier spécifique
 */
function getCacheFilePath(promo, groupe, weekOffset) {
    return path.join(cacheDir, `calendar_${promo}_${groupe}_week${weekOffset}.ical`);
}

/**
 * Vérifie si un fichier de cache est valide (existe et n'est pas expiré)
 */
function isCacheValid(filePath) {
    if (!fs.existsSync(filePath)) {
        return false;
    }

    const stats = fs.statSync(filePath);
    const fileAge = Date.now() - stats.mtime.getTime();
    return fileAge < CACHE_DURATION;
}

/**
 * Télécharge et met en cache un calendrier
 */
async function fetchAndCacheCalendar(promo, groupe, weekOffset) {
    const cacheFile = getCacheFilePath(promo, groupe, weekOffset);
    
    // Si le cache est valide, pas besoin de télécharger à nouveau
    if (isCacheValid(cacheFile)) {
        console.log(`Cache valid for promo ${promo}, groupe ${groupe}, week ${weekOffset}`);
        return true;
    }
    
    // Calculer le timestamp pour la semaine demandée
    const weekTimestamp = getWeekTimestamp(parseInt(weekOffset));
    
    // Construire l'URL
    const url = `https://tc-net.insa-lyon.fr/aff/AffichageEdtPalmGroupe.jsp?promo=${promo}&groupe=${groupe}&dateDeb=${weekTimestamp}`;
    
    console.log(`Fetching calendar from ${url}`);
    
    try {
        // Faire la requête à l'API externe
        const response = await axios.get(url, {
            responseType: 'text',
            headers: {
                'Accept': 'text/calendar',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        
        // Vérifier si nous avons obtenu un calendrier
        if (response.data && response.data.includes('BEGIN:VCALENDAR')) {
            // Sauvegarder dans le cache
            fs.writeFileSync(cacheFile, response.data, 'utf8');
            console.log(`Calendar cached for promo ${promo}, groupe ${groupe}, week ${weekOffset}`);
            return true;
        } else {
            console.log(`Failed to fetch calendar for promo ${promo}, groupe ${groupe}, week ${weekOffset}`);
            return false;
        }
    } catch (error) {
        console.error(`Error fetching calendar for promo ${promo}, groupe ${groupe}, week ${weekOffset}:`, error.message);
        return false;
    }
}

/**
 * Précharge tous les calendriers pour les promos et groupes configurés
 */
async function preloadAllCalendars() {
    console.log('Starting calendar preloading...');
    
    // Précharger les calendriers 4A
    for (const promo of PROMOS) {
        const groupes = promo === 4 ? GROUPES_4A : GROUPES_3A;
        
        for (const groupe of groupes) {
            for (const weekOffset of WEEK_OFFSETS) {
                await fetchAndCacheCalendar(promo, groupe, weekOffset);
                // Petite pause pour éviter de surcharger le serveur INSA
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }
    
    console.log('Calendar preloading completed');
}

// Lancer le préchargement au démarrage du serveur
preloadAllCalendars();

// Programmer un préchargement périodique (tous les jours à minuit)
cron.schedule('0 0 * * *', () => {
    console.log('Running scheduled calendar preloading');
    preloadAllCalendars();
});

// Endpoint pour obtenir les timestamps disponibles pour les semaines à venir
app.get(`${BASE_PATH}/api/weeks`, (req, res) => {
    const weeks = [];
    const currentWeek = Math.floor(Date.now() / WEEK_IN_MS);
    
    // Générer des timestamps pour les 12 semaines suivantes et 4 semaines précédentes
    for (let i = -4; i <= 12; i++) {
        const timestamp = getWeekTimestamp(i);
        const date = new Date(timestamp);
        weeks.push({
            offset: i,
            timestamp: timestamp,
            label: `Semaine du ${date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`
        });
    }
    
    res.json(weeks);
});

// Endpoint pour récupérer un calendrier
app.get(`${BASE_PATH}/api/calendar`, async (req, res) => {
    // Récupérer les paramètres
    const { promo, groupe, weekOffset = 0 } = req.query;
    
    // Valider les paramètres
    if (!promo || !groupe) {
        return res.status(400).json({ error: 'Les paramètres promo et groupe sont requis' });
    }
    
    const cacheFile = getCacheFilePath(promo, groupe, weekOffset);
    
    // Vérifier si nous avons une version en cache valide
    if (isCacheValid(cacheFile)) {
        console.log(`Serving cached calendar for promo ${promo}, groupe ${groupe}, week ${weekOffset}`);
        res.setHeader('Content-Type', 'text/calendar');
        res.setHeader('Content-Disposition', `attachment; filename="calendar-promo${promo}-groupe${groupe}-week${weekOffset}.ical"`);
        return fs.createReadStream(cacheFile).pipe(res);
    }
    
    // Si nous n'avons pas de version en cache valide, télécharger
    const success = await fetchAndCacheCalendar(promo, groupe, weekOffset);
    
    if (success && fs.existsSync(cacheFile)) {
        // Servir le fichier fraîchement téléchargé
        res.setHeader('Content-Type', 'text/calendar');
        res.setHeader('Content-Disposition', `attachment; filename="calendar-promo${promo}-groupe${groupe}-week${weekOffset}.ical"`);
        return fs.createReadStream(cacheFile).pipe(res);
    }
    
    // En cas d'échec, essayer de charger le fichier exemple
    if (promo === '4' && groupe === '3') {
        const fallbackPath = path.join(__dirname, 'Calendar-TC-Groupe.ical');
        if (fs.existsSync(fallbackPath)) {
            console.log('Using fallback calendar file');
            res.setHeader('Content-Type', 'text/calendar');
            res.setHeader('Content-Disposition', `attachment; filename="calendar-fallback.ical"`);
            return fs.createReadStream(fallbackPath).pipe(res);
        }
    }
    
    // Si tout échoue
    res.status(500).json({
        error: 'Impossible de récupérer le calendrier'
    });
});

// Endpoint pour forcer le rechargement des calendriers
app.get(`${BASE_PATH}/api/reload-calendars`, (req, res) => {
    preloadAllCalendars();
    res.json({ success: true, message: 'Calendar reloading started' });
});

// Endpoint pour effacer le cache si nécessaire
app.get(`${BASE_PATH}/api/clear-cache`, (req, res) => {
    calendarCache.clear();
    res.json({ success: true, message: 'Cache cleared successfully' });
});

// Route par défaut
app.get('/', (req, res) => {
    res.redirect(BASE_PATH);
});

// Démarrer le serveur
app.listen(port, () => {
    console.log(`Serveur démarré sur http://localhost:${port}`);
});

// Afficher les instructions d'installation
console.log('\nPour installer les dépendances nécessaires, exécutez:');
console.log('npm init -y');
console.log('npm install express axios cors node-cron\n');
