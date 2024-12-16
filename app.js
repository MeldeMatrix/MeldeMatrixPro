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
    apiKey: "AIzaSyAN2ZXKYzFoJ0o__qAyVxubjit3wrlEGlo",
    authDomain: "meldepunktpro.firebaseapp.com",
    projectId: "meldepunktpro",
    storageBucket: "meldepunktpro.appspot.com",
    messagingSenderId: "1084931878712",
    appId: "1:1084931878712:web:bfa5e31c03fad5e1015bcd"
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

// Event Listeners
document.getElementById("login-button").addEventListener("click", async () => {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    try {
        await signInWithEmailAndPassword(auth, email, password);
        alert("Login erfolgreich!");
    } catch (error) {
        alert(`Fehler beim Anmelden: ${error.message}`);
    }
});

document.getElementById("logout-button").addEventListener("click", async () => {
    await signOut(auth);
    alert("Abgemeldet!");
});

document.getElementById("search-submit").addEventListener("click", showSearchPage);
document.getElementById("create-submit").addEventListener("click", showCreatePage);

// Authentication State Change
onAuthStateChanged(auth, (user) => {
    if (user) {
        authSection.style.display = "none";
        menuSection.style.display = "block";

	// Nach dem Login direkt zur Seite "Anlage Suchen" navigieren
        showSearchPage();  // Zeige die Such-Seite an
    } else {
        authSection.style.display = "block";
        menuSection.style.display = "none";
        content.innerHTML = "<p>Bitte loggen Sie sich ein.</p>";
    }
});

// Event listener für den Refresh-Button
document.getElementById("refresh-button").addEventListener("click", () => {
    const currentPage = content.innerHTML;

    // Überprüfen, welche Seite aktuell angezeigt wird
    if (currentPage.includes("Anlage Suchen")) {
        showSearchPage(); // Zeige die Such-Seite an
    } else if (currentPage.includes("Neue Anlage Erstellen")) {
        showCreatePage(); // Zeige die Erstellungs-Seite an
    } else if (currentPage.includes("Anlage:")) {
        // Hier müsste die angezeigte Anlage geladen werden. Verwende currentAnlageId, wenn sie gesetzt ist.
        if (currentAnlageId) {
            showAnlagePruefung(currentAnlageId); // Zeige die Seite für die Prüfung der spezifischen Anlage an
        } else {
            alert("Keine gültige Anlage-ID gefunden.");
        }
    }
});

// Search Page
async function showSearchPage() {
    content.innerHTML = `
        <h2>Anlage Suchen</h2>
        <input type="text" id="search-term" placeholder="Anlagen-ID oder Name">
        <button id="perform-search">Suchen</button>
        <div id="search-results"></div>
    `;

    // Neu binden der Event-Listener bei Suche
    document.getElementById("perform-search").addEventListener("click", async () => {
        const searchTerm = document.getElementById("search-term").value.trim().toLowerCase();
        if (!searchTerm) {
            alert("Bitte einen Suchbegriff eingeben.");
            return;
        }

        try {
            const q = query(collection(db, "anlagen"));
            const querySnapshot = await getDocs(q);
            const resultsContainer = document.getElementById("search-results");

            resultsContainer.innerHTML = ""; // Leeren Sie die Ergebnisse vorher

            let foundResults = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                const nameLower = data.name.toLowerCase();
                const idLower = data.id.toLowerCase();

                // Überprüfung auf teilweise Übereinstimmungen im Namen oder ID
                if (nameLower.includes(searchTerm) || idLower.includes(searchTerm)) {
                    foundResults.push(data);
                }
            });

            if (foundResults.length === 0) {
                resultsContainer.innerHTML = "<p>Keine Ergebnisse gefunden.</p>";
            } else {
                foundResults.forEach((data) => {
                    resultsContainer.innerHTML += `
                        <div>
                            <p><strong>${data.name}</strong> (ID: ${data.id})</p>
                            <p>Meldergruppen: ${data.meldergruppen.length}</p>
                            <p>Geprüft: ${calculateProgress(data.meldergruppen)}%</p>
                            <button class="open-anlage" data-id="${data.id}">Zur Prüfung</button>
                        </div>
                        <hr>
                    `;
                });

                // Event listeners für die Buttons neu binden
                document.querySelectorAll(".open-anlage").forEach((button) => {
                    button.addEventListener("click", (e) => {
                        const anlageId = e.target.getAttribute("data-id");
                        currentAnlageId = anlageId;  // Die ID speichern
                        showAnlagePruefung(anlageId);
                    });
                });
            }
        } catch (error) {
            alert(`Fehler bei der Suche: ${error.message}`);
        }
    });
}

// Create Page
async function showCreatePage() {
    content.innerHTML = `
        <h2>Neue Anlage Erstellen</h2>
        <input type="text" id="new-name" placeholder="Anlagenname">
        <input type="text" id="new-id" placeholder="Anlagen-ID">
        <input type="number" id="group-count" placeholder="Anzahl Meldergruppen">
        <button id="create-new">Anlage Erstellen</button>
    `;

    // Event listener für das Erstellen der Anlage neu binden
    document.getElementById("create-new").addEventListener("click", async () => {
        const name = document.getElementById("new-name").value;
        const id = document.getElementById("new-id").value;
        const groupCount = parseInt(document.getElementById("group-count").value, 10);

        const meldergruppen = Array.from({ length: groupCount }, (_, i) => ({
            name: `MG${i + 1}`,
            meldepunkte: Array.from({ length: 32 }, (_, j) => ({
                id: j + 1,
                geprüft: false,
                quartal: null, // Quartal wird für jeden Melder gespeichert
            })),
        }));

        try {
            await setDoc(doc(db, "anlagen", id), { name, id, meldergruppen });
            alert("Anlage erfolgreich erstellt!");
        } catch (error) {
            alert(`Fehler beim Erstellen der Anlage: ${error.message}`);
        }
    });
}

