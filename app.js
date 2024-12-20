// Load environment variables from .env file
import { config } from 'dotenv';
config();

// Firebase SDK Imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.17.1/firebase-app.js";
import {
    getAuth,
    signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/9.17.1/firebase-auth.js";
import {
    getFirestore,
    collection,
    getDoc,
    doc,
    setDoc,
    query,
    where,
    getDocs
} from "https://www.gstatic.com/firebasejs/9.17.1/firebase-firestore.js";

// Firebase Configuration
const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// DOM Elements
const authSection = document.getElementById("auth-section");
const menuSection = document.getElementById("menu-section");
const content = document.getElementById("content");

// Global state for the current Anlage ID
let currentAnlageId = null;
let selectedQuartal = 'Q1'; // Default value for the quarter
let selectedJahr = 2024;    // Default year
let showOnlyOpen = false;   // Filter for open points
let filterByQuarter = null; // To store which quarter to filter the display (via buttons)

// Global state for the current search term
let currentSearchTerm = '';

// Event listener for login button click (already exists)
document.getElementById("login-button").addEventListener("click", async () => {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        alert(`Fehler beim Anmelden: ${error.message}`);
    }
});

document.getElementById("password").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        triggerLogin();
    }
});

// Function to trigger login process
async function triggerLogin() {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        alert(`Fehler beim Anmelden: ${error.message}`);
    }
}

document.getElementById("logout-button").addEventListener("click", async () => {
    await signOut(auth);
});

document.getElementById("search-submit").addEventListener("click", showSearchPage);
document.getElementById("create-submit").addEventListener("click", showCreatePage);

// Authentication State Change
onAuthStateChanged(auth, (user) => {
    if (user) {
        authSection.style.display = "none";
        menuSection.style.display = "block";
        showSearchPage();  // Show search page after login
    } else {
        authSection.style.display = "block";
        menuSection.style.display = "none";
        content.innerHTML = "<p>Bitte loggen Sie sich ein.</p>";
    }
});

// Event listener for the "CheckInspect" link
document.getElementById("checkinspect-link").addEventListener("click", () => {
    showSearchPage(); // Zeigt die Such-Seite an
});

// Event listener for the Refresh button
document.getElementById("refresh-button").addEventListener("click", () => {
    const currentPage = content.innerHTML;

    if (currentPage.includes("Anlage Suchen")) {
        showSearchPage(currentSearchTerm);
    } else if (currentPage.includes("Neue Anlage Erstellen")) {
        showCreatePage();
    } else if (currentPage.includes("Anlage:")) {
        if (currentAnlageId) {
            showAnlagePruefung(currentAnlageId);
        } else {
            alert("Keine gültige Anlage-ID gefunden.");
        }
    }
});

// Search Page
async function showSearchPage(searchTerm = '') {
    content.innerHTML = `
        <h2>Anlage Suchen</h2>
        <input type="text" id="search-term" placeholder="Anlagen-Nr oder Name" value="${searchTerm}">
        <button id="perform-search" class="btn-class">Suchen</button>
        <div id="search-results"></div>
    `;

    // Event listener for search button click
    document.getElementById("perform-search").addEventListener("click", performSearch);

    // Event listener for Enter key press
    document.getElementById("search-term").addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            performSearch();  // Trigger search when Enter is pressed
        }
    });

    // Perform search logic
    async function performSearch() {
        currentSearchTerm = document.getElementById("search-term").value.trim().toLowerCase();
        if (!currentSearchTerm) {
            alert("Bitte einen Suchbegriff eingeben.");
            return;
        }

        try {
            const q = query(collection(db, "anlagen"));
            const querySnapshot = await getDocs(q);
            const resultsContainer = document.getElementById("search-results");

            resultsContainer.innerHTML = ""; // Clear previous results

            let foundResults = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                const nameLower = data.name.toLowerCase();
                const idLower = data.id.toLowerCase();

                if (nameLower.includes(currentSearchTerm) || idLower.includes(currentSearchTerm)) {
                    foundResults.push(data);
                }
            });

            if (foundResults.length === 0) {
                resultsContainer.innerHTML = "<p>Keine Ergebnisse gefunden.</p>";
            } else {
                foundResults.forEach((data) => {
                    resultsContainer.innerHTML += `
                        <div>
                            <p><strong>${data.name}</strong> (Anlagen-Nr: ${data.id})</p>
                            <p>Meldergruppen: ${data.meldergruppen.length}</p>
                            <p>Geprüft: ${calculateProgress(data.meldergruppen)}%</p>
                            <button class="open-anlage btn-class" data-id="${data.id}">Zur Prüfung</button>
                        </div>
                        <hr>
                    `;
                });

                document.querySelectorAll(".open-anlage").forEach((button) => {
                    button.addEventListener("click", (e) => {
                        const anlageId = e.target.getAttribute("data-id");
                        currentAnlageId = anlageId;
                        showAnlagePruefung(anlageId);
                    });
                });
            }
        } catch (error) {
            alert(`Fehler bei der Suche: ${error.message}`);
        }
    }

    // Perform search if there is a current search term
    if (searchTerm) {
        performSearch();
    }
}

