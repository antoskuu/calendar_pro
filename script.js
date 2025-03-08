document.addEventListener('DOMContentLoaded', function() {
    // Initialiser le mode sombre selon les préférences sauvegardées
    initThemePreference();
    
    // Ajouter l'écouteur pour le switch de thème
    document.getElementById('themeSwitcher').addEventListener('click', toggleTheme);
    
    // Initialize variables to store events
    let events4a = [];
    let allEvents3a = {};  // Object to store events by group
    let selected4aCourses = new Set(); // Pour stocker les cours 4A sélectionnés
    let selected3aCourses = new Set(); // Pour stocker les cours 3A sélectionnés
    let calendar;
    let availableWeeks = [];
    let currentWeekOffset = 0; // Semaine actuelle par défaut
    
    // Chargement des groupes avec vérification immédiate et initialisation du sélecteur
    let courseGroups = loadCourseGroups(); 
    let currentGroupReference = null; // Pour suivre l'état du groupe sélectionné
    
    // Force l'initialisation du sélecteur dès le démarrage
    initGroupSelector();
    
    // Initialize calendar
    initCalendar();
    
    // Charger d'abord les semaines disponibles, puis les calendriers
    fetchAvailableWeeks()
        .then(() => {
            // Charger automatiquement les calendriers pour la semaine actuelle
            loadAllCalendars();
        });
    
    // Ajouter les écouteurs pour les boutons de filtrage
    document.getElementById('resetFilters').addEventListener('click', resetAllFilters);
    document.getElementById('select4aAll').addEventListener('click', () => toggleAllCoursesInList('courses4aList', true));
    document.getElementById('select4aNone').addEventListener('click', () => toggleAllCoursesInList('courses4aList', false));
    document.getElementById('select3aAll').addEventListener('click', () => toggleAllCoursesInList('courses3aList', true));
    document.getElementById('select3aNone').addEventListener('click', () => toggleAllCoursesInList('courses3aList', false));
    document.getElementById('prevWeek').addEventListener('click', () => changeWeek(-1));
    document.getElementById('nextWeek').addEventListener('click', () => changeWeek(1));
    document.getElementById('currentWeek').addEventListener('click', () => changeWeek(0, true));
    
    // Boutons pour les groupes de cours
    document.getElementById('saveGroupBtn').addEventListener('click', saveCurrentSelectionAsGroup);
    document.getElementById('groupSelector').addEventListener('change', applySelectedGroup);
    document.getElementById('deleteGroupBtn').addEventListener('click', deleteSelectedGroup);
    
    // Ajouter des écouteurs pour les cases à cocher des groupes 3A
    document.querySelectorAll('.group3a-toggle').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            loadGroup3a(this.value, this.checked);
        });
    });
    
    // Ajouter un écouteur pour le bouton de téléchargement
    document.getElementById('downloadCalendarBtn').addEventListener('click', downloadCurrentCalendar);
    
    /**
     * Télécharger le calendrier actuellement affiché
     */
    function downloadCurrentCalendar() {
        // Récupérer tous les événements actuellement affichés
        const events4aFiltered = events4a.filter(event => 
            selected4aCourses.has(event.normalizedCode || event.courseCode)
        );
        
        const events3aFiltered = Object.values(allEvents3a).flat().filter(event => 
            selected3aCourses.has(event.normalizedCode || event.courseCode)
        );
        
        // Combiner tous les événements
        const allEvents = [...events4aFiltered, ...events3aFiltered];
        
        if (allEvents.length === 0) {
            alert('Aucun événement à télécharger. Veuillez d\'abord charger des calendriers.');
            return;
        }
        
        // Générer le contenu iCal
        const icalContent = generateICalContent(allEvents);
        
        // Créer un objet Blob avec le contenu iCal
        const blob = new Blob([icalContent], { type: 'text/calendar' });
        
        // Créer un lien de téléchargement et déclencher le clic
        const downloadLink = document.createElement('a');
        downloadLink.href = URL.createObjectURL(blob);
        
        // Nommer le fichier avec la semaine actuelle
        const week = availableWeeks.find(w => w.offset === currentWeekOffset);
        const weekLabel = week ? week.label.replace(/\s+/g, '_') : 'calendrier';
        
        downloadLink.download = `calendrier_INSA_${weekLabel}.ics`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
    }
    
    /**
     * Générer le contenu iCal à partir des événements
     */
    function generateICalContent(events) {
        let icalContent = `BEGIN:VCALENDAR
PRODID:-//Calendar Pro//NONSGML v1.0//FR
VERSION:2.0
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:Calendrier INSA
X-WR-TIMEZONE:Europe/Paris
BEGIN:VTIMEZONE
TZID:Europe/Paris
X-LIC-LOCATION:Europe/Paris
BEGIN:DAYLIGHT
TZOFFSETFROM:+0100
TZOFFSETTO:+0200
TZNAME:CEST
DTSTART:19700329T020000
RRULE:FREQ=YEARLY;INTERVAL=1;BYDAY=-1SU;BYMONTH=3
END:DAYLIGHT
BEGIN:STANDARD
TZOFFSETFROM:+0200
TZOFFSETTO:+0100
TZNAME:CET
DTSTART:19701025T030000
RRULE:FREQ=YEARLY;INTERVAL=1;BYDAY=-1SU;BYMONTH=10
END:STANDARD
END:VTIMEZONE
`;
        
        // Ajouter chaque événement
        events.forEach(event => {
            // Formater les dates en format iCal
            const startDateStr = formatDateToICalFormat(new Date(event.start));
            const endDateStr = formatDateToICalFormat(new Date(event.end));
            
            icalContent += `BEGIN:VEVENT
DTSTAMP:${formatDateToICalFormat(new Date())}
UID:${event.id || generateUUID()}
DTSTART:${startDateStr}
DTEND:${endDateStr}
SUMMARY:${event.title || ''}
LOCATION:${event.location || ''}
DESCRIPTION:${event.description || ''}
END:VEVENT
`;
        });
        
        icalContent += 'END:VCALENDAR';
        return icalContent;
    }
    
    /**
     * Formater une date pour le format iCal
     */
    function formatDateToICalFormat(date) {
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const seconds = date.getSeconds().toString().padStart(2, '0');
        
        return `${year}${month}${day}T${hours}${minutes}${seconds}`;
    }
    
    /**
     * Générer un UUID pour les événements qui n'en ont pas
     */
    function generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
    
    /**
     * Charger les groupes de cours depuis localStorage - VERSION AMÉLIORÉE
     */
    function loadCourseGroups() {
        console.log("Tentative de chargement des groupes de cours...");
        try {
            // Vérifier localStorage et sessionStorage
            let savedGroups = localStorage.getItem('calendarProCourseGroups');
            if (!savedGroups) {
                savedGroups = sessionStorage.getItem('calendarProCourseGroups');
                console.log("Groupes non trouvés dans localStorage, recherche dans sessionStorage...");
            }
            
            if (savedGroups) {
                const parsedGroups = JSON.parse(savedGroups);
                // Vérification que nous avons bien un objet non-vide
                if (parsedGroups && typeof parsedGroups === 'object') {
                    const groupCount = Object.keys(parsedGroups).length;
                    console.log(`Groupes chargés avec succès: ${groupCount} groupes trouvés`);
                    
                    // Sauvegarder dans les deux stockages pour plus de résilience
                    if (groupCount > 0) {
                        localStorage.setItem('calendarProCourseGroups', JSON.stringify(parsedGroups));
                        sessionStorage.setItem('calendarProCourseGroups', JSON.stringify(parsedGroups));
                    }
                    
                    return parsedGroups;
                } else {
                    console.warn('Format de groupes invalide ou objet vide:', parsedGroups);
                    return {};
                }
            }
        } catch (error) {
            console.error('Erreur lors du chargement des groupes de cours:', error);
        }
        
        return {};
    }
    
    /**
     * Sauvegarder les groupes de cours - VERSION AMÉLIORÉE
     */
    function saveCourseGroups() {
        try {
            const groupsJson = JSON.stringify(courseGroups);
            localStorage.setItem('calendarProCourseGroups', groupsJson);
            sessionStorage.setItem('calendarProCourseGroups', groupsJson);
            console.log(`Groupes sauvegardés: ${Object.keys(courseGroups).length} groupes`);
        } catch (error) {
            console.error('Erreur lors de la sauvegarde des groupes:', error);
            showToast('Erreur lors de la sauvegarde. Vos préférences pourraient ne pas être conservées.');
        }
        
        // Mettre à jour l'interface
        updateGroupSelector();
    }
    
    /**
     * Mettre à jour le sélecteur de groupes de cours - VERSION AMÉLIORÉE 
     */
    function updateGroupSelector() {
        try {
            const selector = document.getElementById('groupSelector');
            if (!selector) {
                console.error('Sélecteur de groupe introuvable dans le DOM');
                return;
            }
            
            // Sauvegarder la sélection actuelle
            const currentValue = selector.value;
            
            // Vider le sélecteur
            selector.innerHTML = '<option value="">-- Sélectionner un groupe --</option>';
            
            // Vérifier que courseGroups est valide
            if (!courseGroups || typeof courseGroups !== 'object') {
                console.error('Objet courseGroups invalide lors de la mise à jour du sélecteur');
                courseGroups = {};
                return;
            }
            
            // Ajouter chaque groupe dans un ordre alphabétique
            const groupNames = Object.keys(courseGroups).sort();
            
            groupNames.forEach(groupName => {
                const option = document.createElement('option');
                option.value = groupName;
                option.textContent = groupName;
                selector.appendChild(option);
            });
            
            // Restaurer la sélection si elle existe encore
            if (currentValue && courseGroups[currentValue]) {
                selector.value = currentValue;
            }
            
            console.log(`Sélecteur mis à jour avec ${groupNames.length} groupes`);
        } catch (error) {
            console.error('Erreur lors de la mise à jour du sélecteur:', error);
        }
    }
    
    /**
     * Sauvegarder la sélection actuelle comme un groupe de cours - CORRIGÉ
     */
    function saveCurrentSelectionAsGroup() {
        const groupNameInput = document.getElementById('groupName');
        const groupName = groupNameInput.value.trim();
        
        if (!groupName) {
            alert('Veuillez entrer un nom pour ce groupe de cours');
            return;
        }
        
        // Récupérer les codes normalisés des cours actuellement sélectionnés dans l'interface
        const courses4aNormalized = [];
        document.querySelectorAll('#courses4aList input[type="checkbox"]:checked').forEach(checkbox => {
            courses4aNormalized.push(checkbox.value);
        });
        
        const courses3aNormalized = [];
        document.querySelectorAll('#courses3aList input[type="checkbox"]:checked').forEach(checkbox => {
            courses3aNormalized.push(checkbox.value);
        });
        
        // Vérifier qu'il y a des cours sélectionnés
        if (courses4aNormalized.length === 0 && courses3aNormalized.length === 0) {
            alert('Veuillez sélectionner au moins un cours avant de créer un groupe');
            return;
        }
        
        // Log pour le débogage
        console.log('Saving group:', {
            name: groupName,
            courses4a: courses4aNormalized,
            courses3a: courses3aNormalized,
            groups3a: {
                group1: document.getElementById('group1Checkbox').checked,
                group2: document.getElementById('group2Checkbox').checked,
                group3: document.getElementById('group3Checkbox').checked
            }
        });
        
        // Créer un nouvel objet pour ce groupe
        const newGroup = {
            name: groupName,
            courses4a: courses4aNormalized,
            courses3a: courses3aNormalized,
            groups3a: {
                group1: document.getElementById('group1Checkbox').checked,
                group2: document.getElementById('group2Checkbox').checked,
                group3: document.getElementById('group3Checkbox').checked
            }
        };
        
        // Sauvegarder dans notre objet
        courseGroups[groupName] = newGroup;
        
        // Persister dans localStorage
        localStorage.setItem('calendarProCourseGroups', JSON.stringify(courseGroups));
        updateGroupSelector();
        
        // Notification de réussite
        showToast(`Groupe "${groupName}" sauvegardé avec succès`);
        
        // Vider le champ de saisie
        groupNameInput.value = '';
        
        // Sélectionner le nouveau groupe dans la liste
        document.getElementById('groupSelector').value = groupName;
    }
    
    /**
     * Appliquer le groupe sélectionné - VERSION CORRIGÉE ET OPTIMISÉE
     */
    function applySelectedGroup() {
        const selector = document.getElementById('groupSelector');
        const groupName = selector.value;
        
        if (!groupName || !courseGroups[groupName]) {
            currentGroupReference = null; // Aucun groupe sélectionné
            return; // Rien à faire
        }
        
        const group = courseGroups[groupName];
        
        console.log('Applying group:', group);
        
        // Afficher l'indicateur de chargement
        showLoading(true);
        
        // Désactiver le sélecteur pendant le chargement pour éviter les clics multiples
        selector.disabled = true;
        
        try {
            // 1. Sauvegarder l'état actuel pour pouvoir le restaurer en cas d'erreur
            const previousState = {
                selected4aCourses: new Set(selected4aCourses),
                selected3aCourses: new Set(selected3aCourses),
                allEvents3a: {...allEvents3a},
                group1: document.getElementById('group1Checkbox').checked,
                group2: document.getElementById('group2Checkbox').checked,
                group3: document.getElementById('group3Checkbox').checked
            };
            
            // 2. Réinitialiser les sélections actuelles
            selected4aCourses.clear();
            selected3aCourses.clear();
            
            // 3. Mettre à jour l'état des groupes 3A avant le chargement
            document.getElementById('group1Checkbox').checked = group.groups3a && group.groups3a.group1;
            document.getElementById('group2Checkbox').checked = group.groups3a && group.groups3a.group2;
            document.getElementById('group3Checkbox').checked = group.groups3a && group.groups3a.group3;
            
            // 4. Appliquer les sélections de cours à partir du groupe
            if (group.courses4a && Array.isArray(group.courses4a)) {
                group.courses4a.forEach(course => selected4aCourses.add(course));
            }
            
            if (group.courses3a && Array.isArray(group.courses3a)) {
                group.courses3a.forEach(course => selected3aCourses.add(course));
            }
            
            // 5. Nettoyer et recharger le calendrier avant de procéder au chargement des groupes 3A
            calendar.removeAllEvents();
            
            // 6. Obtenir les événements 4A filtrés selon la sélection actuelle
            const filtered4aEvents = events4a.filter(event => 
                selected4aCourses.has(event.normalizedCode || event.courseCode)
            );
            
            // 7. Ajouter les événements 4A au calendrier directement
            calendar.addEventSource(filtered4aEvents);
            
            // 8. Créer un tableau de promesses pour charger les groupes 3A
            const promises = [];
            
            // Nettoyer complètement les événements 3A pour éviter les conflits
            allEvents3a = {};
            
            // Charger les calendriers 3A pour tous les groupes sélectionnés
            if (group.groups3a && group.groups3a.group1) {
                promises.push(fetchCalendar3a(1));
            }
            
            if (group.groups3a && group.groups3a.group2) {
                promises.push(fetchCalendar3a(2));
            }
            
            if (group.groups3a && group.groups3a.group3) {
                promises.push(fetchCalendar3a(3));
            }
            
            // 9. Attendre que tous les chargements soient terminés avec une meilleure gestion des erreurs
            return Promise.all(promises)
                .then(() => {
                    // 10. Mettre à jour les checkboxes une fois que tous les calendriers sont chargés
                    updateCheckboxes();
                    
                    // 11. Mettre à jour l'affichage du calendrier
                    updateCalendarDisplay();
                    
                    // 12. Sauvegarder l'état courant comme référence
                    currentGroupReference = {
                        courses4a: Array.from(selected4aCourses),
                        courses3a: Array.from(selected3aCourses),
                        groups3a: {
                            group1: document.getElementById('group1Checkbox').checked,
                            group2: document.getElementById('group2Checkbox').checked,
                            group3: document.getElementById('group3Checkbox').checked
                        }
                    };
                    
                    showToast(`Groupe "${groupName}" appliqué`);
                })
                .catch(error => {
                    console.error("Erreur lors du chargement des calendriers 3A:", error);
                    
                    // 13. En cas d'erreur, restaurer l'état précédent
                    selected4aCourses = previousState.selected4aCourses;
                    selected3aCourses = previousState.selected3aCourses;
                    allEvents3a = previousState.allEvents3a;
                    document.getElementById('group1Checkbox').checked = previousState.group1;
                    document.getElementById('group2Checkbox').checked = previousState.group2;
                    document.getElementById('group3Checkbox').checked = previousState.group3;
                    
                    showToast(`Erreur lors du chargement du groupe`);
                    document.getElementById('corsError').style.display = 'block';
                    document.getElementById('corsError').textContent = 'Erreur lors du chargement: ' + error.message;
                    
                    // Remettre à jour l'affichage avec l'état précédent
                    updateCheckboxes();
                    updateCalendarDisplay();
                })
                .finally(() => {
                    // 14. Dans tous les cas, réactiver le sélecteur et cacher le chargement
                    selector.disabled = false;
                    showLoading(false);
                });
        } catch (error) {
            console.error("Erreur lors de l'application du groupe:", error);
            selector.disabled = false;
            showLoading(false);
            showToast(`Erreur lors de l'application du groupe`);
        }
    }
    
    /**
     * Mettre à jour l'état des cases à cocher pour refléter les sélections actuelles
     */
    function updateCourseCheckboxes() {
        // Mettre à jour les cases à cocher 4A
        document.querySelectorAll('#courses4aList input[type="checkbox"]').forEach(checkbox => {
            checkbox.checked = selected4aCourses.has(checkbox.value);
        });
        
        // Mettre à jour les cases à cocher 3A
        document.querySelectorAll('#courses3aList input[type="checkbox"]').forEach(checkbox => {
            checkbox.checked = selected3aCourses.has(checkbox.value);
        });
    }
    
    /**
     * Supprimer le groupe sélectionné
     */
    function deleteSelectedGroup() {
        const selector = document.getElementById('groupSelector');
        const groupName = selector.value;
        
        if (!groupName || !courseGroups[groupName]) {
            alert('Veuillez sélectionner un groupe à supprimer');
            return;
        }
        
        if (confirm(`Êtes-vous sûr de vouloir supprimer le groupe "${groupName}" ?`)) {
            delete courseGroups[groupName];
            saveCourseGroups();
        }
    }
    
    /**
     * Récupérer les semaines disponibles
     */
    function fetchAvailableWeeks() {
        return fetch('/calendar-pro/api/weeks')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to fetch available weeks');
                }
                return response.json();
            })
            .then(weeks => {
                availableWeeks = weeks;
                
                // Trouver l'index de la semaine actuelle (offset = 0)
                const currentWeekIndex = weeks.findIndex(week => week.offset === 0);
                
                // Mettre à jour le texte du bouton avec le label de la semaine actuelle
                if (currentWeekIndex >= 0) {
                    updateWeekLabel(weeks[currentWeekIndex].label);
                }
                
                return weeks;
            })
            .catch(error => {
                console.error('Error fetching available weeks:', error);
                document.getElementById('corsError').style.display = 'block';
            });
    }
    
    /**
     * Changer de semaine
     */
    function changeWeek(direction, resetToCurrentWeek = false) {
        // Si resetToCurrentWeek est true, on revient à la semaine actuelle (offset=0)
        if (resetToCurrentWeek) {
            currentWeekOffset = 0;
        } else {
            // Sinon, on ajoute la direction (-1 pour semaine précédente, +1 pour semaine suivante)
            currentWeekOffset += direction;
            
            // S'assurer que l'offset reste dans les limites des semaines disponibles
            const minOffset = availableWeeks[0]?.offset || -4;
            const maxOffset = availableWeeks[availableWeeks.length - 1]?.offset || 12;
            
            currentWeekOffset = Math.max(minOffset, Math.min(maxOffset, currentWeekOffset));
        }
        
        // Trouver la semaine correspondant à l'offset actuel
        const week = availableWeeks.find(w => w.offset === currentWeekOffset);
        
        if (week) {
            // Mettre à jour le label de la semaine
            updateWeekLabel(week.label);
            
            // Définir la date de début pour le calendrier (convertir le timestamp en Date)
            const startDate = new Date(week.timestamp);
            calendar.gotoDate(startDate);
            
            // Recharger les calendriers pour la nouvelle semaine
            loadAllCalendars();
        }
    }
    
    /**
     * Mettre à jour le label de la semaine affichée
     */
    function updateWeekLabel(label) {
        document.getElementById('weekLabel').textContent = label;
        
        // Mettre à jour l'état des boutons précédent/suivant si nécessaire
        const minOffset = availableWeeks[0]?.offset || -4;
        const maxOffset = availableWeeks[availableWeeks.length - 1]?.offset || 12;
        
        document.getElementById('prevWeek').disabled = (currentWeekOffset <= minOffset);
        document.getElementById('nextWeek').disabled = (currentWeekOffset >= maxOffset);
    }
    
    /**
     * Initialize the FullCalendar
     */
    function initCalendar() {
        const calendarEl = document.getElementById('calendar');
        calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: 'timeGridWeek',
            headerToolbar: {
                left: '', // Supprimer les boutons prev/next/today intégrés
                center: 'title',
                right: 'timeGridWeek,timeGridDay'
            },
            slotMinTime: '08:00:00',
            slotMaxTime: '18:00:00', // Modifié de 20:00:00 à 18:00:00
            allDaySlot: false,
            locale: 'fr',
            weekends: false,
            height: 'auto',
            // Ajout d'événements pour synchroniser les dates du calendrier
            datesSet: function(info) {
                // Cette fonction est appelée lorsque les dates affichées changent
                console.log("Dates displayed changed to:", info.start, info.end);
            },
            eventClick: function(info) {
                alert(
                    'Cours: ' + info.event.title + '\n' +
                    'Horaire: ' + info.event.extendedProps.formattedTime + '\n' +
                    'Lieu: ' + (info.event.extendedProps.location || 'Non spécifié') + '\n' +
                    'Description: ' + (info.event.extendedProps.description || 'Aucune description')
                );
            },
            eventDidMount: function(info) {
                // Add tooltip
                const tooltip = `
                    <div class="fc-tooltip">
                        <strong>${info.event.title}</strong><br>
                        ${info.event.extendedProps.formattedTime}<br>
                        ${info.event.extendedProps.location || 'Non spécifié'}
                    </div>
                `;
                
                info.el.setAttribute('title', info.event.title);
            }
        });
        
        calendar.render();
    }
    
    /**
     * Charger tous les calendriers
     */
    function loadAllCalendars() {
        showLoading(true);
        
        // Réinitialisation plus prudente des données
        events4a = [];
        allEvents3a = {};
        
        // Ne pas réinitialiser les sélections lors du changement de semaine
        // selected4aCourses.clear();
        // selected3aCourses.clear();
        
        // Garder une référence aux sélections actuelles
        const savedSelected4aCourses = new Set(selected4aCourses);
        const savedSelected3aCourses = new Set(selected3aCourses);
        
        // Nettoyer le calendrier pour les nouvelles données
        calendar.removeAllEvents();
        
        // Charger le calendrier 4A avec une meilleure gestion des erreurs
        fetchCalendar4a()
            .then(() => {
                // Restaurer les sélections 4A précédentes si possible
                const validCourses4a = new Set();
                events4a.forEach(event => {
                    const code = event.normalizedCode || event.courseCode;
                    validCourses4a.add(code);
                    if (savedSelected4aCourses.has(code)) {
                        selected4aCourses.add(code);
                    }
                });
                
                // Charger les calendriers 3A pour tous les groupes sélectionnés
                const promises = [];
                if (document.getElementById('group1Checkbox').checked) {
                    promises.push(fetchCalendar3a(1));
                }
                if (document.getElementById('group2Checkbox').checked) {
                    promises.push(fetchCalendar3a(2));
                }
                if (document.getElementById('group3Checkbox').checked) {
                    promises.push(fetchCalendar3a(3));
                }
                
                // Si aucune promesse, résoudre immédiatement
                return promises.length > 0 ? Promise.all(promises) : Promise.resolve();
            })
            .then(() => {
                // Restaurer les sélections 3A précédentes si possible
                const allEvents3aFlat = Object.values(allEvents3a).flat();
                const validCourses3a = new Set();
                allEvents3aFlat.forEach(event => {
                    const code = event.normalizedCode || event.courseCode;
                    validCourses3a.add(code);
                    if (savedSelected3aCourses.has(code)) {
                        selected3aCourses.add(code);
                    }
                });
                
                // Afficher les filtres et mettre à jour le calendrier
                document.getElementById('filtersContent').style.display = 'block';
                updateCalendarDisplay();
                showLoading(false);
            })
            .catch(error => {
                console.error('Error loading calendars:', error);
                document.getElementById('corsError').style.display = 'block';
                document.getElementById('corsError').textContent = 'Erreur lors du chargement des calendriers: ' + error.message;
                document.getElementById('filtersContent').style.display = 'block';
                showLoading(false);
            });
    }
    
    /**
     * Récupérer le calendrier 4A
     */
    function fetchCalendar4a() {
        const url = `/api/calendar?promo=4&groupe=3&weekOffset=${currentWeekOffset}`;
        
        return fetch(url)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.text();
            })
            .then(data => {
                events4a = parseICalFile(data, '4a');
                generateCourseFilters(events4a, 'courses4aList', '4a');
                // Sélectionner tous les cours 4A par défaut
                events4a.forEach(event => {
                    if (event.courseCode) {
                        selected4aCourses.add(event.courseCode);
                    }
                });
                updateCalendarDisplay();
            });
    }
    
    /**
     * Récupérer un calendrier 3A pour un groupe spécifique - VERSION AMÉLIORÉE
     */
    function fetchCalendar3a(group) {
        const url = `/api/calendar?promo=3&groupe=${group}&weekOffset=${currentWeekOffset}`;
        
        // Afficher une notification de chargement propre à ce groupe
        const groupText = group === 1 ? "Groupe 1" : (group === 2 ? "Groupe 2" : "Groupe 3");
        showToast(`Chargement des cours 3A ${groupText}...`);
        
        return fetch(url)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Échec du chargement du groupe ${group}: ${response.status}`);
                }
                return response.text();
            })
            .then(data => {
                if (!data || data.trim() === '') {
                    throw new Error(`Données vides pour le groupe ${group}`);
                }
                
                try {
                    const events = parseICalFile(data, '3a', group);
                    allEvents3a[group] = events;
                    
                    // Mettre à jour les filtres avec tous les cours 3A disponibles
                    const allEvents3aFlat = Object.values(allEvents3a).flat();
                    generateCourseFilters(allEvents3aFlat, 'courses3aList', '3a');
                    
                    return events;
                } catch (e) {
                    console.error(`Erreur lors du traitement du calendrier ${group}:`, e);
                    throw new Error(`Erreur de traitement: ${e.message}`);
                }
            })
            .catch(error => {
                console.error(`Erreur lors du chargement du groupe ${group}:`, error);
                throw error; // Propager l'erreur pour la gestion centralisée
            });
    }
    
    /**
     * Charger ou décharger un groupe 3A spécifique
     */
    function loadGroup3a(group, isChecked) {
        if (isChecked) {
            // Si le groupe est sélectionné et pas encore chargé
            if (!allEvents3a[group]) {
                showLoading(true);
                fetchCalendar3a(group)
                    .then(() => {
                        showLoading(false);
                        // Vérifier si ce changement affecte la sélection de groupe
                        checkIfGroupSelectionChanged();
                    })
                    .catch(error => {
                        console.error(`Error loading group ${group}:`, error);
                        showLoading(false);
                        document.getElementById('corsError').style.display = 'block';
                    });
            } else {
                // Si déjà chargé, juste mettre à jour l'affichage
                updateCalendarDisplay();
                // Vérifier si ce changement affecte la sélection de groupe
                checkIfGroupSelectionChanged();
            }
        } else {
            // Si le groupe est désélectionné
            delete allEvents3a[group];
            
            // Mettre à jour les filtres avec les cours restants
            const allEvents3aFlat = Object.values(allEvents3a).flat();
            generateCourseFilters(allEvents3aFlat, 'courses3aList', '3a');
            
            // Mettre à jour les sélections pour n'inclure que les cours disponibles
            selected3aCourses.clear();
            document.querySelectorAll('#courses3aList input:checked').forEach(checkbox => {
                selected3aCourses.add(checkbox.value);
            });
            
            updateCalendarDisplay();
            
            // Vérifier si ce changement affecte la sélection de groupe
            checkIfGroupSelectionChanged();
        }
    }
    
    /**
     * Generate checkboxes for course filtering 
     * avec élimination des doublons de matières
     */
    function generateCourseFilters(events, containerId, year) {
        const container = document.getElementById(containerId);
        
        // Sauvegarder les sélections actuelles
        const selectedCourses = new Set();
        document.querySelectorAll(`#${containerId} input:checked`).forEach(checkbox => {
            selectedCourses.add(checkbox.value);
        });
        
        // Récupérer tous les codes de cours uniques en normalisant les codes de cours
        const uniqueCourses = new Map(); // Utiliser Map pour stocker {code: {shortCode, name}}
        
        events.forEach(event => {
            // Extraction du code de la matière (partie avant le dernier tiret et le /)
            // Par exemple, pour "4TC-VIR-2024/1", on extrait "4TC-VIR"
            const summary = event.title || '';
            let courseCode = event.courseCode;
            let shortCode = courseCode;
            
            // Normalisation du code pour éliminer les doublons
            // Par exemple, "4TC-VIR-2024/1" et "4TC-VIR-2024/2" deviennent tous deux "4TC-VIR"
            if (courseCode && courseCode.includes('-')) {
                const parts = courseCode.split('-');
                if (parts.length >= 2) {
                    // Utiliser seulement les 2 premières parties comme code court (ex: 4TC-VIR)
                    shortCode = parts.slice(0, 2).join('-');
                    
                    // Si nous n'avons pas encore ce cours ou si c'est un cours principal (sans numéro de séance)
                    if (!uniqueCourses.has(shortCode) || !courseCode.includes('/')) {
                        let courseName = summary;
                        
                        // Extraire le nom du cours depuis le titre
                        if (summary.includes('/')) {
                            const nameParts = summary.split('/');
                            // Prendre la partie avant le premier /
                            courseName = nameParts[0].trim();
                            
                            // Si après le / il y a une indication comme "Cours", "TD", etc., l'ajouter
                            if (nameParts.length > 1 && nameParts[1].trim().match(/^(Cours|TD|TP)/)) {
                                courseName += ' (' + nameParts[1].trim() + ')';
                            }
                        }
                        
                        uniqueCourses.set(shortCode, {
                            fullCode: courseCode,
                            name: courseName
                        });
                    }
                }
            }
        });
        
        // Si c'est une mise à jour des cours 3A, conserver les éléments existants
        if (containerId === 'courses3aList') {
            // Container temporaire pour les nouveaux éléments
            const fragment = document.createDocumentFragment();
            
            uniqueCourses.forEach((courseInfo, shortCode) => {
                const isSelected = selectedCourses.has(shortCode) || selected3aCourses.has(shortCode);
                
                // Chercher si l'élément existe déjà
                const existingElement = document.getElementById(`course-${year}-${shortCode.replace(/[^a-z0-9]/gi, '')}`);
                
                if (existingElement) {
                    // Si l'élément existe, mettre à jour son état checked
                    const checkbox = existingElement.querySelector('input');
                    if (checkbox) {
                        checkbox.checked = isSelected;
                    }
                } else {
                    // Si l'élément n'existe pas, le créer
                    createCourseFilterItem(fragment, shortCode, courseInfo.name, isSelected, year);
                }
            });
            
            // Pour les éléments existants qui ne sont plus pertinents, les supprimer
            document.querySelectorAll(`#${containerId} .course-filter-item`).forEach(item => {
                const courseCode = item.dataset.courseCode;
                if (!uniqueCourses.has(courseCode)) {
                    item.remove();
                }
            });
            
            // Ajouter les nouveaux éléments
            container.appendChild(fragment);
        } else {
            // Pour les cours 4A, effacer et recréer tous les éléments
            container.innerHTML = '';
            
            const fragment = document.createDocumentFragment();
            uniqueCourses.forEach((courseInfo, shortCode) => {
                const isSelected = selectedCourses.has(shortCode) || selected4aCourses.has(shortCode);
                createCourseFilterItem(fragment, shortCode, courseInfo.name, isSelected, year);
            });
            
            container.appendChild(fragment);
        }
        
        // Ajouter des écouteurs d'événements
        document.querySelectorAll(`#${containerId} input[type="checkbox"]`).forEach(checkbox => {
            // Supprimer les anciens écouteurs si possible (éviter les doublons)
            checkbox.removeEventListener('change', onCourseCheckboxChanged);
            
            // Ajouter un nouvel écouteur
            checkbox.addEventListener('change', onCourseCheckboxChanged);
        });
    }
    
    /**
     * Creates a course filter checkbox item
     */
    function createCourseFilterItem(container, courseCode, courseName, isChecked, year) {
        const item = document.createElement('div');
        item.className = 'list-group-item d-flex justify-content-between align-items-center course-filter-item';
        item.dataset.courseCode = courseCode;
        
        item.innerHTML = `
            <div class="form-check">
                <input class="form-check-input" type="checkbox" value="${courseCode}" 
                       id="course-${year}-${courseCode.replace(/[^a-z0-9]/gi, '')}" 
                       data-year="${year}" ${isChecked ? 'checked' : ''}>
                <label class="form-check-label" for="course-${year}-${courseCode.replace(/[^a-z0-9]/gi, '')}">
                    <span class="badge ${year === '4a' ? 'bg-primary' : 'bg-success'}">${courseCode}</span>
                    ${courseName}
                </label>
            </div>
        `;
        
        container.appendChild(item);
    }
    
    /**
     * Toggle all courses in a list
     */
    function toggleAllCoursesInList(containerId, checked) {
        document.querySelectorAll(`#${containerId} input[type="checkbox"]`).forEach(checkbox => {
            checkbox.checked = checked;
            
            const courseCode = checkbox.value;
            const yearType = checkbox.dataset.year;
            
            if (yearType === '4a') {
                if (checked) {
                    selected4aCourses.add(courseCode);
                } else {
                    selected4aCourses.delete(courseCode);
                }
            } else {
                if (checked) {
                    selected3aCourses.add(courseCode);
                } else {
                    selected3aCourses.delete(courseCode);
                }
            }
        });
        
        updateCalendarDisplay();
        
        // Vérifier si ce changement affecte la sélection de groupe
        checkIfGroupSelectionChanged();
    }
    
    /**
     * Reset all filters to show all courses
     */
    function resetAllFilters() {
        // Sélectionner tous les cours 4A
        toggleAllCoursesInList('courses4aList', true);
        
        // Activer tous les groupes 3A
        document.querySelectorAll('.group3a-toggle').forEach(checkbox => {
            if (!checkbox.checked) {
                checkbox.checked = true;
                loadGroup3a(checkbox.value, true);
            }
        });
        
        // Sélectionner tous les cours 3A
        toggleAllCoursesInList('courses3aList', true);
    }
    
    /**
     * Show or hide loading indicator
     */
    function showLoading(isLoading) {
        const loadingIndicator = document.getElementById('loadingIndicator');
        if (isLoading) {
            loadingIndicator.style.display = 'block';
            document.getElementById('filtersContent').style.opacity = '0.5';
            document.getElementById('corsError').style.display = 'none'; // Cacher les erreurs précédentes
        } else {
            loadingIndicator.style.display = 'none';
            document.getElementById('filtersContent').style.opacity = '1';
        }
    }
    
    /**
     * Parse iCal file and extract events - Updated to handle normalized course codes
     */
    function parseICalFile(data, year, group = null) {
        const jcalData = ICAL.parse(data);
        const comp = new ICAL.Component(jcalData);
        const events = [];
        
        // Get all events from the calendar
        const vevents = comp.getAllSubcomponents('vevent');
        
        vevents.forEach(vevent => {
            const event = new ICAL.Event(vevent);
            
            // Extract course code from summary
            const summary = event.summary || '';
            let courseCode = '';
            
            // Extract course code using regex
            const courseMatch = summary.match(/(\d+[A-Z]+-[A-Z]+-\d+\/\d+)/);
            if (courseMatch) {
                courseCode = courseMatch[1];
                
                // Normaliser le code pour les filtres
                if (courseCode.includes('-')) {
                    const parts = courseCode.split('-');
                    if (parts.length >= 2) {
                        // Utiliser seulement les 2 premières parties (ex: 4TC-VIR) pour le filtrage
                        const normalizedCode = parts.slice(0, 2).join('-');
                        // Stocker à la fois le code complet et le code normalisé
                        event.normalizedCode = normalizedCode;
                    }
                }
            } else {
                courseCode = summary;
                event.normalizedCode = courseCode;
            }
            
            // Extract group info if available
            const groupInfo = summary.includes('/') 
                ? summary.split('/').pop().trim() 
                : '';
                
            // Format time for display
            const startTime = event.startDate.toJSDate();
            const endTime = event.endDate.toJSDate();
            const formattedTime = formatDateRange(startTime, endTime);
            
            events.push({
                id: event.uid,
                title: summary,
                start: startTime,
                end: endTime,
                courseCode: courseCode,
                normalizedCode: event.normalizedCode || courseCode,
                groupInfo: groupInfo,
                location: event.location,
                description: event.description,
                formattedTime: formattedTime,
                year: year,
                group: group,
                className: `event-${year}`
            });
        });
        
        return events;
    }
    
    /**
     * Format date range for display
     */
    function formatDateRange(start, end) {
        const options = { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' };
        return `${start.toLocaleDateString('fr-FR', options)} - ${end.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
    }
    
    /**
     * Fonction améliorée pour mettre à jour l'affichage du calendrier
     */
    function updateCalendarDisplay() {
        try {
            // Clear current events
            calendar.removeAllEvents();
            
            // Filtrer les événements 4A selon la sélection
            const filtered4aEvents = events4a.filter(event => {
                return selected4aCourses.has(event.normalizedCode || event.courseCode);
            });
            
            // Combiner tous les événements 3A de tous les groupes et les filtrer
            let all3aEvents = [];
            
            try {
                all3aEvents = Object.values(allEvents3a)
                    .flat()
                    .filter(event => {
                        return selected3aCourses.has(event.normalizedCode || event.courseCode);
                    });
            } catch (e) {
                console.error("Erreur lors du filtrage des événements 3A:", e);
                all3aEvents = [];
            }
            
            // Ajouter les événements 4A filtrés
            if (filtered4aEvents.length > 0) {
                calendar.addEventSource(filtered4aEvents);
            }
            
            // Vérifier les conflits et les marquer
            if (all3aEvents.length > 0) {
                const eventsWithConflicts = markConflicts(filtered4aEvents, all3aEvents);
                calendar.addEventSource(eventsWithConflicts);
            }
            
            // Vérifier si le calendrier est vide après le chargement
            if (filtered4aEvents.length === 0 && all3aEvents.length === 0) {
                console.warn('No events to display for the current week');
                document.getElementById('noEventsWarning').style.display = 'block';
            } else {
                document.getElementById('noEventsWarning').style.display = 'none';
            }
            
            // Forcer un rendu pour s'assurer que tout est bien affiché
            calendar.render();
        } catch (error) {
            console.error("Erreur lors de la mise à jour de l'affichage du calendrier:", error);
            document.getElementById('corsError').style.display = 'block';
            document.getElementById('corsError').textContent = "Erreur d'affichage: " + error.message;
        }
    }
    
    /**
     * Identify and mark conflicting events
     */
    function markConflicts(events4a, events3a) {
        // Clone 3A events to avoid modifying the original array
        const result = JSON.parse(JSON.stringify(events3a));
        
        // Check each 3A event against all 4A events for time conflicts
        for (let event3a of result) {
            const start3a = new Date(event3a.start);
            const end3a = new Date(event3a.end);
            
            // Check if this 3A event conflicts with any 4A event
            const hasConflict = events4a.some(event4a => {
                const start4a = new Date(event4a.start);
                const end4a = new Date(event4a.end);
                
                // Check for overlap
                return (
                    (start3a < end4a && end3a > start4a) || // Partial overlap
                    (start4a < end3a && end4a > start3a)    // Reverse partial overlap
                );
            });
            
            if (hasConflict) {
                event3a.className = 'event-conflict';
            }
        }
        
        return result;
    }
    
    /**
     * Afficher une notification toast
     */
    function showToast(message) {
        const toastContainer = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = 'toast show';
        toast.setAttribute('role', 'alert');
        toast.setAttribute('aria-live', 'assertive');
        toast.setAttribute('aria-atomic', 'true');
        
        toast.innerHTML = `
            <div class="toast-header">
                <strong class="me-auto">Notification</strong>
                <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
            <div class="toast-body">
                ${message}
            </div>
        `;
        
        toastContainer.appendChild(toast);
        
        // Fermer automatiquement après 3 secondes
        setTimeout(() => {
            const bsToast = new bootstrap.Toast(toast);
            bsToast.hide();
            // Supprimer après l'animation de fermeture
            toast.addEventListener('hidden.bs.toast', () => {
                toastContainer.removeChild(toast);
            });
        }, 3000);
        
        // Permettre la fermeture manuelle
        const closeButton = toast.querySelector('.btn-close');
        closeButton.addEventListener('click', () => {
            const bsToast = new bootstrap.Toast(toast);
            bsToast.hide();
        });
    }
    
    /**
     * Gestionnaire d'événement pour les changements de case à cocher de cours
     */
    function onCourseCheckboxChanged(event) {
        const checkbox = event.target;
        const courseCode = checkbox.value; // C'est le code normalisé
        const yearType = checkbox.dataset.year;
        
        console.log(`Checkbox changed for ${yearType} course: ${courseCode}, checked: ${checkbox.checked}`);
        
        if (yearType === '4a') {
            if (checkbox.checked) {
                selected4aCourses.add(courseCode);
            } else {
                selected4aCourses.delete(courseCode);
            }
        } else {
            if (checkbox.checked) {
                selected3aCourses.add(courseCode);
            } else {
                selected3aCourses.delete(courseCode);
            }
        }
        
        // Vérifier si l'état actuel diffère de la référence du groupe sélectionné
        checkIfGroupSelectionChanged();
        
        updateCalendarDisplay();
    }
    
    /**
     * Mettre à jour les checkboxes pour correspondre aux sélections actuelles
     */
    function updateCheckboxes() {
        // Mettre à jour les cases à cocher 4A
        document.querySelectorAll('#courses4aList input[type="checkbox"]').forEach(checkbox => {
            checkbox.checked = selected4aCourses.has(checkbox.value);
        });
        
        // Mettre à jour les cases à cocher 3A
        document.querySelectorAll('#courses3aList input[type="checkbox"]').forEach(checkbox => {
            checkbox.checked = selected3aCourses.has(checkbox.value);
        });
    }
    
    /**
     * Vérifier si la sélection actuelle diffère du groupe sélectionné
     */
    function checkIfGroupSelectionChanged() {
        // Si aucun groupe n'est référencé, rien à faire
        if (!currentGroupReference) return;
        
        // Vérifier les groupes 3A
        const currentGroups3a = {
            group1: document.getElementById('group1Checkbox').checked,
            group2: document.getElementById('group2Checkbox').checked,
            group3: document.getElementById('group3Checkbox').checked
        };
        
        if (
            currentGroups3a.group1 !== currentGroupReference.groups3a.group1 ||
            currentGroups3a.group2 !== currentGroupReference.groups3a.group2 ||
            currentGroups3a.group3 !== currentGroupReference.groups3a.group3
        ) {
            // Les groupes 3A ont changé, désélectionner le groupe
            document.getElementById('groupSelector').value = "";
            currentGroupReference = null;
            return;
        }
        
        // Vérifier les cours 4A
        const currentCourses4a = Array.from(selected4aCourses);
        if (!arraysEqual(currentCourses4a, currentGroupReference.courses4a)) {
            document.getElementById('groupSelector').value = "";
            currentGroupReference = null;
            return;
        }
        
        // Vérifier les cours 3A
        const currentCourses3a = Array.from(selected3aCourses);
        if (!arraysEqual(currentCourses3a, currentGroupReference.courses3a)) {
            document.getElementById('groupSelector').value = "";
            currentGroupReference = null;
            return;
        }
    }
    
    /**
     * Comparer deux tableaux
     */
    function arraysEqual(arr1, arr2) {
        if (arr1.length !== arr2.length) return false;
        
        const sortedArr1 = [...arr1].sort();
        const sortedArr2 = [...arr2].sort();
        
        for (let i = 0; i < sortedArr1.length; i++) {
            if (sortedArr1[i] !== sortedArr2[i]) return false;
        }
        
        return true;
    }
    
    // Initialiser le sélecteur de groupe
    updateGroupSelector();
    
    // Initialisation pour s'assurer que les groupes sont bien chargés et visibles dans l'interface
    setTimeout(() => {
        // Si les groupes semblent vides mais qu'il y a des données dans localStorage, essayer de recharger
        const rawGroups = localStorage.getItem('calendarProCourseGroups');
        if (rawGroups && Object.keys(courseGroups).length === 0) {
            console.warn('Groupes vides mais localStorage non vide, tentative de rechargement...');
            courseGroups = loadCourseGroups();
            updateGroupSelector();
        }
        
        // Toujours mettre à jour le sélecteur pour s'assurer que les groupes sont bien affichés
        updateGroupSelector();
    }, 500);
    
    /**
     * Initialise le sélecteur de groupe dès le démarrage
     */
    function initGroupSelector() {
        console.log("Initialisation du sélecteur de groupes...");
        // Vérifier si courseGroups est vide ou non valide
        if (!courseGroups || typeof courseGroups !== 'object' || Object.keys(courseGroups).length === 0) {
            console.warn("Groupes non trouvés ou invalides, tentative de rechargement...");
            // Tenter de recharger depuis le localStorage
            courseGroups = {};
            
            try {
                const savedGroups = localStorage.getItem('calendarProCourseGroups');
                if (savedGroups) {
                    const parsedGroups = JSON.parse(savedGroups);
                    if (parsedGroups && typeof parsedGroups === 'object') {
                        courseGroups = parsedGroups;
                        console.log("Groupes rechargés avec succès:", Object.keys(courseGroups).length, "groupes");
                    }
                }
            } catch(e) {
                console.error("Erreur lors du chargement des groupes:", e);
            }
        }
        
        // Mettre à jour le sélecteur avec les données actuelles
        updateGroupSelector();
        
        // Pour le débogage
        console.log("Groupes disponibles après initialisation:", Object.keys(courseGroups));
    }
});

/**
 * Initialise le thème selon la préférence sauvegardée
 */
function initThemePreference() {
    const savedTheme = localStorage.getItem('theme');
    const prefersDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme === 'dark' || (!savedTheme && prefersDarkMode)) {
        document.documentElement.setAttribute('data-bs-theme', 'dark');
        updateThemeButton(true);
    } else {
        document.documentElement.setAttribute('data-bs-theme', 'light');
        updateThemeButton(false);
    }
}

/**
 * Bascule entre le mode clair et le mode sombre
 */
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-bs-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-bs-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    
    updateThemeButton(newTheme === 'dark');
}

/**
 * Met à jour le texte et l'icône du bouton de thème
 */
function updateThemeButton(isDarkMode) {
    const button = document.getElementById('themeSwitcher');
    
    if (isDarkMode) {
        button.innerHTML = '<i class="bi bi-sun-fill"></i> Mode clair';
        button.classList.remove('btn-outline-secondary');
        button.classList.add('btn-outline-light');
    } else {
        button.innerHTML = '<i class="bi bi-moon-fill"></i> Mode sombre';
        button.classList.remove('btn-outline-light');
        button.classList.add('btn-outline-secondary');
    }
}