// Global state variables for filter and status
let selectedQuartal = 'Q1';  // Standardwert für das Quartal
let showOnlyOpen = false;    // Zu verwendender Filter für offene Punkte

async function showAnlagePruefung(anlageId) {
    const anlageDoc = await getDoc(doc(db, "anlagen", anlageId));
    if (!anlageDoc.exists()) {
        alert("Anlage nicht gefunden!");
        return;
    }

    const anlageData = anlageDoc.data();

    // Render page with Quartal selection
    content.innerHTML = `
        <h2>Anlage: ${anlageData.name} (ID: ${anlageData.id})</h2>
        <div>
            <label for="quartal-select">Wählen Sie das Quartal:</label>
            <select id="quartal-select">
                <option value="Q1" ${selectedQuartal === 'Q1' ? 'selected' : ''}>Q1</option>
                <option value="Q2" ${selectedQuartal === 'Q2' ? 'selected' : ''}>Q2</option>
                <option value="Q3" ${selectedQuartal === 'Q3' ? 'selected' : ''}>Q3</option>
                <option value="Q4" ${selectedQuartal === 'Q4' ? 'selected' : ''}>Q4</option>
            </select>
        </div>
        <button id="filter-open">${showOnlyOpen ? "Alle Punkte anzeigen" : "Nur offene Punkte anzeigen"}</button>
        <button id="reset-melderpunkte">Alle Melderpunkte auf 'Geprüft: false' und 'Quartal: null' setzen</button>
        <div id="anlage-pruefung">
            ${anlageData.meldergruppen
                .map(
                    (gruppe) => `
                <div>
                    <h3>${gruppe.name}</h3>
                    <div class="melder-container">
                        ${gruppe.meldepunkte
                            .filter((melder) =>
                                showOnlyOpen
                                    ? !melder.geprüft
                                    : true
                            )
                            .map(
                                (melder) => `
                            <span>
                                ${melder.id}
                                <input type="checkbox" class="melder-checkbox" data-group="${gruppe.name}" data-melder="${melder.id}" ${melder.geprüft ? 'checked' : ''}>
                            </span>
                        `).join('') }
                    </div>
                </div>
            `).join('') }
        </div>
    `;

    // Bind Quartal selection event
    document.getElementById("quartal-select").addEventListener("change", (e) => {
        selectedQuartal = e.target.value;
    });

    // Handle open filter toggle
    document.getElementById("filter-open").addEventListener("click", () => {
        showOnlyOpen = !showOnlyOpen;
        showAnlagePruefung(anlageId); // Seite neu laden
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

            if (!selectedQuartal) {
                alert("Bitte wählen Sie zuerst das Quartal aus!");
                return;
            }

            // Update Melderpunkt with quartal and status
            const updatedGruppen = anlageData.meldergruppen.map((gruppe) => {
                if (gruppe.name === groupName) {
                    return {
                        ...gruppe,
                        meldepunkte: gruppe.meldepunkte.map((melder) => {
                            if (melder.id === melderId) {
                                return {
                                    ...melder,
                                    geprüft: checked, // Status des Melders ändern
                                    quartal: selectedQuartal, // Quartal speichern
                                };
                            }
                            return melder;
                        }),
                    };
                }
                return gruppe;
            });

            // Update the database
            await setDoc(doc(db, "anlagen", anlageId), {
                ...anlageData,
                meldergruppen: updatedGruppen,
            });

            // Re-render the page after update
            anlageData.meldergruppen = updatedGruppen; // Aktuelle Daten aktualisieren
            showAnlagePruefung(anlageId); // Seite neu laden
        });
    });
}

// Helper Function: Calculate Progress
function calculateProgress(meldergruppen) {
    const total = meldergruppen.reduce(
        (sum, gruppe) => sum + gruppe.meldepunkte.length,
        0
    );
    const checked = meldergruppen.reduce(
        (sum, gruppe) =>
            sum +
            gruppe.meldepunkte.filter((melder) => melder.geprüft).length,
        0
    );
    return ((checked / total) * 100).toFixed(2);
}

// Function to reset all Melderpunkte
async function resetMelderpunkte(anlageId, anlageData) {
    const updatedGruppen = anlageData.meldergruppen.map((gruppe) => ({
        ...gruppe,
        meldepunkte: gruppe.meldepunkte.map((melder) => ({
            ...melder,
            geprüft: false,
            quartal: null,
        })),
    }));

    // Update the database with reset values
    await setDoc(doc(db, "anlagen", anlageId), {
        ...anlageData,
        meldergruppen: updatedGruppen,
    });

    alert("Alle Melderpunkte wurden auf 'Geprüft: false' und 'Quartal: null' gesetzt.");
    showAnlagePruefung(anlageId); // Seite neu laden
}