// Create Page
async function showCreatePage() {
    content.innerHTML = `
        <h2>Neue Anlage Erstellen</h2>
        <input type="text" id="new-name" placeholder="Anlagenname">
        <input type="text" id="new-id" placeholder="Anlagen-Nr">
        <div style="margin-top:5px">
            <a>Akku Einbaudatum: </a>
            <input type="text" id="new-text-field-1" placeholder="YY/JJJJ">
        </div>
        <div style="margin-top:5px">
            <a>Besonderheiten: </a>
            <input type="text" id="new-text-field-2">
        </div>
        <div>
            <label for="turnus-select">Wählen Sie den Turnus:</label>
            <select id="turnus-select">
                <option value="quarterly">Vierteljährlich</option>
                <option value="semi-annual">Halbjährlich</option>
                <option value="annual">Jährlich</option>
            </select>
        </div>
        <div id="meldergruppen-container">
            <div class="meldergruppe">
                <h4 style="margin-top: 1em; margin-bottom: 0px">Meldegruppe 1</h4>
                <input type="number" class="melder-count" placeholder="Anzahl Melder" value="1">
                <label for="zd">ZD</label>
                <input type="checkbox" class="zd-checkbox">
                <label for="type">Typ</label>
                <select class="type-select">
                    <option value="RM">RM</option>
                    <option value="HM">HM</option>
                    <option value="WM">WM</option>
                    <option value="LRM">LRM</option>
                    <option value="RAS">RAS</option>
                    <option value="FM">FM</option>
                    <option value="WLK">WLK</option>
                    <option value="FSE">FSE</option>
                    <option value="Esti">Esti</option>
                    <option value="SpK">SpK</option>
                    <option value="LöA">LöA</option>
                </select>
            </div>
        </div>
        <br>
        <button id="add-meldegruppe" class="btn-class">Weitere Meldegruppe hinzufügen</button>
        <br>
        <br>
        <button id="create-new" class="btn-class">Anlage Erstellen</button>
    `;

    // Event Listener für "Weitere Meldegruppe hinzufügen"
    document.getElementById("add-meldegruppe").addEventListener("click", () => {
        const meldergruppenContainer = document.getElementById("meldergruppen-container");
        const groupCount = meldergruppenContainer.querySelectorAll(".meldergruppe").length + 1;
        const newGroup = document.createElement("div");
        newGroup.classList.add("meldergruppe");
        newGroup.innerHTML = `
            <h4 style="margin-top: 1em; margin-bottom: 0px">Meldegruppe ${groupCount}</h3>
            <input type="number" class="melder-count" placeholder="Anzahl Melder" value="1">
            <label for="zd">ZD</label>
            <input type="checkbox" class="zd-checkbox">
            <label for="type">Typ</label>
            <select class="type-select">
                <option value="RM">RM</option>
                <option value="HM">HM</option>
                <option value="WM">WM</option>
                <option value="LRM">LRM</option>
                <option value="RAS">RAS</option>
                <option value="FM">FM</option>
                <option value="WLK">WLK</option>
                <option value="FSE">FSE</option>
                <option value="Esti">Esti</option>
                <option value="SpK">SpK</option>
                <option value="LöA">LöA</option>
            </select>
        `;
        meldergruppenContainer.appendChild(newGroup);
    });

    // Event Listener für das Erstellen der neuen Anlage
    document.getElementById("create-new").addEventListener("click", async () => {
        const name = document.getElementById("new-name").value;
        const id = document.getElementById("new-id").value;
        const textField1 = document.getElementById("new-text-field-1").value;  // Neues Textfeld 1
        const textField2 = document.getElementById("new-text-field-2").value;  // Neues Textfeld 2
        const turnus = document.getElementById("turnus-select").value;  // Get the selected Turnus

        // Collect all Meldegruppen data
        const meldergruppen = [];
        document.querySelectorAll(".meldergruppe").forEach((groupElement, index) => {
            const melderCount = parseInt(groupElement.querySelector(".melder-count").value, 10);
            const zdChecked = groupElement.querySelector(".zd-checkbox").checked;
            const typeValue = groupElement.querySelector(".type-select").value;
            
            const meldepunkte = Array.from({ length: melderCount }, (_, i) => ({
                id: i + 1,
                geprüft: {},
            }));

            meldergruppen.push({
                name: `MG${index + 1}`,
                meldepunkte: meldepunkte,
                zd: zdChecked,
                type: typeValue,
            });
        });

        try {
            await setDoc(doc(db, "anlagen", id), { name, id, meldergruppen, textField1, textField2, turnus });
            alert("Anlage erfolgreich erstellt!");
        } catch (error) {
            alert(`Fehler beim Erstellen der Anlage: ${error.message}`);
        }
    });
}

