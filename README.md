# Calendar Pro pour les Cours INSA Lyon

Cette application web aide les étudiants de l'INSA Lyon à gérer leur emploi du temps lors de l'assistance à des cours de 4ème année (4A) et de 3ème année (3A).

## Caractéristiques

- Récupération automatique des fichiers iCalendar depuis le site de l'INSA pour les cours de 4A et 3A
- Choix des groupes de 3A (1, 2 et/ou 3) à inclure
- Affichage de tous les cours de 4A groupe 3 (obligatoires)
- Sélection des cours de 3A auxquels vous souhaitez assister
- Mise en évidence des conflits entre les cours de 4A et les cours sélectionnés de 3A
- Calendrier interactif avec détails des cours au clic

## Prérequis

- Node.js (v14+)
- npm (v6+)

## Installation

1. Clonez ce dépôt
2. Installez les dépendances:
```
npm install
```
3. Démarrez le serveur:
```
npm start
```
4. Accédez à l'application dans votre navigateur: `http://localhost:3000`

## Utilisation

1. Ouvrez l'application dans votre navigateur
2. Cliquez sur "Charger 4A Groupe 3" pour récupérer le calendrier 4A
3. Sélectionnez les groupes de 3A que vous souhaitez inclure (1, 2 et/ou 3)
4. Cliquez sur "Charger calendriers 3A" pour récupérer ces calendriers
5. Sélectionnez les cours de 3A qui vous intéressent
6. Le calendrier affichera tous les cours et mettra en évidence les conflits

## Fonctionnement technique

Cette application utilise un serveur Node.js avec Express pour contourner les restrictions CORS. Le serveur agit comme un proxy qui fait des requêtes serveur-à-serveur vers le site de l'INSA et récupère les calendriers iCalendar, qui sont ensuite traités et affichés par l'application frontend.

Si les calendriers ne peuvent pas être récupérés depuis le site de l'INSA, l'application utilisera un calendrier exemple inclus dans le projet.

## Comprendre l'affichage

- **Événements bleus** : Cours de 4A (obligatoires)
- **Événements verts** : Cours de 3A sélectionnés sans conflit
- **Événements rouges rayés** : Cours de 3A en conflit avec les cours de 4A

## Détails techniques

Cette application utilise :
- Node.js et Express pour le serveur backend
- Axios pour les requêtes HTTP
- FullCalendar.js pour l'affichage du calendrier
- ical.js pour l'analyse des fichiers iCalendar
- Bootstrap pour le style

## Déploiement

Pour déployer cette application sur un serveur:

1. Transférez tous les fichiers sur votre serveur
2. Installez Node.js et npm si ce n'est pas déjà fait
3. Exécutez `npm install` pour installer les dépendances
4. Démarrez le serveur avec `npm start` ou utilisez un gestionnaire de processus comme PM2:
```
npm install -g pm2
pm2 start server.js