// Function to display the Anlage Prüfung page
async function showAnlagePruefung(anlageId) {
    const anlageDoc = await getDoc(doc(db, "anlagen", anlageId));
    if (!anlageDoc.exists()) {
        alert("Anlage nicht gefunden!");
        return;
    }

    const anlageData = anlageDoc.data();

    // Dynamisch die letzten 5 Jahre (inkl. aktuelles Jahr) erstellen
    const currentYear = new Date().getFullYear();
    const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i)
        .map(year => `<option value="${year}" ${selectedJahr === year ? 'selected' : ''}>${year}</option>`)
        .join('');


	// Based on Turnus (quarterly, semi-annual, annual), adjust the quarter filters
    let quarterFilterHtml = '';
    if (anlageData.turnus === 'quarterly') {
        quarterFilterHtml = `
            <button class="quarter-filter ${filterByQuarter === 'Q1' ? 'active' : ''}" data-quarter="Q1">Q1</button>
            <button class="quarter-filter ${filterByQuarter === 'Q2' ? 'active' : ''}" data-quarter="Q2">Q2</button>
            <button class="quarter-filter ${filterByQuarter === 'Q3' ? 'active' : ''}" data-quarter="Q3">Q3</button>
            <button class="quarter-filter ${filterByQuarter === 'Q4' ? 'active' : ''}" data-quarter="Q4">Q4</button>
        `;
    } else if (anlageData.turnus === 'semi-annual') {
        quarterFilterHtml = `
            <button class="quarter-filter ${filterByQuarter === 'Q1' ? 'active' : ''}" data-quarter="Q1">H1</button>
            <button class="quarter-filter ${filterByQuarter === 'Q2' ? 'active' : ''}" data-quarter="Q2">H2</button>
        `;
    }

    // For annual, no quarter filter is needed

// Logik für die Quartalsauswahl basierend auf dem Turnus
    let quarterselectturnus = '';
    if (anlageData.turnus === 'quarterly') {
        // Standardmäßig das aktuelle Quartal setzen
        const currentMonth = new Date().getMonth(); // Monat ist von 0 (Januar) bis 11 (Dezember)
        if (currentMonth >= 0 && currentMonth < 3) {
            selectedQuartal = 'Q1';
        } else if (currentMonth >= 3 && currentMonth < 6) {
            selectedQuartal = 'Q2';
        } else if (currentMonth >= 6 && currentMonth < 9) {
            selectedQuartal = 'Q3';
        } else {
            selectedQuartal = 'Q4';
        }

        quarterselectturnus = `
            <label for="quartal-select">Wählen Sie das Prüf-Quartal:</label>
            <select id="quartal-select">
                <option value="Q1" ${selectedQuartal === 'Q1' ? 'selected' : ''}>Q1</option>
                <option value="Q2" ${selectedQuartal === 'Q2' ? 'selected' : ''}>Q2</option>
                <option value="Q3" ${selectedQuartal === 'Q3' ? 'selected' : ''}>Q3</option>
                <option value="Q4" ${selectedQuartal === 'Q4' ? 'selected' : ''}>Q4</option>
            </select>
        `;
    } else if (anlageData.turnus === 'semi-annual') {
        // Halbjährlich: Standard auf H1 oder H2 je nach aktuellem Monat setzen
        const currentMonth = new Date().getMonth(); // Monat ist von 0 (Januar) bis 11 (Dezember)
        selectedQuartal = currentMonth < 6 ? 'Q1' : 'Q2';  // H1: Januar bis Juni, H2: Juli bis Dezember

        quarterselectturnus = `
            <label for="quartal-select">Wählen Sie das Prüf-Halbjahr:</label>
            <select id="quartal-select">
                <option value="Q1" ${selectedQuartal === 'Q1' ? 'selected' : ''}>H1</option>
                <option value="Q2" ${selectedQuartal === 'Q2' ? 'selected' : ''}>H2</option>
            </select>
        `;
    } else {
        
	const currentMonth = new Date().getMonth(); // Monat ist von 0 (Januar) bis 11 (Dezember)
	if (currentMonth >= 0 && currentMonth < 3) {
            selectedQuartal = 'Q1';
        } else if (currentMonth >= 3 && currentMonth < 6) {
            selectedQuartal = 'Q2';
        } else if (currentMonth >= 6 && currentMonth < 9) {
            selectedQuartal = 'Q3';
        } else {
            selectedQuartal = 'Q4';
        }

        quarterselectturnus = '';
    }


    // Render page with Quartal and Year selection and additional buttons
    content.innerHTML = `
        <h2>Anlage: ${anlageData.name} (Anlagen-Nr: ${anlageData.id})</h2>
	<div>
	${quarterselectturnus}

            <label for="year-select">Wählen Sie das Prüf-Jahr:</label>
            <select id="year-select">
                ${yearOptions}
            </select>

            <button id="reset-melderpunkte" class="btn-class">Meldepunkte für das Jahr löschen</button>
        </div>
        <div id="quarter-buttons">
        <label for="quarter-filter">Ansichtsfilter:</label>
        <button id="filter-open" class="btn-class">${showOnlyOpen ? "Nur offene werden angezeigt" : "Alle werden angezeigt"}</button>
        ${quarterFilterHtml}
        <button class="quarter-filter ${filterByQuarter === null ? 'active' : ''}" data-quarter="all">Alle</button>


	<div style="margin-top:5px">
	<label for="text-field-1">Akku Einbaudatum:</label>
        	<input type="text" id="text-field-1" value="${anlageData.textField1 || ''}" />
	</div>
	<div style="margin-top:5px">
	<label for="text-field-2">Besonderheiten:</label>
        	<input style="width: 25%" "type="text" id="text-field-2" value="${anlageData.textField2 || ''}" />
	</div>

        <div id="additional-points" class="additional-points-container">
            ${['Alarmierung:', 'Steuerung:', 'Erdschluss:', 'Kurzschluss:', 'Drahtbruch:', 'FSD Heizung:'].map(point => `
                <div class="additional-point">
                    <label>${point}</label>
                    <div class="checkbox-group">
                        ${anlageData.turnus === 'quarterly' ? `
                            <label>Q1</label><input type="checkbox" class="additional-checkbox" data-point="${point}" data-quarter="Q1" ${anlageData.additionalPoints?.[point]?.[selectedJahr]?.includes('Q1') ? 'checked' : ''}>
                            <label>Q2</label><input type="checkbox" class="additional-checkbox" data-point="${point}" data-quarter="Q2" ${anlageData.additionalPoints?.[point]?.[selectedJahr]?.includes('Q2') ? 'checked' : ''}>
                            <label>Q3</label><input type="checkbox" class="additional-checkbox" data-point="${point}" data-quarter="Q3" ${anlageData.additionalPoints?.[point]?.[selectedJahr]?.includes('Q3') ? 'checked' : ''}>
                            <label>Q4</label><input type="checkbox" class="additional-checkbox" data-point="${point}" data-quarter="Q4" ${anlageData.additionalPoints?.[point]?.[selectedJahr]?.includes('Q4') ? 'checked' : ''}>
                        ` : anlageData.turnus === 'semi-annual' ? `
                            <label>H1</label><input type="checkbox" class="additional-checkbox" data-point="${point}" data-quarter="H1" ${anlageData.additionalPoints?.[point]?.[selectedJahr]?.includes('H1') ? 'checked' : ''}>
                            <label>H2</label><input type="checkbox" class="additional-checkbox" data-point="${point}" data-quarter="H2" ${anlageData.additionalPoints?.[point]?.[selectedJahr]?.includes('H2') ? 'checked' : ''}>
                        ` : `
                            <input type="checkbox" class="additional-checkbox" data-point="${point}" data-quarter="annual" ${anlageData.additionalPoints?.[point]?.[selectedJahr]?.includes('annual') ? 'checked' : ''}>
                        `}
                    </div>
                </div>
            `).join('')}
        </div>

    </div>
        <div style="margin-top: 1.5em" id="anlage-pruefung">
            ${anlageData.meldergruppen
                .filter(gruppe => gruppe.meldepunkte.length > 0) // Nur Meldegruppen mit Meldepunkten anzeigen
                .map(
                    (gruppe) => ` 
                <div>
                    <h4 style="margin-top: 0.5em; margin-bottom: 0px">${gruppe.name} (${gruppe.type}) ${gruppe.zd ? "(ZD)" : ""}</h4>
                    <div class="melder-container">
                        ${gruppe.meldepunkte
                            .filter((melder) => {
  
  // Filter auf Jahr und Quartal anwenden
    if (filterByQuarter && filterByQuarter !== 'all') {
        // Hier prüfen wir, ob das Quartal im 'geprüft' Feld für das ausgewählte Jahr existiert
        return (
            melder.geprüft.hasOwnProperty(selectedJahr) && 
            melder.geprüft[selectedJahr] === filterByQuarter // Nur wenn das Quartal im geprüften Jahr vorhanden ist
        );
    }
    return true; // Ohne Quartalsfilter alle anzeigen
})

                            .filter((melder) => {
                                // "Nur offene" Filter anwenden
                                if (showOnlyOpen) {
                                    return !melder.geprüft[selectedJahr]; // Nur ungeprüfte anzeigen
                                }
                                return true;
                            })
                            .map(
                                (melder) => ` 
                            <span>
                                ${melder.id}
                                <input style="margin-left:0px; margin-right: 10px" type="checkbox" class="melder-checkbox" data-group="${gruppe.name}" data-melder="${melder.id}" ${melder.geprüft[selectedJahr] ? 'checked' : ''}>
                            </span>
                        `).join('') }
                    </div>
                </div>
            `).join('') }
        </div>
    `;
    

	// Event listener für die Änderungen der Textfelder
    	document.getElementById("text-field-1").addEventListener("change", async (e) => {
        const newValue = e.target.value;
        await setDoc(doc(db, "anlagen", anlageId), {
            ...anlageData,
            textField1: newValue
        }, { merge: true });
    });

    document.getElementById("text-field-2").addEventListener("change", async (e) => {
        const newValue = e.target.value;
        await setDoc(doc(db, "anlagen", anlageId), {
            ...anlageData,
            textField2: newValue
        }, { merge: true });
    });

    // Event listener for quartal selection
    const quartalSelect = document.getElementById("quartal-select");
    if (quartalSelect) {
        quartalSelect.addEventListener("change", (e) => {
            selectedQuartal = e.target.value;
        });
    }

    // Event listener for year selection
    document.getElementById("year-select").addEventListener("change", (e) => {
        selectedJahr = parseInt(e.target.value, 10);
        showAnlagePruefung(anlageId); // Re-render with selected year
    });

    // Event listeners für Quartalsfilter
document.querySelectorAll(".quarter-filter").forEach((button) => {
    button.addEventListener("click", (e) => {
        const quarter = e.target.getAttribute("data-quarter");
        filterByQuarter = quarter === 'all' ? null : quarter;

        // Entferne die aktive Klasse von allen Buttons
        document.querySelectorAll(".quarter-filter").forEach((btn) => {
            btn.classList.remove("active");
        });

        // Füge die aktive Klasse dem geklickten Button hinzu
        e.target.classList.add("active");

        showAnlagePruefung(anlageId); // Seite mit dem gewählten Filter neu rendern
    });
});

    // Handle open filter toggle
document.getElementById("filter-open").addEventListener("click", () => {
    showOnlyOpen = !showOnlyOpen;

    const filterOpenButton = document.getElementById("filter-open");
    filterOpenButton.classList.toggle("active", showOnlyOpen); // Active-Klasse basierend auf Zustand

    showAnlagePruefung(anlageId); // Re-render page
});


    // Handle reset melderpunkte button click
    document.getElementById("reset-melderpunkte").addEventListener("click", async () => {
        await resetMelderpunkte(anlageId, anlageData);
    });

 // Handle melder checkbox toggling
document.querySelectorAll(".melder-checkbox").forEach((checkbox) => {
    checkbox.addEventListener("change", async (e) => {
        const groupName = e.target.getAttribute("data-group");
        const melderId = parseInt(e.target.getAttribute("data-melder"), 10);
        const checked = e.target.checked;

        if (!selectedQuartal && anlageData.turnus !== 'annual') {
            alert("Bitte wählen Sie zuerst das Quartal aus!");
            e.target.checked = !checked; // Rückgängig machen, falls kein Quartal ausgewählt ist
            return;
        }

        if (!selectedJahr) {
            alert("Bitte wählen Sie zuerst das Jahr aus!");
            e.target.checked = !checked; // Rückgängig machen, falls kein Jahr ausgewählt ist
            return;
        }

        // Lokale Kopie der aktuellen Daten für die Gruppe
        const gruppe = anlageData.meldergruppen.find(g => g.name === groupName);
        if (!gruppe) {
            console.error(`Gruppe ${groupName} nicht gefunden.`);
            return;
        }

        // Finden des betreffenden Melders
        const melder = gruppe.meldepunkte.find(m => m.id === melderId);
        if (!melder) {
            console.error(`Melder mit ID ${melderId} nicht gefunden.`);
            return;
        }

        // Lokales Update der Prüfungsdaten für den Melder
        const updatedGeprueft = { ...melder.geprüft }; // Kopie der bestehenden Prüfungen

        // Für jährliche Anlagen speichern wir die Prüfung ohne Quartal
        if (anlageData.turnus === 'annual') {
            if (checked) {
                updatedGeprueft[selectedJahr] = 'Jährlich';  // Das Jahr als Wert für die Prüfung
            } else {
                delete updatedGeprueft[selectedJahr]; // Falls die Checkbox deaktiviert wird, entfernen wir das Jahr
            }
        } else {
            // Für andere Turnusse (Quartal, Halbjahr) speichern wir auch das Quartal
            if (checked) {
                updatedGeprueft[selectedJahr] = selectedQuartal; // Das Quartal wird gesetzt
            } else {
                delete updatedGeprueft[selectedJahr]; // Falls die Checkbox deaktiviert wird, entfernen wir das Quartal
            }
        }

        melder.geprüft = updatedGeprueft; // Prüfungen des Melders aktualisieren

        try {
            // Nur die geänderte Gruppe synchronisieren
            await setDoc(doc(db, "anlagen", anlageId), {
                meldergruppen: anlageData.meldergruppen, // Aktualisierte Gruppen
            }, { merge: true }); // Nur die geänderten Felder speichern

            console.log(`Meldepunkt ${melderId} in Gruppe ${groupName} erfolgreich aktualisiert.`);
        } catch (error) {
            console.error("Fehler beim Speichern:", error);
            alert("Fehler beim Aktualisieren des Meldepunktes.");
        }
    });
});

    // Handle additional points checkbox toggling
    document.querySelectorAll(".additional-checkbox").forEach((checkbox) => {
        checkbox.addEventListener("change", async (e) => {
            const point = e.target.getAttribute("data-point");
            const quarter = e.target.getAttribute("data-quarter");
            const checked = e.target.checked;

            if (!selectedQuartal && anlageData.turnus !== 'annual') {
                alert("Bitte wählen Sie zuerst das Quartal aus!");
                e.target.checked = !checked; // Rückgängig machen, falls kein Quartal ausgewählt ist
                return;
            }

            if (!selectedJahr) {
                alert("Bitte wählen Sie zuerst das Jahr aus!");
                e.target.checked = !checked; // Rückgängig machen, falls kein Jahr ausgewählt ist
                return;
            }

            // Lokales Update der Prüfungsdaten für den Punkt
            const updatedPoints = { ...anlageData.additionalPoints }; // Kopie der bestehenden Prüfungen

            if (!updatedPoints[point]) {
                updatedPoints[point] = {};
            }

            if (!updatedPoints[point][selectedJahr]) {
                updatedPoints[point][selectedJahr] = [];
            }

            if (checked) {
                updatedPoints[point][selectedJahr].push(quarter); // Das Quartal wird gesetzt
            } else {
                updatedPoints[point][selectedJahr] = updatedPoints[point][selectedJahr].filter(q => q !== quarter); // Falls die Checkbox deaktiviert wird, entfernen wir das Quartal
            }

            anlageData.additionalPoints = updatedPoints; // Prüfungen des Punktes aktualisieren

            try {
                // Nur die geänderten Punkte synchronisieren
                await setDoc(doc(db, "anlagen", anlageId), {
                    additionalPoints: anlageData.additionalPoints, // Aktualisierte Punkte
                }, { merge: true }); // Nur die geänderten Felder speichern

                console.log(`Punkt ${point} erfolgreich aktualisiert.`);
            } catch (error) {
                console.error("Fehler beim Speichern:", error);
                alert("Fehler beim Aktualisieren des Punktes.");
            }
        });
    });
}


// Helper function to calculate progress for the current year
function calculateProgress(meldergruppen) {
    const currentYear = new Date().getFullYear(); // Aktuelles Jahr ermitteln

    const total = meldergruppen.reduce(
        (sum, gruppe) => sum + gruppe.meldepunkte.length,
        0
    );

    const checked = meldergruppen.reduce(
        (sum, gruppe) =>
            sum +
            gruppe.meldepunkte.filter(
                (melder) => melder.geprüft[currentYear]
            ).length,
        0
    );

    // Verhindert Division durch Null, falls es keine Meldepunkte gibt
    return total > 0 ? ((checked / total) * 100).toFixed(2) : "0.00";
}

// Funktion zum Zurücksetzen der Meldepunkte für das gewählte Jahr
async function resetMelderpunkte(anlageId, anlageData) {
    const updatedGruppen = anlageData.meldergruppen.map((gruppe) => ({
        ...gruppe,
        meldepunkte: gruppe.meldepunkte.map((melder) => ({
            ...melder,
            // Nur das gewählte Jahr zurücksetzen, nicht alle Jahre
            geprüft: {
                ...Object.fromEntries(
                    Object.entries(melder.geprüft).filter(
                        ([year]) => parseInt(year) !== selectedJahr
                    )
                ),
            },
            quartal: melder.quartal === selectedQuartal ? null : melder.quartal,
        })),
    }));

    try {
        await setDoc(doc(db, "anlagen", anlageId), {
            ...anlageData,
            meldergruppen: updatedGruppen,
        });

        alert(`Die Meldepunkte für das Jahr ${selectedJahr} wurden zurückgesetzt.`);
        showAnlagePruefung(anlageId); // Seite nach dem Zurücksetzen neu laden
    } catch (error) {
        alert(`Fehler beim Zurücksetzen der Meldepunkte: ${error.message}`);
    }
}
